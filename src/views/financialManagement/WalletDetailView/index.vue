<script setup>
import { computed, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useListMemory } from '../../../composables/useListMemory';
import {
  IDENTITY_OPTIONS,
  INCOME_TYPE_OPTIONS,
  DEPOSIT_TYPE_OPTIONS,
  buildIncomeRows,
  buildDepositRows,
} from './mockData';

/**
 * 财务管理 > 收益明细（钱包明细）
 * 顶部双 Tab：收益 / 押金；搜索区 + 明细流水表格 + 分页
 */

// ===== Tab 切换 =====
const activeTab = ref('income'); // income | deposit

// ===== 数据源（本地模拟） =====
const incomeRows = ref(buildIncomeRows(60));
const depositRows = ref(buildDepositRows(30));

// ===== 筛选条件 =====
const filter = reactive({
  userId: '',
  userName: '',
  clubId: '',
  clubName: '',
  identity: '',
  flowType: '', // 收益 Tab：收支类型；押金 Tab：钱包类型
  relationNo: '',
  timeRange: [],
});

// 当前 Tab 下的搜索字段（收支类型 / 钱包类型 随 Tab 切换）
const searchFields = computed(() => [
  { prop: 'userId', label: '用户ID', type: 'input', placeholder: '请输入用户ID' },
  { prop: 'userName', label: '用户名称', type: 'input', placeholder: '请输入用户名称' },
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID' },
  { prop: 'clubName', label: '俱乐部名称', type: 'input', placeholder: '请输入俱乐部名称' },
  {
    prop: 'identity', label: '身份', type: 'select', placeholder: '请选择身份',
    options: [{ label: '全部', value: '' }, ...IDENTITY_OPTIONS],
  },
  {
    prop: 'flowType',
    label: activeTab.value === 'income' ? '收支类型' : '钱包类型',
    type: 'select',
    placeholder: `请选择${activeTab.value === 'income' ? '收支类型' : '钱包类型'}`,
    options: [
      { label: '全部', value: '' },
      ...(activeTab.value === 'income' ? INCOME_TYPE_OPTIONS : DEPOSIT_TYPE_OPTIONS),
    ],
  },
  { prop: 'relationNo', label: '关联订单号', type: 'input', placeholder: '请输入关联订单号' },
  {
    prop: 'timeRange', label: '时间', type: 'daterange',
    startPlaceholder: '开始时间', endPlaceholder: '结束时间',
    shortcuts: [
      { text: '今天', value: () => { const d = new Date(); return [d, d]; } },
      { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [start, end]; } },
      { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [start, end]; } },
    ],
  },
]);

// ===== 分页与列表记忆 =====
const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['userId', 'userName', 'clubId', 'clubName', 'identity', 'flowType', 'relationNo', 'timeRange'],
});
restoreFilter(filter);

// 当前 Tab 的全量数据
const currentRows = computed(() =>
  activeTab.value === 'income' ? incomeRows.value : depositRows.value,
);

// 过滤后的数据
const filteredRows = computed(() => {
  return currentRows.value.filter((row) => {
    const userIdMatch = !filter.userId || row.accountId.includes(String(filter.userId).trim());
    const userNameMatch = !filter.userName || row.nickname.includes(String(filter.userName).trim());
    const clubIdMatch = !filter.clubId || (row.identity === '俱乐部' && row.accountId.includes(String(filter.clubId).trim()));
    const clubNameMatch = !filter.clubName || (row.identity === '俱乐部' && row.nickname.includes(String(filter.clubName).trim()));
    const identityMatch = !filter.identity || (filter.identity === 'club' ? row.identity === '俱乐部' : row.identity === '打手');
    const typeMatch = !filter.flowType || row.type === filter.flowType;
    const relationMatch = !filter.relationNo || (row.relationNo && row.relationNo.includes(String(filter.relationNo).trim()));
    let timeMatch = true;
    if (Array.isArray(filter.timeRange) && filter.timeRange.length === 2 && filter.timeRange[0]) {
      const start = new Date(String(filter.timeRange[0]).replace(/-/g, '/')).getTime();
      const end = new Date(String(filter.timeRange[1]).replace(/-/g, '/')).getTime();
      const t = new Date(row.time.replace(/-/g, '/')).getTime();
      timeMatch = t >= start && t <= end;
    }
    return userIdMatch && userNameMatch && clubIdMatch && clubNameMatch &&
      identityMatch && typeMatch && relationMatch && timeMatch;
  });
});

