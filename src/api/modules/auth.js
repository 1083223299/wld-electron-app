import { request } from '../request';

const { mock } = request;

/**
 * 登录 mock：按账号推断角色，便于演示不同角色的按钮显隐
 * - 账号含 service → 客服（无"我的订单"，隐藏审核按钮）
 * - 账号含 audit   → 审核员（仅审核/查看）
 * - 其他           → 管理员（全部按钮）
 */
function inferRole(username) {
  const u = String(username || '').toLowerCase();
  if (u.includes('service')) return 'service';
  if (u.includes('audit')) return 'audit';
  return 'admin';
}

function inferName(role, username) {
  if (role === 'service') return '客服张三';
  if (role === 'audit') return '审核员李四';
  return '管理员';
}

export const authApi = {
  login: ({ username, password }) => {
    const role = inferRole(username);
    return mock(
      {
        token: 'mock-token-demo',
        user: {
          id: 1,
          username,
          role,
          name: inferName(role, username),
        },
      },
      300,
    ).then((payload) => {
      if (!username || !password) {
        throw new Error('用户名和密码不能为空');
      }
      if (password.length < 6) {
        throw new Error('密码长度不能少于 6 位');
      }
      return payload;
    });
  },
};
