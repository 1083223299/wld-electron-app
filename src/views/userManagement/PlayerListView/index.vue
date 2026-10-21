<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { playerApi } from '../../../api/modules/player';
import { gameApi } from '../../../api/modules/game';

const { confirm } = useConfirm();
const { show } = useToast();

const filter = reactive({
  keyword: '',
  clubId: '',
  status: '',
});

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['keyword', 'clubId', 'status'],
});
restoreFilter(filter);
const editDialogVisible = ref(false);
const assetDialogVisible = ref(false);
const currentRow = ref(null);

// ============ 可接单规格 ============
const specDialogVisible = ref(false);
const specLoading = ref(false);
const specSaving = ref(false);
const specLoadError = ref(false);
// 游戏-规格目录：来源 gameApi.all()（当前为 mock），真实联调时规格 id 以游戏/规格列表接口返回为准
const specCatalog = ref([]); // [{ gameId, gameName, specs: [{ id, name }] }]
const specGameRows = ref([]); // [{ gameId, gameName, specs, all, checked:Set<number> }]

const specDialogTitle = computed(() => `可接单规格 - ${currentRow.value?.name ?? ''}`);

const editForm = reactive({
  name: '',
  clubName: '',
  phone: '',
  status: '可接单',
  remark: '',
});

const assetForm = reactive({
  assetType: '收益',
  operation: '充值',
  amount: '',
  reason: '',
  files: [],
});

const assetTypeOptions = ['收益', '押金'];

const assetOperationOptions = computed(() => {
  if (assetForm.assetType === '押金') {
    return ['充值', '扣减'];
  }
  return ['充值', '扣减', '余额抵扣'];
});

const currentAssetKey = computed(() => (assetForm.assetType === '收益' ? 'income' : 'deposit'));

const currentAssetBalance = computed(() => {
  const row = currentRow.value;
  if (!row) return '0.00';
  const value = Number(row[currentAssetKey.value] ?? 0);
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
});

const getAssetOperationLabel = computed(() => {
  if (assetForm.operation === '充值') return '充值金额（元）';
  if (assetForm.operation === '扣减') return '扣减金额（元）';
  return '抵扣金额（元）';
});

const getAssetPlaceholder = computed(() => {
  if (assetForm.operation === '充值') return '请输入充值金额';
  if (assetForm.operation === '扣减') return '请输入扣减金额';
  return '请输入抵扣金额';
});

const maxUploadFiles = 5;

const rows = ref([]);
const total = ref(0);
const loading = ref(false);

const statusOptions = ['可接单', '禁止接单', '未冻结', '冻结', '在店', '退店'];

const columns = [
  { key: 'id', title: '打手ID' },
  { key: 'name', title: '打手名称' },
  { key: 'clubName', title: '俱乐部名称' },
  { key: 'income', title: '收益余额（元）' },
  { key: 'deposit', title: '押金余额（元）' },
  { key: 'finished', title: '已完成' },
  { key: 'failed', title: '未通过' },
  { key: 'freezeCount', title: '冻结' },
  { key: 'status', title: '状态' },
  { key: 'op', title: '操作' },
];

const searchFields = [
  { prop: 'keyword', label: '关键词', type: 'input', placeholder: '名称或手机号', span: 6 },
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID', span: 5 },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    span: 5,
    options: [
      { label: '全部', value: '' },
      { label: '正常', value: 'NORMAL' },
      { label: '禁止接单', value: 'DISABLED' },
    ],
  },
];

// ============ 列表数据（服务端分页/筛选） ============
/** 后端列表字段 → 页面展示字段；钱包/订单统计字段当前接口未返回，待对应接口接入后填充 */
function mapPlayerRow(item = {}) {
  const statusRaw = String(item.status || '').toUpperCase();
  const inStore = Number(item.inStore) === 1;
  const canTake = Number(item.canTake) === 1;

  let status = '可接单';
  if (item.quitAt) status = '退店';
  else if (statusRaw === 'DISABLED' || !canTake) status = '禁止接单';

  return {
    id: item.id,
    clubId: item.clubId,
    clubName: item.clubName || '',
    name: item.name || '',
    phone: item.phone || '',
    status,
    isFrozen: false, // 列表接口暂无冻结字段，钱包冻结/解冻接口接入后填充
    isInStore: inStore,
    canTake,
    remark: '',
    quitAt: item.quitAt || '',
    income: item.income ?? '—',
    deposit: item.deposit ?? '—',
    finished: item.finished ?? '—',
    failed: item.failed ?? '—',
    freezeCount: item.freezeCount ?? '—',
  };
}

