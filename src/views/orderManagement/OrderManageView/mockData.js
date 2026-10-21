/**
 * 订单管理（催单列表 / 领单大厅 / 订单列表）本地模拟数据
 * 依据《未来电竞需求_原型分析文档》订单管理画布整理：
 * - 催单列表：所有未支付的第三方渠道订单（当前仅抖音）
 * - 领单大厅：所有已支付的第三方订单（当前仅抖音），需客服认领
 * - 订单列表：全生命周期订单，含 我的订单/全部订单 两个视角
 */
import { reactive } from 'vue';

/** 当前登录客服（原型右上角 张三，企微名 小九；管理员角色可改领取客服/编辑进行中订单） */
export const CURRENT_USER = { name: '张三', corp: '小九', role: 'admin' };

/* ===== 下拉/选项常量（与原型字段说明一致） ===== */
export const CHANNELS = ['抖音'];
export const STATUS_OPTIONS = ['待派单', '待接单', '进行中', '已完成', '交易关闭'];
export const AUDIT_OPTIONS = ['未提交', '待审核', '已驳回'];
export const ATTR_OPTIONS = ['主订单', '子订单'];
export const TYPE_OPTIONS = ['常规单', '特惠单'];
export const CLIENT_OPTIONS = ['端游', '手游'];
export const TAG_OPTIONS = ['呼叫', '卡单', '待发货', '已发货', '售后中', '冻结', '部分退款', '转单', '已退款'];
/**
 * 呼叫类型（对齐后端枚举 ORDER/COMPLAINT/PLAYER/TECH/OTHER：
 * 订单问题/投诉/打手问题/技术问题/其他；body 优先 type，提交英文枚举）
 */
export const CALL_TYPE_OPTIONS = [
  { label: '订单问题', value: 'ORDER' },
  { label: '投诉', value: 'COMPLAINT' },
  { label: '打手问题', value: 'PLAYER' },
  { label: '技术问题', value: 'TECH' },
  { label: '其他', value: 'OTHER' },
];
export const GAME_OPTIONS = ['三角洲行动', '王者荣耀', '和平精英'];
export const SPEC_OPTIONS = ['任务(8h)', '任务(9999h)', '护航', '跑刀'];
export const CLUB_OPTIONS = ['张三俱乐部', '李四俱乐部', '王五俱乐部'];
export const PLAYER_OPTIONS = [
  '张三 (144587)',
  '李四 (144588)',
  '王五 (144589)',
  '赵六 (144590)',
];

/* ===== 订单列表数据（含全生命周期状态） ===== */

/** 完成凭证/二维码占位图（本地 mock，无后端图片资源时用于回显演示） */
const PROOF_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">' +
      '<rect width="160" height="120" fill="#f4f6fb"/>' +
      '<rect x="20" y="30" width="120" height="60" rx="6" fill="#e2e8f5"/>' +
      '<text x="80" y="66" text-anchor="middle" font-size="13" fill="#94a3b8">示例凭证图</text>' +
      '</svg>'
  );

const BASE = {
  channel: '抖音',
  product: '绝密航天/巴克累计2088W 双子星',
  gameName: '三角洲行动',
  spec: '任务(8h)',
  clientType: ['端游'],
  orderType: '常规单',
  claimerCorp: '小九',
  claimerName: '张三',
  auditStatus: '-',
  attribute: '-',
  status: '待派单',
  tags: [],
  roleName: '阿斯蒂芬',
  groupCode: '16454454',
  playerCount: 1,
  statusCount: '',
  bound: false,
  mainOrderNo: '',
  frozen: false,
  refunded: false,
  rejectCount: 0,
  remark: '',
  /* ---- 编辑/详情扩展字段（原型：二维码上传、存单、完成凭证、分润、日志） ---- */
  qrImg: '',               // 企业群二维码（base64，上传后回显）
  depositTarget: '1000',   // 保底目标(W)
  depositReason: '',       // 存单原因（三角洲订单）
  depositFirst: '500',     // 第一把(W)
  depositSecond: '500',    // 第二把(W)
  depositImages: [],       // 剩余保底截图（最多5张，base64）
  depositRemark: '',       // 存单备注（非三角洲订单）
  proofFirst: '',          // 完成凭证-首图
  proofLast: '',           // 完成凭证-尾图
  proofProcess: [],        // 完成凭证-进程图（最多10张）
  proofUploadTime: '2026-10-09 11:22:33', // 凭证上传时间（回显）
  playerRemark: '',        // 打手备注
  lastRejectReason: '',    // 上次驳回原因（驳回后回显）
  platformAdjust: null,    // 平台加价/减价 {type, amount}
  clubAdjust: null,        // 俱乐部加价/减价 {type, amount}
  logs: [],                // 自定义订单日志（空则按状态自动生成）
};

