// GameListView 组件，用于管理游戏列表及其 SKU 映射
<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { gameApi } from '../../../api/modules/game';
import { fileApi } from '../../../api/modules/file';
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
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    shortcuts: [
      { text: '今天', value: () => { const d = new Date(); return [d, d]; } },
      { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [start, end]; } },
      { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [start, end]; } },
    ],
    span: 6,
  },
];

// ============ 列表 ============
const rows = ref([]);
const total = ref(0);
const customOrderSavingIds = ref(new Set());
const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['gameId', 'gameName', 'createTime'],
});
restoreFilter(filter);
const loading = ref(false);

const columns = [
  { key: 'id', title: '游戏ID' },
  { key: 'name', title: '游戏名称' },
  { key: 'logo', title: '游戏logo' },
  { key: 'settleDays', title: '账期天数' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'customOrder', title: '用户自定义下单开关' },
  { key: 'op', title: '操作' },
];

function isCustomOrderEnabled(row) {
  const value = row.customOrderEnabled ?? row.allowCustomOrder ?? 1;
  return value === true || value === 1 || value === '1';
}

async function toggleCustomOrder(row) {
  if (customOrderSavingIds.value.has(row.id)) return;
  const previousValue = isCustomOrderEnabled(row);
  const nextValue = !previousValue;
  customOrderSavingIds.value.add(row.id);
  row.customOrderEnabled = nextValue ? 1 : 0;

  try {
    const currentSpecs = Array.isArray(row.specs) && row.specs.length
      ? row.specs
      : await gameApi.specs(row.id);
    const specs = currentSpecs.map((spec) => (typeof spec === 'string' ? spec : spec.name)).filter(Boolean);
    await gameApi.update(row.id, {
      name: row.name,
      settleDays: row.settleDays,
      specs,
      logoUrl: row.logoUrl || row.logo || row.gameLogo || '',
      customOrderEnabled: nextValue ? 1 : 0,
    });
    row.allowCustomOrder = nextValue ? 1 : 0;
    show(`已${nextValue ? '开启' : '关闭'}「${row.name}」的用户自定义下单`, 'success');
  } catch (error) {
    row.customOrderEnabled = previousValue ? 1 : 0;
    row.allowCustomOrder = previousValue ? 1 : 0;
    show(error?.message || '开关保存失败，请重试', 'error');
  } finally {
    customOrderSavingIds.value.delete(row.id);
  }
}