function fmtMoney(value) {
  if (value === '' || value === null || value === undefined || value === '—') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await playerApi.list({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filter.keyword,
      clubId: filter.clubId,
      status: filter.status,
    });
    rows.value = (res && res.list) || [];
    total.value = (res && res.total) || 0;
  } catch (e) {
    // 错误提示由 request.js 统一弹出
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchList);

function openEdit(row) {
  currentRow.value = row;
  Object.assign(editForm, {
    name: row.name,
    clubName: row.clubName,
    phone: row.phone || '',
    status: row.status,
    remark: row.remark || '',
  });
  editDialogVisible.value = true;
}

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
    const list = await playerApi.getSpecs(Number(row.id));
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
    await playerApi.updateSpecs(Number(currentRow.value.id), specs);
    show('规格保存成功', 'success');
    specDialogVisible.value = false;
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  } finally {
    specSaving.value = false;
  }
}

function normalizeAssetAmount(value) {
  if (value === '' || value === null || value === undefined) return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return Number(amount.toFixed(2));
}

function handleAssetTypeChange(type) {
  assetForm.assetType = type;
  if (type === '押金' && assetForm.operation === '余额抵扣') {
    assetForm.operation = '充值';
  }
  assetForm.amount = '';
}

function openAssetFilePicker() {
  const input = document.getElementById('asset-upload-input');
  if (input) input.click();
}

function handleAssetFiles(event) {
  const picked = Array.from(event.target.files || []);
  const merged = [...assetForm.files, ...picked];
  if (merged.length > maxUploadFiles) {
    show(`最多上传 ${maxUploadFiles} 个文件`, 'warning');
  }
  assetForm.files = merged.slice(0, maxUploadFiles);
  event.target.value = '';
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'];
const DOC_EXTS = ['doc', 'docx'];
const SHEET_EXTS = ['xls', 'xlsx', 'csv'];
const SLIDE_EXTS = ['ppt', 'pptx'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];

const getFileExt = (name = '') => {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
};

const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return IMAGE_EXTS.includes(getFileExt(file.name));
};

const getFileMeta = (file) => {
  const ext = getFileExt(file?.name);
  if (isImageFile(file)) return { icon: '🖼️', color: '#7c3aed' };
  if (ARCHIVE_EXTS.includes(ext)) return { icon: '🗜️', color: '#d97706' };
  if (ext === 'pdf') return { icon: '📕', color: '#dc2626' };
  if (DOC_EXTS.includes(ext)) return { icon: '📘', color: '#2563eb' };
  if (SHEET_EXTS.includes(ext)) return { icon: '📗', color: '#059669' };
  if (SLIDE_EXTS.includes(ext)) return { icon: '📙', color: '#ea580c' };
  if (AUDIO_EXTS.includes(ext)) return { icon: '🎵', color: '#0d9488' };
  if (VIDEO_EXTS.includes(ext)) return { icon: '🎬', color: '#db2777' };
  if (ext === 'txt') return { icon: '📄', color: '#64748b' };
  return { icon: '📎', color: '#64748b' };
};

const previewUrls = new WeakMap();
const getImagePreview = (file) => {
  if (!isImageFile(file)) return '';
  if (!previewUrls.has(file)) previewUrls.set(file, URL.createObjectURL(file));
  return previewUrls.get(file);
};

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const assetFiles = computed(() =>
  (assetForm.files || []).map((file, index) => {
    const meta = getFileMeta(file);
    const image = isImageFile(file);
    return {
      index,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      isImage: image,
      preview: image ? getImagePreview(file) : '',
      icon: meta.icon,
      bg: `${meta.color}1f`,
    };
  })
);

