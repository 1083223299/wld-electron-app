import { request } from '../request';

// =====================================================================
// 渠道配置：已按 OpenAPI 联调真实后端（鉴权走 request.js 自动附加 Bearer token）
//   GET    /api/admin/channels          渠道列表（全量返回，无分页参数，分页由页面本地完成）
//   POST   /api/admin/channels          新增渠道   body: { channelCode, shopId, shopName }
//   PUT    /api/admin/channels/{id}     编辑渠道   body: { shopId, shopName }（channelCode 创建后不可修改）
//   DELETE /api/admin/channels/{id}     删除渠道
//
// 列表项实际返回字段：{ id, channelCode, shopId, shopName }；
// 编辑/删除使用列表项里的 id。
// =====================================================================

export const channelApi = {
  /**
   * 渠道列表（接口全量返回，本地分页由页面处理）
   * @returns {Promise<Array<{id:number, channelCode:string, shopId:string, shopName:string}>>}
   */
  list: async () => {
    const data = await request.get('/api/admin/channels');
    return Array.isArray(data) ? data : [];
  },

  /** 全部渠道（供其他模块下拉选择） */
  all: async () => {
    const list = await channelApi.list();
    return list.map((c) => ({
      id: c.id,
      channelCode: c.channelCode,
      shopId: c.shopId,
      shopName: c.shopName,
    }));
  },

  /** 新增渠道 @param {{channelCode:string, shopId:string, shopName:string}} data */
  create: ({ channelCode, shopId, shopName }) =>
    request.post('/api/admin/channels', {
      channelCode: String(channelCode || '').trim(),
      shopId: String(shopId || '').trim(),
      shopName: String(shopName || '').trim(),
    }),

  /** 编辑渠道（channelCode 创建后不可改） @param {number} id @param {{shopId:string, shopName:string}} data */
  update: (id, { shopId, shopName }) =>
    request.put(`/api/admin/channels/${id}`, {
      shopId: String(shopId || '').trim(),
      shopName: String(shopName || '').trim(),
    }),

  /** 删除渠道 @param {number} id */
  remove: (id) => request.del(`/api/admin/channels/${id}`),
};
