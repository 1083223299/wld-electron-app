<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useToast } from '../../../composables/useToast';
import { gameApi } from '../../../api/modules/game';
import { channelApi } from '../../../api/modules/channel';

const props = defineProps({
  gameId: { type: Number, default: null },
  gameName: { type: String, default: '' },
});
const emit = defineEmits(['back']);

const { show } = useToast();

const currentGameId = computed(() => props.gameId);
const currentGameName = computed(() => props.gameName);

// ============ 店铺（渠道）tabs ============
// 店铺列表来自渠道配置（channelApi.all，含真实 shopId）；接口异常时兜底默认店铺
const shops = ref([{ channel: '抖音', shop: '张三店铺', shopId: '' }]);
const activeShop = ref(shops.value[0]);

async function loadShops() {
  try {
    const list = await channelApi.all();
    if (Array.isArray(list) && list.length) {
      shops.value = list.map((c) => ({
        channel: c.channel || c.channelCode || '',
        // 展示名兜底：shopName → 渠道名 → shopId，避免出现空标签按钮
        shop: c.shopName || c.channel || c.channelCode || c.shopId || '',
        shopId: c.shopId || '',
      }));
      activeShop.value = shops.value[0];
    }
  } catch {
    /* 保持默认店铺 */
  }
}

/** 切换店铺：重置页码并按 shopId 重新拉取 */
function selectShop(s) {
  activeShop.value = s;
  page.value = 1;
  fetchList();
}

// ============ 筛选 ============
const filter = reactive({
  productId: '',
  skuId: '',
  skuName: '',
  matched: '',
});

const searchFields = [
  { prop: 'productId', label: '商品ID', type: 'input', placeholder: '请输入商品ID', span: 5 },
  { prop: 'skuId', label: 'SKUID', type: 'input', placeholder: '请输入SKUID', span: 5 },
  { prop: 'skuName', label: 'SKU名称', type: 'input', placeholder: '请输入SKU名称', span: 5 },
  {
    prop: 'matched',
    label: '是否匹配',
    type: 'select',
    placeholder: '请选择',
    span: 5,
    options: [
      { label: '全部', value: '' },
      { label: '已匹配', value: 'matched' },
      { label: '未匹配', value: 'unmatched' },
    ],
  },
];

// ============ 列表 ============
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const columns = [
  { key: 'productId', title: '商品ID' },
  { key: 'skuId', title: 'SKUID' },
  { key: 'skuName', title: 'SKU名称' },
  { key: 'client', title: '客户端' },
  { key: 'gameName', title: '游戏名称' },
  { key: 'spec', title: '游戏规格' },
  { key: 'op', title: '操作' },
];

async function fetchList() {
  // 真实接口 GET /api/admin/sku-mappings：行字段 { id, shopId, productId, skuId, gameId, specId, clients, itemName }
  const res = await gameApi.skuList({
    page: page.value,
    pageSize: pageSize.value,
    shopId: activeShop.value.shopId || '',
    productId: filter.productId,
    skuId: filter.skuId,
    skuName: filter.skuName,
    matched: filter.matched,
    gameId: currentGameId.value,
  });
  rows.value = ((res && res.list) || []).map((it) => ({
    ...it,
    skuName: it.itemName || '',
    client: String(it.clients || '')
      .split(',')
      .map((c) => CLIENT_EN[String(c).trim()] || c.trim())
      .filter(Boolean),
    gameName: gameNameOf(it.gameId),
    spec: specNameOf(it.gameId, it.specId),
    matched: !!(it.gameId && it.specId),
  }));
  total.value = (res && res.total) || 0;
}

function handleSearch(values) {
  Object.assign(filter, values);
  page.value = 1;
  fetchList();
}

function handleReset() {
  filter.productId = '';
  filter.skuId = '';
  filter.skuName = '';
  filter.matched = '';
  page.value = 1;
  fetchList();
}

function pageChange(p) {
  page.value = p;
  fetchList();
}

// ============ 全部游戏（供编辑弹窗搜索联想；规格带 id，保存映射需 specId） ============
const allGames = ref([]); // [{ id, name, specs: [{ id, name }] }]
async function loadAllGames() {
  const games = (await gameApi.listAll()) || [];
  allGames.value = await Promise.all(
    (games || []).map(async (g) => {
      let specs = [];
      try {
        const list = await gameApi.specs(g.id);
        specs = (list || []).map((s) => ({ id: s.id, name: s.name ?? s }));
      } catch {
        specs = [];
      }
      return { id: g.id, name: g.name, specs };
    })
  );
}

