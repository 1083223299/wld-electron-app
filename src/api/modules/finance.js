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
 * 业务码 → 收支类型中文
 * 接口文档仅给出 ORDER_INCOME / WITHDRAW_SUBMIT 示例，其余业务码以接口实际返回为准，
 * 页面会在拉取列表时把返回的 bizType + bizTypeLabel 动态并入筛选选项
 */
export const BIZ_TYPE_LABEL = {
  ORDER_INCOME: '收入-订单收入',
  WITHDRAW_SUBMIT: '支出-提现申请',
  // TODO: 待接口文档补充完整业务码枚举后完善
};

/** 文案转换（接口返回英文枚举 → 中文展示） */
export const ownerTypeText = (code) => OWNER_TYPE[code] || code || '—';
export const walletTypeText = (code) => WALLET_TYPE[code] || code || '—';
export const bizTypeText = (code) => BIZ_TYPE_LABEL[code] || code || '—';

/* ================= 下拉选项（value 为接口枚举值） ================= */

export const OWNER_TYPE_OPTIONS = Object.entries(OWNER_TYPE).map(([value, label]) => ({ label, value }));
export const WALLET_TYPE_OPTIONS = Object.entries(WALLET_TYPE).map(([value, label]) => ({ label, value }));

/** 收支类型（业务码）预置选项；运行时由页面动态并入接口实际返回的业务码 */
export const BIZ_TYPE_OPTIONS = Object.entries(BIZ_TYPE_LABEL).map(([value, label]) => ({ label, value }));

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
   *          walletType?:string,keyword?:string,clubId?:number,bizType?:string}} params
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array}>}
   */
  txns: (params = {}) => request.get(`/api/admin/finance/txns${buildQuery(params)}`),
};
