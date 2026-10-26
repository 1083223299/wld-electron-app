import { watch } from 'vue';
import { config, notifyConfig } from '../config/env';
import { getToken } from '../utils/auth';
import { orderStore } from '../views/orderManagement/OrderManageView/mockData';
import { orderConfigApi } from './modules/orderConfig';

/**
 * 系统通知 · 即时通讯通道
 * ---------------------------------------------------------------
 * 职责：向「系统通知」模块提供 WebSocket 实时消息通道。
 *
 * 两种通道模式（由环境配置 config.useMock 决定）：
 *  1. 本地模拟模式（useMock = true，默认 local 环境）
 *     - 不真实连网，由内置「推送引擎」模拟服务端：
 *       · 启动即扫描订单列表，所有带「卡单」标签的订单自动生成
 *         卡单预警，并 @全量客服 @管理员
 *       · 监听订单列表变化，订单被标记卡单时立即推送
 *       · 每 60 秒轮询推送一条示例消息（卡单/交接/公告轮换）
 *     - 接入真实后端后删除本分支即可。
 *  2. 真实 WebSocket 模式（useMock = false，dev/test/staging/prod）
 *     - 连接 config.websocketURL 配置的地址，自动附加
 *       ?token={登录token URL 编码}&client=ADMIN（后端 /ws/notify 规范，client 必须与 token 同端）
 *     - 未登录（token 为空）时不建立连接；登录成功后由 store 侧 watch token 触发重连
 *     - 自动断线重连（指数退避，最长 30s）
 *     - 服务端消息约定（后端实时通知 JSON）：
 *       新通知 { type:'NOTIFICATION', id, scene, sceneLabel, title, content,
 *                orderId, jumpTarget, timeText, unread, badge }
 *       标记已读后 { type:'UNREAD', unread, badge }（仅角标，不入列表）
 *       badge 超过 99 为 '99+'
 *     - 兼容旧约定兜底：{ type:'stuck'|'handover'|'system', ... } / { type:'notify', payload } / 数组
 * ---------------------------------------------------------------
 */

/* ================= 推送消息类型（后端实时通知） ================= */
export const WS_MSG_TYPE = {
  NOTIFICATION: 'NOTIFICATION', // 新通知（含完整字段 + unread/badge）
  UNREAD: 'UNREAD', // 已读角标刷新（仅 unread/badge）
};

/** 后端 /ws/notify 连接地址组装：base?token={urlencoded}&client=ADMIN（后台端） */
export function buildWsUrl(base = '') {
  if (!base) return '';
  const token = getToken();
  if (!token) return '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}&client=ADMIN`;
}

/* ================= 通知类型 ================= */
export const NOTIFY_TYPE = {
  STUCK: 'stuck', // 卡单预警（@全量客服 @管理员）
  HANDOVER: 'handover', // 交接提醒
  SYSTEM: 'system', // 系统公告
};

/** 类型展示元信息（页面图标/标签用） */
export const TYPE_META = {
  [NOTIFY_TYPE.STUCK]: { label: '卡单预警', className: 'is-stuck' },
  [NOTIFY_TYPE.HANDOVER]: { label: '交接提醒', className: 'is-handover' },
  [NOTIFY_TYPE.SYSTEM]: { label: '系统公告', className: 'is-system' },
};

/* ================= 时间工具 ================= */
function pad(n) {
  return String(n).padStart(2, '0');
}

export function formatTime(d = new Date()) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/* ================= 消息构造 ================= */
let seq = 0;

/**
 * 生成一条标准通知消息
 * @param {Object} partial 部分字段，缺省字段自动补全
 */
export function makeMessage(partial = {}) {
  seq += 1;
  return {
    id: partial.id || `nt-${Date.now()}-${seq}`,
    type: NOTIFY_TYPE.SYSTEM,
    title: '',
    content: '',
    orderNos: [],
    mentions: [],
    time: formatTime(),
    read: false,
    ...partial,
  };
}

/* ================= 卡单订单（本地模拟数据源） ================= */

