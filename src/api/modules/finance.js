import { request } from '../request';

/**
 * 财务管理（管理端）接口
 * 依据 Apifox「未来洞电竞后台 / 财务管理 / 收益明细」OpenAPI 规格：
 * - 全部接口鉴权：Header Authorization: Bearer {token}（后台 JWT，三端互不通用），
 *   request.js 已自动附加当前登录 token，无需重复传参
 * - 列表类接口为服务端分页/筛选，Query 空值自动剔除
 * - code=0/200 视为成功，业务错误由 request.js 统一提示
 */

/* ================= 枚举 → 中文（接口返回/提交均为英文枚举） ================= */

/** 身份 */
export const OWNER_TYPE = {
  CLUB: '俱乐部',
  PLAYER: '打手',
};

/** 钱包类型（收益明细顶部 Tab） */
export const WALLET_TYPE = {
  INCOME: '收益',
  DEPOSIT: '押金',
};

/**
 * 业务码 → 收支类型中文（预置兜底表；展示以接口 bizTypeLabel 为准，见 resolveBizTypeLabel）
 * 2026-10-23 后端确认完整枚举与文案：ORDER_INCOME 订单收入 / WITHDRAW_SUBMIT 提现扣减 /
 * WITHDRAW_FAIL_BACK 提现失败退回（收入方向）/ TRANSFER_DEDUCT 转单扣除 / SYSTEM_DEDUCT、SETTLE_VOID 系统扣款 /
 * PLATFORM_RECHARGE 平台充值；BALANCE_OFFSET 按金额符号：为负=支出-余额抵扣，为正=收入-余额抵扣（接口返回）。
 */
export const BIZ_TYPE_LABEL = {
  ORDER_INCOME: '收入-订单收入',
  PLATFORM_RECHARGE: '收入-平台充值',
  WITHDRAW_SUBMIT: '支出-提现扣减',
  WITHDRAW_FAIL_BACK: '收入-提现失败退回',
  TRANSFER_DEDUCT: '支出-转单扣除',
  SYSTEM_DEDUCT: '支出-系统扣款',
  SETTLE_VOID: '支出-系统扣款',
  BALANCE_OFFSET: '支出-余额抵扣', // 金额为负（收益扣出）；金额为正（押金转入）时接口返回"收入-余额抵扣"，动态并入下拉
};

/** 文案转换（接口返回英文枚举 → 中文展示） */
export const ownerTypeText = (code) => OWNER_TYPE[code] || code || '—';
export const walletTypeText = (code) => WALLET_TYPE[code] || code || '—';
export const bizTypeText = (code) => BIZ_TYPE_LABEL[code] || code || '—';

/**
 * 收支类型展示文案：接口 bizTypeLabel 优先（后端 2026-10-23 确认 GET /api/admin/finance/txns 统一返回中文 label，
 * 展示以 bizTypeLabel 为准），预置表兜底（接口未回 label 或后端新增码未同步时用本地映射，最后回退 code）。
 */
export function resolveBizTypeLabel(item = {}) {
  if (item.bizTypeLabel) return item.bizTypeLabel;
  return BIZ_TYPE_LABEL[item.bizType] || item.bizType || '—';
}

/* ================= 下拉选项（value 为接口枚举值） ================= */

export const OWNER_TYPE_OPTIONS = Object.entries(OWNER_TYPE).map(([value, label]) => ({ label, value }));
export const WALLET_TYPE_OPTIONS = Object.entries(WALLET_TYPE).map(([value, label]) => ({ label, value }));

/**
 * 收支类型（业务码）预置选项：同一中文文案只保留首个 value
 * （SYSTEM_DEDUCT / SETTLE_VOID 后端均口径为"系统扣款"，避免下拉出现两个同名选项；
 *  列表展示仍按各自 code 经 resolveBizTypeLabel 映射中文）
 */
export const BIZ_TYPE_OPTIONS = (() => {
  const seen = new Set();
  return Object.entries(BIZ_TYPE_LABEL)
    .filter(([, label]) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .map(([value, label]) => ({ label, value }));
})();

/* ================= 查询参数组装（空值自动剔除） ================= */

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
}

/* ================= 财务管理（管理端）接口 ================= */

export const financeApi = {
  /**
   * 收益明细（钱包流水）GET /api/admin/finance/txns
   * - walletType: INCOME 收益 / DEPOSIT 押金（对应页面顶部 Tab）
   * - ownerType: CLUB / PLAYER（身份筛选）
   * - bizType: 业务码（收支类型筛选）
   * - keyword: 匹配账号昵称或手机号
   * - from / to: 时间范围（yyyy-MM-dd 或 ISO 日期时间）
   * @param {{page?:number,pageSize?:number,from?:string,to?:string,ownerType?:string,
   *          walletType?:string,userId?:number,keyword?:string,clubId?:number,clubName?:string,
   *          bizType?:string,orderNo?:string}} params
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array}>}
   */
  txns: (params = {}) => request.get(`/api/admin/finance/txns${buildQuery(params)}`),
};
