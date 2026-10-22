import { request } from '../request';

/**
 * 订单管理（管理端）接口
 * 依据 Apifox「未来洞电竞后台 / 订单管理」OpenAPI 规格：
 * - 全部接口鉴权：Header Authorization: Bearer {token}（后台 JWT，三端 JWT 互不通用），
 *   request.js 已自动附加当前登录 token，无需重复传参
 * - 列表类接口为服务端分页/筛选，Query 空值自动剔除
 * - code=0/200 视为成功，业务错误由 request.js 统一提示
 */

/* ================= 枚举 → 中文（接口返回/提交均为英文枚举） ================= */

/**
 * 订单状态（催单列表为 WAIT_PAY，不参与订单列表筛选；订单列表含 WAIT_CLAIM 待领取）
 * 依据最新 OpenAPI：WAIT_PAY待支付 / WAIT_CLAIM待领取 / WAIT_DISPATCH待派单 /
 * WAIT_TAKE待接单 / IN_PROGRESS进行中 / COMPLETED已完成 / CLOSED交易关闭
 */
export const ORDER_STATUS = {
  WAIT_PAY: '待支付', // 催单列表专用
  WAIT_CLAIM: '待领取',
  WAIT_DISPATCH: '待派单',
  WAIT_TAKE: '待接单',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CLOSED: '交易关闭',
};

/** 审核状态（列表接口用 NONE，领单大厅/详情用 UNSUBMITTED） */
export const AUDIT_STATUS = {
  NONE: '未提交',
  UNSUBMITTED: '未提交',
  PENDING: '待审核',
  REJECTED: '已驳回',
};

/** 订单类型 */
export const ORDER_TYPE = {
  NORMAL: '常规单',
  SPECIAL: '特惠单',
};

/** 渠道编码 → 渠道名（人工新增订单示例：XHS / PRIVATE） */
export const CHANNEL_CODES = {
  DOUYIN: '抖音',
  XHS: '小红书',
  PRIVATE: '人工',
};

/** 派单类型：SYSTEM=大厅（系统派单）；CLUB=指定俱乐部（人工派单） */
export const DISPATCH_TYPE = {
  SYSTEM: '系统派单',
  CLUB: '人工派单',
};

/** 转单类型：PUBLIC=进入公共抢单大厅；CLUB_HALL=进入当前俱乐部抢单大厅 */
export const TRANSFER_TYPE = {
  PUBLIC: '进入公共抢单大厅',
  CLUB_HALL: '进入当前俱乐部',
};

/** 打手名额来源 */
export const SLOT_SOURCE = {
  GRAB: '抢单',
  ASSIGN: '指派',
};

/* ================= 文案转换 ================= */

export const statusText = (code) => ORDER_STATUS[code] || code || '—';
export const auditText = (code) => AUDIT_STATUS[code] || code || '—';
export const typeText = (code) => ORDER_TYPE[code] || code || '—';
export const channelText = (code) => CHANNEL_CODES[code] || code || '—';
export const dispatchTypeText = (code) => DISPATCH_TYPE[code] || code || '—';
export const transferTypeText = (code) => TRANSFER_TYPE[code] || code || '—';
export const slotSourceText = (code) => SLOT_SOURCE[code] || code || '—';

/* ================= 下拉选项（value 为接口枚举值） ================= */

/** 订单列表-状态筛选（不含催单专用 WAIT_PAY） */
export const STATUS_OPTIONS = Object.entries(ORDER_STATUS)
  .filter(([value]) => value !== 'WAIT_PAY')
  .map(([value, label]) => ({ label, value }));

export const AUDIT_OPTIONS = Object.entries(AUDIT_STATUS).map(([value, label]) => ({ label, value }));
export const TYPE_OPTIONS = Object.entries(ORDER_TYPE).map(([value, label]) => ({ label, value }));
export const CHANNEL_OPTIONS = Object.entries(CHANNEL_CODES).map(([value, label]) => ({ label, value }));

/* ================= 查询参数组装（空值自动剔除，数组 join 逗号） ================= */

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
}

