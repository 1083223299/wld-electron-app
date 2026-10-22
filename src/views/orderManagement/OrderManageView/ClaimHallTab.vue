<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import AppModal from '../../../components/AppModal.vue';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { orderApi, TYPE_OPTIONS, statusText, channelText } from '../../../api/modules/order';
import { STATUS_CLASS } from './mockData';

/**
 * 客服领单大厅（接口联调）：GET /api/admin/orders/claim-hall
 * 无 Query 参数，返回数组；已支付待领取订单，认领后进入订单列表
 * 鉴权：Authorization Bearer {token} 由 request.js 自动附加
 * 认领：POST /api/admin/orders/{id}/claim（无 body），认领后可选维护信息（orderType/playerCount/roleName/teamCode）
 * 说明：claim-hall 已返回 createdAt（后端确认），创建时间列/筛选按接口数据展示；
 *      组队码 teamCode 新 OpenAPI 已支持（maintain），填写则随认领提交；二维码等字段仍缺（待后端补充）
 */
const { show } = useToast();

const filter = reactive({
  orderNo: '',
  thirdOrderNo: '',
  createTime: [],
});

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['orderNo', 'thirdOrderNo', 'createTime'],
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

/** 后端字段 → 页面展示字段 */
function mapRow(item = {}) {
  const tags = [];
  if (Number(item.frozen) === 1) tags.push('冻结');
  if (Number(item.afterSaleFlag) === 1) tags.push('售后中');
  return {
    id: item.id,
    orderNo: item.orderNo || '',
    channel: channelText(item.channelCode),
    channelCode: item.channelCode,
    thirdOrderNo: item.thirdOrderNo || '',
    amount: Number(item.amount) || 0,
    product: item.itemName || '',
    playerCount: item.playerCount,
    takenCount: item.takenCount,
    status: statusText(item.status),
    statusCode: item.status,
    tags,
    frozen: Number(item.frozen) === 1,
    afterSale: Number(item.afterSaleFlag) === 1,
    ownerName: item.ownerName || '',
    // 创建时间：claim-hall 已返回 createdAt（后端确认），按接口数据展示
    createTime: item.createdAt || '',
  };
}

const allRows = ref([]);
const loading = ref(false);

async function fetchHall() {
  loading.value = true;
  try {
    const list = await orderApi.claimHall();
    allRows.value = (list || []).map(mapRow);
  } catch {
    allRows.value = [];
  } finally {
    loading.value = false;
  }
}

