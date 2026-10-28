import { request } from '../request';

// 网关使用管理端路由前缀；Apifox 业务文档中的路径不包含该前缀。
const ADMIN_HEADERS = { 'X-Wld-Client': 'ADMIN' };

export const specPriceApi = {
  /** GET /api/admin/custom-spec/games */
  listGames: () => request.get('/api/admin/custom-spec/games', ADMIN_HEADERS),

  /** POST /api/admin/custom-spec/games */
  registerGame: (data) => request.post('/api/admin/custom-spec/games', data, ADMIN_HEADERS),

  /** GET /api/admin/custom-spec/games/{gameId}/types */
  listTypes: (gameId) => request.get(`/api/admin/custom-spec/games/${gameId}/types`, ADMIN_HEADERS),

  /** GET /api/admin/custom-spec/games/{gameId}/ranks */
  listRanks: async (gameId) => {
    const response = await request.get(`/api/admin/custom-spec/games/${gameId}/ranks`, ADMIN_HEADERS);
    if (!Array.isArray(response?.ranks)) {
      throw new Error('段位目录接口返回数据格式错误');
    }
    return {
      ranks: response.ranks,
      groups: Array.isArray(response.groups) ? response.groups : [],
      placementSeasons: Array.isArray(response.placementSeasons) ? response.placementSeasons : [],
    };
  },

  /** PUT /api/admin/custom-spec/games/{gameId}/types */
  saveTypes: (gameId, data) =>
    request.put(`/api/admin/custom-spec/games/${gameId}/types`, data, ADMIN_HEADERS),

  /** GET /api/admin/custom-spec/games/{gameId}/types/{typeCode}/prices */
  listPrices: (gameId, typeCode) =>
    request.get(`/api/admin/custom-spec/games/${gameId}/types/${encodeURIComponent(typeCode)}/prices`, ADMIN_HEADERS),

  /** 全量替换价目；请求体为 { items: [...] }，明细只提交接口定义字段。 */
  replacePrices: (gameId, typeCode, items) =>
    request.put(
      `/api/admin/custom-spec/games/${gameId}/types/${encodeURIComponent(typeCode)}/prices`,
      {
        items: items.map((row) => {
          const item = {
            fieldCode: row.fieldCode,
            fromKey: row.fromKey ?? '',
            toKey: row.toKey ?? '',
            fallback: Boolean(row.fallback),
          };
          if (row.dimJson != null && row.dimJson !== '') item.dimJson = row.dimJson;
          if (row.amount != null) item.amount = row.amount;
          if (row.percent != null) item.percent = row.percent;
          return item;
        }),
      },
      ADMIN_HEADERS,
    ),
};
