<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { clubApi } from '../../../api/modules/club';
import { gameApi } from '../../../api/modules/game';

const { confirm } = useConfirm();
const { show } = useToast();

// ============ 筛选 ============
const filter = reactive({
  keyword: '',
  status: '',
});

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['keyword', 'status'],
});
restoreFilter(filter);

// ============ 列表（服务端分页） ============
const rows = ref([]);
const total = ref(0);
const loading = ref(false);

const STATUS_LABEL = { NORMAL: '已开通', DISABLED: '已禁用' };

const columns = [
  { key: 'id', title: '俱乐部ID' },
  { key: 'name', title: '俱乐部名称' },
  { key: 'phone', title: '手机号' },
  { key: 'status', title: '状态' },
  { key: 'inStore', title: '是否在店' },
  { key: 'publicGrab', title: '公开抢单' },
  { key: 'canTake', title: '可接单' },
  { key: 'realNameVerified', title: '实名认证' },
  { key: 'quitAt', title: '退店时间' },
  { key: 'op', title: '操作' },
];

const searchFields = [
  {
    prop: 'keyword',
    label: '关键词',
    type: 'input',
    placeholder: '请输入俱乐部名称或手机号',
    span: 8,
  },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    span: 8,
    options: [
      { label: '全部', value: '' },
      { label: '已开通', value: 'NORMAL' },
      { label: '已禁用', value: 'DISABLED' },
    ],
  },
];

function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await clubApi.list({
      page: page.value,
      pageSize: pageSize.value,
      status: filter.status,
      keyword: filter.keyword,
    });
    rows.value = res.list || [];
    total.value = res.total || 0;
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
    if (Array.isArray(filter[key])) filter[key] = [];
    else filter[key] = '';
  });
  rememberFilter(filter, true);
  fetchList();
}

function pageChange(nextPage) {
  onPageChange(nextPage);
  fetchList();
}

// ============ 启用 / 停用账号 ============
async function toggleStatus(row) {
  const next = row.status === 'NORMAL' ? 'DISABLED' : 'NORMAL';
  const actionLabel = next === 'DISABLED' ? '停用' : '启用';
  const ok = await confirm({
    title: '提示',
    message: `确认${actionLabel}俱乐部「${row.name}」吗？${next === 'DISABLED' ? '停用后该俱乐部将无法登录。' : ''}`,
    okText: '确认',
  });
  if (!ok) return;
  try {
    await clubApi.updateStatus(row.id, next);
    show(`${actionLabel}成功`, 'success');
    fetchList();
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  }
}

// ============ 可接单规格 ============
const specDialogVisible = ref(false);
const specLoading = ref(false);
const specSaving = ref(false);
const specLoadError = ref(false);
const currentRow = ref(null);
// 游戏-规格目录：来源 gameApi.all()（当前为 mock），真实联调时规格 id 以游戏/规格列表接口返回为准
const specCatalog = ref([]); // [{ gameId, gameName, specs: [{ id, name }] }]
const specGameRows = ref([]); // [{ gameId, gameName, specs, all, checked:Set<number> }]

const specDialogTitle = computed(() => `可接单规格 - ${currentRow.value?.name ?? ''}`);

async function loadSpecCatalog() {
  if (specCatalog.value.length) return;
  const games = await gameApi.all();
  specCatalog.value = (games || []).map((game) => ({
    gameId: game.id,
    gameName: game.name,
    specs: (game.specs || []).map((name, i) => ({ id: i + 1, name })),
  }));
}

function buildSpecRows(list) {
  const configMap = new Map((list || []).map((item) => [Number(item.gameId), item]));
  specGameRows.value = specCatalog.value.map((game) => {
    const cfg = configMap.get(game.gameId);
    const all = !!(cfg && cfg.all);
    const checked = new Set(all || !cfg ? [] : (Array.isArray(cfg.specIds) ? cfg.specIds.map(Number) : []));
    return { ...game, all, checked };
  });
}

