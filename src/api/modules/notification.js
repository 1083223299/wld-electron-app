import { request } from '../request';
import { NOTIFY_TYPE } from '../notifySocket';

/**
 * 系统通知（管理端）接口
 * 依据 Apifox「未来洞电竞后台 / 09-通知 / 系统通知」OpenAPI 规格：
 * - 全部接口鉴权：Header Authorization: Bearer {token}（后台 JWT，三端 JWT 互不通用），
 *   request.js 已自动附加当前登录 token，无需重复传参
 * - 列表项字段：id / scene / title / content / bizKey / readFlag(0 未读 1 已读) / createdAt
 * - 列表接口无 Query 参数；已读接口无 body
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
    read: raw.readFlag === 1,
  };
}

/* ================= 系统通知（管理端）接口 ================= */

export const notifyApi = {
  /** 我的通知（管理端）GET /api/admin/notifications（无 Query 参数，返回数组） */
  list: () => request.get('/api/admin/notifications'),

  /** 标记通知已读 POST /api/admin/notifications/{id}/read（无 body，返回 { ok }） */
  markRead: (id) => request.post(`/api/admin/notifications/${id}/read`),
};
