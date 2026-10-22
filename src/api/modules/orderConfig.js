import { request } from '../request';

/**
 * 订单超时配置（GET /api/admin/timeouts 查询 / PUT /api/admin/timeouts 保存）
 * 测试环境口径：
 * - GET 按顺序返回 [{ name, code, minutes, ... }]，页面直接用返回的 name 动态渲染标签
 * - PUT 提交 [{ name, code, minutes }]，不传 mode
 */
export const orderConfigApi = {
  /** 获取超时配置（GET，保持后端返回顺序） */
  get: () => request.get('/api/admin/timeouts'),

  /** 保存超时配置（PUT，请求体 [{ name, code, minutes }]） */
  save: async (items = []) => {
    const list = (items || []).map((it) => ({
      name: it.name,
      code: it.code,
      minutes: Number(it.minutes),
    }));
    return request.put('/api/admin/timeouts', list);
  },
};
