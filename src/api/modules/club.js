import { request } from '../request';

/**
 * 俱乐部（管理端）
 * 路径前缀：/api/admin/clubs
 */
export const clubApi = {
  /**
   * 俱乐部列表 GET /api/admin/clubs
   * 分页/筛选参数通过 query 传递，空值自动剔除
   * @param {object} params { page, pageSize, status, keyword }
   *   - page: 从 1 开始，默认 1
   *   - pageSize: 默认 20，最大 100
   *   - status: NORMAL / DISABLED，不传则全部
   *   - keyword: 匹配名称或手机号
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array}>}
   */
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const query = qs.toString();
    return request.get(`/api/admin/clubs${query ? `?${query}` : ''}`);
  },

  /**
   * 启用/停用账号 PUT /api/admin/accounts/{client}/{id}/status
   * 俱乐部列表为俱乐部端账号，client 固定 CLUB
   * @param {number} id 账号 ID（俱乐部 ID）
   * @param {'NORMAL'|'DISABLED'} status 目标状态
   */
  updateStatus: (id, status) =>
    request.put(`/api/admin/accounts/CLUB/${id}/status`, { status }),

  /** 查俱乐部可接单规格 GET /api/admin/clubs/{clubId}/specs */
  getSpecs: (clubId) => request.get(`/api/admin/clubs/${clubId}/specs`),

  /** 改俱乐部可接单规格 PUT /api/admin/clubs/{clubId}/specs，body: { specs } */
  updateSpecs: (clubId, specs) =>
    request.put(`/api/admin/clubs/${clubId}/specs`, { specs }),
};