/** 后端客户端枚举 → 页面中文 */
const CLIENT_EN = { PC: '端游', MOBILE: '手游' };
/** 页面中文 → 后端枚举（多选时逗号分隔） */
const CLIENT_CN = { 端游: 'PC', 手游: 'MOBILE' };

function gameNameOf(gameId) {
  const g = allGames.value.find((x) => x.id === gameId);
  return g ? g.name : '';
}

function specNameOf(gameId, specId) {
  if (!gameId || !specId) return '';
  const g = allGames.value.find((x) => x.id === gameId);
  const s = g && g.specs.find((x) => x.id === specId);
  return s ? s.name : '';
}

// ============ 添加商品弹窗 ============
const addVisible = ref(false);
const addForm = reactive({ productIds: '' });

function openAdd() {
  addForm.productIds = '';
  addVisible.value = true;
}

async function submitAdd() {
  if (!addForm.productIds.trim()) {
    show('请输入商品ID', 'warning');
    return;
  }
  await gameApi.fetchSkusByProductIds({ productIds: addForm.productIds });
  show('添加成功，已自动带出该店铺下全部 SKU', 'success');
  addVisible.value = false;
  fetchList();
}

// ============ 编辑 SKU 映射弹窗 ============
const editVisible = ref(false);
const editingRow = ref(null);
const editForm = reactive({
  client: [],
  gameId: null,
  gameName: '',
  specId: null, // 规格 ID（保存映射用），展示名由 specOptions 反查
  gameSearch: '', // 搜索关键字
});

const clientOptions = ['手游', '端游'];

// 游戏名称下拉：展开状态 + 外部点击关闭
const gameDropdownOpen = ref(false);
const gameSelectRef = ref(null);

function onDocClick(e) {
  if (!gameSelectRef.value) return;
  if (!gameSelectRef.value.contains(e.target)) {
    gameDropdownOpen.value = false;
  }
}

// 游戏名称下拉：根据搜索关键字过滤
const gameOptions = computed(() => {
  const kw = editForm.gameSearch.trim();
  if (!kw) return allGames.value;
  return allGames.value.filter((g) => g.name.includes(kw));
});

// 当前选中游戏的规格
const specOptions = computed(() => {
  if (!editForm.gameId) return [];
  const g = allGames.value.find((x) => x.id === editForm.gameId);
  return g ? g.specs : [];
});

function openEdit(row) {
  editingRow.value = row;
  editForm.client = [...(row.client || [])];
  editForm.gameId = row.gameId || null;
  editForm.gameName = row.gameName || '';
  editForm.specId = row.specId || null;
  editForm.gameSearch = row.gameName || '';
  gameDropdownOpen.value = false;
  editVisible.value = true;
}

function onGamePick(game) {
  editForm.gameId = game.id;
  editForm.gameName = game.name;
  editForm.gameSearch = game.name;
  editForm.specId = null; // 切换游戏后清空规格
  gameDropdownOpen.value = false;
}

function toggleGameDropdown() {
  gameDropdownOpen.value = !gameDropdownOpen.value;
}

async function submitEdit() {
  if (!editForm.client.length) {
    show('请选择客户端', 'warning');
    return;
  }
  if (!editForm.gameId) {
    show('请选择游戏名称', 'warning');
    return;
  }
  if (!editForm.specId) {
    show('请选择游戏规格', 'warning');
    return;
  }
  const row = editingRow.value;
  // 真实接口 PUT /api/admin/sku-mappings：clients 传英文枚举，多选逗号分隔（格式以后端契约为准）
  await gameApi.updateSku({
    id: row.id,
    shopId: row.shopId,
    productId: row.productId,
    skuId: row.skuId,
    gameId: Number(editForm.gameId),
    specId: Number(editForm.specId),
    clients: editForm.client.map((c) => CLIENT_CN[c] || c).join(','),
    itemName: row.skuName || row.itemName || '',
  });
  show('保存成功', 'success');
  editVisible.value = false;
  fetchList();
}

function goBack() {
  emit('back');
}

onMounted(async () => {
  document.addEventListener('click', onDocClick);
  // 店铺与游戏目录都就绪后再拉列表，保证游戏名/规格、店铺筛选首屏正确
  await Promise.all([loadShops(), loadAllGames()]);
  fetchList();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
});

watch(currentGameId, () => {
  page.value = 1;
  fetchList();
});
</script>