/** 日期（Date 或字符串）→ 'yyyy-MM-ddTHH:mm:ss'，供 createdFrom/createdTo 使用（后端只接受 yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss） */
function toDateTimeStr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value).replace(/-/g, '/'));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function fetchList() {
  loading.value = true;
  try {
    // 服务端分页/筛选：id 完全匹配、name 模糊、createdFrom/createdTo 区间（yyyy-MM-dd HH:mm:ss）
    const range = Array.isArray(filter.createTime) && filter.createTime.length === 2 ? filter.createTime : [];
    const res = await gameApi.list({
      page: page.value,
      pageSize: pageSize.value,
      id: filter.gameId,
      name: filter.gameName,
      createdFrom: toDateTimeStr(range[0]),
      createdTo: toDateTimeStr(range[1]),
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
  logo: '', // 游戏logo（必填，图片 url）【字段名待后端确认】
  customOrderEnabled: true, // 用户自定义下单开关【字段名待后端确认】
});
// 编辑时记录的原始规格（含 id），用于识别表单中被删除的行 → 显式调 DELETE 删除
const originalSpecs = ref([]);
const logoUploading = ref(false);
const previewLogoUrl = ref('');

function openLogoPreview(url) {
  if (url) previewLogoUrl.value = url;
}

function closeLogoPreview() {
  previewLogoUrl.value = '';
}

function handleLogoPreviewKeydown(event) {
  if (event.key === 'Escape' && previewLogoUrl.value) closeLogoPreview();
}

function resetEditForm() {
  editForm.name = '';
  editForm.settleDays = '';
  editForm.specs = [''];
  editForm.logo = '';
  editForm.customOrderEnabled = true;
}

function openCreate() {
  editingId.value = null;
  resetEditForm();
  originalSpecs.value = [];
  editVisible.value = true;
}

async function openEdit(row) {
  editingId.value = row.id;
  editForm.name = row.name || '';
  editForm.settleDays = row.settleDays ?? '';
  editForm.specs = [''];
  // Keep the legacy logo aliases for rows returned by older game-list responses.
  editForm.logo = row.logo || row.logoUrl || row.gameLogo || '';
  editForm.customOrderEnabled = row.customOrderEnabled ?? row.allowCustomOrder ?? true;
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

/* ===== 游戏logo 上传（单图，必填） ===== */
function openLogoPicker() {
  document.getElementById('game-logo-input')?.click();
}

async function handleLogoFile(event) {
  const picked = Array.from(event.target.files || []);
  event.target.value = '';
  if (!picked.length) return;
  const file = picked[0];
  if (!/^image\//.test(file.type) && !/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(file.name)) {
    show('请上传图片格式的logo', 'warning');
    return;
  }
  logoUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    editForm.logo = res.url;
    show('logo已上传', 'success');
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  } finally {
    logoUploading.value = false;
  }
}

function removeLogo() {
  editForm.logo = '';
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
  // 游戏logo：必填（原型批注1：加游戏logo字段，必填）
  if (!editForm.logo) {
    show('请上传游戏logo', 'warning');
    return;
  }

  const payload = {
    name: editForm.name.trim(),
    settleDays,
    specs,
    logoUrl: editForm.logo,
    customOrderEnabled: editForm.customOrderEnabled ? 1 : 0,
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

onMounted(() => {
  fetchList();
  window.addEventListener('keydown', handleLogoPreviewKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleLogoPreviewKeydown);
});
</script>

<template>
  <div class="game-list-view">
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

        <template #cell-logo="{ row }">
          <button
            v-if="row.logo || row.logoUrl || row.gameLogo"
            type="button"
            class="game-logo-trigger"
            :aria-label="`放大查看${row.name || '游戏'}logo`"
            title="点击放大"
            @click="openLogoPreview(row.logo || row.logoUrl || row.gameLogo)"
          >
            <img
              class="game-logo-thumb"
              :src="row.logo || row.logoUrl || row.gameLogo"
              alt="游戏logo"
            />
          </button>
          <span v-else class="muted-text">—</span>
        </template>

        <template #cell-customOrder="{ row }">
          <button
            type="button"
            role="switch"
            :aria-checked="isCustomOrderEnabled(row)"
            :aria-label="`${row.name}用户自定义下单`"
            :disabled="customOrderSavingIds.has(row.id)"
            class="custom-order-switch"
            :class="{
              on: isCustomOrderEnabled(row),
              saving: customOrderSavingIds.has(row.id),
            }"
            @click="toggleCustomOrder(row)"
          >
            <span class="dot" />
          </button>
        </template>

        <template #cell-op="{ row }">
          <div class="action-group">
            <button class="link-btn" @click="openEdit(row)">编辑</button>
            <button class="link-btn danger" @click="handleDelete(row)">删除</button>
          </div>
        </template>
      </DataTable>

      <!-- 新增 / 编辑 弹窗 -->
      <AppModal v-model="editVisible" :title="editingId ? '编辑游戏' : '新增游戏'" width="720px">
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
            <div class="form-row form-row--logo">
              <label class="required">游戏logo</label>
              <div class="logo-uploader">
                <input id="game-logo-input" type="file" accept="image/*" hidden @change="handleLogoFile" />
                <div v-if="editForm.logo" class="logo-preview">
                  <button
                    type="button"
                    class="logo-preview-image"
                    aria-label="放大查看游戏logo"
                    title="点击放大"
                    @click="openLogoPreview(editForm.logo)"
                  >
                    <img :src="editForm.logo" alt="游戏logo" />
                    <span class="logo-preview-zoom">放大预览</span>
                  </button>
                  <button type="button" class="logo-remove" title="移除logo" aria-label="移除logo" @click="removeLogo">×</button>
                </div>
                <button v-else type="button" class="logo-pick" :disabled="logoUploading" @click="openLogoPicker">
                  {{ logoUploading ? '上传中…' : '点击上传logo' }}
                </button>
              </div>
            </div>
            <div class="custom-order-setting" :class="{ enabled: editForm.customOrderEnabled }">
              <div class="custom-order-copy">
                <span class="custom-order-title">用户自定义下单</span>
              </div>
              <button
                type="button"
                class="custom-order-switch lg"
                :class="{ on: editForm.customOrderEnabled }"
                :aria-pressed="editForm.customOrderEnabled"
                aria-label="切换用户自定义下单"
                @click="editForm.customOrderEnabled = !editForm.customOrderEnabled"
              >
                <span class="dot" />
              </button>
            </div>
          </div>

          <div class="spec-section">
            <div class="spec-section-heading">
              <label class="required">游戏规格</label>
              <span>至少添加一项，可按需增删</span>
            </div>
            <div class="spec-list">
              <div v-for="(spec, idx) in editForm.specs" :key="idx" class="spec-row">
                <span class="spec-index">{{ String(idx + 1).padStart(2, '0') }}</span>
                <input v-model="editForm.specs[idx]" maxlength="50" placeholder="请输入游戏规格，上限50字" />
                <button
                  v-if="editForm.specs.length > 1"
                  type="button"
                  class="icon-btn"
                  @click="removeSpec(idx)"
                  title="删除该规格"
                  aria-label="删除该规格"
                >
                  −
                </button>
                <button
                  v-if="idx === editForm.specs.length - 1"
                  type="button"
                  class="icon-btn"
                  @click="addSpec"
                  title="新增规格"
                  aria-label="新增规格"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <button class="btn btn-plain" @click="editVisible = false">取消</button>
          <button class="btn btn-primary" @click="submitEdit">确 定</button>
        </template>
      </AppModal>

      <Teleport to="body">
        <div
          v-if="previewLogoUrl"
          class="logo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="游戏logo预览"
          tabindex="-1"
          @click.self="closeLogoPreview"
        >
          <button type="button" class="logo-lightbox-close" aria-label="关闭预览" @click="closeLogoPreview">×</button>
          <img :src="previewLogoUrl" alt="游戏logo放大预览" />
          <span class="logo-lightbox-caption">点击空白处或按 Esc 关闭</span>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.game-list-view {
  height: 100%;
}

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
  gap: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 24px;
  padding: 20px;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  background: var(--bg-card);
}

.form-row {
  display: grid;
  align-content: start;
  gap: 9px;
}

.form-row label,
.spec-section > label {
  color: var(--text-main);
  font-size: 13px;
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
  min-height: 42px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  padding: 10px 13px;
  font-size: 13px;
  color: var(--text-main);
  box-sizing: border-box;
  background: var(--bg-card);
  font-family: inherit;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.form-row input:focus,
.form-row select:focus,
.spec-row input:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 3px var(--primary-ring);
}

.bill-period-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bill-period-wrap .unit {
  color: var(--text-sub);
  font-size: 13px;
}

.spec-section {
  display: grid;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid var(--border-soft);
  border-radius: 16px;
  background: var(--bg-card);
}

.spec-section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.spec-section-heading > span {
  color: var(--text-sub);
  font-size: 12px;
}

.spec-list {
  display: grid;
  gap: 9px;
}

.spec-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.spec-index {
  width: 28px;
  flex: 0 0 28px;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.spec-row input {
  flex: 1;
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border-soft);
  background: var(--bg-toolbar);
  color: var(--text-sub);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s ease;
}

.icon-btn:hover {
  border-color: var(--primary);
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
  background: var(--bg-hover);
  color: var(--text-sub);
}

.btn-plain:hover {
  background: var(--border-soft);
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

/* 游戏logo 缩略图（列表） */
.game-logo-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  display: block;
  border-radius: 9px;
  background: var(--bg-toolbar);
}

.game-logo-trigger {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border-soft);
  border-radius: 11px;
  background: var(--bg-card);
  cursor: zoom-in;
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.game-logo-trigger:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px var(--primary-border);
  transform: translateY(-1px);
}

/* 用户自定义下单开关（列表展示，编辑在弹窗内操作） */
.custom-order-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #d0d5dd;
  transition: background 0.18s ease;
  vertical-align: middle;
  cursor: pointer;
}