async function openSpecs(row) {
  currentRow.value = row;
  specGameRows.value = [];
  specLoadError.value = false;
  specDialogVisible.value = true;
  specLoading.value = true;
  try {
    await loadSpecCatalog();
    const list = await clubApi.getSpecs(Number(row.id));
    buildSpecRows(list);
  } catch (e) {
    // 错误提示由 request.js 统一弹出，这里仅标记加载失败态
    specLoadError.value = true;
  } finally {
    specLoading.value = false;
  }
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
  // 单规格全选后自动视为“全部规格”
  row.all = row.specs.length > 0 && row.checked.size === row.specs.length;
  if (row.all) row.checked.clear();
}

async function saveSpecs() {
  if (!currentRow.value) return;
  // 仅提交有选中的游戏；all=true 或 specIds 为空均表示该游戏全部规格可接
  const specs = specGameRows.value
    .filter((row) => row.all || row.checked.size > 0)
    .map((row) => ({
      gameId: row.gameId,
      all: row.all,
      specIds: row.all ? [] : [...row.checked],
    }));
  specSaving.value = true;
  try {
    await clubApi.updateSpecs(Number(currentRow.value.id), specs);
    show('规格保存成功', 'success');
    specDialogVisible.value = false;
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  } finally {
    specSaving.value = false;
  }
}

// ============ 展示辅助 ============
function getStatusClass(status) {
  return status === 'DISABLED' ? 'status-danger' : 'status-success';
}

function getStoreClass(row) {
  return Number(row.inStore) === 1 ? 'status-success' : 'status-muted';
}

onMounted(fetchList);
</script>

<template>
  <div class="list-page">
    <div class="list-page__search">
      <SearchComponent :fields="searchFields" :initial-values="filter" @search="handleSearch" @reset="handleReset" />
    </div>

    <DataTable
      :columns="columns"
      :data="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="pageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #cell-status="{ row }">
        <span :class="['status-badge', getStatusClass(row.status)]">{{ STATUS_LABEL[row.status] ?? row.status }}</span>
      </template>

      <template #cell-inStore="{ row }">
        <span :class="['status-badge', getStoreClass(row)]">{{ Number(row.inStore) === 1 ? '在店' : '已退店' }}</span>
      </template>

      <template #cell-publicGrab="{ row }">
        <span :class="['status-badge', Number(row.publicGrab) === 1 ? 'status-success' : 'status-muted']">
          {{ Number(row.publicGrab) === 1 ? '是' : '否' }}
        </span>
      </template>

      <template #cell-canTake="{ row }">
        <span :class="['status-badge', Number(row.canTake) === 1 ? 'status-success' : 'status-muted']">
          {{ Number(row.canTake) === 1 ? '可接单' : '不可接单' }}
        </span>
      </template>

      <template #cell-realNameVerified="{ row }">
        <span :class="['status-badge', Number(row.realNameVerified) === 1 ? 'status-success' : 'status-muted']">
          {{ Number(row.realNameVerified) === 1 ? '已实名' : '未实名' }}
        </span>
      </template>

      <template #cell-quitAt="{ row }">{{ formatTime(row.quitAt) }}</template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" type="button" @click="openSpecs(row)">可接单规格</button>
          <button v-if="row.status === 'NORMAL'" class="link-btn danger" type="button" @click="toggleStatus(row)">停用</button>
          <button v-else class="link-btn success" type="button" @click="toggleStatus(row)">启用</button>
        </div>
      </template>
    </DataTable>

    <AppModal v-model="specDialogVisible" :title="specDialogTitle" width="640px">
      <div class="spec-dialog-card club-modal-content">
        <div v-if="specLoading" class="spec-loading">规格加载中…</div>
        <template v-else>
          <div v-if="specLoadError" class="spec-empty">规格加载失败，请检查接口或稍后重试</div>
          <div v-else-if="!specGameRows.length" class="spec-empty">暂无游戏规格数据，请先在游戏管理中配置</div>
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
          <div class="spec-tip">勾选后该俱乐部可接对应游戏规格的订单；勾选“全部规格”表示该游戏下所有规格均可接，未勾选任何规格的游戏不会提交。</div>
        </template>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="specDialogVisible = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="specLoading || specSaving" @click="saveSpecs">
          {{ specSaving ? '保存中…' : '保存' }}
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

