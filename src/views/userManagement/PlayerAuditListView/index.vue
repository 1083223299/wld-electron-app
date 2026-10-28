<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { playerApplicationApi } from '../../../api/modules/player';
import { gameApi } from '../../../api/modules/game';

const { show } = useToast();
const route = useRoute();

/* ===== 筛选（原型：打手名称模糊 / 打手手机号完全匹配 / 状态：审核中、已驳回 / 申请时间区间） ===== */
const filter = reactive({
  name: '',
  phone: '',
  status: '',
  appliedTime: [],
});

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['name', 'phone', 'status', 'appliedTime'],
});
restoreFilter(filter);

/** 状态枚举与打手入驻审核接口一致。 */
const STATUS = { PENDING: '审核中', REJECTED: '已驳回', APPROVED: '已通过' };
const STATUS_OPTIONS = [
  { label: '审核中', value: 'PENDING' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已通过', value: 'APPROVED' },
];

const searchFields = [
  { prop: 'name', label: '打手名称', type: 'input', placeholder: '请输入打手名称', span: 5 },
  { prop: 'phone', label: '打手手机号', type: 'input', placeholder: '请输入手机号（完全匹配）', span: 5 },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    span: 4,
    options: [{ label: '全部', value: '' }, ...STATUS_OPTIONS],
  },
  {
    prop: 'appliedTime',
    label: '申请时间',
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    shortcuts: [
      { text: '今天', value: () => { const d = new Date(); return [d, d]; } },
      { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [start, end]; } },
      { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [start, end]; } },
    ],
  },
];

const columns = [
  { key: 'name', title: '打手名称' },
  { key: 'phone', title: '打手手机号' },
  { key: 'clubName', title: '俱乐部名称' },
  { key: 'status', title: '状态' },
  { key: 'lastRejectReason', title: '上次驳回原因' },
  { key: 'appliedAt', title: '申请时间' },
  { key: 'op', title: '操作' },
];

const rows = ref([]);
const total = ref(0);
const loading = ref(false);
const notificationTarget = ref({ applicationId: '', playerId: '' });

