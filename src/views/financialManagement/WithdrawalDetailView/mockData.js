/**
 * 财务管理 > 提现明细 模拟数据
 * 对应需求图《提现走系统自动打款》：
 * - 顶部「收益 / 押金」双 Tab
 * - 表格列：身份、账号ID、账号昵称、支付宝账号、提现金额(元)、状态、原因、提交时间
 * - 状态：待审核 / 打款成功 / 打款失败
 */

// 身份下拉选项（与收益明细保持一致）
export { IDENTITY_OPTIONS } from '../WalletDetailView/mockData';

// 收支类型下拉选项（提现明细场景）
export const WITHDRAW_TYPE_OPTIONS = [
  { label: '提现', value: '提现' },
  { label: '退回', value: '退回' },
];

// 状态枚举
export const STATUS_MAP = {
  pending: { text: '待审核', class: 'status-warning' },
  success: { text: '打款成功', class: 'status-success' },
  failed: { text: '打款失败', class: 'status-danger' },
};

// 固定演示账号（与需求图一致）
const DEMO_ACCOUNTS = [
  { role: 'club', accountId: '41646444', nickname: '张三俱乐部', alipay: '468443515315' },
  { role: 'player', accountId: '41646454', nickname: '李四', alipay: '468443515315' },
  { role: 'club', accountId: '41646466', nickname: '王者俱乐部', alipay: 'wangzhe@alipay.com' },
  { role: 'player', accountId: '41646478', nickname: '王五', alipay: '13800138000' },
];

// 打款失败原因池
const FAIL_REASONS = [
  '平台账号余额不足',
  '支付宝账号信息有误',
  '账户未实名认证',
  '收款账户异常',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 简单可复现伪随机（保证每次刷新数据一致）
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * 生成提现明细数据
 * @param {'income'|'deposit'} tab 收益 / 押金
 * @param {number} count 条数
 */
export function buildWithdrawalRows(tab = 'income', count = 658) {
  const rand = seededRandom(tab === 'income' ? 20261012 : 20261013);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const account = DEMO_ACCOUNTS[Math.floor(rand() * DEMO_ACCOUNTS.length)];
    const r = rand();
    // 约 30% 待审核、55% 打款成功、15% 打款失败
    const status = r < 0.3 ? 'pending' : r < 0.85 ? 'success' : 'failed';
    const amount = (Math.floor(rand() * 900) + 100) + (Math.floor(rand() * 100) / 100);
    const d = new Date(2026, 9, 10, 11, 12, 22);
    d.setSeconds(d.getSeconds() - i * 37);
    rows.push({
      id: `${tab}-${i}`,
      identity: account.role === 'club' ? '俱乐部' : '打手',
      accountId: account.accountId,
      nickname: account.nickname,
      alipayAccount: account.alipay,
      amount,
      status,
      reason: status === 'failed' ? FAIL_REASONS[Math.floor(rand() * FAIL_REASONS.length)] : '',
      type: '提现',
      submitTime: formatTime(d),
      tab,
    });
  }
  return rows;
}