const filteredRows = computed(() => {
  return allRows.value.filter((row) => {
    const noMatch = !filter.orderNo || row.orderNo === String(filter.orderNo).trim();
    const thirdMatch = !filter.thirdOrderNo || row.thirdOrderNo === String(filter.thirdOrderNo).trim();
    let timeMatch = true;
    if (Array.isArray(filter.createTime) && filter.createTime.length === 2 && filter.createTime[0]) {
      const start = new Date(filter.createTime[0]).getTime();
      const end = new Date(filter.createTime[1]).getTime();
      const t = row.createTime ? new Date(row.createTime.replace(/-/g, '/')).getTime() : NaN;
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

onMounted(fetchHall);

const columns = [
  { key: 'orderNo', title: '本平台订单号' },
  { key: 'channel', title: '渠道' },
  { key: 'thirdOrderNo', title: '第三方订单号' },
  { key: 'amount', title: '订单金额（元）' },
  { key: 'product', title: '购买项目' },
  { key: 'playerCount', title: '名额数' },
  { key: 'status', title: '订单状态' },
  { key: 'tags', title: '订单标签' },
  { key: 'createTime', title: '创建时间' },
  { key: 'op', title: '操作' },
];

/* ===== 认领弹窗（orderType/playerCount/roleName/teamCode 非必填，填写则随认领提交） ===== */
const claimVisible = ref(false);
const currentRow = ref(null);
const claimForm = reactive({ orderType: 'NORMAL', playerCount: '', roleName: '', groupCode: '' });

function openClaim(row) {
  currentRow.value = row;
  Object.assign(claimForm, { orderType: 'NORMAL', playerCount: '', roleName: '', groupCode: '' });
  claimVisible.value = true;
}

async function submitClaim() {
  const row = currentRow.value;
  if (!row) return;
  try {
    // 1) 认领订单（无 body）
    await orderApi.claim(row.id);
    // 2) 认领时填写的维护字段通过维护订单信息接口补录（未填写则不调用）；
    //    组队码 teamCode 新 OpenAPI 已支持（maintain），填写则随认领提交
    const orderType = claimForm.orderType !== 'NORMAL' ? claimForm.orderType : undefined;
    const playerCount =
      claimForm.playerCount !== '' && claimForm.playerCount !== null
        ? Number(claimForm.playerCount) || 0
        : undefined;
    const roleName = String(claimForm.roleName || '').trim() || undefined;
    const teamCode = String(claimForm.groupCode || '').trim() || undefined;
    if (
      orderType !== undefined || playerCount !== undefined ||
      roleName !== undefined || teamCode !== undefined
    ) {
      await orderApi.maintain(row.id, { orderType, playerCount, roleName, teamCode });
    }
    claimVisible.value = false;
    show('认领成功，已进入订单列表', 'success');
    fetchHall();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

function handleIntegerInput(event) {
  claimForm.playerCount = String(event.target.value).replace(/\D/g, '');
}

const TAG_CLASS_MAP = {
  卡单: 'warn',
  待发货: 'info',
  已发货: 'success',
  售后中: 'danger',
  部分退款: 'danger',
  呼叫: 'warn',
  冻结: 'muted',
  存单: 'purple',
};

function tagClass(tag) {
  return TAG_CLASS_MAP[tag] || 'info';
}
</script>

<template>
  <div class="claim-tab list-page">
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        :row-columns="3"
        :labelWidth="97"
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
        <h2 class="list-title">领单大厅</h2>
      </template>

      <template #cell-amount="{ row }">{{ Number(row.amount).toFixed(2) }}</template>

      <template #cell-playerCount="{ row }">
        {{ row.playerCount != null ? `${row.takenCount ?? 0}/${row.playerCount}` : '—' }}
      </template>

      <template #cell-channel="{ row }">
        <span class="channel-tag">{{ (row.channel || '抖').slice(0, 1) }}</span>
      </template>

      <template #cell-status="{ row }">
        <span class="status-badge" :class="STATUS_CLASS[row.status] || 'status-info'">{{ row.status }}</span>
      </template>

      <template #cell-tags="{ row }">
        <div class="status-wrap">
          <span
            v-for="tag in row.tags"
            :key="tag"
            class="order-tag"
            :class="`tag-${tagClass(tag)}`"
          >{{ tag }}</span>
          <span v-if="!row.tags?.length" class="muted-text">—</span>
        </div>
      </template>

      <template #cell-createTime="{ row }">{{ row.createTime || '—' }}</template>

      <template #cell-op="{ row }">
        <button class="link-btn primary" @click="openClaim(row)">认领</button>
      </template>
    </DataTable>

    <!-- <p class="perm-hint">仅客服角色可领取订单</p> -->

    <AppModal v-model="claimVisible" title="领取" width="480px">
      <div class="claim-dialog">
        <div class="form-row">
          <label>订单类型</label>
          <el-radio-group v-model="claimForm.orderType">
            <el-radio v-for="item in TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label>打手人数</label>
          <input v-model="claimForm.playerCount" placeholder="仅支持输入整数" @input="handleIntegerInput" />
        </div>
        <div class="form-row">
          <label>角色名</label>
          <input v-model="claimForm.roleName" placeholder="请输入角色名" />
        </div>
        <div class="form-row">
          <label>组队码</label>
          <!-- 组队码 teamCode：maintain 已支持（新 OpenAPI），填写则随认领提交 -->
          <input v-model="claimForm.groupCode" placeholder="请输入组队码" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="claimVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitClaim">领取</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.status-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.status-success { color: #0f9f6e; background: rgba(15, 159, 110, 0.08); }
.status-warning { color: #b45309; background: rgba(180, 83, 9, 0.08); }
.status-info { color: #1d4ed8; background: rgba(29, 78, 216, 0.08); }
.status-danger { color: #d92d20; background: rgba(217, 45, 32, 0.08); }
.status-muted { color: #475467; background: rgba(71, 84, 103, 0.08); }

.order-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
}

.tag-warn { color: #b45309; background: rgba(245, 158, 11, 0.12); }
.tag-info { color: #1d4ed8; background: rgba(59, 130, 246, 0.12); }
.tag-success { color: #0f9f6e; background: rgba(15, 159, 110, 0.1); }
.tag-danger { color: #d92d20; background: rgba(217, 45, 32, 0.1); }
.tag-muted { color: #475467; background: rgba(71, 84, 103, 0.1); }
.tag-purple { color: var(--primary); background: var(--primary-faint); }

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

.muted-text {
  color: var(--text-faint);
  font-size: 12px;
}

.link-btn {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.link-btn.primary {
  color: var(--primary);
  font-weight: 600;
}

.link-btn:hover {
  background: var(--primary-soft);
}

.perm-hint {
  flex: 0 0 auto;
  margin: 0;
  text-align: right;
  font-size: 12px;
  color: #8a93a6;
}

.claim-dialog {
  display: grid;
  gap: 16px;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.form-row input {
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  color: #1f2937;
  box-sizing: border-box;
  background: #fbfcfe;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.form-row input:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.claim-dialog :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px;
  min-height: 30px;
}

.claim-dialog :deep(.el-radio) {
  margin-right: 0;
  height: 30px;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 22px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: background 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease, transform 0.18s ease;
}

.btn:active {
  transform: translateY(1px);
}

.btn-plain {
  background: #f2f4f7;
  color: #475467;
}

.btn-plain:hover {
  background: #e8ecf3;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 12px 24px var(--primary-glow-strong);
}

.btn-primary:hover {
  filter: brightness(1.06);
  box-shadow: 0 16px 30px var(--primary-border-strong);
}
</style>
