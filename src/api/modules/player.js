import { request } from '../request';

/**
 * 打手可接单规格（管理端）
 * 路径前缀：/api/admin/players/{playerId}/specs
 *
 * 规格项结构：{ gameId: number, all: boolean, specIds: number[] }
 *   - all = true 或 specIds 为空 => 该游戏下全部规格可接
 *   - PUT 时 specs 传空数组表示清空该打手全部可接规格
 */
export const playerApi = {
  /**
   * 打手列表（管理端）GET /api/admin/players
   * 参数以接口契约为准，空值自动剔除
   * @param {object} params { page, pageSize, status: 'NORMAL'|'DISABLED', keyword: 名称或手机号, clubId }
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array}>}
   */
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const query = qs.toString();
    return request.get(`/api/admin/players${query ? `?${query}` : ''}`);
  },

  /** 查打手可接单规格 GET /api/admin/players/{playerId}/specs */
  getSpecs: (playerId) => request.get(`/api/admin/players/${playerId}/specs`),

  /** 改打手可接单规格 PUT /api/admin/players/{playerId}/specs，body: { specs } */
  updateSpecs: (playerId, specs) =>
    request.put(`/api/admin/players/${playerId}/specs`, { specs }),
};
