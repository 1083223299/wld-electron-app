import { request } from '../request';

// =====================================================================
// 渠道配置：已按 OpenAPI 联调真实后端（鉴权走 request.js 自动附加 Bearer token）
//   GET    /api/admin/channels          渠道列表（全量返回，无分页参数，分页由页面本地完成）
//   POST   /api/admin/channels          新增渠道   body: { name }
//   PUT    /api/admin/channels/{id}     编辑渠道   body: { name }
//   DELETE /api/admin/channels/{id}     删除渠道
//
// 说明（接口文档 2026-10 更新，测试服已验证）：
//   - 新增/编辑只传渠道名称 name（上限15字，重复时响应体 code 409「渠道名称已存在」）；
//     编辑时 shopId、shopName 即使传入也会被后端丢弃；渠道编码由服务端生成（C 加 id），不用填也不能改；
//   - 列表按渠道维度返回嵌套结构：{ id, name, code, editable, shops }——字段是 code（不是 channelCode）；
//     editable 为 0/1：0=系统写死渠道（如抖音接入第三方API，不可编辑/删除，编辑返回 403「抖音渠道不支持编辑」）；
//     shops 为该渠道下店铺列表（目前仅抖音下有店铺），新渠道 shops 为 []；
//   - 删除渠道：抖音（editable=0）返回 403「抖音渠道不支持删除」；
//     渠道下有订单返回 code 409「该渠道已有订单，不能删除」；无订单直接删除渠道，
//     店铺行不再挂到任何渠道（GET /channels 不再返回）；
//   - 编辑重名：PUT 改成已有渠道名 → code 409「渠道名称已存在」（HTTP 仍为 200，看响应体 code）；
//   - 编辑/删除使用列表项里的 id。
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

  /**
   * 全部店铺（供选择器使用，已把渠道下的 shops 拍平为店铺列表）
   * 真实返回结构：data = [{ id, name(渠道名), code(渠道编码), editable,
   *   shops: [{ id, shopId, shopName }] }]
   * @returns {Promise<Array<{id:number, channel:string, channelCode:string, shopId:string, shopName:string}>>}
   */
  all: async () => {
    const data = await request.get('/api/admin/channels');
    const channels = Array.isArray(data)
      ? data
      : data && Array.isArray(data.list)
        ? data.list
        : [];
    const shops = [];
    channels.forEach((ch) => {
      const list = Array.isArray(ch.shops) ? ch.shops : [];
      list.forEach((sh) => {
        shops.push({
          id: sh.id,
          channel: ch.name || '',
          channelCode: ch.code || '',
          shopId: sh.shopId || '',
          shopName: sh.shopName || '',
        });
      });
    });
    return shops;
  },

  /** 新增渠道（只传渠道名称，渠道编码由服务端生成）@param {{name:string}} data */
  create: ({ name }) =>
    request.post('/api/admin/channels', { name: String(name || '').trim() }),

  /** 编辑渠道（与新增一致，只传渠道名称）@param {number} id @param {{name:string}} data */
  update: (id, { name }) =>
    request.put(`/api/admin/channels/${id}`, { name: String(name || '').trim() }),

  /** 删除渠道 @param {number} id */
  remove: (id) => request.del(`/api/admin/channels/${id}`),
};

/**
 * 渠道编码 → 渠道名称映射（后端契约 2026-10-22）
 * 订单列表/详情/领单大厅/催单列表只回 channelCode（存的编码，如 DOUYIN、C1792654075578006），
 * 没有渠道名称字段；渠道列要显示名称时用 GET /api/admin/channels 做 code → name 映射，
 * 不再使用写死的 DOUYIN / XHS / PRIVATE。
 * @returns {Promise<Object<string,string>>} { code: name }；读取不到名称的编码以编码自身兜底
 */
export async function channelNameMap() {
  const data = await request.get('/api/admin/channels');
  const list = Array.isArray(data) ? data : [];
  const map = {};
  list.forEach((ch) => {
    const code = String(ch.channelCode || ch.code || '').trim();
    const name = String(ch.name || ch.shopName || ch.channelName || '').trim();
    if (code) map[code] = name || code;
  });
  return map;
}