.custom-order-switch:focus-visible {
  outline: 3px solid var(--primary-ring);
  outline-offset: 2px;
}

.custom-order-switch:disabled {
  cursor: wait;
}

.custom-order-switch .dot {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: left 0.18s ease;
}

.custom-order-switch.on {
  background: var(--primary);
}

.custom-order-switch.on .dot {
  left: 21px;
}

.custom-order-switch.saving {
  opacity: 0.65;
}

.custom-order-switch.lg {
  width: 48px;
  height: 26px;
  cursor: pointer;
}

.custom-order-switch.lg .dot {
  width: 20px;
  height: 20px;
}

.custom-order-switch.lg.on .dot {
  left: 25px;
}

.custom-order-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-order-setting {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 68px;
  padding: 13px 16px;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  background: var(--bg-toolbar);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.custom-order-setting.enabled {
  border-color: var(--primary-border);
  background: var(--primary-faint);
}

.custom-order-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.custom-order-title {
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
}

.custom-order-hint {
  font-size: 12px;
  color: var(--text-sub);
  line-height: 1.5;
}

/* logo 上传 */
.form-row--logo {
  grid-column: 1 / -1;
}

.logo-uploader {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 76px;
}

.logo-preview {
  position: relative;
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  padding: 3px;
  border-radius: 14px;
  border: 1px solid var(--border-soft);
  background: var(--bg-card);
  box-sizing: border-box;
}

.logo-preview-image {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 10px;
  background: var(--bg-toolbar);
  cursor: zoom-in;
}

.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.logo-preview-zoom {
  position: absolute;
  inset: auto 0 0;
  padding: 4px 2px;
  color: #fff;
  background: rgba(15, 23, 42, 0.62);
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.logo-preview-image:hover .logo-preview-zoom,
.logo-preview-image:focus-visible .logo-preview-zoom {
  opacity: 1;
}

.logo-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.2);
}

