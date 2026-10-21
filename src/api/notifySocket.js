import { watch } from 'vue';
import { config } from '../config/env';
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
 *     - 连接 config.websocketURL 配置的地址
 *     - 自动断线重连（指数退避，最长 30s）
 *     - 服务端消息约定：
 *       普通消息：{ type: 'stuck'|'handover'|'system', title, content, orderNos, mentions, time }
 *       包装消息：{ type: 'notify', payload: { ...同上 } }
 *       或直接推数组 [ { ... }, ... ]
 * ---------------------------------------------------------------
 */

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

  // 读取待接单卡单时长（STUCK，用于文案展示超时分钟数）
  orderConfigApi.get().then((res) => {
    stuckMinutes = Number(res?.stuckMinutes) || 10;
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

/**
 * 启动真实 WS 通道（含断线自动重连）
 * @param {(msg: Object) => void} emit
 * @param {(status: 'connected'|'disconnected') => void} onStatus
 */
function startRealSocket(emit, onStatus) {
  const url = config.websocketURL;
  let ws = null;
  let closed = false;
  let retry = 0;
  let retryTimer = null;

  const scheduleRetry = () => {
    if (closed || !url) return;
    const delay = Math.min(30000, 3000 * 2 ** retry);
    retry += 1;
    retryTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (closed || !url) return;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      scheduleRetry();
      return;
    }
    ws.onopen = () => {
      retry = 0;
      onStatus('connected');
    };
    ws.onmessage = (ev) => {
      let data = null;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      const rawList = Array.isArray(data) ? data : [data];
      rawList.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        // 包装格式 { type:'notify', payload } → 解包
        const msg = raw.type === 'notify' && raw.payload ? raw.payload : raw;
        if (!msg || typeof msg !== 'object') return;
        emit(msg);
      });
    };
    ws.onclose = () => {
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
    if (retryTimer) clearTimeout(retryTimer);
    try {
      ws && ws.close();
    } catch {
      /* 忽略 */
    }
  };
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
