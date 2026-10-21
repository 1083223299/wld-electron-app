<script setup>
import { onMounted, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import { useListMemory } from '../../../composables/useListMemory';
import { orderApi, channelText } from '../../../api/modules/order';

/**
 * 催单列表（接口联调）：GET /api/admin/orders/urge-hall
 * 未支付第三方订单（status=WAIT_PAY），支付或取消后离开本列表
 * 需求无搜索模块：仅服务端分页，不传筛选参数（筛选接口由后端补充后再加）
 * 鉴权：Authorization Bearer {token} 由 request.js 自动附加
 */
const { page, pageSize, onPageSizeChange, onPageChange } = useListMemory();

const rows = ref([]);
const total = ref(0);

/** 后端字段 → 页面展示字段 */
function mapRow(item = {}) {
  return {
    id: item.id,
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
  try {
    const res = await orderApi.urgeHall({ page: page.value, pageSize: pageSize.value });
    rows.value = ((res && res.list) || []).map(mapRow);
    total.value = (res && res.total) || 0;
  } catch {
    rows.value = [];
    total.value = 0;
  }
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
