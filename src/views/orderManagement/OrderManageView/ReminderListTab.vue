<script setup>
import { computed, reactive } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useListMemory } from '../../../composables/useListMemory';
import { orderStore } from './mockData';

/** 催单列表：所有未支付的第三方渠道订单（当前仅抖音） */
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
  { prop: 'orderNo', label: '本平台订单号', type: 'input', placeholder: '请输入订单号', span: 8 },
  { prop: 'thirdOrderNo', label: '第三方订单号', type: 'input', placeholder: '请输入订单号', span: 8 },
  {
    prop: 'createTime',
    label: '创建时间',
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    span: 8,
  },
];

function handleSearch(values) {
  Object.assign(filter, values);
  rememberFilter(filter, true);
}

function handleReset() {
  Object.keys(filter).forEach((key) => {
    filter[key] = Array.isArray(filter[key]) ? [] : '';
  });
  rememberFilter(filter, true);
}

const filteredRows = computed(() => {
  return orderStore.reminderOrders.filter((row) => {
    // mock 阶段无独立本平台订单号，orderNo 与 thirdOrderNo 均匹配第三方订单号，联调后按接口字段区分
    const noMatch = !filter.orderNo || row.thirdOrderNo === String(filter.orderNo).trim();
    const thirdMatch = !filter.thirdOrderNo || row.thirdOrderNo === String(filter.thirdOrderNo).trim();
    let timeMatch = true;
    if (Array.isArray(filter.createTime) && filter.createTime.length === 2 && filter.createTime[0]) {
      const start = new Date(filter.createTime[0]).getTime();
      const end = new Date(filter.createTime[1]).getTime();
      const t = new Date(row.createTime.replace(/-/g, '/')).getTime();
      timeMatch = t >= start && t <= end;
    }
    return noMatch && thirdMatch && timeMatch;
  });
});

const total = computed(() => filteredRows.value.length);
const rows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

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
      @page-change="onPageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #toolbar>
        <h2 class="list-title">催单列表</h2>
      </template>

      <template #cell-channel>
        <span class="channel-tag">抖</span>
      </template>

      <template #cell-amount="{ row }">{{ Number(row.amount).toFixed(2) }}</template>
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