<template>
  <div class="sku-page">
    <!-- 顶部标题 + 返回 -->
    <div class="sku-header">
      <div class="sku-title-row">
        <button class="back-link" @click="goBack">&lt; 返回</button>
        <h2 class="sku-title">sku映射</h2>
        <span v-if="currentGameName" class="sku-subtitle">当前游戏：{{ currentGameName }}</span>
      </div>
    </div>

    <!-- 店铺切换 tabs（原型：渠道下方有店铺，当前仅一个，后续多店铺） -->
    <div class="shop-tabs">
      <button
        v-for="s in shops"
        :key="s.shopId || s.shop"
        type="button"
        class="shop-tab"
        :class="{ active: (activeShop.shopId || activeShop.shop) === (s.shopId || s.shop) }"
        @click="selectShop(s)"
      >
        {{ s.shop }}
      </button>
    </div>

    <!-- 筛选 -->
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        @search="handleSearch"
        @reset="handleReset"
      />
    </div>

    <!-- 列表 -->
    <DataTable
      :columns="columns"
      :data="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="pageChange"
    >
      <template #toolbar>
        <button class="btn btn-primary" @click="openAdd">添加商品</button>
      </template>

      <template #cell-client="{ row }">
        <span v-if="row.client && row.client.length">{{ row.client.join('、') }}</span>
        <span v-else class="muted">-</span>
      </template>
      <template #cell-gameName="{ row }">
        <span v-if="row.gameName">{{ row.gameName }}</span>
        <span v-else class="muted">未匹配</span>
      </template>
      <template #cell-spec="{ row }">
        <span v-if="row.spec">{{ row.spec }}</span>
        <span v-else class="muted">-</span>
      </template>

      <template #cell-op="{ row }">
        <button class="link-btn" @click="openEdit(row)">编辑</button>
      </template>
    </DataTable>

    <!-- 添加商品弹窗 -->
    <AppModal v-model="addVisible" title="添加商品" width="520px">
      <div class="sku-modal-content">
        <div class="form-row">
          <label class="required">商品ID</label>
          <textarea
            v-model="addForm.productIds"
            rows="4"
            placeholder="多个商品ID用英文分号;隔开"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="addVisible = false">取 消</button>
        <button class="btn btn-primary" @click="submitAdd">确 定</button>
      </template>
    </AppModal>

    <!-- 编辑映射弹窗 -->
    <AppModal v-model="editVisible" title="编辑" width="520px">
      <div class="sku-modal-content edit-modal">
        <div class="form-row">
          <label class="required">客户端</label>
          <div class="client-box">
            <label v-for="c in clientOptions" :key="c" class="checkbox-item">
              <input v-model="editForm.client" type="checkbox" :value="c" />
              <span>{{ c }}</span>
            </label>
          </div>
        </div>

        <div class="form-row">
          <label class="required">游戏名称</label>
          <div class="select-wrap" ref="gameSelectRef">
            <div
              class="select-control"
              :class="{ open: gameDropdownOpen }"
              @click="toggleGameDropdown"
            >
              <span v-if="editForm.gameSearch" class="select-value">{{ editForm.gameSearch }}</span>
              <span v-else class="select-placeholder">请选择游戏</span>
              <span class="select-arrow" :class="{ up: gameDropdownOpen }">▾</span>
            </div>
            <input
              v-if="gameDropdownOpen"
              v-model="editForm.gameSearch"
              class="select-search"
              placeholder="输入关键字搜索"
              autofocus
              @input="gameDropdownOpen = true"
            />
            <transition name="drop">
              <ul v-if="gameDropdownOpen" class="dropdown">
                <li
                  v-for="g in gameOptions"
                  :key="g.id"
                  :class="{ active: g.id === editForm.gameId }"
                  @click="onGamePick(g)"
                >
                  {{ g.name }}
                </li>
                <li v-if="!gameOptions.length" class="empty">无匹配游戏</li>
              </ul>
            </transition>
          </div>
        </div>

        <div class="form-row">
          <label class="required">游戏规格</label>
          <select v-model="editForm.specId" :disabled="!editForm.gameId" class="form-control">
            <option value="" disabled>
              {{ editForm.gameId ? '请选择规格' : '请先选择游戏' }}
            </option>
            <option v-for="s in specOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <div v-if="editForm.gameName" class="current-value">
            已选：<strong>{{ editForm.gameName }}</strong>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="editVisible = false">取 消</button>
        <button class="btn btn-primary" @click="submitEdit">确 定</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.sku-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sku-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.sku-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.back-link {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.back-link:hover {
  text-decoration: underline;
}

.sku-title {
  margin: 0;
  font-size: 18px;
  color: #1f2433;
}

.sku-subtitle {
  font-size: 12px;
  color: #8a93a6;
}

.shop-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  background: var(--bg-elevated, #f2f4f7);
  border: 1px solid var(--border-soft, transparent);
  border-radius: 12px;
}

.shop-tab {
  border: none;
  background: transparent;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-sub, #475467);
  cursor: pointer;
  transition: all 0.18s ease;
}

.shop-tab:hover {
  color: var(--primary, #8b5cf6);
}

.shop-tab.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert, #fff);
  box-shadow: 0 8px 18px var(--primary-glow-strong, rgba(139, 92, 246, 0.35));
}

.muted {
  color: #98a2b3;
}

.link-btn {
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  padding: 3px 8px;
}

.link-btn:hover {
  background: rgba(37, 99, 235, 0.08);
}

/* 弹窗 */
.sku-modal-content {
  display: grid;
  gap: 18px;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row label {
  /* color: #5b6478; */
  font-size: 12px;
  font-weight: 600;
}

.form-row label.required::before {
  content: '*';
  color: #f04438;
  margin-right: 4px;
}

.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  color: #1f2937;
  box-sizing: border-box;
  background: #fbfcfe;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  font-family: inherit;
}

.form-row textarea {
  resize: vertical;
  min-height: 90px;
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.checkbox-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.client-box {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  /* background: #fafbff; */
  border: 1px solid #eef1f8;
  border-radius: 12px;
}

.checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #e3e7f0;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  color: #475467;
  background: var(--bg-card);
  transition: all 0.18s ease;
}

.checkbox-item:has(input:checked) {
  border-color: #8b5cf6;
  color: var(--primary);
  background: var(--primary-soft);
  font-weight: 600;
}

/* 游戏名称下拉 */
.select-wrap {
  position: relative;
}

.select-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 42px;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  /* background: #fbfcfe; */
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  font-size: 13px;
}

