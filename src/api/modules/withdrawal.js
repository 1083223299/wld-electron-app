import { request } from '../request';

/**
 * 财务管理 > 提现明细（管理端）
 * 路径：GET /api/admin/finance/withdrawals
 * 需后台登录，Authorization 由 request.js 自动附加
 *
 * 提现单状态：PROCESSING / SUCCESS / FAILED（一期自动打款，无待审核）
 * 钱包类型：INCOME / DEPOSIT；身份：CLUB / PLAYER
 */
export const withdrawalApi = {
  /**
   * 提现明细分页查询
   * 参数以接口契约为准，空值自动剔除
   * @param {object} params
   *   { page, pageSize, from, to, ownerType: 'CLUB'|'PLAYER',
   *     walletType: 'INCOME'|'DEPOSIT', userId, keyword: 账号昵称或手机号, clubId, clubName,
   *     bizType, status: 'PROCESSING'|'SUCCESS'|'FAILED' }
   * @returns {Promise<{total:number,page:number,pageSize:number,list:Array}>}
   */
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const query = qs.toString();
    return request.get(`/api/admin/finance/withdrawals${query ? `?${query}` : ''}`);
  },
};
