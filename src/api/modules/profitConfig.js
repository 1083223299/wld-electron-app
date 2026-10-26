import { request } from '../request';

/**
 * 用户自选规格-分润配置（管理端全局配置）
 * 接口路径已实测确认（2026-10-26）：
 *   GET  /api/admin/profit-configs            读取当前分润配置（复数为正确路径，单数 404）
 *   PUT  /api/admin/profit-configs            保存分润配置
 * body: { clubRate, playerRate, platformRate }（百分比数值，两位小数）
 * 说明：平台分润由后端自动计算（100 - 俱乐部分润 - 打手分润），前端只维护俱乐部/打手两项。
 */
export const profitConfigApi = {
  /** 读取分润配置 */
  get: () => request.get('/api/admin/profit-configs'),
  /** 保存分润配置 @param {{clubRate:number,playerRate:number}} data */
  save: (data = {}) => request.put('/api/admin/profit-configs', data),
};
