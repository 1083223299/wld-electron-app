<script setup>
import { computed, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useListMemory } from '../../../composables/useListMemory';
import {
  IDENTITY_OPTIONS,
  WITHDRAW_TYPE_OPTIONS,
  STATUS_MAP,
  buildWithdrawalRows,
} from './mockData';

/**
 * 财务管理 > 提现明细
 * 依据《提现走系统自动打款》需求图还原：
 * - 顶部「收益 / 押金」Tab 切换
 * - 搜索区：用户ID、用户名称、俱乐部ID、俱乐部名称、身份、收支类型、提交时间
 * - 表格：身份、账号ID、账号昵称、支付宝账号、提现金额(元)、状态、原因、提交时间
 * - 状态：待审核(橙) / 打款成功(绿) / 打款失败(红)
 */

// ===== Tab 切换 =====
const activeTab = ref('income'); // income | deposit
const tabOptions = [
  { label: '收益', value: 'income' },
  { label: '押金', value: 'deposit' },
];

// ===== 数据源（本地模拟，上线后替换为接口） =====
const incomeRows = ref(buildWithdrawalRows('income', 329));
const depositRows = ref(buildWithdrawalRows('deposit', 329));

// ===== 筛选条件 =====
const filter = reactive({
  userId: '',
  userName: '',
  clubId: '',
  clubName: '',
  identity: '',
  flowType: '',
  timeRange: [],
});

const searchFields = [
  { prop: 'userId', label: '用户ID', type: 'input', placeholder: '请输入用户ID' },
  { prop: 'userName', label: '用户名称', type: 'input', placeholder: '请输入用户名称' },
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID' },
  { prop: 'clubName', label: '俱乐部名称', type: 'input', placeholder: '请输入俱乐部名称' },
  {
    prop: 'identity', label: '身份', type: 'select', placeholder: '请选择身份',
    options: [{ label: '全部', value: '' }, ...IDENTITY_OPTIONS],
  },
  {
    prop: 'flowType', label: '收支类型', type: 'select', placeholder: '请选择收支类型',
    options: [{ label: '全部', value: '' }, ...WITHDRAW_TYPE_OPTIONS],
  },
  {
    prop: 'timeRange', label: '提交时间', type: 'daterange',
    startPlaceholder: '开始时间', endPlaceholder: '结束时间',
    shortcuts: [
      { text: '今天', value: () => { const d = new Date(); return [d, d]; } },
      { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [start, end]; } },
      { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [start, end]; } },
    ],
  },
];

// ===== 分页与列表记忆 =====
const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['userId', 'userName', 'clubId', 'clubName', 'identity', 'flowType', 'timeRange'],
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
    const flowTypeMatch = !filter.flowType || row.type === filter.flowType;

    let timeMatch = true;
    if (Array.isArray(filter.timeRange) && filter.timeRange.length === 2 && filter.timeRange[0]) {
      const start = new Date(String(filter.timeRange[0]).replace(/-/g, '/')).getTime();
      const end = new Date(String(filter.timeRange[1]).replace(/-/g, '/')).getTime();
      const t = new Date(row.submitTime.replace(/-/g, '/')).getTime();
      timeMatch = t >= start && t <= end;
    }

    return userIdMatch && userNameMatch && clubIdMatch && clubNameMatch && identityMatch && flowTypeMatch && timeMatch;
  });
});

const total = computed(() => filteredRows.value.length);
const rows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

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

function switchTab(tab) {
  activeTab.value = tab;
  page.value = 1;
}

const money = (value) => (Number(value) || 0).toFixed(2);

// ===== 表格列 =====
const columns = [
  { key: 'identity', title: '身份' },
  { key: 'accountId', title: '账号ID' },
  { key: 'nickname', title: '账号昵称' },
  { key: 'alipayAccount', title: '支付宝账号' },
  { key: 'amount', title: '提现金额(元)' },
  { key: 'status', title: '状态' },
  { key: 'reason', title: '原因' },
  { key: 'submitTime', title: '提交时间' },
];
</script>

<template>
  <div class="withdrawal-detail-page list-page">
    <div class="list-page__search">
      <!-- 收益 / 押金 Tab -->
      <div class="tab-switch">
        <button
          v-for="item in tabOptions"
          :key="item.value"
          type="button"
          :class="['tab-btn', { active: activeTab === item.value }]"
          @click="switchTab(item.value)"
        >
          {{ item.label }}
        </button>
      </div>

      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        :row-columns="4"
        :label-width="80"
        :confirm-reset="false"
        @search="handleSearch"
        @reset="handleReset"
      />
    </div>

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
      <template #cell-amount="{ row }">{{ money(row.amount) }}</template>

      <template #cell-status="{ row }">
        <span class="status-badge" :class="STATUS_MAP[row.status]?.class">{{ STATUS_MAP[row.status]?.text }}</span>
      </template>

      <template #cell-reason="{ row }">
        <span :class="{ 'muted-text': !row.reason }">{{ row.reason || '—' }}</span>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.withdrawal-detail-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tab-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid #eceef6;
  border-radius: 10px;
  background: #f5f6fb;
  margin-bottom: 12px;
  width: max-content;
}

.tab-btn {
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 6px 18px;
  background: transparent;
  color: #5b6478;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  color: var(--primary);
}

.tab-btn.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 6px 14px var(--primary-glow-strong);
}

/* 状态徽章 */
.status-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.status-success { color: #0f9f6e; background: rgba(15, 159, 110, 0.08); }
.status-warning { color: #b45309; background: rgba(245, 158, 11, 0.12); }
.status-danger { color: #d92d20; background: rgba(217, 45, 32, 0.08); }

.muted-text {
  color: #98a2b3;
}
</style>
