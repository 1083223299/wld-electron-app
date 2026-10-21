import { request } from '../request';

// =====================================================================
// 游戏管理 / 规格管理：已按 OpenAPI 联调真实后端（鉴权走 request.js 自动附加 Bearer token）
//   GET    /api/admin/games                  游戏列表（全量返回，无分页参数，分页/筛选由页面本地完成）
//   POST   /api/admin/games                  新增游戏   body: { name, settleDays }
//   PUT    /api/admin/games/{id}             编辑游戏   body: { name, settleDays }
//   DELETE /api/admin/games/{id}             删除游戏（软删）
//   GET    /api/admin/games/{gameId}/specs   规格列表
//   POST   /api/admin/games/{gameId}/specs   新增规格   body: { name }
//   PUT    /api/admin/games/{gameId}/specs/{id}  编辑规格   body: { name }
//   DELETE /api/admin/games/{gameId}/specs/{id}  删除规格（软删）
//
// 说明：
//   - 后端字段为 settleDays（结算天数），页面表单/列展示已对齐该字段；
//   - 新增/编辑游戏时规格通过独立规格接口维护，见 createWithSpecs / updateWithSpecs；
//   - SKU 映射相关接口（skuList / fetchSkusByProductIds / updateSku）暂无对应后端接口，
//     暂保持本地 Mock，待后端提供接口文档后替换。
// =====================================================================

export const gameApi = {
  // ============ 游戏主表 ============

  /**
   * 游戏列表（接口全量返回，本地分页/筛选由页面处理）
   * @returns {Promise<Array<{id:number, name:string, status?:string, settleDays?:number, createTime?:string}>>}
   */
  list: () => request.get('/api/admin/games'),

  /** 新增游戏 @param {{name:string, settleDays:number}} data */
  create: ({ name, settleDays }) => request.post('/api/admin/games', { name, settleDays }),

  /** 编辑游戏 @param {number} id @param {{name:string, settleDays:number}} data */
  update: (id, { name, settleDays }) =>
    request.put(`/api/admin/games/${id}`, { name, settleDays }),

  /** 删除游戏（软删） @param {number} id */
  remove: (id) => request.del(`/api/admin/games/${id}`),

  // ============ 游戏规格 ============

  /** 规格列表 @param {number} gameId */
  specs: (gameId) => request.get(`/api/admin/games/${gameId}/specs`),

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
   * @param {{name:string, settleDays:number, specs:string[]}} data
   */
  createWithSpecs: async ({ name, settleDays, specs = [] } = {}) => {
    const game = await gameApi.create({ name, settleDays });
    if (specs.length) {
      await Promise.all(specs.map((specName) => gameApi.createSpec(game.id, specName)));
    }
    return game;
  },

  /**
   * 编辑游戏 + 规格差异同步（新增缺失规格、删除多余规格，名称变更按“删旧增新”处理）
   * @param {number} id 游戏 ID
   * @param {{name:string, settleDays:number, specs:string[]}} data
   */
  updateWithSpecs: async (id, { name, settleDays, specs = [] } = {}) => {
    await gameApi.update(id, { name, settleDays });
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
    const games = (await gameApi.list()) || [];
    return Promise.all(
      games.map(async (g) => {
        let specs = [];
        try {
          specs = (await gameApi.specs(g.id)) || [];
        } catch {
          // 单个游戏规格拉取失败不阻塞整个下拉列表
        }
        return { id: g.id, name: g.name, specs: specs.map((s) => s.name) };
      })
    );
  },

  // =====================================================================
  // SKU 映射（暂无后端接口，保持本地 Mock）
  // =====================================================================

  // ===== SKU 映射表（内存 mock DB） =====
  // 一条记录 = 一个店铺下的一个 SKU，映射到某个游戏的某个规格
  _skuDb: [
    {
      id: 1,
      channel: '抖音',
      shop: '张三店铺',
      productId: '896377857678',
      skuId: '896377857678',
      skuName: '绝密航天/巴克累计2088W 双子星（店长强推美吃）',
      client: ['手游', '端游'],
      gameId: 46546,
      gameName: '三角洲',
      spec: '护航',
      matched: true,
    },
    {
      id: 2,
      channel: '抖音',
      shop: '张三店铺',
      productId: '896377857679',
      skuId: '896377857679',
      skuName: '和平精英 代练 星钻上王者',
      client: ['手游'],
      gameId: 46547,
      gameName: '和平精英',
      spec: '单排上分',
      matched: true,
    },
    {
      id: 3,
      channel: '抖音',
      shop: '张三店铺',
      productId: '896377857680',
      skuId: '896377857680',
      skuName: '王者荣耀 陪玩 大神双排',
      client: ['手游'],
      gameId: null,
      gameName: '',
      spec: '',
      matched: false,
    },
    {
      id: 4,
      channel: '抖音',
      shop: '张三店铺',
      productId: '896377857681',
      skuId: '896377857681',
      skuName: '英雄联盟 排位代练',
      client: ['端游'],
      gameId: null,
      gameName: '',
      spec: '',
      matched: false,
    },
  ],

  _skuSeq: 5,

  /**
   * SKU 列表
   * @param {{page?:number,pageSize?:number,productId?:string,skuId?:string,skuName?:string,matched?:string,gameId?:number}} params
   */
  skuList: (params = {}) =>
    request.mock(null, 200).then(() => {
      const {
        page = 1,
        pageSize = 10,
        productId = '',
        skuId = '',
        skuName = '',
        matched = '',
        gameId = '',
      } = params;
      let list = gameApi._skuDb;
      if (gameId) list = list.filter((s) => s.gameId === Number(gameId));
      if (productId) list = list.filter((s) => s.productId === String(productId).trim());
      if (skuId) list = list.filter((s) => s.skuId === String(skuId).trim());
      if (skuName) list = list.filter((s) => s.skuName.includes(String(skuName).trim()));
      if (matched === 'matched') list = list.filter((s) => s.matched);
      if (matched === 'unmatched') list = list.filter((s) => !s.matched);
      return {
        total: list.length,
        list: list.slice((page - 1) * pageSize, page * pageSize),
      };
    }),

  /**
   * 由商品 ID 批量拉取店铺下的 SKU（人工添加商品时用）
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
          id: gameApi._skuSeq++,
          channel: '抖音',
          shop: '张三店铺',
          productId: pid,
          skuId: `${pid}00${idx + 1}`,
          skuName: `店铺商品 ${pid} - 规格SKU`,
          client: [],
          gameId: null,
          gameName: '',
          spec: '',
          matched: false,
        });
      });
      // 写入 DB
      gameApi._skuDb.push(...result);
      return result;
    }),

  /**
   * 编辑 SKU 映射
   * @param {{id:number,client:string[],gameId:number,gameName:string,spec:string}} data
   */
  updateSku: (data) =>
    request.mock(null, 200).then(() => {
      const item = gameApi._skuDb.find((s) => s.id === Number(data.id));
      if (!item) throw new Error('SKU 不存在');
      Object.assign(item, {
        client: data.client || [],
        gameId: data.gameId || null,
        gameName: data.gameName || '',
        spec: data.spec || '',
        matched: !!(data.gameId && data.spec),
      });
      return item;
    }),
};
