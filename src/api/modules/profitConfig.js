import { request } from '../request';

/**
 * 用户自选规格-分润配置（管理端全局配置）
 * GET/PUT /api/admin/custom-spec/profit
 * 保存请求：{ clubRate: integer, playerRate: integer }
 * 平台分润由后端自动计算。
 */
export const profitConfigApi = {
  /** 读取分润配置 */
  get: () => request.get('/api/admin/custom-spec/profit'),
  /** 保存分润配置 @param {{clubRate:number,playerRate:number}} data */
  save: (data = {}) => request.put('/api/admin/custom-spec/profit', data),
};