/** 卡单订单重复提醒的最小间隔（毫秒），避免 60s 轮询重复轰炸同一订单 */
const RE_ALERT_MS = 5 * 60 * 1000;

/** 从订单列表取出所有带「卡单」标签的订单 */
export function collectStuckOrders() {
  return (orderStore.orders || []).filter(
    (o) => Array.isArray(o.tags) && o.tags.includes('卡单')
  );
}

/** 生成一条卡单预警消息（@全量客服 @管理员） */
export function buildStuckMessage(order, minutes = 10) {
  return makeMessage({
    type: NOTIFY_TYPE.STUCK,
    title: '卡单预警',
    content: `订单 ${order.orderNo} 已超过 ${minutes} 分钟未流转，请全量客服与管理员及时处理，避免影响客户体验。`,
    orderNos: [order.orderNo],
    mentions: ['全量客服', '管理员'],
  });
}

/* ================= 本地模拟推送引擎 ================= */

/**
 * 启动本地模拟通道：
 * - 初始扫描：把所有卡单订单静默写入通知列表（不弹气泡）
 * - 监听订单变化：订单被标记卡单时立即推送（弹气泡 + 闪托盘）
 * - 每 60s 轮询：推送一条示例消息，模拟服务端实时推送
 * @param {(msg: Object, opts: {silent?: boolean}) => void} emit 消息回调
 */
function startMockEngine(emit) {
  // 卡单提醒去重记录：orderNo -> { last, times }
  const alerted = new Map();
  let timer = null;
  let stopWatch = null;
  let stuckMinutes = 10;

  // 读取待接单时长（WAIT_TAKE，用于文案展示超时分钟数）
  orderConfigApi.get().then((list) => {
    const item = (Array.isArray(list) ? list : []).find((x) => x && x.code === 'WAIT_TAKE');
    stuckMinutes = Number(item?.minutes) || 10;
  });

  const scan = (opts = {}) => {
    const stuck = collectStuckOrders();
    const now = Date.now();
    const alive = new Set(stuck.map((o) => o.orderNo));

    // 已解决的卡单订单（标签移除）清除提醒记录，重新卡单时可再次提醒
    for (const key of [...alerted.keys()]) {
      if (!alive.has(key)) alerted.delete(key);
    }

    for (const order of stuck) {
      const rec = alerted.get(order.orderNo);
      if (!rec || now - rec.last >= RE_ALERT_MS) {
        alerted.set(order.orderNo, { last: now, times: (rec ? rec.times : 0) + 1 });
        emit(buildStuckMessage(order, stuckMinutes), opts);
      }
    }
  };

  // 1) 初始扫描：静默入列（避免每次启动都弹一堆气泡）
  scan({ silent: true });

  // 2) 监听订单列表变化：订单被打上「卡单」标签时立即推送
  stopWatch = watch(
    () => orderStore.orders.map((o) => `${o.orderNo}:${(o.tags || []).join(',')}`),
    () => scan()
  );

  // 3) 每 60s 推送一条示例消息（模拟服务端实时推送）
  const templates = [
    // 交接提醒：@关注人
    () =>
      makeMessage({
        type: NOTIFY_TYPE.HANDOVER,
        title: '交接提醒',
        content: '张三 提交了新的交接日志并 @了你：凌晨单量低，早班关注永劫无匹配 SKU 单。',
        mentions: ['张三'],
      }),
    // 系统公告
    () =>
      makeMessage({
        type: NOTIFY_TYPE.SYSTEM,
        title: '系统公告',
        content: '系统将于今晚 23:00 - 24:00 进行例行维护，期间消息推送可能出现延迟，请提前处理卡单订单。',
      }),
    // 卡单预警（从未提醒过的卡单订单里轮换，全部提醒过则发公告）
    () => {
      const now = Date.now();
      const candidates = collectStuckOrders().filter(
        (o) => !alerted.has(o.orderNo) || now - alerted.get(o.orderNo).last >= RE_ALERT_MS
      );
      if (candidates.length) {
        const order = candidates[0];
        alerted.set(order.orderNo, { last: now, times: (alerted.get(order.orderNo)?.times || 0) + 1 });
        return buildStuckMessage(order, stuckMinutes);
      }
      return makeMessage({
        type: NOTIFY_TYPE.SYSTEM,
        title: '系统公告',
        content: '订单数据已同步完成，当前暂无新增卡单订单。',
      });
    },
  ];

  let templateIdx = 0;
  const pushOne = () => {
    const template = templates[templateIdx % templates.length];
    templateIdx += 1;
    emit(template(), {});
  };
  // 每 60s 轮询推送一条
  // timer = setInterval(pushOne, 60 * 1000);
  // 启动后 8 秒先推一条，方便立即看到 冒泡/铃铛/托盘闪烁/角标 的效果（不必等满 60s）
  // const firstPushTimer = setTimeout(pushOne, 8000);

  return () => {
    if (timer) clearInterval(timer);
    if (firstPushTimer) clearTimeout(firstPushTimer);
    if (stopWatch) stopWatch();
  };
}

