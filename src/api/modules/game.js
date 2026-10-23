import { request } from '../request';

// =====================================================================
// 游戏管理 / 规格管理：已按 OpenAPI 联调真实后端（鉴权走 request.js 自动附加 Bearer token）
//   GET    /api/admin/games                  游戏列表（服务端分页/筛选：id/name/createdFrom/createdTo/page/pageSize，
//                                                 返回分页对象，list 项含内联 specs[{id,gameId,name}]）
//   POST   /api/admin/games                  新增游戏   body: { name, settleDays, specs }
//   PUT    /api/admin/games/{id}             编辑游戏   body: { name, settleDays, specs }
//   DELETE /api/admin/games/{id}             删除游戏（软删）
//   GET    /api/admin/games/{gameId}/specs   规格列表
//   POST   /api/admin/games/{gameId}/specs   新增规格   body: { name }
//   PUT    /api/admin/games/{gameId}/specs/{id}  编辑规格   body: { name }
//   DELETE /api/admin/games/{gameId}/specs/{id}  删除规格（软删）
//
// 说明（接口文档 2026-10 更新，测试服已验证）：
//   - 新增/编辑游戏时规格随主表单内联提交：specs 为数组，元素可为 { name } 对象或字符串，
//     后端亦兼容 specNames 旧字段；前端统一转为 [{ name }]；
//   - 编辑为“补齐”语义：PUT 只会新增缺失的规格、保持已有规格，不会删除表单中移除的行；
//     表单中删除的规格由前端显式调用 DELETE /games/{gameId}/specs/{id}；
//   - 同游戏下规格名称唯一：游戏保存接口静默跳过同名规格不报错；
//     单独新增/改名规格接口才返回 code 409「规格名称已存在」；
//   - 存单表单（holdForm）不再由表单提交，后端按游戏名称自动判定：
//     名称含「三角洲」（包含匹配，如「三角洲行动」）记保底 WARRANTY，其余记备注 REMARK；
//     编辑时不传 holdForm，保持原值，不会因改名重新判定；
//   - 校验口径（新增/编辑一致，HTTP 均为 200、看响应体 code；仅禁止操作才是 HTTP 403）：
//     游戏名重复 → code 409「游戏名称已存在」（编辑时改成自己原来的名字可通过）；
//     游戏名超 15 字 → code 400「游戏名称最多15字」；
//     settleDays 不传/0/负数/小数/非数字 → code 400「请填写账期天数」（编辑时不传则保持原天数）；
//   - 规格独立接口保留，供规格列表/下拉与 SKU 映射等场景使用；
//   - SKU 映射已接入真实接口（GET/PUT /api/admin/sku-mappings），见文件尾部；
//     「按商品 ID 拉取 SKU」后端暂无对应接口，保留本地模拟，待后端确认。
// =====================================================================

/**
 * 兼容后端返回结构差异，归一化为数组：
 * 数组原样返回；对象则尝试提取 list / records / items / data 数组字段；其余返回空数组
 * @param {any} value
 * @returns {Array}
 */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.list)) return value.list;
    if (Array.isArray(value.records)) return value.records;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.data)) return value.data;
  }
  return [];
}

/** 规格归一化：字符串或 { name } 对象统一转为 { name }（与接口文档示例一致） */
function normalizeSpecs(specs) {
  if (!Array.isArray(specs)) return [];
  return specs.map((s) => (typeof s === 'string' ? { name: s } : s));
}

