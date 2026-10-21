import { request } from '../request';

/**
 * 后端角色 → 前端角色枚举映射
 * 后端返回大写枚举（ADMIN / KEFU / AUDITOR / FINANCE），
 * 前端页面按小写枚举判断按钮显隐（OrderListTab.vue 等）：
 *   service → 客服（无"我的订单"，隐藏审核按钮）
 *   audit   → 审核员（仅审核/查看）
 *   admin   → 管理员（全部按钮）
 *   finance → 财务（页面无特判，按默认展示；如需要可在此扩展权限判断）
 */
const ROLE_MAP = {
  ADMIN: 'admin',
  KEFU: 'service',
  AUDITOR: 'audit',
  FINANCE: 'finance',
};

function normalizeRole(role) {
  const mapped = ROLE_MAP[role];
  if (mapped) return mapped;
  const lower = String(role || '').toLowerCase();
  return lower || 'admin';
}

/**
 * 把后端登录/me 返回的 data 映射成前端 user 对象
 * data 形如 { loginId, client, role, accountId, clubId, name, wecomName }
 */
function toUser(data = {}) {
  return {
    id: data.accountId,
    username: data.name,
    name: data.name,
    role: normalizeRole(data.role),
    client: data.client,
    loginId: data.loginId,
    accountId: data.accountId,
    clubId: data.clubId,
    wecomName: data.wecomName,
  };
}

export const authApi = {
  /**
   * 企微 ID 下拉（登录页）
   * GET /api/admin/auth/wecom-options，未登录可调
   * 返回 [{ wecomId, label, name, username }]
   */
  getWecomOptions: () => request.get('/api/admin/auth/wecom-options'),

  /**
   * 登录（管理端）
   * POST /api/admin/auth/login
   * 必填 username / password；client 管理端固定 ADMIN（直连时必填，经网关由前缀决定）；
   * wecomId 可选，须与该账号 wecom_name 一致（登录页企微下拉取值）
   */
  login: ({ username, password, wecomId }) =>
    request
      .post('/api/admin/auth/login', {
        client: 'ADMIN',
        username,
        password,
        ...(wecomId ? { wecomId } : {}),
      })
      .then((data) => {
        // data: { token, client, role, name, accountId, clubId }
        const user = toUser(data);
        return { token: data.token, user };
      }),

  /** 当前登录用户（管理端） GET /api/admin/me，token 由 request.js 自动带 Bearer */
  me: () => request.get('/api/admin/me').then((data) => toUser(data)),
};
