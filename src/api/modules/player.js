import { request } from '../request';

/**
 * 打手（管理端）
 * 相关路径：
 *   GET  /api/admin/players                    打手列表
 *   POST /api/admin/players                    新增打手
 *   GET  /api/admin/players/{id}               打手详情（编辑回显）
 *   PUT  /api/admin/players/{id}               编辑打手
 *   PUT  /api/admin/players/{id}/flags         退店/接单/钱包冻结
 *   POST /api/admin/players/{id}/wallet-adjust 资产管理
 *   GET  /api/admin/players/{playerId}/specs   查可接单规格
 *   PUT  /api/admin/players/{playerId}/specs   改可接单规格
 */
export const playerApi = {
  /**
   * 打手列表 GET /api/admin/players
   * 筛选：id/phone/clubId 完全匹配，name/clubName 模糊，
   *       accountStatus 为 可接单/禁止接单/未冻结/冻结/在店/退店，
   *       createdFrom/createdTo 创建时间（yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss）
   * @param {object} params { page, pageSize, id, name, phone, clubId, clubName, accountStatus, createdFrom, createdTo }
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

  /** 打手详情（编辑回显）GET /api/admin/players/{id} */
  detail: (id) => request.get(`/api/admin/players/${id}`),

  /** 新增打手 POST /api/admin/players，必填 name/phone/password/clubId */
  create: (data = {}) => request.post('/api/admin/players', data),

  /**
   * 编辑打手 PUT /api/admin/players/{id}
   * password 不传或空串不修改；remark 不传保持原值、空串清除；files 不传保持原值、空数组清除
   * @param {number} id
   * @param {object} data { name?, phone?, password?, clubId?, remark?, files?, specs? }
   */
  update: (id, data = {}) => request.put(`/api/admin/players/${id}`, data),

  /** 退店/接单/钱包冻结 PUT /api/admin/players/{id}/flags，只传要改的字段 */
  updateFlags: (id, data = {}) => request.put(`/api/admin/players/${id}/flags`, data),

  /** 资产管理 POST /api/admin/players/{id}/wallet-adjust */
  walletAdjust: (id, data = {}) => request.post(`/api/admin/players/${id}/wallet-adjust`, data),

  /** 查打手可接单规格 GET /api/admin/players/{playerId}/specs */
  getSpecs: (playerId) => request.get(`/api/admin/players/${playerId}/specs`),

  /** 改打手可接单规格 PUT /api/admin/players/{playerId}/specs，body: { specs } */
  updateSpecs: (playerId, specs) =>
    request.put(`/api/admin/players/${playerId}/specs`, { specs }),
};
