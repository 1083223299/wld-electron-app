<script setup>
import { computed, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';

const { confirm } = useConfirm();
const { show } = useToast();

const filter = reactive({
  playerId: '',
  playerName: '',
  phone: '',
  clubId: '',
  clubName: '',
  status: '',
  createTime: [],
});

const page = ref(1);
const pageSize = ref(10);
const editDialogVisible = ref(false);
const assetDialogVisible = ref(false);
const currentRow = ref(null);

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

const rows = ref([
  { id: '2455415', phone: '13800000001', name: '张三', clubName: '未来电商', clubId: '10001', income: 0, deposit: 0, finished: 0, failed: 0, freezeCount: 0, status: '可接单', isFrozen: false, isInStore: true, remark: '' },
  { id: '2455416', phone: '13800000002', name: '李四', clubName: '未来电竞', clubId: '10002', income: 0, deposit: 0, finished: 1, failed: 2, freezeCount: 0, status: '禁止接单', isFrozen: false, isInStore: true, remark: '' },
  { id: '2455417', phone: '13800000003', name: '王五', clubName: '未来娱乐', clubId: '10003', income: 3000, deposit: 5000, finished: 5, failed: 1, freezeCount: 1, status: '冻结', isFrozen: true, isInStore: true, remark: '冻结理由：风险控制' },
  { id: '2455418', phone: '13800000004', name: '赵六', clubName: '未来文化', clubId: '10004', income: 6600, deposit: 1200, finished: 2, failed: 0, freezeCount: 0, status: '退店', isFrozen: false, isInStore: false, remark: '' },
  { id: '2455419', phone: '13800000005', name: '周七', clubName: '未来俱乐部', clubId: '10005', income: 1100, deposit: 500, finished: 9, failed: 3, freezeCount: 0, status: '未冻结', isFrozen: false, isInStore: true, remark: '' },
  { id: '2455420', phone: '13800000006', name: '吴八', clubName: '未来共享', clubId: '10006', income: 2300, deposit: 800, finished: 4, failed: 0, freezeCount: 0, status: '可接单', isFrozen: false, isInStore: true, remark: '' },
  { id: '2455421', phone: '13800000007', name: '郑九', clubName: '未来渠道', clubId: '10007', income: 900, deposit: 200, finished: 3, failed: 1, freezeCount: 0, status: '冻结', isFrozen: true, isInStore: true, remark: '账户异常' },
  { id: '2455422', phone: '13800000008', name: '孙十', clubName: '未来科技', clubId: '10008', income: 5000, deposit: 3000, finished: 8, failed: 2, freezeCount: 0, status: '在店', isFrozen: false, isInStore: true, remark: '' },
  { id: '2455423', phone: '13800000009', name: '黄十一', clubName: '未来联盟', clubId: '10009', income: 200, deposit: 100, finished: 1, failed: 0, freezeCount: 0, status: '可接单', isFrozen: false, isInStore: true, remark: '' },
  { id: '2455424', phone: '13800000010', name: '陈十二', clubName: '未来工作室', clubId: '10010', income: 1000, deposit: 300, finished: 7, failed: 2, freezeCount: 0, status: '退店', isFrozen: false, isInStore: false, remark: '' },
]);

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
  { prop: 'playerId', label: '打手ID', type: 'input', placeholder: '请输入打手ID', span: 5 },
  { prop: 'playerName', label: '打手名称', type: 'input', placeholder: '请输入打手名称', span: 5 },
  { prop: 'phone', label: '打手手机号', type: 'input', placeholder: '请输入手机号', span: 5 },
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID', span: 5 },
  { prop: 'clubName', label: '俱乐部名称', type: 'input', placeholder: '请输入俱乐部名称', span: 5 },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    span: 4,
    options: [{ label: '全部', value: '' }, ...statusOptions.map((item) => ({ label: item, value: item }))],
  },
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
  },
];

const filteredRows = computed(() => {
  const matches = (value, matcher) => {
    if (!value) return true;
    return String(matcher).toLowerCase().includes(String(value).toLowerCase());
  };

  return rows.value.filter((row) => {
    const playerIdMatch = !filter.playerId || row.id === String(filter.playerId).trim();
    const playerNameMatch = !filter.playerName || matches(filter.playerName, row.name);
    const phoneMatch = !filter.phone || row.phone === String(filter.phone).trim();
    const clubIdMatch = !filter.clubId || row.clubId === String(filter.clubId).trim();
    const clubNameMatch = !filter.clubName || matches(filter.clubName, row.clubName);
    const statusMatch = !filter.status || row.status === filter.status;
    return playerIdMatch && playerNameMatch && phoneMatch && clubIdMatch && clubNameMatch && statusMatch;
  });
});

const total = computed(() => filteredRows.value.length);

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

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
  page.value = 1;
}

function handleReset() {
  Object.keys(filter).forEach((key) => {
    if (Array.isArray(filter[key])) filter[key] = [];
    else filter[key] = '';
  });
  page.value = 1;
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
  page.value = nextPage;
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
      :data="pagedRows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="pageChange"
    >
      <template #cell-income="{ row }">{{ row.income.toFixed(2) }}</template>
      <template #cell-deposit="{ row }">{{ row.deposit.toFixed(2) }}</template>

      <template #cell-status="{ row }">
        <span :class="['status-badge', getStatusClass(row.status)]">{{ row.status }}</span>
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" @click="openEdit(row)">编辑</button>
          <button class="link-btn" @click="openAsset(row)">资产管理</button>

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