function removeAssetFile(index) {
  const file = assetForm.files[index];
  if (file && previewUrls.has(file)) {
    URL.revokeObjectURL(previewUrls.get(file));
    previewUrls.delete(file);
  }
  assetForm.files.splice(index, 1);
}

function openAsset(row) {
  currentRow.value = row;
  assetForm.files.forEach((file) => {
    if (previewUrls.has(file)) {
      URL.revokeObjectURL(previewUrls.get(file));
      previewUrls.delete(file);
    }
  });
  Object.assign(assetForm, {
    assetType: '收益',
    operation: '充值',
    amount: '',
    reason: '',
    files: [],
  });
  assetDialogVisible.value = true;
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

function getStatusClass(status) {
  switch (status) {
    case '可接单':
      return 'status-success';
    case '禁止接单':
      return 'status-danger';
    case '冻结':
      return 'status-warn';
    case '退店':
      return 'status-muted';
    default:
      return 'status-info';
  }
}

function canShowAction(row, action) {
  switch (action) {
    case '禁止接单':
      return row.status === '可接单';
    case '开启接单':
      return row.status === '禁止接单';
    case '钱包冻结':
      return !row.isFrozen && row.isInStore;
    case '钱包解冻':
      return row.isFrozen && row.isInStore;
    case '退店':
      return row.isInStore;
    case '恢复在店':
      return !row.isInStore;
    default:
      return true;
  }
}

async function triggerAction(action, row) {
  const ok = await confirm({
    title: '提示',
    message: `确认${action}打手「${row.name}」吗？此操作将影响其当前状态。`,
    okText: '确认',
  });
  if (!ok) return;

  if (action === '禁止接单') row.status = '禁止接单';
  if (action === '开启接单') row.status = '可接单';
  if (action === '钱包冻结') {
    row.isFrozen = true;
    row.status = '冻结';
  }
  if (action === '钱包解冻') {
    row.isFrozen = false;
    row.status = '未冻结';
  }
  if (action === '退店') {
    row.isInStore = false;
    row.status = '退店';
  }
  if (action === '恢复在店') {
    row.isInStore = true;
    row.status = '在店';
  }

  show(`${action}成功`, 'success');
}

function submitEdit() {
  if (!currentRow.value) return;
  currentRow.value.name = editForm.name;
  currentRow.value.clubName = editForm.clubName;
  currentRow.value.phone = editForm.phone;
  currentRow.value.status = editForm.status;
  currentRow.value.remark = editForm.remark;
  editDialogVisible.value = false;
  show('编辑成功', 'success');
}

function submitAsset() {
  if (!currentRow.value) return;

  if (assetForm.assetType === '押金' && assetForm.operation === '余额抵扣') {
    show('押金余额不支持余额抵扣', 'warning');
    return;
  }

  const amount = normalizeAssetAmount(assetForm.amount);
  if (amount === '' || amount === 0) {
    show('请输入有效金额', 'warning');
    return;
  }

  if (assetForm.reason.trim().length > 200) {
    show('原因不能超过200字', 'warning');
    return;
  }

  const key = currentAssetKey.value;
  const currentValue = Number(currentRow.value[key] ?? 0);

  if (assetForm.operation === '充值') {
    currentRow.value[key] = Number((currentValue + amount).toFixed(2));
  }

  if (assetForm.operation === '扣减') {
    currentRow.value[key] = Number((currentValue - amount).toFixed(2));
  }

  if (assetForm.operation === '余额抵扣') {
    const otherKey = key === 'income' ? 'deposit' : 'income';
    currentRow.value[key] = Number((currentValue - amount).toFixed(2));
    currentRow.value[otherKey] = Number((Number(currentRow.value[otherKey] ?? 0) + amount).toFixed(2));
  }

  assetDialogVisible.value = false;
  show('资产已更新', 'success');
}

function pageChange(nextPage) {
  onPageChange(nextPage);
  fetchList();
}

function pageSizeChange(size) {
  onPageSizeChange(size);
  fetchList();
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
      <template #cell-income="{ row }">{{ fmtMoney(row.income) }}</template>
      <template #cell-deposit="{ row }">{{ fmtMoney(row.deposit) }}</template>

      <template #cell-status="{ row }">
        <span :class="['status-badge', getStatusClass(row.status)]">{{ row.status }}</span>
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" @click="openEdit(row)">编辑</button>
          <button class="link-btn" @click="openAsset(row)">资产管理</button>
          <button class="link-btn" @click="openSpecs(row)">规格</button>

          <button v-if="canShowAction(row, '禁止接单')" class="link-btn danger" @click="triggerAction('禁止接单', row)">
            禁止接单
          </button>
          <button v-if="canShowAction(row, '开启接单')" class="link-btn success" @click="triggerAction('开启接单', row)">
            开启接单
          </button>

          <button v-if="canShowAction(row, '钱包冻结')" class="link-btn warning" @click="triggerAction('钱包冻结', row)">
            钱包冻结
          </button>
          <button v-if="canShowAction(row, '钱包解冻')" class="link-btn info" @click="triggerAction('钱包解冻', row)">
            钱包解冻
          </button>

          <button v-if="canShowAction(row, '退店')" class="link-btn muted" @click="triggerAction('退店', row)">退店</button>
          <button v-if="canShowAction(row, '恢复在店')" class="link-btn link" @click="triggerAction('恢复在店', row)">
            恢复在店
          </button>
        </div>
      </template>
    </DataTable>

    <AppModal v-model="editDialogVisible" title="编辑打手" width="480px">
      <div class="dialog-form player-modal-content">
        <div class="form-row">
          <label>打手名称</label>
          <input v-model="editForm.name" placeholder="请输入打手名称" />
        </div>
        <div class="form-row">
          <label>俱乐部名称</label>
          <input v-model="editForm.clubName" placeholder="请输入俱乐部名称" />
        </div>
        <div class="form-row">
          <label>手机号</label>
          <input v-model="editForm.phone" placeholder="请输入手机号" />
        </div>
        <div class="form-row">
          <label>状态</label>
          <select v-model="editForm.status">
            <option v-for="item in statusOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>备注</label>
          <textarea v-model="editForm.remark" rows="3" placeholder="请输入备注"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="editDialogVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitEdit">保存</button>
      </template>
    </AppModal>

    <AppModal v-model="assetDialogVisible" title="资产管理" width="560px">
      <div class="asset-dialog-card player-modal-content">
        <div class="asset-type-switch">
          <button
            v-for="item in assetTypeOptions"
            :key="item"
            type="button"
            :class="['type-btn', { active: assetForm.assetType === item }]"
            @click="handleAssetTypeChange(item)"
          >
            {{ item }}
          </button>
        </div>

        <div class="asset-balance-row">
          <span>{{ assetForm.assetType }}余额（元）</span>
          <strong>{{ currentAssetBalance }}</strong>
        </div>

        <div class="asset-field-group radio-group">
          <label class="field-label">操作</label>
          <div class="radio-list">
            <label v-for="item in assetOperationOptions" :key="item" class="radio-item">
              <input v-model="assetForm.operation" type="radio" :value="item" />
              <span>{{ item }}</span>
            </label>
          </div>
        </div>

        <div class="asset-field-group">
          <label class="field-label required">{{ getAssetOperationLabel }}</label>
          <input
            v-model.number="assetForm.amount"
            type="number"
            step="0.01"
            min="-999999999"
            :placeholder="getAssetPlaceholder"
          />
        </div>

        <div class="asset-field-group">
          <label class="field-label">文件</label>
          <div class="upload-box">
            <input
              id="asset-upload-input"
              type="file"
              multiple
              @change="handleAssetFiles"
              hidden
            />
            <div class="upload-toolbar">
              <button type="button" class="upload-trigger" @click="openAssetFilePicker">上传文件</button>
              <span class="upload-tip">支持任意格式文件，最多上传 {{ maxUploadFiles }} 个</span>
            </div>
            <div v-if="assetFiles.length" class="file-list">
              <div v-for="item in assetFiles" :key="`${item.name}-${item.index}`" class="file-item">
                <img
                  v-if="item.isImage"
                  class="file-thumb"
                  :src="item.preview"
                  :alt="item.name"
                />
                <span v-else class="file-icon" :style="{ background: item.bg }">{{ item.icon }}</span>
                <div class="file-info">
                  <span class="file-name" :title="item.name">{{ item.name }}</span>
                  <span class="file-size">{{ item.size }}</span>
                </div>
                <button type="button" class="file-remove" @click="removeAssetFile(item.index)">×</button>
              </div>
            </div>
          </div>
        </div>

        <div class="asset-field-group">
          <label class="field-label required">原因</label>
          <textarea
            v-model="assetForm.reason"
            rows="3"
            maxlength="200"
            placeholder="请输入本次操作原因"
          ></textarea>
          <div class="reason-count">{{ assetForm.reason.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="assetDialogVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitAsset">确定</button>
      </template>
    </AppModal>

    <AppModal v-model="specDialogVisible" :title="specDialogTitle" width="640px">
      <div class="spec-dialog-card player-modal-content">
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
          <div class="spec-tip">勾选后该打手可接对应游戏规格的订单；勾选“全部规格”表示该游戏下所有规格均可接，未勾选任何规格的游戏不会提交。</div>
        </template>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="specDialogVisible = false">取消</button>
        <button class="btn btn-primary" :disabled="specLoading || specSaving" @click="saveSpecs">
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
  /* gap: 16px; */
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
  cursor: pointer;
  /* padding: 3px 8px; */
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

.link-btn.success {
  color: #0f9f6e;
}

.link-btn.success:hover {
  background: rgba(15, 159, 110, 0.08);
}

.link-btn.warning {
  color: #d97706;
}

.link-btn.warning:hover {
  background: rgba(217, 119, 6, 0.08);
}

.link-btn.info {
  color: #1d4ed8;
}

.link-btn.info:hover {
  background: rgba(29, 78, 216, 0.08);
}

.link-btn.muted {
  color: #475467;
}

.link-btn.muted:hover {
  background: rgba(71, 84, 103, 0.08);
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.list-page__body td:last-child {
  min-width: 420px;
}

.status-success {
  color: #0f9f6e;
  background: rgba(15, 159, 110, 0.08);
}

.status-danger {
  color: #d92d20;
  background: rgba(217, 45, 32, 0.08);
}

.status-warn {
  color: #b45309;
  background: rgba(180, 83, 9, 0.08);
}

.status-muted {
  color: #475467;
  background: rgba(71, 84, 103, 0.08);
}

.status-info {
  color: #1d4ed8;
  background: rgba(29, 78, 216, 0.08);
}

/* ===== 弹窗通用字段（编辑打手） ===== */
.dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row:has(textarea) {
  grid-column: 1 / -1;
}

.form-row label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
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
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.form-row textarea {
  resize: vertical;
  min-height: 84px;
}

.asset-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
}

.asset-form-panel,
.asset-rule-panel {
  display: grid;
  gap: 14px;
}

.asset-rule-panel table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.asset-rule-panel th,
.asset-rule-panel td {
  border: 1px solid #e5e7eb;
  padding: 10px 8px;
  font-size: 12px;
  text-align: left;
  vertical-align: top;
}

.asset-rule-panel th {
  background: #f3f4f6;
  font-weight: 700;
}
/* ===== 资产管理弹窗 ===== */
.asset-dialog-card {
  display: grid;
  gap: 18px;
}

/* 收益 / 押金 分段切换 */
.asset-type-switch {
  display: inline-flex;
  gap: 6px;
  width: 100%;
  padding: 5px;
  border: 1px solid #eceef6;
  border-radius: 14px;
  background: #f5f6fb;
}

.type-btn {
  flex: 1;
  height: 40px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #5b6478;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-btn:hover {
  color: var(--primary);
}

.type-btn.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  border-color: transparent;
  color: var(--text-invert);
  box-shadow: 0 10px 22px var(--primary-glow-strong);
}

/* 余额展示卡 */
.asset-balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 14px;
  color: var(--text-invert);
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(135deg, var(--primary), var(--primary-hover));
  box-shadow: 0 14px 30px var(--primary-glow-strong);
}

.asset-balance-row span {
  font-size: 13px;
  opacity: 0.9;
}

.asset-balance-row strong {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}

.asset-field-group {
  display: grid;
  gap: 8px;
}

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

/* 操作方式胶囊单选 */
.radio-group {
  margin-top: 2px;
}

.radio-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.radio-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid #e3e7f0;
  border-radius: 999px;
  color: #475467;
  font-size: 13px;
  cursor: pointer;
  background: #fbfcfe;
  transition: all 0.18s ease;
}

.radio-item:hover {
  border-color: #c9b8ff;
  color: var(--primary);
}

.radio-item input {
  accent-color: var(--primary);
}

.radio-item:has(input:checked) {
  border-color: transparent;
  color: var(--primary);
  background: var(--primary-faint);
  box-shadow: inset 0 0 0 1px var(--primary-border-strong);
  font-weight: 600;
}

.asset-field-group input,
.asset-field-group textarea {
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  background: #fbfcfe;
  padding: 11px 14px;
  font-size: 13px;
  box-sizing: border-box;
  color: #1f2937;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.radio-item input {
  width: auto;
}

.asset-field-group input:focus,
.asset-field-group textarea:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

/* 文件上传 */
.upload-box {
  border: 1px dashed #cfd5e4;
  border-radius: 14px;
  padding: 14px;
  background: linear-gradient(180deg, #fafbff, #f5f7ff);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.upload-box:hover {
  border-color: #a78bfa;
  background: #f7f5ff;
}

.upload-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.upload-trigger {
  border: 1px solid var(--primary-glow-strong);
  background: var(--bg-card);
  color: var(--primary);
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.upload-trigger:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  box-shadow: 0 8px 18px var(--primary-border-strong);
}

.upload-tip {
  color: #8a93a6;
  font-size: 12px;
}

.file-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.file-item:hover {
  border-color: #c9b8ff;
  box-shadow: 0 10px 22px var(--primary-border);
  transform: translateY(-1px);
}

.file-icon {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.file-thumb {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  object-fit: cover;
  border: 1px solid #eceef3;
  background: #f8fafc;
}

.file-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.file-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #344054;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 11px;
  color: #98a2b3;
  font-variant-numeric: tabular-nums;
}

.file-remove {
  flex: 0 0 auto;
  border: none;
  background: rgba(148, 163, 184, 0.14);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  color: #667085;
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.file-remove:hover {
  background: rgba(240, 68, 56, 0.14);
  color: #f04438;
}

.reason-count {
  text-align: right;
  color: #98a2b3;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
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
</style>

<!-- 仅本页两个弹窗（编辑 / 资产管理）的外壳外观，通过内容容器 :has 命中 -->
<style>
.modal-overlay:has(.player-modal-content) {
  background: rgba(17, 12, 46, 0.55);
  backdrop-filter: blur(6px);
}

.modal-box:has(.player-modal-content) {
  border-radius: 22px;
  border: 1px solid var(--primary-border);
  box-shadow: 0 40px 90px rgba(46, 16, 101, 0.35), 0 6px 20px rgba(46, 16, 101, 0.16);
}

.modal-box:has(.player-modal-content) .modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  border-bottom: none;
}

.modal-box:has(.player-modal-content) .modal-header strong {
  color: var(--text-invert);
  font-size: 18px;
  letter-spacing: 0.02em;
}

.modal-box:has(.player-modal-content) .modal-title-dot {
  background: var(--bg-card);
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.22);
}

.modal-box:has(.player-modal-content) .modal-header .btn-link {
  color: rgba(255, 255, 255, 0.9);
}

.modal-box:has(.player-modal-content) .modal-header .btn-link:hover {
  background: rgba(255, 255, 255, 0.18);
  color: var(--text-invert);
}

.modal-box:has(.player-modal-content) .modal-body {
  padding: 24px;
  background: var(--bg-card);
}

.modal-box:has(.player-modal-content) .modal-footer {
  padding: 16px 24px 20px;
  background: linear-gradient(180deg, rgba(248, 250, 255, 0.7), rgba(243, 240, 255, 0.95));
  border-top: 1px solid var(--primary-faint);
}
</style>