/** 时间筛选传参：yyyy-MM-ddTHH:mm:ss */
function formatDateTime(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatAppliedAt(value) {
  return value ? String(value).replace('T', ' ') : '—';
}

function mapRow(item = {}) {
  return {
    id: item.id,
    name: item.realName || item.name || '',
    phone: item.phone || '',
    // 原型：俱乐部名称当前默认都是加入未来电竞，空值兜底展示「未来电竞」
    clubName: item.clubName || '未来电竞',
    statusCode: item.status || 'PENDING',
    status: STATUS[item.status] || item.status || '审核中',
    lastRejectReason: item.lastRejectReason || item.rejectReason || '',
    appliedAt: item.appliedAt || item.createdAt || '',
  };
}

async function fetchList() {
  loading.value = true;
  try {
    const [from, to] = filter.appliedTime || [];
    const res = await playerApplicationApi.list({
      page: page.value,
      pageSize: pageSize.value,
      name: filter.name,
      phone: filter.phone,
      ...notificationTarget.value,
      status: filter.status,
      appliedFrom: formatDateTime(from),
      appliedTo: formatDateTime(to),
    });
    const list = res && Array.isArray(res.list) ? res.list : Array.isArray(res) ? res : [];
    rows.value = list.map(mapRow);
    total.value = (res && res.total) || list.length;
  } catch (error) {
    rows.value = [];
    total.value = 0;
    show(error?.message || '打手审核列表加载失败', 'error');
  } finally {
    loading.value = false;
  }
}

function applyNotificationSearch(query = {}) {
  const applicationId = String(query.applicationId || '');
  const playerId = String(query.playerId || '');
  const name = String(query.name || '');
  const phone = String(query.phone || '');
  notificationTarget.value = { applicationId, playerId };
  if (!applicationId && !playerId && !name && !phone) {
    fetchList();
    return;
  }

  filter.name = name;
  filter.phone = phone;
  filter.status = '';
  filter.appliedTime = [];
  page.value = 1;
  fetchList();
}

onMounted(() => applyNotificationSearch(route.query));

watch(
  () => route.query,
  (query) => applyNotificationSearch(query)
);

function handleSearch(values) {
  notificationTarget.value = { applicationId: '', playerId: '' };
  Object.assign(filter, values);
  rememberFilter(filter, true);
  page.value = 1;
  fetchList();
}

function handleReset() {
  notificationTarget.value = { applicationId: '', playerId: '' };
  filter.name = '';
  filter.phone = '';
  filter.status = '';
  filter.appliedTime = [];
  rememberFilter(filter, true);
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

function getStatusClass(status) {
  return status === '已驳回' ? 'status-danger' : 'status-warn';
}

/* ================= 通过：维护可接单规格 ================= */
const specDialogVisible = ref(false);
const specLoading = ref(false);
const specSaving = ref(false);
const specCatalogError = ref(false);
const currentRow = ref(null);
const specCatalog = ref([]); // 游戏目录及各游戏的可选规格
const specRows = ref([]);

async function loadSpecCatalog() {
  const games = await gameApi.listAll();
  const catalog = await Promise.all(
    (Array.isArray(games) ? games : []).map(async (game) => {
      let specs = [];
      if (Array.isArray(game.specs) && game.specs.length) {
        specs = game.specs;
      } else {
        specs = await gameApi.specs(game.id);
      }
      return {
        gameId: String(game.id),
        gameName: game.name,
        specs: (specs || [])
          .map((spec) => ({ id: Number(spec.id ?? spec), name: spec.name ?? String(spec) }))
          .filter((spec) => Number.isFinite(spec.id) && spec.id > 0),
      };
    }),
  );
  specCatalog.value = catalog;
}

function gameForRow(row) {
  return specCatalog.value.find((game) => game.gameId === row.gameId);
}

function addSpecRow() {
  if (!specSaving.value) specRows.value.push({ gameId: '', specId: '' });
}

function removeSpecRow(index) {
  if (!specSaving.value && specRows.value.length > 1) specRows.value.splice(index, 1);
}

function changeSpecGame(row) {
  row.specId = '';
}

async function openApprove(row) {
  currentRow.value = row;
  specRows.value = [{ gameId: '', specId: '' }];
  specCatalogError.value = false;
  specDialogVisible.value = true;
  specLoading.value = true;
  try {
    await loadSpecCatalog();
  } catch {
    specCatalogError.value = true;
  } finally {
    specLoading.value = false;
  }
}

async function submitApprove() {
  if (!currentRow.value) return;
  const specIds = [];
  for (const [index, row] of specRows.value.entries()) {
    const game = gameForRow(row);
    if (!game || !row.specId) {
      return show(`请完整选择第 ${index + 1} 行的游戏和规格`, 'warning');
    }
    if (row.specId === 'ALL') {
      specIds.push(...game.specs.map((spec) => spec.id));
    } else {
      const specId = Number(row.specId);
      if (!game.specs.some((spec) => spec.id === specId)) {
        return show(`第 ${index + 1} 行的规格无效，请重新选择`, 'warning');
      }
      specIds.push(specId);
    }
  }
  const uniqueSpecIds = [...new Set(specIds)];
  if (!uniqueSpecIds.length) return show('请至少选择一个可接单规格', 'warning');
  specSaving.value = true;
  try {
    await playerApplicationApi.approve(currentRow.value.id, uniqueSpecIds);
    show('已通过，打手入驻成功', 'success');
    specDialogVisible.value = false;
    fetchList();
  } catch (error) {
    show(error?.message || '审核通过失败，请稍后重试', 'error');
  } finally {
    specSaving.value = false;
  }
}

/* ================= 驳回：维护驳回原因 ================= */
const rejectDialogVisible = ref(false);
const rejectSaving = ref(false);
const rejectForm = reactive({ reason: '' });

function openReject(row) {
  currentRow.value = row;
  rejectForm.reason = '';
  rejectDialogVisible.value = true;
}

async function submitReject() {
  if (!currentRow.value) return;
  const reason = rejectForm.reason.trim();
  if (!reason) return show('请填写驳回原因', 'warning');
  if (reason.length > 200) return show('驳回原因不能超过200字', 'warning');
  rejectSaving.value = true;
  try {
    await playerApplicationApi.reject(currentRow.value.id, reason);
    show('已驳回', 'success');
    rejectDialogVisible.value = false;
    fetchList();
  } catch (error) {
    show(error?.message || '驳回失败，请稍后重试', 'error');
  } finally {
    rejectSaving.value = false;
  }
}
</script>

<template>
  <div class="list-page">
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        @search="handleSearch"
        @reset="handleReset"
      />
    </div>

    <DataTable
      :columns="columns"
      :data="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="pageChange"
      @page-size-change="pageSizeChange"
    >
      <template #cell-status="{ row }">
        <span :class="['status-badge', getStatusClass(row.status)]">{{ row.status }}</span>
      </template>
      <template #cell-lastRejectReason="{ row }">
        <span v-if="row.lastRejectReason" class="reject-reason">{{ row.lastRejectReason }}</span>
        <span v-else>—</span>
      </template>
      <template #cell-appliedAt="{ row }">
        {{ formatAppliedAt(row.appliedAt) }}
      </template>
      <template #cell-op="{ row }">
        <div v-if="row.statusCode === 'PENDING'" class="action-group">
          <button class="link-btn success" @click="openApprove(row)">通过</button>
          <button class="link-btn danger" @click="openReject(row)">驳回</button>
        </div>
        <span v-else class="muted-text">—</span>
      </template>
    </DataTable>

    <!-- 通过：维护可接单规格 -->
    <AppModal v-model="specDialogVisible" title="通过 - 维护可接单规格" width="680px">
      <div class="spec-dialog-card player-modal-content">
        <div v-if="specLoading" class="spec-loading">规格加载中…</div>
        <template v-else>
          <div v-if="specCatalogError" class="spec-empty">
            规格加载失败，请检查接口或稍后重试
          </div>
          <div v-else-if="!specCatalog.length" class="spec-empty">暂无游戏数据，请先在游戏管理中配置游戏与规格</div>
          <div v-else class="spec-choice-list">
            <label class="field-label required">可接单规格</label>
            <div v-for="(row, index) in specRows" :key="index" class="spec-choice-row">
              <select
                v-model="row.gameId"
                :disabled="specSaving"
                aria-label="选择游戏"
                @change="changeSpecGame(row)"
              >
                <option value="" disabled>请选择游戏</option>
                <option v-for="game in specCatalog" :key="game.gameId" :value="game.gameId">
                  {{ game.gameName }}
                </option>
              </select>
              <select
                v-model="row.specId"
                :disabled="specSaving || !gameForRow(row)?.specs.length"
                aria-label="选择规格"
              >
                <option value="" disabled>请选择规格</option>
                <option
                  v-if="gameForRow(row)?.specs.length"
                  value="ALL"
                >全部规格</option>
                <option
                  v-for="spec in gameForRow(row)?.specs || []"
                  :key="spec.id"
                  :value="String(spec.id)"
                >
                  {{ spec.name }}
                </option>
              </select>
              <div class="spec-row-actions">
                <button
                  v-if="specRows.length > 1"
                  type="button"
                  class="spec-row-action remove"
                  :disabled="specSaving"
                  aria-label="删除规格行"
                  @click="removeSpecRow(index)"
                >−</button>
                <button
                  v-if="index === specRows.length - 1"
                  type="button"
                  class="spec-row-action add"
                  :disabled="specSaving"
                  aria-label="新增规格行"
                  @click="addSpecRow"
                >+</button>
              </div>
            </div>
            <p class="spec-choice-hint">选择“全部规格”会提交该游戏当前配置的全部规格。</p>
          </div>
        </template>
      </div>
      <template #footer>
        <button class="btn btn-plain" :disabled="specSaving" @click="specDialogVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="specLoading || specSaving || specCatalogError || !specCatalog.length" @click="submitApprove">
          {{ specSaving ? '提交中…' : '确定' }}
        </button>
      </template>
    </AppModal>

    <!-- 驳回：维护驳回原因 -->
    <AppModal v-model="rejectDialogVisible" title="驳回" width="520px">
      <div class="reject-dialog player-modal-content">
        <div class="field-group">
          <label class="field-label required">驳回原因</label>
          <textarea
            v-model="rejectForm.reason"
            rows="4"
            maxlength="200"
            placeholder="请填写驳回原因，最多200字"
          ></textarea>
          <div class="reason-count">{{ rejectForm.reason.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="rejectDialogVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="rejectSaving" @click="submitReject">
          {{ rejectSaving ? '提交中…' : '确定' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 12px;
  min-width: max-content;
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
  flex: 0 0 auto;
  transition: background 0.15s ease, color 0.15s ease;
}

.link-btn:hover {
  background: rgba(37, 99, 235, 0.08);
}

.link-btn.danger { color: #d92d20; }
.link-btn.danger:hover { background: rgba(217, 45, 32, 0.08); }
.link-btn.success { color: #0f9f6e; }
.link-btn.success:hover { background: rgba(15, 159, 110, 0.08); }

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.status-warn { color: #b45309; background: rgba(180, 83, 9, 0.08); }
.status-danger { color: #d92d20; background: rgba(217, 45, 32, 0.08); }

.reject-reason {
  color: #d92d20;
  font-size: 12.5px;
}

.muted-text { color: #98a2b3; }

/* 规格弹窗 */
.spec-dialog-card,
.reject-dialog {
  display: grid;
  gap: 16px;
}

.spec-loading,
.spec-empty {
  padding: 32px 12px;
  text-align: center;
  color: #8a93a6;
  font-size: 13px;
}

.spec-choice-list {
  display: grid;
  gap: 14px;
}

.spec-choice-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.spec-choice-row select {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e3e7f0;
  border-radius: 10px;
  background: #fff;
  color: #344054;
  font-size: 13px;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.spec-choice-row select:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px var(--primary-border);
}

.spec-choice-row select:disabled {
  background: #f5f6fa;
  color: #98a2b3;
  cursor: not-allowed;
}

.spec-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spec-row-action {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid #e3e7f0;
  border-radius: 10px;
  background: #fff;
  color: #475467;
  font-size: 21px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.16s ease;
}

.spec-row-action.add {
  border-color: var(--primary-border-strong);
  color: var(--primary);
}

.spec-row-action:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-faint);
}

.spec-row-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spec-choice-hint {
  margin: -4px 0 0;
  color: #98a2b3;
  font-size: 12px;
}

@media (max-width: 560px) {
  .spec-choice-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .spec-row-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}

/* 驳回弹窗 */
.field-group { display: grid; gap: 8px; }

.field-label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.field-label.required::before {
  content: '*';
  color: #f04438;
  margin-right: 4px;
}

.field-group textarea {
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  background: #fbfcfe;
  padding: 11px 14px;
  font-size: 13px;
  box-sizing: border-box;
  color: #1f2937;
  resize: vertical;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.field-group textarea:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.reason-count {
  text-align: right;
  color: #98a2b3;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* 底部按钮 */
.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 22px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.btn-plain { background: #f2f4f7; color: #475467; }
.btn-plain:hover { background: #e8ecf3; }

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 12px 24px var(--primary-glow-strong);
}

.btn-primary:hover { filter: brightness(1.06); }
</style>

<!-- 弹窗外壳美化（与其他管理页一致） -->
<style>
.modal-overlay:has(.player-modal-content) {
  background: rgba(17, 12, 46, 0.55);
  backdrop-filter: blur(6px);
}

.modal-box:has(.player-modal-content) {
  border-radius: 22px;
  border: 1px solid var(--primary-border);
  box-shadow: 0 40px 90px rgba(46, 16, 101, 0.35);
}

.modal-box:has(.player-modal-content) .modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-bottom: none;
}

.modal-box:has(.player-modal-content) .modal-header strong {
  color: var(--text-invert);
  font-size: 18px;
}

.modal-box:has(.player-modal-content) .modal-body {
  padding: 24px;
  background: var(--bg-card);
}

.modal-box:has(.player-modal-content) .modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid var(--primary-faint);
}
</style>
