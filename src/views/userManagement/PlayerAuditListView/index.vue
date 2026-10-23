<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { playerApplicationApi } from '../../../api/modules/player';
import { gameApi } from '../../../api/modules/game';

const { show } = useToast();

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

/** 状态枚举：PENDING=审核中 / REJECTED=已驳回（接口待后端确认，先按此拟定） */
const STATUS = { PENDING: '审核中', REJECTED: '已驳回' };
const STATUS_OPTIONS = [
  { label: '审核中', value: 'PENDING' },
  { label: '已驳回', value: 'REJECTED' },
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

/** 时间筛选传参：yyyy-MM-ddTHH:mm:ss */
function formatDateTime(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function mapRow(item = {}) {
  return {
    id: item.id,
    name: item.name || '',
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
      status: filter.status,
      appliedFrom: formatDateTime(from),
      appliedTo: formatDateTime(to),
    });
    const list = res && Array.isArray(res.list) ? res.list : Array.isArray(res) ? res : [];
    rows.value = list.map(mapRow);
    total.value = (res && res.total) || list.length;
  } catch {
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
  page.value = 1;
  fetchList();
}

function handleReset() {
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
const specLoadError = ref(false);
const specCatalogError = ref(false);
const currentRow = ref(null);
const specCatalog = ref([]); // [{ gameId, gameName, specs: [{id,name}] }]
const specGameRows = ref([]);

async function loadSpecCatalog() {
  const games = await gameApi.listAll();
  const catalog = await Promise.all(
    (Array.isArray(games) ? games : []).map(async (game) => {
      let specs = [];
      if (Array.isArray(game.specs) && game.specs.length) {
        specs = game.specs;
      } else {
        try {
          specs = await gameApi.specs(game.id);
        } catch {
          /* 单游戏规格失败不阻塞 */
        }
      }
      return {
        gameId: game.id,
        gameName: game.name,
        specs: (specs || []).map((s) => ({ id: Number(s.id ?? s), name: s.name ?? s })),
      };
    }),
  );
  specCatalog.value = catalog;
}

function toggleGameAll(row) {
  if (specSaving.value || !row.specs.length) return;
  row.all = !row.all;
  if (row.all) row.checked.clear();
}

function toggleSpec(row, specId) {
  if (specSaving.value || row.all) return;
  if (row.checked.has(specId)) row.checked.delete(specId);
  else row.checked.add(specId);
  row.all = row.specs.length > 0 && row.checked.size === row.specs.length;
  if (row.all) row.checked.clear();
}

async function openApprove(row) {
  currentRow.value = row;
  specGameRows.value = [];
  specLoadError.value = false;
  specCatalogError.value = false;
  specDialogVisible.value = true;
  specLoading.value = true;
  try {
    await loadSpecCatalog();
    specGameRows.value = specCatalog.value.map((g) => ({ ...g, all: false, checked: new Set() }));
  } catch (e) {
    specCatalogError.value = true;
  } finally {
    specLoading.value = false;
  }
}

async function submitApprove() {
  if (!currentRow.value) return;
  const specs = specGameRows.value
    .filter((g) => g.all || g.checked.size > 0)
    .map((g) => ({ gameId: g.gameId, all: g.all, specIds: g.all ? [] : [...g.checked] }));
  specSaving.value = true;
  try {
    await playerApplicationApi.approve(currentRow.value.id, { specs });
    show('已通过，打手入驻成功', 'success');
    specDialogVisible.value = false;
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
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
    await playerApplicationApi.reject(currentRow.value.id, { reason });
    show('已驳回', 'success');
    rejectDialogVisible.value = false;
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
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
      <template #cell-op="{ row }">
        <div v-if="row.statusCode === 'PENDING'" class="action-group">
          <button class="link-btn success" @click="openApprove(row)">通过</button>
          <button class="link-btn danger" @click="openReject(row)">驳回</button>
        </div>
        <span v-else class="muted-text">—</span>
      </template>
    </DataTable>

    <!-- 通过：维护可接单规格 -->
    <AppModal v-model="specDialogVisible" title="通过 - 维护可接单规格" width="640px">
      <div class="spec-dialog-card player-modal-content">
        <div v-if="specLoading" class="spec-loading">规格加载中…</div>
        <template v-else>
          <div v-if="specLoadError || specCatalogError" class="spec-empty">
            规格加载失败，请检查接口或稍后重试
          </div>
          <div v-else-if="!specGameRows.length" class="spec-empty">暂无游戏规格数据，请先在游戏管理中配置游戏与规格</div>
          <div v-else class="spec-game-list">
            <div v-for="game in specGameRows" :key="game.gameId" class="spec-game-item">
              <div class="spec-game-head">
                <span class="spec-game-name">{{ game.gameName }}</span>
                <label class="spec-all-toggle" :class="{ muted: !game.specs.length }">
                  <input
                    type="checkbox"
                    :checked="game.all"
                    :disabled="specSaving || !game.specs.length"
                    @change="toggleGameAll(game)"
                  />
                  <span>全部规格</span>
                </label>
              </div>
              <div v-if="game.specs.length" class="spec-tags">
                <label
                  v-for="spec in game.specs"
                  :key="spec.id"
                  :class="['spec-tag', { active: game.all || game.checked.has(spec.id), disabled: game.all }]"
                >
                  <input
                    type="checkbox"
                    :checked="game.all || game.checked.has(spec.id)"
                    :disabled="game.all || specSaving"
                    @change="toggleSpec(game, spec.id)"
                  />
                  <span>{{ spec.name }}</span>
                </label>
              </div>
              <div v-else class="spec-game-none">该游戏暂未配置规格</div>
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="specDialogVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="specLoading || specSaving" @click="submitApprove">
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

.spec-game-list {
  display: grid;
  gap: 12px;
  max-height: 46vh;
  overflow-y: auto;
  padding-right: 4px;
}

.spec-game-item {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid #e3e7f0;
  border-radius: 14px;
  background: #fbfcfe;
}

.spec-game-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.spec-game-name {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}

.spec-all-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #475467;
  cursor: pointer;
  user-select: none;
}

.spec-all-toggle.muted { opacity: 0.5; cursor: not-allowed; }
.spec-all-toggle input { width: auto; accent-color: var(--primary); }

.spec-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.spec-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e3e7f0;
  border-radius: 999px;
  background: #f8fafc;
  color: #475467;
  font-size: 12.5px;
  cursor: pointer;
  user-select: none;
  transition: all 0.16s ease;
}

.spec-tag:hover { border-color: #c9b8ff; color: var(--primary); }

.spec-tag.active {
  border-color: transparent;
  background: var(--primary-faint);
  color: var(--primary);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--primary-border-strong);
}

.spec-tag.disabled { cursor: not-allowed; opacity: 0.75; }
.spec-tag input { width: auto; margin: 0; accent-color: var(--primary); }
.spec-game-none { color: #98a2b3; font-size: 12px; }

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