/* ================= 订单管理（管理端）接口 ================= */

export const orderApi = {
  /**
   * 订单列表（管理端）GET /api/admin/orders
   * scope=MINE 我的订单（默认）/ scope=ALL 全部订单（ownerId 仅 scope=ALL 时有效）
   * 注意：管理端请勿使用 /api/admin/orders/mine（该路径对后台账号 403）
   * TODO(后续优化)：我的订单/全部订单目前按两个接口切换使用（mine/all 内部传不同 scope），
   *   后续有时间再统一为单查询方式 orderApi.list({ scope, ...params })
   * @param {{scope?:string,page?:number,pageSize?:number,orderNo?:string,thirdOrderNo?:string,
   *          status?:string,auditStatus?:string,orderType?:string,channelCode?:string,gameId?:number,
   *          ownerId?:number,frozen?:number,afterSale?:number,from?:string,to?:string}} params
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array}>}
   */
  list: (params = {}) => request.get(`/api/admin/orders${buildQuery(params)}`),

  /** 我的订单：内部固定 scope=MINE */
  mine: (params = {}) => orderApi.list({ ...params, scope: 'MINE' }),

  /** 全部订单：内部固定 scope=ALL */
  all: (params = {}) => orderApi.list({ ...params, scope: 'ALL' }),

  /** 催单列表 GET /api/admin/orders/urge-hall（未支付第三方订单 status=WAIT_PAY） */
  urgeHall: (params = {}) => request.get(`/api/admin/orders/urge-hall${buildQuery(params)}`),

  /** 客服领单大厅 GET /api/admin/orders/claim-hall（无 Query 参数，返回数组） */
  claimHall: () => request.get('/api/admin/orders/claim-hall'),

  /** 订单详情（管理端）GET /api/admin/orders/{id} */
  detail: (id) => request.get(`/api/admin/orders/${id}`),

  /** 认领订单 POST /api/admin/orders/{id}/claim（无 body） */
  claim: (id) => request.post(`/api/admin/orders/${id}/claim`),

  /** 维护订单信息 POST /api/admin/orders/{id}/maintain（待派单/进行中-未提交） */
  maintain: (id, data = {}) => request.post(`/api/admin/orders/${id}/maintain`, data),

  /** 派单 POST /api/admin/orders/{id}/dispatch（SYSTEM=大厅；CLUB=指定俱乐部必填 targetClubId） */
  dispatch: (id, data = {}) => request.post(`/api/admin/orders/${id}/dispatch`, data),

  /**
   * 指派打手到名额（管理端）POST /api/admin/orders/{id}/assignments
   * body: { slots: [{ slotNo: 1, playerId: 144587 }] }
   * 说明：俱乐部接单后管理端按名额指派打手；后端校验打手归属、在店状态及游戏规格
   */
  assign: (orderId, data = {}) => request.post(`/api/admin/orders/${orderId}/assignments`, data),

  /**
   * 订单分润明细 POST /api/admin/orders/{id}/profit-details
   * 查询订单当前生效的分润快照及俱乐部、打手各名额份额；version 不传返回当前版本；
   * 未锁定分润时 available=false。
   * @param {number} id
   * @param {{version?:number}} [params]
   * @returns {Promise<{orderId:number,available:boolean,version:number,amount:number,clubBase:number,
   *   clubMode:string,clubRate:number,clubFixed:number,playerMode:string,playerRate:number,playerFixed:number,
   *   playerCount:number,platformAdjust:number,clubAdjust:number,platformAmount:number,clubAmount:number,
   *   clubRetain:number,reason:string,refundId:string,shares:Array<{ownerType:string,ownerId:number,slotNo:number,
   *   baseAmount:number,adjustAmount:number,amount:number,tailAmount:number}>}>}
   */
  profitDetail: (id, params = {}) => request.post(`/api/admin/orders/${id}/profit-details`, params),

  /** 审核验收 POST /api/admin/orders/{id}/audit（pass 必填，驳回必填 reason 最多50字） */
  audit: (id, data = {}) => request.post(`/api/admin/orders/${id}/audit`, data),

  /** 冻结订单 POST /api/admin/orders/{id}/freeze */
  freeze: (id, data = {}) => request.post(`/api/admin/orders/${id}/freeze`, data),

  /** 解冻订单 POST /api/admin/orders/{id}/unfreeze */
  unfreeze: (id) => request.post(`/api/admin/orders/${id}/unfreeze`),

  /** 平台加减价 POST /api/admin/orders/{id}/platform-adjust（direction: INCREASE/DECREASE） */
  platformAdjust: (id, data = {}) => request.post(`/api/admin/orders/${id}/platform-adjust`, data),

  /** 人工退款 POST /api/admin/orders/{id}/refund（amount 正数必填，reason 可选） */
  refund: (id, data = {}) => request.post(`/api/admin/orders/${id}/refund`, data),

  /** 转单 POST /api/admin/orders/{id}/transfer（type: PUBLIC/CLUB_HALL，deduct 转单扣款） */
  transfer: (id, data = {}) => request.post(`/api/admin/orders/${id}/transfer`, data),

  /** 人工新增订单 POST /api/admin/orders */
  create: (data = {}) => request.post('/api/admin/orders', data),

  /** 绑定主单 POST /api/admin/orders/{id}/bind（parentOrderId 必填） */
  bind: (id, data = {}) => request.post(`/api/admin/orders/${id}/bind`, data),

  /** 解绑主单 POST /api/admin/orders/{id}/unbind */
  unbind: (id) => request.post(`/api/admin/orders/${id}/unbind`),

  /** 呼叫 POST /api/admin/orders/{id}/call（callType 必填） */
  call: (id, data = {}) => request.post(`/api/admin/orders/${id}/call`, data),

  /** 交易关闭 POST /api/admin/orders/{id}/close */
  close: (id, data = {}) => request.post(`/api/admin/orders/${id}/close`, data),

  /** 修改客服 PUT /api/admin/orders/{id}/owner（ownerAccountId 必填） */
  changeOwner: (id, data = {}) => request.put(`/api/admin/orders/${id}/owner`, data),

  /** 订单日志 GET /api/admin/orders/{id}/logs（action/content/operatorName/createdAt） */
  logs: (id) => request.get(`/api/admin/orders/${id}/logs`),

  /**
   * 编辑存单 POST /api/admin/orders/{id}/hold
   * 说明：只有进行中、未冻结、未售后能改，待接单不能调；不改变订单状态。
   * 用订单详情 hold.form 决定表单（WARRANTY 填 warrantyTarget/reason/rounds/shots；REMARK 只填 remark）。
   * stored=false 表示不存单并清空明细；warrantyTarget/rounds 单位是万，rounds 每把一个金额，最多 10 个；
   * shots 最多 5 张 url（先走文件上传）；remark 最多 200 字。
   * @param {number} id
   * @param {{stored:boolean, warrantyTarget?:number, reason?:string, rounds?:number[], shots?:string[], remark?:string}} data
   */
  hold: (id, data = {}) => request.post(`/api/admin/orders/${id}/hold`, data),

  /** 回退到待领取 POST /api/admin/orders/{id}/rollback（无 body；回退目标状态以后端契约为准） */
  rollback: (id) => request.post(`/api/admin/orders/${id}/rollback`),

  /**
   * 可绑主单列表 GET /api/admin/orders/bindable-parents
   * @param {{excludeId?:number, keyword?:string, page?:number, pageSize?:number}} params
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array,statusCounts?:Object}>}
   */
  bindableParents: (params = {}) => request.get(`/api/admin/orders/bindable-parents${buildQuery(params)}`),

  /**
   * 批量解绑主单 POST /api/admin/orders/unbind
   * @param {number[]} orderIds 待解绑的订单 ID 列表（可传单个）
   * @returns {Promise<{successIds:number[], failures:{orderId:number,message:string}[]}>}
   */
  unbindBatch: (orderIds = []) => request.post('/api/admin/orders/unbind', { orderIds }),
};
