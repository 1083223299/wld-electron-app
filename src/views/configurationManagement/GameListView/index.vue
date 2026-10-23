<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { gameApi } from '../../../api/modules/game';
import SkuMapping from './SkuMapping.vue';

const { confirm } = useConfirm();
const { show } = useToast();

// ============ 视图切换：list = 游戏列表，sku = SKU 映射 ============
const currentView = ref('list');
const currentGame = ref({ id: null, name: '' });

// ============ 筛选 ============
const filter = reactive({
  gameId: '',
  gameName: '',
  createTime: [],
});

const searchFields = [
  { prop: 'gameId', label: '游戏ID', type: 'input', placeholder: '请输入游戏ID', span: 5 },
  { prop: 'gameName', label: '游戏名称', type: 'input', placeholder: '请输入游戏名称', span: 5 },
  {
    prop: 'createTime',
    label: '创建时间',
    type: 'daterange-no-time',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    span: 6,
  },
];

// ============ 列表 ============
const rows = ref([]);
const total = ref(0);
const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['gameId', 'gameName', 'createTime'],
});
restoreFilter(filter);
const loading = ref(false);

const columns = [
  { key: 'id', title: '游戏ID' },
  { key: 'name', title: '游戏名称' },
  { key: 'settleDays', title: '账期天数' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'op', title: '操作' },
];