.list-page__search {
  background: var(--bg-card);
  border: 1px solid #edf0f5;
  border-radius: 12px;
  padding: 18px 18px 0;
}

.action-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 8px;
  min-width: max-content;
}

.link-btn {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 8px;
  white-space: nowrap;
  flex: 0 0 auto;
  transition: background 0.15s ease, color 0.15s ease;
}

.link-btn:hover {
  background: rgba(37, 99, 235, 0.08);
}

.link-btn.danger {
  color: #d92d20;
}

.link-btn.danger:hover {
  background: rgba(217, 45, 32, 0.08);
}

.link-btn.success {
  color: #0f9f6e;
}

.link-btn.success:hover {
  background: rgba(15, 159, 110, 0.08);
}

.list-page__body td:last-child {
  min-width: 160px;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.status-success {
  color: #0f9f6e;
  background: rgba(15, 159, 110, 0.08);
}

.status-danger {
  color: #d92d20;
  background: rgba(217, 45, 32, 0.08);
}

.status-muted {
  color: #475467;
  background: rgba(71, 84, 103, 0.08);
}

/* ===== 可接单规格弹窗 ===== */
.spec-dialog-card {
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
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.spec-game-item:hover {
  border-color: #c9b8ff;
  box-shadow: 0 6px 16px var(--primary-border);
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

.spec-all-toggle.muted {
  opacity: 0.5;
  cursor: not-allowed;
}

.spec-all-toggle input {
  width: auto;
  accent-color: var(--primary);
}

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

.spec-tag:hover {
  border-color: #c9b8ff;
  color: var(--primary);
}

.spec-tag.active {
  border-color: transparent;
  background: var(--primary-faint);
  color: var(--primary);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--primary-border-strong);
}

.spec-tag.disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.spec-tag.disabled:hover {
  border-color: #e3e7f0;
  color: #475467;
}

.spec-tag input {
  width: auto;
  margin: 0;
  accent-color: var(--primary);
}

.spec-game-none {
  color: #98a2b3;
  font-size: 12px;
}

.spec-tip {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--primary-faint);
  color: #8a93a6;
  font-size: 12px;
  line-height: 1.6;
}

/* ===== 弹窗底部按钮 ===== */
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

<!-- 规格弹窗外壳外观，通过内容容器 :has 命中 -->
<style>
.modal-overlay:has(.club-modal-content) {
  background: rgba(17, 12, 46, 0.55);
  backdrop-filter: blur(6px);
}

.modal-box:has(.club-modal-content) {
  border-radius: 22px;
  border: 1px solid var(--primary-border);
  box-shadow: 0 40px 90px rgba(46, 16, 101, 0.35), 0 6px 20px rgba(46, 16, 101, 0.16);
}

.modal-box:has(.club-modal-content) .modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-bottom: none;
}

.modal-box:has(.club-modal-content) .modal-header strong {
  color: var(--text-invert);
  font-size: 18px;
  letter-spacing: 0.02em;
}

.modal-box:has(.club-modal-content) .modal-title-dot {
  background: var(--bg-card);
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.22);
}

.modal-box:has(.club-modal-content) .modal-header .btn-link {
  color: rgba(255, 255, 255, 0.9);
}

.modal-box:has(.club-modal-content) .modal-header .btn-link:hover {
  background: rgba(255, 255, 255, 0.18);
  color: var(--text-invert);
}

.modal-box:has(.club-modal-content) .modal-body {
  padding: 24px;
  background: var(--bg-card);
}

.modal-box:has(.club-modal-content) .modal-footer {
  padding: 16px 24px 20px;
  background: linear-gradient(180deg, rgba(248, 250, 255, 0.7), rgba(243, 240, 255, 0.95));
  border-top: 1px solid var(--primary-faint);
}
</style>