.select-control:hover {
  border-color: #c9b8ff;
}

.select-control.open {
  border-color: #8b5cf6;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.select-value {
  /* color: #1f2937; */
  font-weight: 500;
}

.select-placeholder {
  color: #98a2b3;
}

.select-arrow {
  color: #98a2b3;
  font-size: 12px;
  transition: transform 0.18s ease;
}

.select-arrow.up {
  transform: rotate(180deg);
}

.select-search {
  width: 100%;
  margin-top: 6px;
  border: 1px solid #e3e7f0;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  background: var(--bg-card);
  box-sizing: border-box;
  outline: none;
}

.select-search:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px var(--primary-faint);
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 220px;
  overflow: auto;
  background: var(--bg-card);
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 6px;
}

.dropdown li {
  padding: 10px 12px;
  font-size: 13px;
  color: #1f2937;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.dropdown li:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.dropdown li.active {
  background: var(--primary-border);
  color: var(--primary);
  font-weight: 600;
}

.dropdown li.empty {
  color: #98a2b3;
  cursor: default;
  text-align: center;
}

/* 下拉展开动画 */
.drop-enter-active,
.drop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.form-control {
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

.form-control:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.form-control:disabled {
  background: #f4f5f8;
  color: #98a2b3;
  cursor: not-allowed;
}

.current-value {
  font-size: 12px;
  color: #8a93a6;
}

.edit-modal {
  gap: 20px;
}

.btn {
  border: none;
  border-radius: 12px;
  padding: 10px 22px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
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
}
</style>

<style>
.modal-overlay:has(.sku-modal-content) {
  background: rgba(17, 12, 46, 0.55);
  backdrop-filter: blur(6px);
}

.modal-box:has(.sku-modal-content) {
  border-radius: 22px;
  border: 1px solid var(--primary-border);
}

.modal-box:has(.sku-modal-content) .modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-bottom: none;
}

.modal-box:has(.sku-modal-content) .modal-header strong {
  color: var(--text-invert);
  font-size: 18px;
}

.modal-box:has(.sku-modal-content) .modal-body {
  padding: 24px;
  background: var(--bg-card);
}

.modal-box:has(.sku-modal-content) .modal-footer {
  padding: 16px 24px 20px;
  /* background: linear-gradient(180deg, rgba(248, 250, 255, 0.7), rgba(243, 240, 255, 0.95)); */
  border-top: 1px solid var(--primary-faint);
}
.btn-link {
  color: var(--text-invert);
}
</style>