const total = computed(() => filteredRows.value.length);
const rows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

// ===== 搜索 / 重置 =====
function handleSearch(values) {
  Object.assign(filter, values);
  rememberFilter(filter, true);
}

function handleReset() {
  Object.keys(filter).forEach((key) => {
    if (Array.isArray(filter[key])) filter[key] = [];
    else filter[key] = '';
  });
  rememberFilter(filter, true);
}

// 切换 Tab 时重置筛选与分页
function changeTab(name) {
  activeTab.value = name;
  handleReset();
}

// ===== 表格列 =====
const columns = [
  { key: 'identity', title: '身份' },
  { key: 'accountId', title: '账号ID' },
  { key: 'nickname', title: '账号昵称' },
  { key: 'type', title: '收支类型' },
  { key: 'amount', title: '订单金额' },
  { key: 'relationNo', title: '关联订单号' },
  { key: 'time', title: '时间' },
];

// 金额格式化：带正负号
function formatAmount(val) {
  const num = Number(val) || 0;
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}`;
}
</script>

<template>
  <div class="wallet-detail-page list-page">
    <!-- 顶部 Tab：收益 / 押金 -->
    <div class="wallet-tabs">
      <button
        type="button"
        :class="['wallet-tab', { active: activeTab === 'income' }]"
        @click="changeTab('income')"
      >
        收益
      </button>
      <button
        type="button"
        :class="['wallet-tab', { active: activeTab === 'deposit' }]"
        @click="changeTab('deposit')"
      >
        押金
      </button>
    </div>

    <!-- 搜索区 -->
    <SearchComponent
      :fields="searchFields"
      :initial-values="filter"
      :row-columns="4"
      :labelWidth="90"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 明细表格 -->
    <DataTable
      class="list-panel"
      :columns="columns"
      :data="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="onPageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #cell-amount="{ row }">
        <span :class="['amount-text', row.amount >= 0 ? 'amount-in' : 'amount-out']">
          {{ formatAmount(row.amount) }}
        </span>
      </template>

      <template #cell-relationNo="{ row }">
        <a v-if="row.relationNo" class="relation-link">{{ row.relationNo }}</a>
        <span v-else class="muted-text">—</span>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.wallet-detail-page {
  display: flex;
  flex-direction: column;
}

/* 顶部 收益/押金 切换按钮（按需求图样式） */
.wallet-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0;
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
}

.wallet-tab {
  min-width: 88px;
  height: 36px;
  padding: 0 24px;
  border: 1px solid #dcdfe6;
  background: var(--bg-card);
  color: #5b6478;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.wallet-tab + .wallet-tab {
  border-left: none;
}

.wallet-tab:first-child {
  border-radius: 8px 0 0 8px;
}

.wallet-tab:last-child {
  border-radius: 0 8px 8px 0;
}

.wallet-tab.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-invert);
}

/* 金额：收入绿色 +，支出红色 - */
.amount-text {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.amount-in {
  color: #0f9f6e;
}

.amount-out {
  color: #f04438;
}

/* 关联订单号：蓝色可点链接 */
.relation-link {
  color: #2563eb;
  cursor: pointer;
  text-decoration: none;
}

.relation-link:hover {
  text-decoration: underline;
}

.muted-text {
  color: #c0c4cc;
}
</style>
