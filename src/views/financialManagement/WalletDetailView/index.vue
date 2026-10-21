<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useListMemory } from '../../../composables/useListMemory';
import {
  financeApi,
  OWNER_TYPE_OPTIONS,
  BIZ_TYPE_OPTIONS,
  bizTypeText,
  ownerTypeText,
} from '../../../api/modules/finance';

/**
 * 财务管理 > 收益明细（钱包明细）
 * 顶部双 Tab：收益(INCOME) / 押金(DEPOSIT)；搜索区 + 明细流水表格 + 分页
 * 数据源：GET /api/admin/finance/txns（服务端分页/筛选，详见 src/api/modules/finance.js）
 */

// ===== Tab 切换（对应接口 walletType 参数） =====
const activeTab = ref('income'); // income | deposit

// ===== 筛选条件（与接口 Query 参数一一对应） =====
const filter = reactive({
  keyword: '',   // 匹配账号昵称或手机号
  clubId: '',    // 按俱乐部筛选
  ownerType: '', // 身份 CLUB / PLAYER
  bizType: '',   // 收支类型（业务码）
  timeRange: [], // 时间范围 → from / to
});

// ===== 收支类型选项：预置 + 接口实际返回动态补充 =====
const bizTypeOptions = ref([...BIZ_TYPE_OPTIONS]);
function collectBizTypes(list) {
  if (!Array.isArray(list)) return;
  const seen = new Set(bizTypeOptions.value.map((o) => o.value));
  const added = [];
  for (const item of list) {
    if (!item || !item.bizType || seen.has(item.bizType)) continue;
    seen.add(item.bizType);
    added.push({ label: item.bizTypeLabel || bizTypeText(item.bizType), value: item.bizType });
  }
  if (added.length) bizTypeOptions.value = [...bizTypeOptions.value, ...added];
}

// 搜索字段（用户ID/俱乐部名称/关联订单号接口无对应 Query 参数，按接口能力收敛）
const searchFields = computed(() => [
  { prop: 'keyword', label: '用户名称', type: 'input', placeholder: '账号昵称或手机号' },
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID' },
  {
    prop: 'ownerType', label: '身份', type: 'select', placeholder: '请选择身份',
    options: [{ label: '全部', value: '' }, ...OWNER_TYPE_OPTIONS],
  },
  {
    prop: 'bizType', label: '收支类型', type: 'select', placeholder: '请选择收支类型',
    options: [{ label: '全部', value: '' }, ...bizTypeOptions.value],
  },
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
  filterKeys: ['keyword', 'clubId', 'ownerType', 'bizType', 'timeRange'],
});
restoreFilter(filter);

// ===== 列表数据（服务端分页/筛选） =====
const rows = ref([]);
const total = ref(0);
const loading = ref(false);

/** 接口流水字段 → 页面展示字段 */
function mapRow(item = {}) {
  const amount = Number(item.amount);
  const orderAmount = Number(item.orderAmount);
  return {
    id: item.id,
    accountId: item.accountId ?? '—',
    accountName: item.accountName || '—',
    ownerTypeText: ownerTypeText(item.ownerType),
    clubName: item.clubName || '—',
    bizTypeLabel: item.bizTypeLabel || bizTypeText(item.bizType),
    amount: Number.isFinite(amount) ? amount : 0,
    orderAmount: Number.isFinite(orderAmount) ? orderAmount : null,
    orderNo: item.orderNo || '',
    createdAt: item.createdAt || '—',
    reason: item.reason || '',
  };
}

/** 时间范围 → from/to（YYYY-MM-DD HH:mm:ss 转 ISO 日期时间） */
function buildTimeRange() {
  const range = filter.timeRange;
  if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) {
    return { from: '', to: '' };
  }
  return {
    from: String(range[0]).replace(' ', 'T'),
    to: String(range[1]).replace(' ', 'T'),
  };
}

async function fetchList() {
  loading.value = true;
  try {
    const { from, to } = buildTimeRange();
    const res = await financeApi.txns({
      page: page.value,
      pageSize: pageSize.value,
      from: from || undefined,
      to: to || undefined,
      ownerType: filter.ownerType || undefined,
      walletType: activeTab.value === 'income' ? 'INCOME' : 'DEPOSIT',
      keyword: filter.keyword || undefined,
      clubId: filter.clubId || undefined,
      bizType: filter.bizType || undefined,
    });
    const list = (res && res.list) || [];
    rows.value = list.map(mapRow);
    total.value = (res && res.total) || 0;
    collectBizTypes(list);
  } catch (e) {
    // 错误提示由 request.js 统一弹出
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);

// ===== 搜索 / 重置 =====
function handleSearch(values) {
  Object.assign(filter, values);
  rememberFilter(filter, true);
  fetchList();
}

function handleReset() {
  Object.keys(filter).forEach((key) => {
    if (Array.isArray(filter[key])) filter[key] = [];
    else filter[key] = '';
  });
  rememberFilter(filter, true);
  fetchList();
}

// 切换 Tab 时重置筛选与分页，并按新钱包类型重新拉取
function changeTab(name) {
  if (activeTab.value === name) return;
  activeTab.value = name;
  handleReset();
}

// ===== 分页事件 =====
function pageChange(next) {
  onPageChange(next);
  fetchList();
}

function pageSizeChange(size) {
  onPageSizeChange(size);
  fetchList();
}

// ===== 表格列 =====
const columns = [
  { key: 'ownerTypeText', title: '身份' },
  { key: 'accountId', title: '账号ID' },
  { key: 'accountName', title: '账号昵称' },
  { key: 'clubName', title: '俱乐部名称' },
  { key: 'bizTypeLabel', title: '收支类型' },
  { key: 'amount', title: '金额' },
  { key: 'orderAmount', title: '订单金额' },
  { key: 'orderNo', title: '关联订单号' },
  { key: 'createdAt', title: '时间' },
  { key: 'reason', title: '备注' },
];

// 金额格式化：带正负号
function formatAmount(val) {
  const num = Number(val) || 0;
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}`;
}

// 订单金额：接口未返回时显示 —
function formatOrderAmount(val) {
  if (val === null || val === undefined || val === '') return '—';
  return Number(val).toFixed(2);
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
    <div class="list-panel-wrap">
      <DataTable
        class="list-panel"
        :columns="columns"
        :data="rows"
        :total="total"
        :page="page"
        :page-size="pageSize"
        @page-change="pageChange"
        @page-size-change="pageSizeChange"
      >
        <template #cell-amount="{ row }">
          <span :class="['amount-text', row.amount >= 0 ? 'amount-in' : 'amount-out']">
            {{ formatAmount(row.amount) }}
          </span>
        </template>

        <template #cell-orderAmount="{ row }">
          <span :class="{ 'muted-text': row.orderAmount === null }">
            {{ formatOrderAmount(row.orderAmount) }}
          </span>
        </template>

        <template #cell-orderNo="{ row }">
          <a v-if="row.orderNo" class="relation-link">{{ row.orderNo }}</a>
          <span v-else class="muted-text">—</span>
        </template>

        <template #cell-reason="{ row }">
          <span :class="{ 'muted-text': !row.reason }">{{ row.reason || '—' }}</span>
        </template>
      </DataTable>

      <div v-if="loading" class="table-loading"><span>加载中…</span></div>
    </div>
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

/* 表格加载遮罩 */
.list-panel-wrap {
  position: relative;
}

.table-loading {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-card) 55%, transparent);
  color: var(--text-sub);
  font-size: 13px;
  letter-spacing: 0.02em;
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
