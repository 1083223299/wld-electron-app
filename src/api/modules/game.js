import { request } from '../request';

const { mock } = request;

// ===== 游戏主表（内存 mock DB） =====
const GAME_DB = [
  {
    id: 46546,
    name: '三角洲',
    specs: ['护航', '陪玩'],
    billPeriodDays: 7,
    createTime: '2026-10-10 11:12:22',
    deleted: false,
  },
  {
    id: 46547,
    name: '和平精英',
    specs: ['单排上分', '四排吃鸡'],
    billPeriodDays: 7,
    createTime: '2026-10-10 11:12:22',
    deleted: false,
  },
  {
    id: 46548,
    name: '王者荣耀',
    specs: ['段位上分', '陪玩'],
    billPeriodDays: 15,
    createTime: '2026-10-08 09:30:00',
    deleted: false,
  },
  {
    id: 46549,
    name: '英雄联盟',
    specs: ['排位上分', '云顶之弈'],
    billPeriodDays: 7,
    createTime: '2026-10-05 16:20:11',
    deleted: false,
  },
  {
    id: 46550,
    name: '永劫无间',
    specs: ['排位赛', '陪练'],
    billPeriodDays: 30,
    createTime: '2026-09-28 14:08:55',
    deleted: false,
  },
];

// ===== SKU 映射表（内存 mock DB） =====
// 一条记录 = 一个店铺下的一个 SKU，映射到某个游戏的某个规格
const SKU_DB = [
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
];

let gameSeq = 46551;
let skuSeq = 5;

const now = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const inRange = (value, range) => {
  if (!Array.isArray(range) || !range.length) return true;
  const [start, end] = range;
  if (!start && !end) return true;
  // createTime 是 'YYYY-MM-DD HH:mm:ss' 字符串，可直接字典比较
  if (start && String(value) < new Date(start).toISOString().slice(0, 10)) return false;
  if (end && String(value) > `${new Date(end).toISOString().slice(0, 10)} 23:59:59`) return false;
  return true;
};

export const gameApi = {
  /**
   * 游戏列表
   * @param {{page?:number,pageSize?:number,gameId?:string,gameName?:string,createTime?:Array}} params
   */
  list: (params = {}) =>
    mock(null, 200).then(() => {
      const { page = 1, pageSize = 10, gameId = '', gameName = '', createTime = [] } = params;
      let list = GAME_DB.filter((g) => !g.deleted);
      if (gameId) list = list.filter((g) => String(g.id) === String(gameId).trim());
      if (gameName) list = list.filter((g) => g.name.includes(String(gameName).trim()));
      list = list.filter((g) => inRange(g.createTime, createTime));
      // 按创建时间倒序
      list = [...list].sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
      return {
        total: list.length,
        list: list.slice((page - 1) * pageSize, page * pageSize),
      };
    }),

  /** 全部游戏（供 SKU 映射下拉选择） */
  all: () =>
    mock(null, 100).then(() =>
      GAME_DB.filter((g) => !g.deleted).map((g) => ({
        id: g.id,
        name: g.name,
        specs: g.specs,
      }))
    ),

  create: (data) =>
    mock(null, 200).then(() => {
      // 唯一性校验
      const dup = GAME_DB.find((g) => !g.deleted && g.name === data.name);
      if (dup) throw new Error('游戏名称已存在');
      const item = {
        id: gameSeq++,
        name: data.name,
        specs: data.specs || [],
        billPeriodDays: Number(data.billPeriodDays),
        createTime: now(),
        deleted: false,
      };
      GAME_DB.unshift(item);
      return item;
    }),

  update: (id, data) =>
    mock(null, 200).then(() => {
      const item = GAME_DB.find((g) => g.id === Number(id));
      if (!item) throw new Error('游戏不存在');
      const dup = GAME_DB.find(
        (g) => !g.deleted && g.id !== Number(id) && g.name === data.name
      );
      if (dup) throw new Error('游戏名称已存在');
      Object.assign(item, {
        name: data.name,
        specs: data.specs || [],
        billPeriodDays: Number(data.billPeriodDays),
      });
      return item;
    }),

  /** 软删除 */
  remove: (id) =>
    mock(null, 200).then(() => {
      const item = GAME_DB.find((g) => g.id === Number(id));
      if (item) item.deleted = true;
      return true;
    }),

  // ============ SKU 映射 ============

  /**
   * SKU 列表
   * @param {{page?:number,pageSize?:number,productId?:string,skuId?:string,skuName?:string,matched?:string,gameId?:number}} params
   */
  skuList: (params = {}) =>
    mock(null, 200).then(() => {
      const {
        page = 1,
        pageSize = 10,
        productId = '',
        skuId = '',
        skuName = '',
        matched = '',
        gameId = '',
      } = params;
      let list = SKU_DB;
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
    mock(null, 400).then(() => {
      const ids = String(productIds)
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!ids.length) return [];
      // 模拟：根据商品ID生成几个未匹配的 SKU
      const result = [];
      ids.forEach((pid, idx) => {
        result.push({
          id: skuSeq++,
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
      SKU_DB.push(...result);
      return result;
    }),

  /**
   * 编辑 SKU 映射
   * @param {{id:number,client:string[],gameId:number,gameName:string,spec:string}} data
   */
  updateSku: (data) =>
    mock(null, 200).then(() => {
      const item = SKU_DB.find((s) => s.id === Number(data.id));
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
