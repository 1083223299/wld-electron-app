<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useListMemory } from '../../../composables/useListMemory';
import { withdrawalApi } from '../../../api/modules/withdrawal';

/**
 * 财务管理 > 提现明细
 * 接口：GET /api/admin/finance/withdrawals（服务端分页/筛选）
 * - 顶部「收益 / 押金」Tab → walletType: INCOME / DEPOSIT
 * - 搜索区（按原型）：用户ID、用户名称、俱乐部ID、俱乐部名称、身份、收支类型、提交时间（无状态筛选）
 * - 列表（按原型）：身份/账号ID/账号昵称/支付宝账号(仅收益Tab)/提现金额(元)/状态/原因/提交时间
 * - 状态：PROCESSING(处理中) / SUCCESS(打款成功) / FAILED(打款失败)，一期自动打款无待审核
 * - 收支类型：后端口径无 bizType（提现记录无业务码），「收支类型」筛选绑 walletType（INCOME 收益 / DEPOSIT 押金），
 *   与顶部 Tab 同语义；筛选选中时以筛选为准，未选时回落到 Tab 值
 * - userId / clubName 参数后端已补（2026-10-23 后端确认），空值不传
 */

// ===== Tab 切换（映射 walletType 参数） =====
const activeTab = ref('income'); // income | deposit
const tabOptions = [
  { label: '收益', value: 'income' },
  { label: '押金', value: 'deposit' },
];
const walletTypeByTab = { income: 'INCOME', deposit: 'DEPOSIT' };

// ===== 筛选条件（按原型：用户ID/用户名称/俱乐部ID/俱乐部名称/身份/收支类型/提交时间，无状态筛选） =====
const filter = reactive({
  userId: '',    // 用户ID（后端已补 Query）
  keyword: '',   // 账号昵称或手机号
  clubId: '',
  clubName: '',  // 俱乐部名称（后端已补 Query）
  ownerType: '', // CLUB / PLAYER
  walletType: '', // 收支类型（收益/押金，绑 walletType；选空回落 Tab）
  timeRange: [], // [from, to]，格式 YYYY-MM-DD HH:mm:ss
});

const OWNER_TYPE_OPTIONS = [
  { label: '俱乐部', value: 'CLUB' },
  { label: '打手', value: 'PLAYER' },
];

// 收支类型选项：后端口径无 bizType，绑 walletType（与顶部 Tab 同语义）
const WALLET_TYPE_OPTIONS = [
  { label: '收益', value: 'INCOME' },
  { label: '押金', value: 'DEPOSIT' },
];

const STATUS_MAP = {
  PROCESSING: { text: '处理中', class: 'status-warning' },
  SUCCESS: { text: '打款成功', class: 'status-success' },
  FAILED: { text: '打款失败', class: 'status-danger' },
};

const OWNER_TYPE_TEXT = { CLUB: '俱乐部', PLAYER: '打手' };

const searchFields = [
  { prop: 'userId', label: '用户ID', type: 'input', placeholder: '请输入用户ID' },
  { prop: 'keyword', label: '用户名称', type: 'input', placeholder: '账号昵称或手机号' },
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID' },
  { prop: 'clubName', label: '俱乐部名称', type: 'input', placeholder: '请输入俱乐部名称' },
  {
    prop: 'ownerType', label: '身份', type: 'select', placeholder: '请选择身份',
    options: [{ label: '全部', value: '' }, ...OWNER_TYPE_OPTIONS],
  },
  {
    prop: 'walletType', label: '收支类型', type: 'select', placeholder: '请选择收支类型',
    options: [{ label: '全部', value: '' }, ...WALLET_TYPE_OPTIONS],
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
  filterKeys: ['userId', 'keyword', 'clubId', 'clubName', 'ownerType', 'walletType', 'timeRange'],
});
restoreFilter(filter);

// ===== 列表数据（服务端分页/筛选） =====
const rows = ref([]);
const total = ref(0);
const loading = ref(false);

async function fetchList() {
  loading.value = true;
  try {
    const range = Array.isArray(filter.timeRange) && filter.timeRange.length === 2 ? filter.timeRange : [];
    // 时间筛选传参：yyyy-MM-ddTHH:mm:ss（后端只接受 yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss，空格分隔会报 400 PARAM_ERROR；Date 对象直传会被序列化为英文格式，后端无法解析）
    const fmtDT = (d) => {
      if (!d) return '';
      const date = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };
    const res = await withdrawalApi.list({
      page: page.value,
      pageSize: pageSize.value,
      from: fmtDT(range[0]),
      to: fmtDT(range[1]),
      ownerType: filter.ownerType,
      walletType: filter.walletType || walletTypeByTab[activeTab.value],
      userId: filter.userId,
      keyword: filter.keyword,
      clubId: filter.clubId,
      clubName: filter.clubName,
    });
    rows.value = (res && res.list) || [];
    total.value = (res && res.total) || 0;
  } catch (e) {
    // 错误提示由 request.js 统一弹出
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);

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

function switchTab(tab) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  page.value = 1;
  fetchList();
}

function pageChange(nextPage) {
  onPageChange(nextPage);
  fetchList();
}

function pageSizeChange(size) {
  onPageSizeChange(size);
  fetchList();
}

// ===== 表格列（与原型「提现明细」截图一致） =====
// 收益 Tab：身份/账号ID/账号昵称/支付宝账号/提现金额(元)/状态/原因/提交时间
// 押金 Tab：原型无支付宝账号列
const columns = computed(() => {
  const base = [
    { key: 'ownerType', title: '身份' },
    { key: 'accountId', title: '账号ID' },
    { key: 'accountName', title: '账号昵称' },
  ];
  if (activeTab.value === 'income') {
    base.push({ key: 'alipayAccount', title: '支付宝账号' });
  }
  base.push(
    { key: 'amount', title: '提现金额(元)' },
    { key: 'status', title: '状态' },
    { key: 'failReason', title: '原因' },
    { key: 'submittedAt', title: '提交时间' },
  );
  return base;
});

const money = (value) => (Number(value) || 0).toFixed(2);
const ownerTypeText = (value) => OWNER_TYPE_TEXT[value] || value || '—';
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
        :label-width="90"
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
      @page-change="pageChange"
      @page-size-change="pageSizeChange"
    >
      <template #cell-ownerType="{ row }">{{ ownerTypeText(row.ownerType) }}</template>

      <template #cell-amount="{ row }">{{ money(row.amount) }}</template>

      <template #cell-status="{ row }">
        <span class="status-badge" :class="STATUS_MAP[row.status]?.class">{{ STATUS_MAP[row.status]?.text ?? row.status }}</span>
      </template>

      <template #cell-failReason="{ row }">
        <span :class="{ 'muted-text': !row.failReason }">{{ row.failReason || '—' }}</span>
      </template>

      <template #cell-submittedAt="{ row }">
        <span :class="{ 'muted-text': !row.submittedAt }">{{ row.submittedAt || '—' }}</span>
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
