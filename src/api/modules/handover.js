import { request } from '../request';

/**
 * 交接中心 > 交接日志（管理端）接口
 * 依据 Apifox「未来洞电竞后台 / 交接中心 / 交接日志」OpenAPI 规格：
 * - GET  /api/admin/handovers            交接日志列表（服务端分页 + from/to/status/mine 筛选）
 * - POST /api/admin/handovers            新建交接日志
 * - POST /api/admin/handovers/{id}/ack   关注人标记已处理
 * - GET  /api/admin/accounts             关注人候选（账号列表）
 * 鉴权：Header Authorization: Bearer {token}，request.js 已自动附加当前登录 token
 */

/** 关注人处理状态（接口返回/提交均为英文枚举） */
export const LOG_STATUS = {
  PENDING: 'PENDING', // 待处理
  DONE: 'DONE', // 已处理
};

/** 查询参数组装（空值自动剔除，数组 join 逗号） */
function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const handoverApi = {
  /**
   * 交接日志列表 GET /api/admin/handovers
   * 服务端分页；from/to 时间范围、status 处理状态、mine=1 仅看与我相关
   * @param {Object} params
   * @param {number} [params.page] 页码，默认 1
   * @param {number} [params.pageSize] 每页条数，默认 20，最大 100
   * @param {string} [params.from] 开始时间 yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss
   * @param {string} [params.to] 结束时间 yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss
   * @param {''|'PENDING'|'DONE'} [params.status] 处理状态
   * @param {1|''} [params.mine] 传 1 时只看我创建或我作为关注人的交接
   * @returns {Promise<{page:number,pageSize:number,total:number,list:Array}>}
   *   list 项：{ id, content, orderId, creatorId, creatorName, createdAt,
   *             watchers: [{ accountId, accountName, status:'PENDING'|'DONE', handledAt }],
   *             myWatcherStatus: 'PENDING'|'DONE'|null }
   */
  list: (params = {}) => request.get(`/api/admin/handovers${buildQuery(params)}`),

  /**
   * 关注人标记已处理 POST /api/admin/handovers/{id}/ack
   * 当前用户由 token 识别，无需 body
   * @param {number} id 交接 ID
   * @returns {Promise<{ok:boolean}>}
   */
  ack: (id) => request.post(`/api/admin/handovers/${id}/ack`),

  /**
   * 新建交接日志 POST /api/admin/handovers
   * @param {Object} data
   * @param {string} data.content 交接内容（必填）
   * @param {number} [data.orderId] 关联订单 ID
   * @param {number[]} [data.watcherIds] 关注人 ID 列表
   * @returns {Promise<Object>} 新建后的交接日志（字段同列表项）
   */
  create: (data = {}) => request.post('/api/admin/handovers', data),

  /**
   * 关注人候选 GET /api/admin/accounts
   * 账号列表，默认只取正常状态（NORMAL）；统一标准化为 { accountId, accountName }
   * @param {Object} [params] { keyword, role, status } status 默认 NORMAL
   * @returns {Promise<Array<{accountId:number,accountName:string}>>}
   */
  accounts: async (params = {}) => {
    const res = await request.get(
      `/api/admin/accounts${buildQuery({ status: 'NORMAL', ...params })}`
    );
    // 兼容后端返回数组或 { list: [...] } 两种结构
    const list = Array.isArray(res) ? res : res?.list || [];
    return list.map((a) => ({
      accountId: a.accountId ?? a.id,
      accountName: a.accountName || a.name || '',
    }));
  },
};
