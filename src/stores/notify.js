import { defineStore } from 'pinia';
import { watch } from 'vue';
import { notifyConfig } from '../config/env';
import {
  createNotifySocket,
  createAdminAlertSocket,
  WS_MSG_TYPE,
  NOTIFY_TYPE,
  formatTime,
  collectStuckOrders,
  buildStuckMessage,
  makeMessage,
} from '../api/notifySocket';
import { sceneToType, notifyApi, normalizeNotificationPage } from '../api/modules/notification';
import { useUserStore } from './user';
import { playNotifySound } from '../utils/notifySound';
import { renderTrayBadgeDataUrl } from '../utils/trayBadge';

/**
 * 系统通知 Store
 * ---------------------------------------------------------------
 * - items    通知列表（新在前，持久化，最多保留 MAX_ITEMS 条）
 * - unread   未读数（后端权威，随 WS UNREAD / 列表接口刷新）
 * - badge    角标文本（后端权威：未读 <=99 数字字符串，>99 为 '99+'）
 * - bubbles  实时消息气泡（不持久化，WS 收到消息自动弹出）
 * - 收到消息时：入列 → 弹气泡 → 通过 notifyBridge 通知主进程闪托盘
 * ---------------------------------------------------------------
 */

const MAX_ITEMS = 200;
const BUBBLE_MAX = 3;
const BUBBLE_DURATION = 8000;

/** 从登录 JWT 中解出稳定账号标识（loginId，如 ADMIN:11；同账号跨登录不变） */
function extractLoginId(token = '') {
  try {
    const part = String(token).split('.')[1];
    if (!part) return '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const data = JSON.parse(json);
    return data.loginId || (data.loginType ? `${data.loginType}:${data.name || ''}` : '');
  } catch {
    return '';
  }
}

