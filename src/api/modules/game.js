import { request } from '../request';

// =====================================================================
// 游戏管理 / 规格管理：已按 OpenAPI 联调真实后端（鉴权走 request.js 自动附加 Bearer token）
//   GET    /api/admin/games                  游戏列表（全量返回，无分页参数，分页/筛选由页面本地完成）
//   POST   /api/admin/games                  新增游戏   body: { name, settleDays, holdForm }
//   PUT    /api/admin/games/{id}             编辑游戏   body: { name, settleDays, holdForm }
//   DELETE /api/admin/games/{id}             删除游戏（软删）
//   GET    /api/admin/games/{gameId}/specs   规格列表
//   POST   /api/admin/games/{gameId}/specs   新增规格   body: { name }
//   PUT    /api/admin/games/{gameId}/specs/{id}  编辑规格   body: { name }
//   DELETE /api/admin/games/{gameId}/specs/{id}  删除规格（软删）
//
// 说明：
//   - 后端字段为 settleDays（结算天数）、holdForm（存单表单），页面表单已对齐；
//   - holdForm 枚举：WARRANTY 保底把数 / REMARK 存单备注，名称含三角洲时新建默认 WARRANTY（与后端一致）；
//   - 新增/编辑游戏时规格通过独立规格接口维护，见 createWithSpecs / updateWithSpecs；
//   - SKU 映射已接入真实接口（GET/PUT /api/admin/sku-mappings），见文件尾部；
//     「按商品 ID 拉取 SKU」后端暂无对应接口，保留本地模拟，待后端确认。
// =====================================================================

/** 存单表单选项：WARRANTY 保底把数；REMARK 存单备注 */
export const HOLD_FORM_OPTIONS = [
  { value: 'WARRANTY', label: '保底把数' },
  { value: 'REMARK', label: '存单备注' },
];

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

export const gameApi = {
  // ============ 游戏主表 ============

  /**
   * 游戏列表（接口全量返回，本地分页/筛选由页面处理）
   * 返回已归一化的数组，兼容后端 data 为数组或 { list } 等包裹结构
   * @returns {Promise<Array<{id:number, name:string, status?:string, settleDays?:number, createTime?:string}>>}
   */
  list: async () => toArray(await request.get('/api/admin/games')),

  /** 新增游戏 @param {{name:string, settleDays:number, holdForm?:string}} data */
  create: ({ name, settleDays, holdForm }) =>
    request.post('/api/admin/games', { name, settleDays, holdForm }),

  /** 编辑游戏 @param {number} id @param {{name:string, settleDays:number, holdForm?:string}} data */
  update: (id, { name, settleDays, holdForm }) =>
    request.put(`/api/admin/games/${id}`, { name, settleDays, holdForm }),

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

  // ============ 复合操作：新增/编辑游戏时同步维护规格 ============

  /**
   * 新增游戏 + 批量新增规格
   * @param {{name:string, settleDays:number, holdForm?:string, specs:string[]}} data
   */
  createWithSpecs: async ({ name, settleDays, holdForm, specs = [] } = {}) => {
    const game = await gameApi.create({ name, settleDays, holdForm });
    if (specs.length) {
      await Promise.all(specs.map((specName) => gameApi.createSpec(game.id, specName)));
    }
    return game;
  },

  /**
   * 编辑游戏 + 规格差异同步（新增缺失规格、删除多余规格，名称变更按“删旧增新”处理）
   * @param {number} id 游戏 ID
   * @param {{name:string, settleDays:number, holdForm?:string, specs:string[]}} data
   */
  updateWithSpecs: async (id, { name, settleDays, holdForm, specs = [] } = {}) => {
    await gameApi.update(id, { name, settleDays, holdForm });
    const current = (await gameApi.specs(id)) || [];
    const currentNames = new Set(current.map((s) => s.name));
    const targetSet = new Set(specs);
    const tasks = [];
    for (const specName of specs) {
      if (!currentNames.has(specName)) tasks.push(gameApi.createSpec(id, specName));
    }
    for (const spec of current) {
      if (!targetSet.has(spec.name)) tasks.push(gameApi.removeSpec(id, spec.id));
    }
    await Promise.all(tasks);
    return true;
  },

  /** 全部游戏（供 SKU 映射 / 玩家 / 俱乐部下拉选择），附带各游戏规格名 */
  all: async () => {
    const games = toArray(await gameApi.list());
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
  //   GET /api/admin/sku-mappings   列表：服务端仅支持 shopId/productId 两个 Query，无分页；
  //                                  skuId/skuName/matched/gameId 在本地过滤后分页
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
   * 接口仅按 shopId/productId 筛选且不分页；skuId/skuName/matched/gameId 在本地过滤后分页
   * @param {{page?:number,pageSize?:number,shopId?:string,productId?:string,skuId?:string,skuName?:string,matched?:string,gameId?:number}} params
   * @returns {Promise<{total:number,list:Array}>}
   *   list 项：{id, shopId, productId, skuId, gameId, specId, clients, itemName}
   */
  skuList: async (params = {}) => {
    const { page = 1, pageSize = 10, shopId = '', productId = '', skuId = '', skuName = '', matched = '', gameId = '' } = params;
    const qs = new URLSearchParams();
    if (shopId) qs.set('shopId', String(shopId).trim());
    if (productId) qs.set('productId', String(productId).trim());
    const query = qs.toString();
    const all = toArray(await request.get(`/api/admin/sku-mappings${query ? `?${query}` : ''}`));
    const kwSkuId = String(skuId || '').trim();
    const kwSkuName = String(skuName || '').trim();
    const gid = gameId ? Number(gameId) : '';
    let list = all;
    if (kwSkuId) list = list.filter((s) => String(s.skuId || '') === kwSkuId); // SKUID 完全匹配
    if (kwSkuName) list = list.filter((s) => String(s.itemName || '').includes(kwSkuName)); // SKU名称 模糊匹配
    if (gid !== '') list = list.filter((s) => Number(s.gameId) === gid);
    if (matched === 'matched') list = list.filter((s) => s.gameId && s.specId);
    if (matched === 'unmatched') list = list.filter((s) => !s.gameId || !s.specId);
    return {
      total: list.length,
      list: list.slice((page - 1) * pageSize, page * pageSize),
    };
  },

  /**
   * 由商品 ID 批量拉取店铺下的 SKU（添加商品时用）
   * 后端暂未提供按商品 ID 拉取 SKU 的管理端接口（文档仅有 sku-mappings 列表/保存），
   * 暂保留本地模拟供 UI 走通，待后端确认对应接口后替换。
   * @param {{productIds:string}} productIds 多个商品ID用逗号分隔
   */
  fetchSkusByProductIds: ({ productIds = '' } = {}) =>
    request.mock(null, 400).then(() => {
      const ids = String(productIds)
        .split(/[,，\s]+/)
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
