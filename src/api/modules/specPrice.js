import { request } from '../request';

/**
 * 自定义规格-价格配置（按游戏的特殊规格定价，管理端）
 * 【接口待后端确认】以下路径/字段为按原型拟定，OpenAPI 未给出，联调以后端为准：
 *   GET  /api/admin/games/{gameId}/spec-price      读取某游戏特殊规格定价
 *   PUT  /api/admin/games/{gameId}/spec-price      保存某游戏特殊规格定价
 * 说明：前端纯页面先行，保存按拟定结构提交，后端文档到位后对齐字段。
 */
export const specPriceApi = {
  get: (gameId) => request.get(`/api/admin/games/${gameId}/spec-price`),
  save: (gameId, data = {}) => request.put(`/api/admin/games/${gameId}/spec-price`, data),
};
