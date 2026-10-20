/**
 * 财务管理 > 收益明细（钱包明细）模拟数据
 * 对应需求图：顶部「收益 / 押金」双 Tab，明细流水表格
 */

// 身份下拉选项
export const IDENTITY_OPTIONS = [
  { label: '俱乐部', value: 'club' },
  { label: '打手', value: 'player' },
];

// 收益 Tab - 收支类型下拉选项
export const INCOME_TYPE_OPTIONS = [
  { label: '收入-订单收入', value: '收入-订单收入' },
  { label: '收入-平台充值', value: '收入-平台充值' },
  { label: '支出-提现成功', value: '支出-提现成功' },
  { label: '支出-平台扣除', value: '支出-平台扣除' },
  { label: '支出-转单扣除', value: '支出-转单扣除' },
  { label: '支出-余额抵扣', value: '支出-余额抵扣' },
];

// 押金 Tab - 钱包类型下拉选项
export const DEPOSIT_TYPE_OPTIONS = [
  { label: '押金缴纳', value: '押金缴纳' },
  { label: '押金扣除', value: '押金扣除' },
  { label: '押金退还', value: '押金退还' },
  { label: '押金冻结', value: '押金冻结' },
];

// 固定演示账号（与需求图一致）
const DEMO_ACCOUNTS = [
  { role: 'club', accountId: '41646444', nickname: '张三俱乐部' },
  { role: 'player', accountId: '41646454', nickname: '李四' },
  { role: 'club', accountId: '41646466', nickname: '王者俱乐部' },
  { role: 'player', accountId: '41646478', nickname: '王五' },
];

const INCOME_TYPES = ['收入-订单收入', '收入-平台充值'];
const EXPENSE_TYPES = ['支出-提现成功', '支出-平台扣除', '支出-转单扣除', '支出-余额抵扣'];
const DEPOSIT_TYPES = ['押金缴纳', '押金扣除', '押金退还', '押金冻结'];

// 生成一批稳定的随机时间（2026-10-10 当天为主）
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
 * 生成收益 Tab 流水数据
 * @param {number} count 条数
 */
export function buildIncomeRows(count = 60) {
  const rand = seededRandom(20261010);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const account = DEMO_ACCOUNTS[Math.floor(rand() * DEMO_ACCOUNTS.length)];
    const isIncome = rand() > 0.5;
    const type = isIncome
      ? INCOME_TYPES[Math.floor(rand() * INCOME_TYPES.length)]
      : EXPENSE_TYPES[Math.floor(rand() * EXPENSE_TYPES.length)];
    const amount = (Math.floor(rand() * 900) + 100) + (Math.floor(rand() * 100) / 100);
    // 约 1/4 的记录带关联订单号
    const hasRelation = rand() > 0.7;
    const d = new Date(2026, 9, 10, 11, 12, 22);
    d.setSeconds(d.getSeconds() - i * 37);
    rows.push({
      id: `inc-${i}`,
      identity: account.role === 'club' ? '俱乐部' : '打手',
      accountId: account.accountId,
      nickname: account.nickname,
      type,
      amount: isIncome ? amount : -amount,
      relationNo: hasRelation ? String(41646444 + Math.floor(rand() * 100)) : '',
      time: formatTime(d),
    });
  }
  return rows;
}

/**
 * 生成押金 Tab 流水数据
 * @param {number} count 条数
 */
export function buildDepositRows(count = 30) {
  const rand = seededRandom(20261011);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const account = DEMO_ACCOUNTS[Math.floor(rand() * DEMO_ACCOUNTS.length)];
    const type = DEPOSIT_TYPES[Math.floor(rand() * DEPOSIT_TYPES.length)];
    const isIncome = type === '押金缴纳' || type === '押金退还';
    const amount = (Math.floor(rand() * 900) + 100) + (Math.floor(rand() * 100) / 100);
    const hasRelation = rand() > 0.6;
    const d = new Date(2026, 9, 10, 10, 30, 0);
    d.setMinutes(d.getMinutes() - i * 13);
    rows.push({
      id: `dep-${i}`,
      identity: account.role === 'club' ? '俱乐部' : '打手',
      accountId: account.accountId,
      nickname: account.nickname,
      type,
      amount: isIncome ? amount : -amount,
      relationNo: hasRelation ? String(41646400 + Math.floor(rand() * 200)) : '',
      time: formatTime(d),
    });
  }
  return rows;
}