/* ================= 真实 WebSocket 客户端 ================= */

/** 创建一条 WS 连接的公共处理（重连退避 + 假死检测看门狗），解析逻辑由调用方传入 */
function createWsConnection({ base, onMessage, onStatus }) {
  const {
    reconnectBaseMs = 3000,
    reconnectMaxMs = 30000,
    idleTimeoutMs = 45000,
  } = notifyConfig;
  let ws = null;
  let closed = false;
  let retry = 0;
  let retryTimer = null;
  let watchdogTimer = null;

  const clearWatchdog = () => {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  };

  /** 假死检测：连接已打开时，超过 idleTimeoutMs 未收到任何服务端消息则主动断开，触发 onclose → 重连 */
  const armWatchdog = () => {
    clearWatchdog();
    if (!(idleTimeoutMs > 0) || !ws || ws.readyState !== WebSocket.OPEN) return;
    watchdogTimer = setTimeout(() => {
      try {
        ws && ws.close();
      } catch {
        /* 忽略 */
      }
    }, idleTimeoutMs);
  };

  const scheduleRetry = () => {
    if (closed || !base) return;
    const delay = Math.min(reconnectMaxMs, reconnectBaseMs * 2 ** retry);
    retry += 1;
    retryTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (closed || !base) return;
    // 未登录（token 为空）不建连；由 store 侧 watch token 变化后调用 restart 重连
    const url = buildWsUrl(base);
    if (!url) {
      onStatus('disconnected');
      return;
    }
    try {
      ws = new WebSocket(url);
    } catch (e) {
      scheduleRetry();
      return;
    }
    ws.onopen = () => {
      retry = 0;
      onStatus('connected');
      armWatchdog();
    };
    ws.onmessage = (ev) => {
      // 任何服务端消息都说明连接存活：重置假死检测
      armWatchdog();
      onMessage(ev);
    };
    ws.onclose = () => {
      clearWatchdog();
      onStatus('disconnected');
      scheduleRetry();
    };
    ws.onerror = () => {
      try {
        ws && ws.close();
      } catch {
        /* 忽略 */
      }
    };
  };

  connect();

  return () => {
    closed = true;
    clearWatchdog();
    if (retryTimer) clearTimeout(retryTimer);
    try {
      ws && ws.close();
    } catch {
      /* 忽略 */
    }
  };
}

/**
 * 启动真实 WS 通道（含断线自动重连 + 假死检测）
 * @param {(msg: Object) => void} emit
 * @param {(status: 'connected'|'disconnected') => void} onStatus
 */
function startRealSocket(emit, onStatus) {
  return createWsConnection({
    base: config.websocketURL,
    onMessage: (ev) => {
      let data = null;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      const rawList = Array.isArray(data) ? data : [data];
      rawList.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        // 后端实时通知：type=NOTIFICATION / UNREAD 原样交给 store 处理
        if (raw.type === WS_MSG_TYPE.NOTIFICATION || raw.type === WS_MSG_TYPE.UNREAD) {
          emit(raw);
          return;
        }
        // 兼容旧约定兜底：包装格式 { type:'notify', payload } → 解包；否则原样
        const msg = raw.type === 'notify' && raw.payload ? raw.payload : raw;
        if (!msg || typeof msg !== 'object') return;
        emit(msg);
      });
    },
    onStatus,
  });
}