/** 把通道收到的任意消息规范化成标准通知项（兼容后端 /ws/notify 与旧模拟消息） */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw;
  return {
    id: src.id || `nt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: [NOTIFY_TYPE.STUCK, NOTIFY_TYPE.HANDOVER, NOTIFY_TYPE.SYSTEM].includes(src.type)
      ? src.type
      : sceneToType(src.scene),
    title: src.title || '系统通知',
    content: src.content || '',
    orderNos: Array.isArray(src.orderNos)
      ? src.orderNos
      : src.orderNo
        ? [src.orderNo]
        : src.orderId
          ? [src.orderId]
          : [],
    mentions: Array.isArray(src.mentions) ? src.mentions : [],
    // 展示用相对时间（后端 timeText）；无则回落到本地格式化
    time: src.timeText || src.time || src.createdAt || formatTime(),
    sceneLabel: src.sceneLabel || '',
    orderId: src.orderId || null,
    jumpTarget: src.jumpTarget || '',
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
    /** 后端权威未读角标（字符串：'3' / '99+'；''=未推送，回落 items 推导） */
    badge: '',
    /** 后端权威未读数（数字，角标解析用） */
    unread: 0,
    /**
     * 离线消息提醒时间戳（按登录账号隔离，毫秒）：登录/重连时对比该账号的记录，
     * 仅对「该账号创建时间晚于上次提醒」的未读消息触发提醒（管理员/客服各自独立）
     */
    lastRemindTsByUser: {},
  }),

  getters: {
    /** 铃铛/托盘数字角标：后端 badge 优先，未推送时由 items 推导 */
    unreadCount: (s) => {
      if (s.badge !== '') {
        const n = Number(String(s.badge).replace('+', ''));
        return Number.isFinite(n) ? n : s.items.filter((i) => !i.read).length;
      }
      return s.items.filter((i) => !i.read).length;
    },
    /** 铃铛角标展示文本：后端 badge（'99+'）优先 */
    badgeText: (s) => {
      if (s.badge !== '') return s.badge;
      const n = s.items.filter((i) => !i.read).length;
      return n > 99 ? '99+' : n > 0 ? String(n) : '';
    },
  },

  actions: {
    /**
     * 登出时重置当前账号的展示状态（角标/未读/列表/气泡/连接态）：
     * 防止上一个账号的角标残留到下一个登录账号。
     * lastRemindTsByUser 不重置（各账号离线提醒记录跨会话保留，避免重复提醒历史消息）。
     */
    resetState() {
      this.items = [];
      this.bubbles = [];
      this.badge = '';
      this.unread = 0;
      this.pulse = 0;
      this.connected = false;
      this.mode = '';
      if (window.notifyBridge) {
        try {
          window.notifyBridge.setTrayBadge('');
          window.notifyBridge.setTrayList([]);
          window.notifyBridge.clearFlash();
        } catch {
          /* 主进程方法缺失时忽略 */
        }
      }
    },

    /**
     * 初始化即时通讯通道（应用启动时调用一次）
     * 本地模拟模式：自动扫描卡单订单生成通知；真实模式：连接 WS 并自动重连。
     * 未登录（token 为空）时不连接；登录成功/登出通过 watch token 自动建连/断开。
     * 同时启动后台弹框通道（/ws/admin，纯文本「标题:内容」）。
     */
    init() {
      if (this.initialized) return;
      this.initialized = true;

      const userStore = useUserStore();
      this._startChannel = () => {
        if (this._close) {
          try {
            this._close();
          } catch {
            /* 忽略 */
          }
          this._close = null;
        }
        if (!userStore.token) {
          // 未登录：保持断开，等待登录后重连
          this.connected = false;
          this.cancelUnreadPolling();
          return;
        }
        const client = createNotifySocket({
          onMessage: (msg, opts) => this.handleIncoming(msg, opts),
          onStatus: (status) => {
            this.connected = status === 'connected';
            if (status === 'connected') {
              // 重连成功：取消兜底轮询，并立即校准一次角标（补断连期间错过的推送）
              this.cancelUnreadPolling();
              this.refreshUnreadOnce();
              // 离线/断线期间的新消息补提醒：托盘闪动 + 声音 + 托盘冒泡弹窗
              this.remindOfflineUnread();
            } else {
              // 断连：超过阈值后低频轮询角标保底（重连成功自动停止）
              this.scheduleUnreadPolling();
            }
          },
        });
        this.mode = client.mode;
        this._close = client.close;
      };

      // 后台弹框通道（/ws/admin）：收到纯文本「标题:内容」→ 弹系统气泡/托盘（不入通知列表）
      this._startAdminChannel = () => {
        if (this._closeAdmin) {
          try {
            this._closeAdmin();
          } catch {
            /* 忽略 */
          }
          this._closeAdmin = null;
        }
        if (!userStore.token) return;
        const client = createAdminAlertSocket({
          onMessage: (msg) => this.handleAdminAlert(msg),
          onStatus: () => {},
        });
        this._closeAdmin = client.close;
      };

      this._startChannel();
      this._startAdminChannel();

      // 登录/登出自动建连或断开
      this._stopTokenWatch = watch(
        () => userStore.token,
        (tok, prev) => {
          // 登出（token 清空）：清空本账号的角标/未读/列表/气泡，避免残留到下一个登录账号
          if (!tok) {
            this.resetState();
          }
          this._startChannel();
          this._startAdminChannel();
          // 登录成功（token 从空到有）：清掉上一账号/持久化残留的列表与角标，再检查离线消息补提醒
          if (tok && !prev) {
            this.items = [];
            this.bubbles = [];
            this.badge = '';
            this.unread = 0;
            this.remindOfflineUnread();
          }
        }
      );

      // 启动时同步一次托盘角标（持久化中可能有未读）
      this.syncTrayBadge();
    },

    /**
     * 后台弹框通知（/ws/admin，纯文本「标题:内容」）
     * 这类通知在通知列表里没有对应记录，仅弹系统气泡 + 闪托盘 + 提示音
     */
    handleAdminAlert(msg) {
      if (!msg || typeof msg !== 'object') return;
      const item = makeMessage({
        type: NOTIFY_TYPE.SYSTEM,
        title: msg.title || '系统通知',
        content: msg.content || '',
      });
      this.notifyUser(item);
    },

    /**
     * 重连成功后校准一次角标（补断连期间错过的推送；后端 unread 接口为权威）
     */
    async refreshUnreadOnce() {
      if (!useUserStore().token) return;
      try {
        const res = await notifyApi.unread();
        const d = res && res.data && typeof res.data === 'object' ? res.data : res;
        if (d && (d.unread != null || d.badge != null)) {
          this.applyBadge(d.unread, d.badge);
        }
      } catch {
        // 校准失败不影响主流程，等下一次连接/轮询
      }
    },

    /**
     * 离线/断线期间的新消息补提醒（登录成功 / 重连成功时调用）：
     * 按登录账号隔离记录 lastRemindTsByUser，对比该账号「创建时间晚于上次提醒」且未读的消息，
     * 逐条通知主进程（托盘闪动 + 托盘冒泡弹窗 + 常驻未读列表），并播放提示音。
     * 每次检查后更新该账号的提醒时间戳，天然去重（无新增则不提醒）。
     */
    async remindOfflineUnread() {
      if (!useUserStore().token) return;
      try {
        const userStore = useUserStore();
        // 账号标识：优先 user 对象（me 接口已返回时），否则从 token JWT 解 loginId，保证切账号各自独立
        const uid =
          userStore.user?.loginId ||
          userStore.user?.id ||
          extractLoginId(userStore.token) ||
          userStore.user?.name ||
          'guest';
        const since = Number((this.lastRemindTsByUser || {})[uid]) || 0;

        const res = await notifyApi.list({ page: 1, pageSize: 50 });
        const { list } = normalizeNotificationPage(res);
        const fresh = (Array.isArray(list) ? list : []).filter((item) => {
          if (item.readFlag !== 0) return false;
          const t = item.createdAt ? new Date(String(item.createdAt).replace(/-/g, '/')).getTime() : 0;
          return t > since;
        });

        if (fresh.length && window.notifyBridge) {
          fresh.forEach((item) => {
            if (window.notifyBridge.notifyIncoming) {
              window.notifyBridge.notifyIncoming({
                id: item.id,
                title: item.title || '系统通知',
                body: item.content || '',
                type: 'system',
                time: item.createdAt || '',
                mentions: [],
              });
            }
          });
          // 微信式提示音（多条只响一声）
          playNotifySound();
        }
        // 记录该账号的检查时间（无论是否有新增，均更新，避免重复提醒）
        this.lastRemindTsByUser = { ...(this.lastRemindTsByUser || {}), [uid]: Date.now() };
      } catch {
        // 检查失败不影响主流程，下次连接/登录再试
      }
    },

    /**
     * 断连超过阈值后启动低频角标轮询保底：
     * 每 pollIntervalMs 调一次未读角标接口，重连成功后自动取消
     * 阈值与间隔取 env.js notifyConfig（pollDelayMs / pollIntervalMs）
     */
    scheduleUnreadPolling() {
      if (this._unreadPollTimer || this._unreadPollDelayTimer) return; // 已在运行/已安排
      const delay = Number(notifyConfig.pollDelayMs) > 0 ? Number(notifyConfig.pollDelayMs) : 30000;
      const interval = Number(notifyConfig.pollIntervalMs) > 0 ? Number(notifyConfig.pollIntervalMs) : 30000;
      this._unreadPollDelayTimer = setTimeout(() => {
        this._unreadPollDelayTimer = null;
        this._unreadPollTimer = setInterval(() => this.refreshUnreadOnce(), interval);
        this.refreshUnreadOnce(); // 启动时立即补一次
      }, delay);
    },

    /** 取消兜底轮询（重连成功 / 登出时调用） */
    cancelUnreadPolling() {
      if (this._unreadPollDelayTimer) {
        clearTimeout(this._unreadPollDelayTimer);
        this._unreadPollDelayTimer = null;
      }
      if (this._unreadPollTimer) {
        clearInterval(this._unreadPollTimer);
        this._unreadPollTimer = null;
      }
    },

    /**
     * 应用后端权威角标（未读数 + 角标文本），并同步托盘
     * @param {number|string} unread 未读条数
     * @param {number|string} badge 角标文本（>99 为 '99+'，未传时由 unread 推导）
     */
    applyBadge(unread, badge) {
      const n = Number(unread) || 0;
      this.unread = n > 0 ? n : 0;
      // 角标归一化：0/'' 一律置空（角标为 0 时不显示），>0 时优先后端给的文本
      this.badge =
        n > 0 ? (badge != null && badge !== '' ? String(badge) : n > 99 ? '99+' : String(n)) : '';
      this.syncTrayBadge();
    },

    /**
     * 本地乐观减少角标（已读成功时调用，不等后端 UNREAD 推送，角标立即变）
     * 随后 WS UNREAD / 列表接口会以后端权威值校准，两者不冲突
     * @param {number} n 减少条数
     */
    decrementBadge(n = 1) {
      const d = Math.max(0, Number(n) || 0);
      if (d === 0) return;
      if (this.badge !== '') {
        const cur = Number(String(this.badge).replace('+', ''));
        if (Number.isFinite(cur)) {
          const next = Math.max(0, cur - d);
          this.badge = next > 99 ? '99+' : next > 0 ? String(next) : '';
        }
      }
      this.unread = Math.max(0, this.unread - d);
      this.syncTrayBadge();
    },

    /**
     * 收到一条新消息：入列 + 未读 + （非静默时）弹气泡 + 通知主进程闪托盘
     * 后端 /ws/notify 推送：NOTIFICATION（新通知）、UNREAD（已读后仅角标）
     * @param {Object} raw 通道原始消息
     * @param {{silent?: boolean}} opts silent=true 时不弹气泡不闪托盘（仅入列）
     */
    handleIncoming(raw, opts = {}) {
      if (!raw || typeof raw !== 'object') return;

      // 后端：已读后角标刷新（仅 unread/badge，不入列表）
      if (raw.type === WS_MSG_TYPE.UNREAD) {
        this.applyBadge(raw.unread, raw.badge);
        return;
      }

      const item = normalize(raw);
      if (!item) return;

      // 后端 NOTIFICATION 自带权威角标：同步未读角标
      if (raw.type === WS_MSG_TYPE.NOTIFICATION && (raw.badge != null || raw.unread != null)) {
        this.applyBadge(raw.unread, raw.badge);
      }

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
            content: i.content && i.content.length > 60 ? `${i.content.slice(0, 60)}…` : i.content,
            time: i.time,
            mentions: Array.isArray(i.mentions) ? i.mentions.slice(0, 5) : [],
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
    pick: ['items', 'lastRemindTsByUser'],
  },
});