let seq = 0;
const build = (overrides) => ({
  ...BASE,
  ...overrides,
  id: `ord-${++seq}`,
  orderType: overrides.orderType || BASE.orderType,
});

export const orderStore = reactive({
  /** 订单列表（全生命周期） */
  orders: [
    // ---------- 待派单 ----------
    build({ orderNo: '2455415', thirdOrderNo: '2455415', amount: 227.0, attribute: '主订单', bound: true, createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455416', thirdOrderNo: '2455416', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', spec: '任务(9999h)', clientType: ['手游', '端游'], orderType: '特惠单', tags: ['呼叫'], createTime: '2026-10-10 12:20:22' }),
    build({ orderNo: '2455417', thirdOrderNo: '862512346', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', spec: '护航', tags: ['卡单'], claimerCorp: '小爱', claimerName: '李四', createTime: '2026-10-11 09:03:22' }),
    build({ orderNo: '2455418', thirdOrderNo: '2455418', amount: 500.0, spec: '跑刀', tags: ['部分退款'], refunded: true, createTime: '2026-10-11 14:40:22' }),
    build({ orderNo: '2455419', thirdOrderNo: '862512349', amount: 88.0, product: '王者荣耀 上分套餐', gameName: '王者荣耀', clientType: ['手游'], roleName: '', playerCount: 0, claimerCorp: 'CC', claimerName: '王五', createTime: '2026-10-12 08:30:22' }),
    build({ orderNo: '2455420', thirdOrderNo: '2455420', amount: 666.0, spec: '护航', clientType: ['手游', '端游'], playerCount: 2, createTime: '2026-10-12 10:15:22' }),
    // ---------- 待接单 ----------
    build({ orderNo: '2455421', thirdOrderNo: '2455421', amount: 227.0, status: '待接单', statusCount: '1/2', tags: ['呼叫'], playerCount: 2, createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455422', thirdOrderNo: '2455422', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', spec: '任务(9999h)', clientType: ['手游', '端游'], orderType: '特惠单', status: '待接单', statusCount: '2/2', tags: ['卡单', '待发货'], playerCount: 2, createTime: '2026-10-10 12:20:22' }),
    build({ orderNo: '2455423', thirdOrderNo: '862512355', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', spec: '护航', status: '待接单', statusCount: '1/1', tags: ['已发货'], claimerCorp: '小爱', claimerName: '李四', createTime: '2026-10-11 09:03:22' }),
    build({ orderNo: '2455424', thirdOrderNo: '2455424', amount: 500.0, spec: '跑刀', status: '待接单', statusCount: '0/2', tags: ['待发货'], playerCount: 2, claimerCorp: 'CC', claimerName: '王五', createTime: '2026-10-11 14:40:22' }),
    build({ orderNo: '2455425', thirdOrderNo: '2455425', amount: 88.0, product: '王者荣耀 上分套餐', gameName: '王者荣耀', clientType: ['手游'], status: '待接单', statusCount: '1/2', playerCount: 2, createTime: '2026-10-12 08:30:22' }),
    build({ orderNo: '2455426', thirdOrderNo: '862512361', amount: 128.0, product: '和平精英 护航套餐', gameName: '和平精英', spec: '护航', status: '待接单', statusCount: '1/3', tags: ['呼叫', '卡单'], playerCount: 3, roleName: '', createTime: '2026-10-12 10:15:22' }),
    // ---------- 进行中 ----------
    build({ orderNo: '2455427', thirdOrderNo: '2455427', amount: 227.0, status: '进行中', auditStatus: '未提交', attribute: '主订单', bound: true, createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455428', thirdOrderNo: '2455428', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', spec: '任务(9999h)', clientType: ['手游', '端游'], orderType: '特惠单', status: '进行中', auditStatus: '未提交', tags: ['存单'], createTime: '2026-10-10 12:20:22' }),
    build({ orderNo: '2455429', thirdOrderNo: '2455429', amount: 500.0, spec: '跑刀', status: '进行中', auditStatus: '未提交', claimerCorp: '小爱', claimerName: '李四', createTime: '2026-10-11 09:03:22' }),
    build({ orderNo: '2455430', thirdOrderNo: '862512370', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', spec: '护航', status: '进行中', auditStatus: '待审核', proofFirst: PROOF_PLACEHOLDER, proofLast: PROOF_PLACEHOLDER, proofProcess: [PROOF_PLACEHOLDER, PROOF_PLACEHOLDER], playerRemark: '已完成全部任务进度', createTime: '2026-10-11 14:40:22' }),
    build({ orderNo: '2455431', thirdOrderNo: '2455431', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', spec: '任务(9999h)', clientType: ['手游', '端游'], status: '进行中', auditStatus: '待审核', tags: ['存单', '部分退款'], refunded: true, createTime: '2026-10-12 08:30:22' }),
    build({ orderNo: '2455432', thirdOrderNo: '2455432', amount: 227.0, status: '进行中', auditStatus: '已驳回', rejectCount: 1, lastRejectReason: '凭证截图不清晰，请重新上传首尾图', createTime: '2026-10-12 10:15:22' }),
    build({ orderNo: '2455433', thirdOrderNo: '862512376', amount: 88.0, product: '王者荣耀 上分套餐', gameName: '王者荣耀', clientType: ['手游'], status: '进行中', auditStatus: '已驳回', tags: ['售后中'], rejectCount: 1, claimerCorp: 'CC', claimerName: '王五', createTime: '2026-10-12 15:30:22' }),
    build({ orderNo: '2455434', thirdOrderNo: '2455434', amount: 666.0, spec: '护航', clientType: ['手游', '端游'], status: '进行中', auditStatus: '已驳回', tags: ['冻结'], frozen: true, rejectCount: 2, createTime: '2026-10-13 09:12:22' }),
    // ---------- 已完成 ----------
    build({ orderNo: '2455435', thirdOrderNo: '2455435', amount: 227.0, status: '已完成', proofFirst: PROOF_PLACEHOLDER, proofLast: PROOF_PLACEHOLDER, proofProcess: [PROOF_PLACEHOLDER], playerRemark: '任务完成，客户验收通过', createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455436', thirdOrderNo: '2455436', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', spec: '任务(9999h)', clientType: ['手游', '端游'], orderType: '特惠单', status: '已完成', claimerCorp: '小爱', claimerName: '李四', createTime: '2026-10-10 12:20:22' }),
    build({ orderNo: '2455437', thirdOrderNo: '862512382', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', spec: '护航', status: '已完成', tags: ['部分退款'], refunded: true, createTime: '2026-10-11 09:03:22' }),
    build({ orderNo: '2455438', thirdOrderNo: '2455438', amount: 500.0, spec: '跑刀', status: '已完成', claimerCorp: 'CC', claimerName: '王五', createTime: '2026-10-11 14:40:22' }),
    build({ orderNo: '2455439', thirdOrderNo: '2455439', amount: 88.0, product: '王者荣耀 上分套餐', gameName: '王者荣耀', clientType: ['手游'], status: '已完成', tags: ['已发货'], createTime: '2026-10-12 08:30:22' }),
    // ---------- 交易关闭 ----------
    build({ orderNo: '2455440', thirdOrderNo: '2455440', amount: 227.0, status: '交易关闭', createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455441', thirdOrderNo: '862512391', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', spec: '任务(9999h)', clientType: ['手游', '端游'], status: '交易关闭', tags: ['售后中'], claimerCorp: '小爱', claimerName: '李四', createTime: '2026-10-11 09:03:22' }),
    build({ orderNo: '2455442', thirdOrderNo: '2455442', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', spec: '护航', status: '交易关闭', claimerCorp: 'CC', claimerName: '王五', createTime: '2026-10-12 10:15:22' }),
    // ---------- 子订单（绑定关系） ----------
    build({ orderNo: '2455443', thirdOrderNo: '2455443', amount: 100.0, status: '待派单', attribute: '子订单', bound: true, mainOrderNo: '2455415', createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455444', thirdOrderNo: '2455444', amount: 100.0, status: '待派单', attribute: '子订单', bound: true, mainOrderNo: '2455415', createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455445', thirdOrderNo: '2455445', amount: 100.0, status: '进行中', auditStatus: '未提交', attribute: '子订单', bound: true, mainOrderNo: '2455427', createTime: '2026-10-10 11:12:22' }),
    build({ orderNo: '2455446', thirdOrderNo: '2455446', amount: 100.0, status: '进行中', auditStatus: '未提交', attribute: '子订单', bound: true, mainOrderNo: '2455427', createTime: '2026-10-10 11:12:22' }),
  ],

  /** 领单大厅：已支付第三方订单（待领取），认领后进入订单列表 */
  claimOrders: [
    { id: 'clm-1', orderNo: '2455501', thirdOrderNo: '2455501', channel: '抖音', amount: 227.0, product: '绝密航天/巴克累计2088W 双子星', status: '待领取', tags: [], createTime: '2026-10-13 09:12:22' },
    { id: 'clm-2', orderNo: '2455502', thirdOrderNo: '2455502', channel: '抖音', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', status: '待领取', tags: ['卡单'], createTime: '2026-10-13 09:30:22' },
    { id: 'clm-3', orderNo: '2455503', thirdOrderNo: '862512403', channel: '抖音', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', status: '待领取', tags: ['待发货'], createTime: '2026-10-13 10:05:22' },
    { id: 'clm-4', orderNo: '2455504', thirdOrderNo: '2455504', channel: '抖音', amount: 500.0, product: '绝密航天/巴克累计2088W 双子星', status: '待领取', tags: ['已发货'], createTime: '2026-10-13 10:42:22' },
    { id: 'clm-5', orderNo: '2455505', thirdOrderNo: '2455505', channel: '抖音', amount: 88.0, product: '王者荣耀 上分套餐', status: '待领取', tags: ['售后中'], createTime: '2026-10-13 11:20:22' },
    { id: 'clm-6', orderNo: '2455506', thirdOrderNo: '2455506', channel: '抖音', amount: 666.0, product: '绝密航天/巴克累计2088W 双子星', status: '待领取', tags: ['部分退款'], createTime: '2026-10-13 13:15:22' },
    { id: 'clm-7', orderNo: '2455507', thirdOrderNo: '862512410', channel: '抖音', amount: 128.0, product: '和平精英 护航套餐', status: '待领取', tags: ['卡单', '待发货'], createTime: '2026-10-13 14:02:22' },
    { id: 'clm-8', orderNo: '2455508', thirdOrderNo: '2455508', channel: '抖音', amount: 358.0, product: '绝密航天/巴克累计2088W 双子星', status: '待领取', tags: [], createTime: '2026-10-13 15:40:22' },
  ],

  /** 催单列表：未支付第三方订单，支付/取消后移出 */
  reminderOrders: [
    { id: 'rmd-1', channel: '抖音', thirdOrderNo: '2455601', amount: 227.0, product: '绝密航天/巴克累计2088W 双子星', createTime: '2026-10-13 08:12:22' },
    { id: 'rmd-2', channel: '抖音', thirdOrderNo: '2455602', amount: 300.0, product: '悠然漫天/巴克累计2088W 双子星', createTime: '2026-10-13 09:30:22' },
    { id: 'rmd-3', channel: '抖音', thirdOrderNo: '862512418', amount: 158.0, product: '绝密航天/巴克累计2089W 双子星', createTime: '2026-10-13 10:05:22' },
    { id: 'rmd-4', channel: '抖音', thirdOrderNo: '2455604', amount: 88.0, product: '王者荣耀 上分套餐', createTime: '2026-10-13 11:20:22' },
    { id: 'rmd-5', channel: '抖音', thirdOrderNo: '2455605', amount: 666.0, product: '绝密航天/巴克累计2088W 双子星', createTime: '2026-10-13 13:15:22' },
    { id: 'rmd-6', channel: '抖音', thirdOrderNo: '862512426', amount: 128.0, product: '和平精英 护航套餐', createTime: '2026-10-13 14:02:22' },
  ],
});

/** 订单关系：主订单 + 其下子订单 */
export function getRelation(row) {
  const children = orderStore.orders.filter((o) => o.mainOrderNo === row.orderNo);
  const main = row.mainOrderNo ? orderStore.orders.find((o) => o.orderNo === row.mainOrderNo) : null;
  return { main, children };
}

/**
 * 订单日志：按状态生成变动时间线（编辑/详情/审核弹窗共用）
 * 依据原型：展示订单状态变动 + 操作人（系统变动展示为系统）+ 时间（到秒）
 */
export function getOrderLogs(row) {
  if (Array.isArray(row.logs) && row.logs.length) return row.logs;
  const list = [];
  list.push({ time: row.createTime, text: '渠道下单', op: '系统' });
  if (['待接单', '进行中', '已完成', '交易关闭'].includes(row.status)) {
    list.push({ time: row.createTime, text: `派单 → 打手 小鹿#4410`, op: row.claimerName });
  }
  if (['进行中', '已完成', '交易关闭'].includes(row.status) && row.auditStatus !== '未提交') {
    list.push({ time: '2026-10-12 12:00:22', text: '提交凭证，客服审核通过', op: row.claimerName });
  }
  if (row.status === '已完成') {
    list.push({ time: '2026-10-12 12:30:22', text: '订单完成，进入7天账期', op: '系统' });
  }
  if (row.status === '交易关闭') {
    list.push({ time: '2026-10-12 12:30:22', text: '订单交易关闭', op: '系统' });
  }
  return list;
}

/** 领单大厅认领：从领单大厅移入订单列表（待派单） */
export function claimOrder(row) {
  const idx = orderStore.claimOrders.findIndex((o) => o.id === row.id);
  if (idx > -1) orderStore.claimOrders.splice(idx, 1);
  orderStore.orders.unshift({
    id: `ord-${Date.now()}`,
    orderNo: row.orderNo,
    thirdOrderNo: row.thirdOrderNo,
    channel: row.channel || '抖音',
    amount: row.amount,
    product: row.product,
    gameName: '',
    spec: '',
    clientType: [],
    orderType: '',
    claimerCorp: CURRENT_USER.corp,
    claimerName: CURRENT_USER.name,
    auditStatus: '-',
    attribute: '-',
    tags: [],
    roleName: '',
    groupCode: '',
    playerCount: 0,
    statusCount: '',
    bound: false,
    mainOrderNo: '',
    frozen: false,
    refunded: false,
    rejectCount: 0,
    remark: '',
    status: '待派单',
    createTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
  });
}

/** 状态样式：主状态 → badge class */
export const STATUS_CLASS = {
  待派单: 'status-info',
  待接单: 'status-warning',
  进行中: 'status-info',
  已完成: 'status-success',
  交易关闭: 'status-muted',
  待领取: 'status-warning',
};

/** 审核状态样式 */
export const AUDIT_CLASS = {
  未提交: 'status-muted',
  待审核: 'status-warning',
  已驳回: 'status-danger',
  '-': 'status-muted',
};
