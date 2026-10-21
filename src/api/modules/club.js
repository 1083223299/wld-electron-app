import { request } from '../request';

/**
 * 俱乐部（管理端）
 * 路径前缀：/api/admin/clubs
 */
export const clubApi = {
  /**
   * 俱乐部列表 GET /api/admin/clubs
   * 分页/筛选参数通过 query 传递，空值自动剔除
   * @param {object} params { page, pageSize, id, name, phone, keyword, status, accountStatus, createdFrom, createdTo }
   *   - page: 从 1 开始，默认 1
   *   - pageSize: 默认 20，最大 100
   *   - id: 俱乐部 ID，完全匹配
   *   - name: 俱乐部名称，模糊匹配
   *   - phone: 手机号，完全匹配
   *   - keyword: 匹配名称或手机号
   *   - status: NORMAL / DISABLED，不传则全部
   *   - accountStatus: CAN_TAKE / BLOCK_TAKE / UNFROZEN / FROZEN / IN_STORE / QUIT
   *   - createdFrom / createdTo: 创建时间区间（yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss）
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
   * 新增俱乐部 POST /api/admin/clubs
   * @param {{name:string, phone:string, password:string, publicGrab:0|1}} data
   */
  create: (data) => request.post('/api/admin/clubs', data),

  /**
   * 编辑俱乐部 PUT /api/admin/clubs/{id}
   * password 传空表示不修改登录密码
   * @param {number} id 俱乐部 ID
   * @param {{name:string, phone:string, password?:string, publicGrab:0|1}} data
   */
  update: (id, data) => request.put(`/api/admin/clubs/${id}`, data),

  /**
   * 启用/停用账号 PUT /api/admin/accounts/{client}/{id}/status
   * 俱乐部列表为俱乐部端账号，client 固定 CLUB
   * @param {number} id 账号 ID（俱乐部 ID）
   * @param {'NORMAL'|'DISABLED'} status 目标状态
   */
  updateStatus: (id, status) =>
    request.put(`/api/admin/accounts/CLUB/${id}/status`, { status }),

  /**
   * 接单/冻结/退店标志 PUT /api/admin/accounts/{client}/{id}/flags
   * 仅提交需要修改的字段，client 固定 CLUB
   * @param {number} id 账号 ID（俱乐部 ID）
   * @param {{canTake?:0|1, inStore?:0|1, walletFrozen?:0|1}} flags
   */
  updateFlags: (id, flags) =>
    request.put(`/api/admin/accounts/CLUB/${id}/flags`, flags),

  /**
   * 资产管理（充值/扣减/余额抵扣）POST /api/admin/accounts/{client}/{id}/wallet-adjust
   * client 固定 CLUB
   * @param {number} id 账号 ID（俱乐部 ID）
   * @param {{walletType:'INCOME'|'DEPOSIT', action:'CREDIT'|'DEDUCT'|'OFFSET', amount:number, reason?:string}} data
   */
  adjustWallet: (id, data) =>
    request.post(`/api/admin/accounts/CLUB/${id}/wallet-adjust`, data),

  /** 查俱乐部可接单规格 GET /api/admin/clubs/{clubId}/specs */
  getSpecs: (clubId) => request.get(`/api/admin/clubs/${clubId}/specs`),

  /** 改俱乐部可接单规格 PUT /api/admin/clubs/{clubId}/specs，body: { specs } */
  updateSpecs: (clubId, specs) =>
    request.put(`/api/admin/clubs/${clubId}/specs`, { specs }),

  /**
   * 查俱乐部分润配置 GET /api/admin/clubs/{id}/profit-configs
   * 只返回该俱乐部已授权的游戏规格，未配置的排在前面
   * @param {number} clubId 俱乐部 ID
   * @param {string} keyword 模糊匹配游戏名或规格名（可选）
   */
  getProfitConfigs: (clubId, keyword = '') => {
    const query = keyword ? `?keyword=${encodeURIComponent(String(keyword).trim())}` : '';
    return request.get(`/api/admin/clubs/${clubId}/profit-configs${query}`);
  },

  /**
   * 保存分润配置 PUT /api/admin/profit-configs，body 为分润配置数组
   * @param {Array<{
   *   clubId:number, specId:number,
   *   clubMode:'PERCENT'|'FIXED', clubRate?:number, clubFixed?:number,
   *   playerMode:'PERCENT'|'FIXED', playerRate?:number, playerFixed?:number,
   *   settleDays:number
   * }>} configs
   */
  saveProfitConfigs: (configs) => request.put('/api/admin/profit-configs', configs),
};
