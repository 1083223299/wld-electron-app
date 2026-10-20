import { defineStore } from 'pinia';
import {
  createNotifySocket,
  NOTIFY_TYPE,
  formatTime,
  collectStuckOrders,
  buildStuckMessage,
  makeMessage,
} from '../api/notifySocket';
import { playNotifySound } from '../utils/notifySound';
import { renderTrayBadgeDataUrl } from '../utils/trayBadge';

/**
 * 系统通知 Store
 * ---------------------------------------------------------------
 * - items    通知列表（新在前，持久化，最多保留 MAX_ITEMS 条）
 * - unread   未读数（由 items 推导，getter）
 * - bubbles  实时消息气泡（不持久化，WS 收到消息自动弹出）
 * - 收到消息时：入列 → 弹气泡 → 通过 notifyBridge 通知主进程闪托盘
 * ---------------------------------------------------------------
 */

const MAX_ITEMS = 200;
const BUBBLE_MAX = 3;
const BUBBLE_DURATION = 8000;

/** 把通道收到的任意消息规范化成标准通知项 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw;
  return {
    id: src.id || `nt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: [NOTIFY_TYPE.STUCK, NOTIFY_TYPE.HANDOVER, NOTIFY_TYPE.SYSTEM].includes(src.type)
      ? src.type
      : NOTIFY_TYPE.SYSTEM,
    title: src.title || '系统通知',
    content: src.content || '',
    orderNos: Array.isArray(src.orderNos)
      ? src.orderNos
      : src.orderNo
        ? [src.orderNo]
        : [],
    mentions: Array.isArray(src.mentions) ? src.mentions : [],
    time: src.time || formatTime(),
    read: !!src.read,
  };
}

export const useNotifyStore = defineStore('notify', {
  state: () => ({
    /** 通知列表（新在前） */
    items: [],
    /** 实时消息气泡（不持久化） */
    bubbles: [],
    /** 通道是否已连接 */
    connected: false,
    /** 通道模式：'mock' 本地模拟 / 'ws' 真实 WebSocket */
    mode: '',
    /** 是否已初始化（避免重复连接） */
    initialized: false,
    /** 收到新消息的脉冲计数（每次非静默消息 +1，用于铃铛晃动等动画触发） */
    pulse: 0,
  }),

  getters: {
    unreadCount: (s) => s.items.filter((i) => !i.read).length,
  },

  actions: {
    /**
     * 初始化即时通讯通道（应用启动时调用一次）
     * 本地模拟模式：自动扫描卡单订单生成通知；真实模式：连接 WS 并自动重连
     */
    init() {
      if (this.initialized) return;
      this.initialized = true;

      const client = createNotifySocket({
        onMessage: (msg, opts) => this.handleIncoming(msg, opts),
        onStatus: (status) => {
          this.connected = status === 'connected';
        },
      });

      this.mode = client.mode;
      this._close = client.close;

      // 启动时同步一次托盘角标（持久化中可能有未读）
      this.syncTrayBadge();
    },

    /**
     * 收到一条新消息：入列 + 未读 + （非静默时）弹气泡 + 通知主进程闪托盘
     * @param {Object} raw 通道原始消息
     * @param {{silent?: boolean}} opts silent=true 时不弹气泡不闪托盘（仅入列）
     */
    handleIncoming(raw, opts = {}) {
      const item = normalize(raw);
      if (!item) return;

      // 卡单预警按订单号去重：同一订单重复提醒时更新原记录
      const isStuck = item.type === NOTIFY_TYPE.STUCK && item.orderNos.length > 0;
      if (isStuck) {
        const prev = this.items.find(
          (i) => i.type === NOTIFY_TYPE.STUCK && i.orderNos[0] === item.orderNos[0]
        );
        if (prev) {
          prev.title = item.title;
          prev.content = item.content;
          prev.time = item.time;
          prev.read = false;
          if (!opts.silent) this.notifyUser(prev);
          this.syncTrayBadge();
          return;
        }
      }

      this.items.unshift(item);
      if (this.items.length > MAX_ITEMS) this.items.splice(MAX_ITEMS);

      if (!opts.silent) this.notifyUser(item);
      this.syncTrayBadge();
    },

    /** 弹气泡 + 播放提示音 + 通知主进程（托盘闪烁 / 可选系统弹窗） */
    notifyUser(item) {
      const bubble = {
        id: `b-${item.id}`,
        type: item.type,
        title: item.title,
        content: item.content,
        orderNos: item.orderNos.slice(),
        mentions: item.mentions.slice(),
        time: item.time,
      };
      this.bubbles.push(bubble);
      if (this.bubbles.length > BUBBLE_MAX) {
        this.bubbles.splice(0, this.bubbles.length - BUBBLE_MAX);
      }
      setTimeout(() => this.dismissBubble(bubble.id), BUBBLE_DURATION);

      // 铃铛晃动动画触发信号（顶部栏监听）
      this.pulse += 1;

      // 微信式提示音
      playNotifySound();

      // 通知主进程：闪托盘 + 常驻未读列表冒泡
      if (window.notifyBridge && window.notifyBridge.notifyIncoming) {
        window.notifyBridge.notifyIncoming({
          id: item.id,
          title: item.title,
          body: item.content,
          type: item.type,
          time: item.time,
          mentions: item.mentions.slice(),
        });
      }
    },

    /** 标记单条已读 */
    markRead(id) {
      const item = this.items.find((i) => i.id === id);
      if (item) item.read = true;
      this.syncTrayBadge();
    },

    /** 全部标记已读，并停止托盘闪烁、清除托盘角标 */
    markAllRead() {
      this.items.forEach((i) => {
        i.read = true;
      });
      if (window.notifyBridge && window.notifyBridge.clearFlash) {
        window.notifyBridge.clearFlash();
      }
      this.syncTrayBadge();
    },

    /** 关闭指定气泡 */
    dismissBubble(id) {
      const idx = this.bubbles.findIndex((b) => b.id === id);
      if (idx > -1) this.bubbles.splice(idx, 1);
    },

    /** 清空所有气泡（进入系统通知页时调用） */
    clearBubbles() {
      this.bubbles.splice(0);
    },

    /**
     * 同步托盘状态：角标气泡（未读数 Canvas 图标）+ 未读列表（托盘悬停弹窗数据源）
     */
    async syncTrayBadge() {
      if (!window.notifyBridge) return;
      const count = this.unreadCount;
      if (count > 0) {
        if (window.notifyBridge.setTrayBadge) {
          const dataUrl = await renderTrayBadgeDataUrl(count);
          if (dataUrl) {
            window.notifyBridge.setTrayBadge({ count, dataUrl });
          }
        }
      } else if (window.notifyBridge.setTrayBadge) {
        window.notifyBridge.setTrayBadge({ count: 0, dataUrl: '' });
      }
      // 未读列表（托盘悬停弹窗 / 常驻冒泡列表）：最多 50 条，内容截取 60 字
      if (window.notifyBridge.setTrayList) {
        const items = this.items
          .filter((i) => !i.read)
          .slice(0, 50)
          .map((i) => ({
            id: i.id,
            type: i.type,
            title: i.title,
            content: i.content.length > 60 ? `${i.content.slice(0, 60)}…` : i.content,
            time: i.time,
            mentions: i.mentions.slice(0, 5),
          }));
        window.notifyBridge.setTrayList({ count: items.length, items });
      }
    },

    /**
     * 手动模拟推送一条卡单预警（本地模拟模式下的演示按钮）
     * 用于验证：消息冒泡 + 托盘图标闪烁
     */
    pushDemo() {
      if (this.mode !== 'mock') return;
      const stuck = collectStuckOrders();
      if (stuck.length) {
        this.handleIncoming(buildStuckMessage(stuck[0]));
      } else {
        this.handleIncoming(
          makeMessage({
            type: NOTIFY_TYPE.HANDOVER,
            title: '交接提醒',
            content: '李四 提交了新的交接日志并 @了你：请关注订单 2455501 的处理进度。',
            orderNos: ['2455501'],
            mentions: ['李四'],
          })
        );
      }
    },
  },

  persist: {
    key: 'futurecave-notify',
    storage: localStorage,
    pick: ['items'],
  },
});
