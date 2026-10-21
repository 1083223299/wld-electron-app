<script setup>
import { onMounted, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useListMemory } from '../../../composables/useListMemory';
import { orderApi, channelText } from '../../../api/modules/order';

/**
 * 催单列表（接口联调）：GET /api/admin/orders/urge-hall
 * 未支付第三方订单（status=WAIT_PAY），支付或取消后离开本列表
 * 服务端分页/筛选（orderNo/thirdOrderNo 完全匹配，from/to 时间范围）
 * 鉴权：Authorization Bearer {token} 由 request.js 自动附加
 */
const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['orderNo', 'thirdOrderNo', 'createTime'],
});

const filter = reactive({
  orderNo: '',
  thirdOrderNo: '',
  createTime: [],
});
restoreFilter(filter);

const searchFields = [
  { prop: 'orderNo', label: '本平台订单号', type: 'input', placeholder: '请输入订单号（完全匹配）', span: 8 },
  { prop: 'thirdOrderNo', label: '第三方订单号', type: 'input', placeholder: '请输入订单号（完全匹配）', span: 8 },
  {
    prop: 'createTime',
    label: '创建时间',
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    span: 8,
  },
];

const rows = ref([]);
const total = ref(0);
const loading = ref(false);

const fmtDay = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** 后端字段 → 页面展示字段 */
function mapRow(item = {}) {
  return {
    id: item.id,
    orderNo: item.orderNo || '',
    thirdOrderNo: item.thirdOrderNo || '',
    channel: channelText(item.channelCode),
    channelCode: item.channelCode,
    amount: Number(item.amount) || 0,
    product: item.itemName || '',
    status: item.status,
    createTime: item.createdAt || '',
  };
}

async function fetchList() {
  loading.value = true;
  try {
    const [fromDay, toDay] = Array.isArray(filter.createTime) ? filter.createTime : [];
    const res = await orderApi.urgeHall({
      page: page.value,
      pageSize: pageSize.value,
      orderNo: String(filter.orderNo || '').trim(),
      thirdOrderNo: String(filter.thirdOrderNo || '').trim(),
      from: fmtDay(fromDay),
      to: fmtDay(toDay),
    });
    rows.value = ((res && res.list) || []).map(mapRow);
    total.value = (res && res.total) || 0;
  } catch {
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch(values) {
  Object.assign(filter, values);
  rememberFilter(filter, true);
  fetchList();
}

function handleReset() {
  Object.keys(filter).forEach((key) => {
    filter[key] = Array.isArray(filter[key]) ? [] : '';
  });
  rememberFilter(filter, true);
  fetchList();
}

onMounted(fetchList);

const columns = [
  { key: 'channel', title: '渠道' },
  { key: 'thirdOrderNo', title: '第三方订单号' },
  { key: 'amount', title: '订单金额（元）' },
  { key: 'product', title: '购买项目' },
  { key: 'createTime', title: '创建时间' },
];
</script>

<template>
  <div class="reminder-tab list-page">
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        :row-columns="3"
        :labelWidth="'97px'"
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
      @page-change="(p) => { onPageChange(p); fetchList(); }"
      @page-size-change="(s) => { onPageSizeChange(s); fetchList(); }"
    >
      <template #toolbar>
        <h2 class="list-title">催单列表</h2>
      </template>

      <template #cell-channel="{ row }">
        <span class="channel-tag">{{ (row.channel || '抖').slice(0, 1) }}</span>
      </template>

      <template #cell-amount="{ row }">{{ Number(row.amount).toFixed(2) }}</template>

      <template #cell-product="{ row }">{{ row.product || '—' }}</template>

      <template #cell-createTime="{ row }">{{ row.createTime || '—' }}</template>
    </DataTable>
  </div>
</template>

<style scoped>
.reminder-tab {
  gap: 12px;
}

.channel-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--primary-faint);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}
</style>