.logo-pick {
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: var(--bg-card);
  color: var(--text-sub);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.logo-pick:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.logo-pick:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logo-hint {
  max-width: 220px;
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.6;
}

.logo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 56px 24px;
  background: rgba(10, 14, 26, 0.82);
  backdrop-filter: blur(7px);
}

.logo-lightbox > img {
  display: block;
  max-width: min(78vw, 680px);
  max-height: min(76vh, 680px);
  object-fit: contain;
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
}

.logo-lightbox-close {
  position: absolute;
  top: 24px;
  right: 28px;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
}

.logo-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: scale(1.05);
}

.logo-lightbox-caption {
  position: absolute;
  bottom: 24px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.muted-text { color: #98a2b3; }
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
  width: min(720px, 90vw) !important;
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
  background: var(--bg-toolbar);
  border-top: 1px solid var(--primary-faint);
}
.btn-link {
  color: var(--text-invert);
}

@media (max-width: 640px) {
  .modal-box:has(.game-modal-content) .modal-body {
    padding: 16px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  .custom-order-setting {
    gap: 12px;
    padding: 12px;
  }

  .custom-order-hint {
    max-width: 40ch;
  }

  .spec-section {
    padding: 16px;
  }

  .spec-section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .logo-lightbox > img {
    max-width: 88vw;
    max-height: 72vh;
  }
}
</style>