/** 日期（Date 或字符串）→ 'yyyy-MM-dd'，供 createdFrom/createdTo 使用 */
function toDateStr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value).replace(/-/g, '/'));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchList() {
  loading.value = true;
  try {
    // 服务端分页/筛选：id 完全匹配、name 模糊、createdFrom/createdTo 区间
    const range = Array.isArray(filter.createTime) && filter.createTime.length === 2 ? filter.createTime : [];
    const res = await gameApi.list({
      page: page.value,
      pageSize: pageSize.value,
      id: filter.gameId,
      name: filter.gameName,
      createdFrom: toDateStr(range[0]),
      createdTo: toDateStr(range[1]),
    });
    rows.value = (res && res.list) || [];
    total.value = (res && res.total) || 0;
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
  filter.gameId = '';
  filter.gameName = '';
  filter.createTime = [];
  rememberFilter(filter, true);
  fetchList();
}

function pageChange(p) {
  onPageChange(p);
  fetchList();
}

// ============ 新增 / 编辑 ============
const editVisible = ref(false);
const editingId = ref(null); // null = 新增
const editForm = reactive({
  name: '',
  settleDays: '',
  specs: [''],
});
// 编辑时记录的原始规格（含 id），用于识别表单中被删除的行 → 显式调 DELETE 删除
const originalSpecs = ref([]);

function openCreate() {
  editingId.value = null;
  editForm.name = '';
  editForm.settleDays = '';
  editForm.specs = [''];
  originalSpecs.value = [];
  editVisible.value = true;
}

async function openEdit(row) {
  editingId.value = row.id;
  editForm.name = row.name || '';
  editForm.settleDays = row.settleDays ?? '';
  editForm.specs = [''];
  editVisible.value = true;
  try {
    // 列表接口不返回规格，编辑时单独拉取当前规格（含 id，删除规格时需要）
    const specs = (await gameApi.specs(row.id)) || [];
    originalSpecs.value = specs;
    editForm.specs = specs.length ? specs.map((s) => s.name) : [''];
  } catch {
    originalSpecs.value = [];
    editForm.specs = [''];
  }
}

function addSpec() {
  editForm.specs.push('');
}

function removeSpec(idx) {
  if (editForm.specs.length <= 1) {
    show('至少保留一个游戏规格', 'warning');
    return;
  }
  editForm.specs.splice(idx, 1);
}

async function submitEdit() {
  if (!editForm.name.trim()) {
    show('请输入游戏名称', 'warning');
    return;
  }
  if (editForm.name.trim().length > 15) {
    show('游戏名称最多15字', 'warning');
    return;
  }
  const specs = editForm.specs.map((s) => s.trim()).filter(Boolean);
  if (!specs.length) {
    show('请至少填写一个游戏规格', 'warning');
    return;
  }
  const dupSpec = specs.find((s, i) => specs.indexOf(s) !== i);
  if (dupSpec) {
    show(`游戏规格「${dupSpec}」重复`, 'warning');
    return;
  }
  if (specs.some((s) => s.length > 50)) {
    show('单个游戏规格不能超过50个字', 'warning');
    return;
  }
  // 账期天数：必填正整数（与后端口径一致：不传/0/负数/小数/非数字均返回「请填写账期天数」）
  const settleDays = Number(editForm.settleDays);
  if (!editForm.settleDays || !Number.isInteger(settleDays) || settleDays <= 0) {
    show('请填写账期天数', 'warning');
    return;
  }

  const payload = {
    name: editForm.name.trim(),
    settleDays,
    specs,
  };

  try {
    if (editingId.value) {
      // 编辑：规格为“补齐”语义——PUT 内联提交会新增缺失规格、保留已有规格；
      // 表单中被删除的规格需显式调 DELETE /games/{gameId}/specs/{id} 删除
      const removed = originalSpecs.value.filter((s) => !specs.includes(s.name));
      await gameApi.update(editingId.value, payload);
      for (const spec of removed) {
        if (spec.id != null) {
          await gameApi.removeSpec(editingId.value, spec.id);
        }
      }
      show('编辑成功', 'success');
    } else {
      await gameApi.create(payload);
      show('新增成功', 'success');
    }
    editVisible.value = false;
    fetchList();
  } catch (e) {
    show(e?.message || '保存失败', 'error');
  }
}

// ============ 删除 ============
async function handleDelete(row) {
  const ok = await confirm({
    title: '删除确认',
    message: `确认删除游戏「${row.name}」吗？此操作为软删除，历史订单数据仍可关联查询。`,
    okText: '确认删除',
  });
  if (!ok) return;
  await gameApi.remove(row.id);
  show('删除成功', 'success');
  fetchList();
}

// ============ SKU 映射（页面内切换） ============
function goSkuMapping() {
  currentGame.value = { id: null, name: '' };
  currentView.value = 'sku';
}

function backFromSku() {
  currentView.value = 'list';
  fetchList(); // 返回后刷新列表
}

onMounted(fetchList);
</script>

<template>
  <!-- SKU 映射视图 -->
  <SkuMapping
    v-if="currentView === 'sku'"
    :game-id="currentGame.id"
    :game-name="currentGame.name"
    @back="backFromSku"
  />

  <!-- 游戏列表视图 -->
  <div v-if="currentView === 'list'" class="list-page">
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        :row-columns="3"
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
      @page-size-change="onPageSizeChange"
    >
      <template #toolbar>
        <div class="toolbar-row">
          <button class="btn btn-primary" @click="openCreate">新增</button>
          <button class="btn btn-plain" @click="goSkuMapping">sku映射</button>
        </div>
      </template>

      <template #cell-settleDays="{ row }">
        {{ row.settleDays != null ? `${row.settleDays}天` : '-' }}
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" @click="openEdit(row)">编辑</button>
          <button class="link-btn danger" @click="handleDelete(row)">删除</button>
        </div>
      </template>
    </DataTable>

    <!-- 新增 / 编辑 弹窗 -->
    <AppModal v-model="editVisible" :title="editingId ? '编辑' : '新增'" width="640px">
      <div class="game-modal-content">
        <div class="form-grid">
          <div class="form-row">
            <label class="required">游戏名称</label>
            <input v-model="editForm.name" maxlength="15" placeholder="上限15个字" />
          </div>
          <div class="form-row">
            <label class="required">账期天数</label>
            <div class="bill-period-wrap">
              <input
                v-model.number="editForm.settleDays"
                type="number"
                min="1"
                placeholder="请输入天数"
              />
              <span class="unit">天</span>
            </div>
          </div>
        </div>

        <div class="spec-section">
          <label class="required">游戏规格</label>
          <div v-for="(spec, idx) in editForm.specs" :key="idx" class="spec-row">
            <input v-model="editForm.specs[idx]" maxlength="50" placeholder="请输入游戏规格，上限50字" />
            <button
              v-if="editForm.specs.length > 1"
              type="button"
              class="icon-btn"
              @click="removeSpec(idx)"
              title="删除该规格"
            >
              −
            </button>
            <button
              v-if="idx === editForm.specs.length - 1"
              type="button"
              class="icon-btn"
              @click="addSpec"
              title="新增规格"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="editVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitEdit">确 定</button>
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

.toolbar-row {
  display: flex;
  gap: 10px;
  align-items: center;
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

.link-btn.danger {
  color: #d92d20;
}

.link-btn.danger:hover {
  background: rgba(217, 45, 32, 0.08);
}

/* 弹窗 */
.game-modal-content {
  display: grid;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row label,
.spec-section > label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.form-row label.required::before,
.spec-section > label.required::before {
  content: '*';
  color: #f04438;
  margin-right: 4px;
}

.form-row input,
.form-row select,
.spec-row input {
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  color: #1f2937;
  box-sizing: border-box;
  background: #fbfcfe;
  font-family: inherit;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.form-row input:focus,
.form-row select:focus,
.spec-row input:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.bill-period-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bill-period-wrap .unit {
  color: #5b6478;
  font-size: 13px;
}

.spec-section {
  display: grid;
  gap: 10px;
}

.spec-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.spec-row input {
  flex: 1;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid #e3e7f0;
  background: #fbfcfe;
  color: #475467;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s ease;
}

.icon-btn:hover {
  border-color: #8b5cf6;
  color: var(--primary);
  background: var(--bg-card);
}

.icon-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

<!-- 弹窗外壳美化 -->
<style>
.modal-overlay:has(.game-modal-content) {
  background: rgba(17, 12, 46, 0.55);
  backdrop-filter: blur(6px);
}

.modal-box:has(.game-modal-content) {
  border-radius: 22px;
  border: 1px solid var(--primary-border);
  box-shadow: 0 40px 90px rgba(46, 16, 101, 0.35);
}

.modal-box:has(.game-modal-content) .modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-bottom: none;
}

.modal-box:has(.game-modal-content) .modal-header strong {
  color: var(--text-invert);
  font-size: 18px;
}

.modal-box:has(.game-modal-content) .modal-body {
  padding: 24px;
  background: var(--bg-card);
}

.modal-box:has(.game-modal-content) .modal-footer {
  padding: 16px 24px 20px;
  /* background: linear-gradient(180deg, rgba(248, 250, 255, 0.7), rgba(243, 240, 255, 0.95)); */
  border-top: 1px solid var(--primary-faint);
}
.btn-link {
  color: var(--text-invert);
}
</style>