/* ================= 对外入口 ================= */

/** 判断 WS 地址是否为占位（未接入真实后端） */
function isPlaceholderWs(url = '') {
  return !url || /myapp\.com/.test(url) || url.startsWith('ws://localhost:3001');
}

/**
 * 创建系统通知即时通讯通道
 * @param {(msg: Object, opts?: {silent?: boolean}) => void} onMessage 收到消息回调
 * @param {(status: 'connected'|'disconnected') => void} onStatus 通道状态回调
 * @returns {{ mode: 'mock'|'ws', close: Function }}
 */
export function createNotifySocket({ onMessage, onStatus }) {
  const url = config.websocketURL || '';
  // 未配置真实 WS 地址（或仍为占位域名）时，自动回落到本地模拟通道，
  // 保证打包产物开箱即可看到卡单推送演示；接入真实后端后配置 websocket 地址即切换真实通道
  const useMock = config.useMock !== false || isPlaceholderWs(url);

  if (useMock) {
    if (config.useMock === false) {
      console.warn('[notify] 未配置真实 WebSocket 地址，使用本地模拟推送通道');
    }
    onStatus && onStatus('connected');
    return { mode: 'mock', close: startMockEngine(onMessage) };
  }

  return { mode: 'ws', close: startRealSocket(onMessage, onStatus) };
}

/* ================= 后台弹框通道（/ws/admin） ================= */

/**
 * 解析后台弹框通道消息：纯文本「标题:内容」（中间中文冒号）；兼容 JSON 兜底
 * @param {string|Object} data
 * @returns {{ type: string, title: string, content: string }|null}
 */
export function parseAdminAlert(data) {
  // 兼容 JSON（后端误推 / 版本过渡期）
  if (data && typeof data === 'object') {
    const title = data.title || '';
    const content = data.content || data.message || data.body || '';
    if (title || content) {
      return { type: 'admin-alert', title, content };
    }
    return null;
  }
  if (typeof data !== 'string') return null;
  const text = data.trim();
  if (!text) return null;
  const idx = text.indexOf('：'); // 中文冒号
  if (idx > 0 && idx < text.length - 1) {
    return { type: 'admin-alert', title: text.slice(0, idx).trim(), content: text.slice(idx + 1).trim() };
  }
  return { type: 'admin-alert', title: '系统通知', content: text };
}

/**
 * 启动后台弹框 WS 通道（/ws/admin，纯文本「标题:内容」）
 * - 与 /ws/notify 同一套握手：?token={登录token URL编码}&client=ADMIN
 * - 未配置地址（如 PROD 尚未有域名）时不连接；配置后自动启用
 * - 未登录（token 为空）时不建连；由 store 侧 watch token 触发重连
 * - 只有「需要弹框」的后台通知才会推送，平时无消息属正常
 * - 复用公共连接管理：断线自动重连 + 假死检测看门狗
 * @param {(msg: Object) => void} emit
 * @param {(status: 'connected'|'disconnected') => void} onStatus
 */
function startAdminAlertSocket(emit, onStatus) {
  return createWsConnection({
    base: config.adminWSURL || '',
    onMessage: (ev) => {
      let data = null;
      try {
        data = JSON.parse(ev.data);
      } catch {
        data = ev.data;
      }
      const msg = parseAdminAlert(data);
      if (msg) emit(msg);
    },
    onStatus,
  });
}

/**
 * 创建后台弹框通道
 * @param {(msg: Object) => void} onMessage 收到「标题:内容」弹框消息回调
 * @param {(status: 'connected'|'disconnected') => void} onStatus
 * @returns {{ mode: 'ws'|'none', close: Function }}
 */
export function createAdminAlertSocket({ onMessage, onStatus }) {
  const url = config.adminWSURL || '';
  if (!url) {
    return { mode: 'none', close: () => {} };
  }
  return { mode: 'ws', close: startAdminAlertSocket(onMessage, onStatus) };
}
