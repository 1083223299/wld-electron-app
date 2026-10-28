import { request } from '../request';
import { NOTIFY_TYPE } from '../notifySocket';

/**
 * 系统通知（管理端）接口
 * 依据 Apifox「未来洞电竞后台 / 09-通知 / 系统通知」OpenAPI 规格：
 * - 全部接口鉴权：Header Authorization: Bearer {token}（后台 JWT，三端 JWT 互不通用），
 *   request.js 已自动附加当前登录 token，无需重复传参
 * - 列表：GET /api/admin/notifications（page/pageSize 分页），返回 { list, unread, badge }
 *   列表项：id / scene / sceneLabel / title / content / bizKey / readFlag / createdAt /
 *           orderId / jumpTarget(ORDER) / orderNo / timeText(相对时间)
 * - 未读角标：GET /api/admin/notifications/unread → { unread, badge（>99 为 '99+'） }
 * - 已读：POST /api/admin/notifications/{id}/read（无 body，返回 { ok }）；
 *   已读后后端经 WebSocket 推 type=UNREAD（仅 unread/badge）
 */

/* ================= 场景 → 通知类型（页面跳转/标签用） ================= */

/** 已知场景枚举的显式映射（与 NOTIFY_TYPE 对齐） */
export const SCENE_TYPE_MAP = {
  TAKE_TIMEOUT: NOTIFY_TYPE.STUCK, // 接单超时未接单 → 卡单预警（跳订单列表）
};

/** 场景 → 通知类型：先查显式映射，未收录的按关键字兜底，默认系统通知 */
export function sceneToType(scene = '') {
  if (SCENE_TYPE_MAP[scene]) return SCENE_TYPE_MAP[scene];
  const s = String(scene || '').toUpperCase();
  if (s.includes('HANDOVER')) return NOTIFY_TYPE.HANDOVER;
  if (s.includes('STUCK') || s.includes('TIMEOUT')) return NOTIFY_TYPE.STUCK;
  return NOTIFY_TYPE.SYSTEM;
}

/** 后端通知项 → 页面列表项（字段与 stores/notify.js 的 normalize 对齐） */
export function normalizeNotification(raw = {}) {
  return {
    id: raw.id,
    type: sceneToType(raw.scene),
    title: raw.title || '系统通知',
    content: raw.content || '',
    bizKey: raw.bizKey || '',
    time: raw.createdAt || '',
    timeText: raw.timeText || '',
    sceneLabel: raw.sceneLabel || '',
    scene: raw.scene || '',
    orderId: raw.orderId || null,
    orderNo: raw.orderNo || '',
    jumpTarget: raw.jumpTarget || '',
    applicationId: raw.applicationId || raw.playerApplicationId || raw.bizKey || '',
    playerId: raw.playerId || raw.userId || '',
    playerName: raw.playerName || raw.applicantName || raw.name || '',
    phone: raw.phone || raw.playerPhone || raw.applicantPhone || raw.mobile || '',
    mentions: Array.isArray(raw.mentions) ? raw.mentions : [],
    read: raw.readFlag === 1,
  };
}

/** 列表分页结果 → { list, unread, badge }（兼容旧数组返回） */
export function normalizeNotificationPage(data) {
  if (Array.isArray(data)) return { list: data, unread: 0, badge: '' };
  return {
    list: Array.isArray(data && data.list) ? data.list : [],
    unread: Number(data && data.unread) || 0,
    badge: (data && data.badge) != null ? String(data.badge) : '',
  };
}

/* ================= 系统通知（管理端）接口 ================= */

export const notifyApi = {
  /** 我的通知（管理端）GET /api/admin/notifications（分页；返回 { list, unread, badge }） */
  list: (params = {}) => {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;
    return request.get(`/api/admin/notifications?page=${page}&pageSize=${pageSize}`);
  },

  /** 未读角标（管理端）GET /api/admin/notifications/unread → { unread, badge } */
  unread: () => request.get('/api/admin/notifications/unread'),

  /** 标记通知已读 POST /api/admin/notifications/{id}/read（无 body，返回 { ok }） */
  markRead: (id) => request.post(`/api/admin/notifications/${id}/read`),
};