export const gameApi = {
  // ============ 游戏主表 ============

  /**
   * 游戏列表（服务端分页/筛选，GET /api/admin/games）
   * 接口支持 id（完全匹配）/name（模糊）/createdFrom/createdTo/page/pageSize；
   * 返回分页对象 data{total,page,pageSize,list}，list 项含内联 specs[{id,gameId,name}]
   * @param {{page?:number,pageSize?:number,id?:number|string,name?:string,createdFrom?:string,createdTo?:string}} params
   * @returns {Promise<{total:number,list:Array<{id:number,name:string,settleDays?:number,holdForm?:string,createdAt?:string,specs?:Array}>}>}
   */
  list: async (params = {}) => {
    const qs = new URLSearchParams();
    const { page = 1, pageSize = 20, id = '', name = '', createdFrom = '', createdTo = '' } = params;
    if (id !== '') qs.set('id', String(id).trim());
    if (name) qs.set('name', String(name).trim());
    if (createdFrom) qs.set('createdFrom', String(createdFrom).trim());
    if (createdTo) qs.set('createdTo', String(createdTo).trim());
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
    const query = qs.toString();
    const res = await request.get(`/api/admin/games${query ? `?${query}` : ''}`);
    const data = res?.data ?? res;
    if (Array.isArray(data)) {
      // 兼容旧结构：data 直接为数组
      return { total: data.length, list: data };
    }
    return { total: data?.total ?? 0, list: toArray(data) };
  },

  /**
   * 游戏全量（循环拉取供下拉选择：SKU 映射/玩家/俱乐部），每页 100 条直至取完
   * @returns {Promise<Array>} 与 list 返回的 list 项结构一致
   */
  listAll: async () => {
    const pageSize = 100;
    let page = 1;
    const all = [];
    for (;;) {
      const { total, list } = await gameApi.list({ page, pageSize });
      all.push(...list);
      if (!list.length || all.length >= total || list.length < pageSize) break;
      page += 1;
    }
    return all;
  },

  /**
   * 新增游戏（规格内联提交，specs 元素可为字符串或 { name }）
   * 额外透传原型新增字段：logo（游戏logo）、customOrderEnabled（用户自定义下单开关，字段名待后端确认）
   * @param {{name:string, settleDays:number, specs:Array<string|{name:string}>, logo?:string, customOrderEnabled?:number|boolean}} data
   */
  create: ({ name, settleDays, specs, ...extra }) =>
    request.post('/api/admin/games', { name, settleDays, specs: normalizeSpecs(specs), ...extra }),

  /**
   * 编辑游戏（规格内联提交，与新增一致）
   * 额外透传 logo / customOrderEnabled（字段名待后端确认）
   * @param {number} id
   * @param {{name:string, settleDays:number, specs:Array<string|{name:string}>, logo?:string, customOrderEnabled?:number|boolean}} data
   */
  update: (id, { name, settleDays, specs, ...extra }) =>
    request.put(`/api/admin/games/${id}`, { name, settleDays, specs: normalizeSpecs(specs), ...extra }),

  /** 删除游戏（软删） @param {number} id */
  remove: (id) => request.del(`/api/admin/games/${id}`),

  // ============ 游戏规格 ============

  /** 规格列表（返回已归一化数组）@param {number} gameId */
  specs: async (gameId) => toArray(await request.get(`/api/admin/games/${gameId}/specs`)),

  /** 新增规格 @param {number} gameId @param {string} name */
  createSpec: (gameId, name) => request.post(`/api/admin/games/${gameId}/specs`, { name }),

  /** 编辑规格 @param {number} gameId @param {number} id @param {string} name */
  updateSpec: (gameId, id, name) =>
    request.put(`/api/admin/games/${gameId}/specs/${id}`, { name }),

  /** 删除规格（软删） @param {number} gameId @param {number} id */
  removeSpec: (gameId, id) => request.del(`/api/admin/games/${gameId}/specs/${id}`),

  /** 全部游戏（供 SKU 映射 / 玩家 / 俱乐部下拉选择），附带各游戏规格名 */
  all: async () => {
    const games = await gameApi.listAll();
    return Promise.all(
      games.map(async (g) => {
        let specs = [];
        try {
          specs = toArray(await gameApi.specs(g.id));
        } catch {
          // 单个游戏规格拉取失败不阻塞整个下拉列表
        }
        return { id: g.id, name: g.name, specs: specs.map((s) => s.name ?? s) };
      })
    );
  },

  // =====================================================================
  // SKU 映射：已接入真实接口
  //   GET /api/admin/sku-mappings   列表（2026-10-23 后端确认）：
  //                                  Query 支持 shopId/productId/skuId(完全匹配)/itemName(模糊)/
  //                                  gameId/gameName(模糊)/matched(已匹配/未匹配，或1/0)/page/pageSize；
  //                                  返回分页对象 {total,page,pageSize,list}（兼容旧数组返回）
  //   PUT /api/admin/sku-mappings   保存  body: { id?, shopId, productId, skuId, gameId, specId, clients?, itemName? }
  // 列表行字段（spec）：{ id, shopId, productId, skuId, gameId, specId, clients, itemName }
  //   - clients 枚举 PC / MOBILE（也允许自由字符串）；
  //   - 行内不返回 shopName，店铺名由页面用 shopId 对照渠道表反查。
  // =====================================================================

  /** 客户端枚举：后端 PC/MOBILE → 页面中文 */
  _CLIENT_EN: { PC: '端游', MOBILE: '手游' },
  /** 页面中文 → 后端枚举（多选时逗号分隔） */
  _CLIENT_CN: { 端游: 'PC', 手游: 'MOBILE' },

  /**
   * SKU 映射列表（GET /api/admin/sku-mappings）
   * 服务端筛选/分页：skuId 完全匹配、itemName 模糊（页面 skuName 字段映射）、matched 已匹配/未匹配
   * @param {{page?:number,pageSize?:number,shopId?:string,productId?:string,skuId?:string,skuName?:string,matched?:string,gameId?:number}} params
   * @returns {Promise<{total:number,list:Array}>}
   *   list 项：{id, shopId, productId, skuId, gameId, specId, clients, itemName}
   */
  skuList: async (params = {}) => {
    const { page = 1, pageSize = 10, shopId = '', productId = '', skuId = '', skuName = '', matched = '', gameId = '' } = params;
    const qs = new URLSearchParams();
    if (page) qs.set('page', String(page));
    if (pageSize) qs.set('pageSize', String(pageSize));
    if (shopId) qs.set('shopId', String(shopId).trim());
    if (productId) qs.set('productId', String(productId).trim());
    if (skuId) qs.set('skuId', String(skuId).trim()); // 完全匹配
    const kwSkuName = String(skuName || '').trim();
    if (kwSkuName) qs.set('itemName', kwSkuName); // 模糊匹配（后端参数名 itemName）
    const gid = gameId ? Number(gameId) : '';
    if (gid !== '') qs.set('gameId', String(gid));
    if (matched) qs.set('matched', matched); // 已匹配/未匹配（或 1/0）
    const query = qs.toString();
    const res = await request.get(`/api/admin/sku-mappings${query ? `?${query}` : ''}`);
    const list = Array.isArray(res) ? res : (res && res.list) || [];
    const total = Array.isArray(res) ? list.length : (res && res.total) || list.length;
    return { total, list };
  },

  /**
   * 由商品 ID 批量拉取店铺下的 SKU（添加商品时用）
   * 后端 2026-10-23 确认：按商品 ID 实时拉取全部 SKU 本期不做（无抖音商品详情接口），
   * 前端不依赖该接口；此处保留本地模拟仅供 UI 走通，待后端提供对应接口后替换。
   * @param {{productIds:string}} productIds 多个商品ID用逗号分隔
   */
  fetchSkusByProductIds: ({ productIds = '' } = {}) =>
    request.mock(null, 400).then(() => {
      const ids = String(productIds)
        .split(/[;；\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!ids.length) return [];
      // 模拟：根据商品ID生成几个未匹配的 SKU
      const result = [];
      ids.forEach((pid, idx) => {
        result.push({
          id: Date.now() + idx,
          shopId: '',
          productId: pid,
          skuId: `${pid}00${idx + 1}`,
          itemName: `店铺商品 ${pid} - 规格SKU`,
          clients: '',
          gameId: null,
          specId: null,
        });
      });
      return result;
    }),

  /**
   * 保存 SKU 映射（PUT /api/admin/sku-mappings）
   * @param {{id?:number, shopId:string, productId:string, skuId:string, gameId:number, specId:number, clients?:string, itemName?:string}} data
   */
  updateSku: (data) => request.put('/api/admin/sku-mappings', data),
};
