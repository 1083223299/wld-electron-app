<script setup>
import { computed, reactive, ref } from 'vue';
import AppModal from '../../../components/AppModal.vue';
import DataTable from '../../../components/DataTable.vue';
import PaginationSimple from '../../../components/PaginationSimple/index.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';

const { confirm } = useConfirm();
const { show } = useToast();

const filter = reactive({
  clubId: '',
  clubName: '',
  ownerName: '',
  phone: '',
  status: '',
  createTime: [],
});

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['clubId', 'clubName', 'ownerName', 'phone', 'status', 'createTime'],
});
restoreFilter(filter);
const licenseModalVisible = ref(false);
const currentLicenseRow = ref(null);
const currentLicenseIndex = ref(0);
const addModalVisible = ref(false);
const editModalVisible = ref(false);
const splitModalVisible = ref(false);
const assetModalVisible = ref(false);
const currentRow = ref(null);

const editForm = reactive({
  clubName: '',
  ownerName: '',
  phone: '',
  businessType: '',
  status: '已开通',
  remark: '',
  licenseFiles: [],
  specList: [
    { id: 1, gameName: '', spec: '' },
  ],
});

const rewardRuleList = computed(() => editForm.specList);

const gameNameOptions = ['三角行动', '王者荣耀', '斗地主'];
const specOptions = ['全部', '护航', '任务', '日常'];

const splitType = ref('百分比分润');
const splitFixedPage = ref(1);
const splitFixedPageSize = ref(3);
const splitConfig = reactive({
  list: [
    { game: '三角行动', rule: '护航', amount: '' },
    { game: '三角行动', rule: '任务', amount: '20.00' },
    { game: '三角行动', rule: '日常', amount: '20.00' },
    { game: '王者荣耀', rule: '护航', amount: '18.00' },
    { game: '王者荣耀', rule: '日常', amount: '15.00' },
    { game: '斗地主', rule: '护航', amount: '12.00' },
    { game: '斗地主', rule: '任务', amount: '24.00' },
  ],
  fixedAmount: '',
  ratio: 40,
  ratio2: 60,
});

const splitFixedTotal = computed(() => splitConfig.list.length);
const splitFixedPagedRows = computed(() => {
  const start = (splitFixedPage.value - 1) * splitFixedPageSize.value;
  return splitConfig.list.slice(start, start + splitFixedPageSize.value);
});

function handleSplitFixedPageChange(nextPage) {
  splitFixedPage.value = nextPage;
}

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
  {
    id: '46546',
    clubName: '未来电竞',
    ownerName: '张三',
    phone: '13800000001',
    businessType: '电竞',
    status: '已开通',
    createdAt: '2024-12-15',
    businessLicense: [
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46547',
    clubName: '未来娱乐',
    ownerName: '李四',
    phone: '13800000002',
    businessType: '娱乐',
    status: '已禁用',
    createdAt: '2024-12-20',
    businessLicense: [
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46548',
    clubName: '未来文化',
    ownerName: '王五',
    phone: '13800000003',
    businessType: '文化',
    status: '待审核',
    createdAt: '2024-12-25',
    businessLicense: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46549',
    clubName: '未来俱乐部',
    ownerName: '赵六',
    phone: '13800000004',
    businessType: '综合',
    status: '已开通',
    createdAt: '2025-01-02',
    businessLicense: [
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46550',
    clubName: '未来电商',
    ownerName: '钱七',
    phone: '13800000005',
    businessType: '电商',
    status: '已禁用',
    createdAt: '2025-01-08',
    businessLicense: [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46551',
    clubName: '未来共享',
    ownerName: '孙八',
    phone: '13800000006',
    businessType: '共享',
    status: '已开通',
    createdAt: '2025-01-11',
    businessLicense: [
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46552',
    clubName: '未来创新',
    ownerName: '周九',
    phone: '13800000007',
    businessType: '创新',
    status: '待审核',
    createdAt: '2025-01-15',
    businessLicense: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46553',
    clubName: '未来社区',
    ownerName: '吴十',
    phone: '13800000008',
    businessType: '社区',
    status: '已开通',
    createdAt: '2025-01-18',
    businessLicense: [
      'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46554',
    clubName: '未来研发',
    ownerName: '郑十一',
    phone: '13800000009',
    businessType: '研发',
    status: '已开通',
    createdAt: '2025-01-20',
    businessLicense: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    id: '46555',
    clubName: '未来科技',
    ownerName: '冯十二',
    phone: '13800000010',
    businessType: '科技',
    status: '已禁用',
    createdAt: '2025-01-25',
    businessLicense: [
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    ],
  },
]);

rows.value.forEach((row, index) => {
  row.income = index * 600;
  row.deposit = (index % 3) * 800;
  row.isFrozen = index % 5 === 3;
  row.isInStore = index % 6 !== 5;
  row.accepting = index % 4 !== 2;
});

const statusOptions = ['已开通', '已禁用', '待审核'];

const columns = [
  { key: 'id', title: '俱乐部ID' },
  { key: 'clubName', title: '俱乐部名称' },
  { key: 'ownerName', title: '负责人' },
  { key: 'phone', title: '手机号' },
  { key: 'businessType', title: '业务类型' },
  { key: 'license', title: '营业执照' },
  { key: 'status', title: '状态' },
  { key: 'op', title: '操作' },
];

const searchFields = [
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID', span: 6 },
  { prop: 'clubName', label: '俱乐部名称', type: 'input', placeholder: '请输入俱乐部名称', span: 6 },
  { prop: 'ownerName', label: '负责人', type: 'input', placeholder: '请输入负责人名称', span: 6 },
  { prop: 'phone', label: '手机号', type: 'input', placeholder: '请输入手机号', span: 6 },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    span: 6,
    options: [{ label: '全部', value: '' }, ...statusOptions.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'createTime',
    label: '创建时间',
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    span: 6,
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
    const clubIdMatch = !filter.clubId || row.id === String(filter.clubId).trim();
    const clubNameMatch = !filter.clubName || matches(filter.clubName, row.clubName);
    const ownerMatch = !filter.ownerName || matches(filter.ownerName, row.ownerName);
    const phoneMatch = !filter.phone || row.phone === String(filter.phone).trim();
    const statusMatch = !filter.status || row.status === filter.status;
    return clubIdMatch && clubNameMatch && ownerMatch && phoneMatch && statusMatch;
  });
});

const total = computed(() => filteredRows.value.length);
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

const currentLicenseImages = computed(() => {
  if (!currentLicenseRow.value) return [];
  return currentLicenseRow.value.businessLicense || [];
});

const currentLicenseImage = computed(() => {
  if (!currentLicenseImages.value.length) return '';
  return currentLicenseImages.value[currentLicenseIndex.value] || currentLicenseImages.value[0];
});

function openLicenseViewer(row) {
  currentLicenseRow.value = row;
  currentLicenseIndex.value = 0;
  licenseModalVisible.value = true;
}

function prevLicense() {
  if (!currentLicenseImages.value.length) return;
  currentLicenseIndex.value = (currentLicenseIndex.value - 1 + currentLicenseImages.value.length) % currentLicenseImages.value.length;
}

function nextLicense() {
  if (!currentLicenseImages.value.length) return;
  currentLicenseIndex.value = (currentLicenseIndex.value + 1) % currentLicenseImages.value.length;
}

function revokeLicenseFiles() {
  editForm.licenseFiles.forEach((item) => {
    if (item?.url) URL.revokeObjectURL(item.url);
  });
}

function openLicensePicker(event) {
  const input = event.currentTarget.querySelector('input[type="file"]');
  if (input) input.click();
}

function handleLicenseChange(event) {
  const picked = Array.from(event.target.files || []).filter((file) =>
    file.type.startsWith('image/')
  );
  picked.forEach((file) => {
    editForm.licenseFiles.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
    });
  });
  event.target.value = '';
}

function removeLicenseFile(index) {
  const [removed] = editForm.licenseFiles.splice(index, 1);
  if (removed?.url) URL.revokeObjectURL(removed.url);
}

function openAdd() {
  currentRow.value = null;
  revokeLicenseFiles();
  Object.assign(editForm, {
    clubName: '',
    ownerName: '',
    phone: '',
    businessType: '',
    status: '已开通',
    remark: '',
    licenseFiles: [],
    specList: [{ id: 1, gameName: '', spec: '' }],
  });
  addModalVisible.value = true;
}

function openEdit(row) {
  currentRow.value = row;
  revokeLicenseFiles();
  Object.assign(editForm, {
    clubName: row.clubName || '',
    ownerName: row.ownerName || '',
    phone: row.phone || '',
    businessType: row.businessType || '',
    status: row.status || '已开通',
    remark: row.remark || '',
    licenseFiles: [],
    specList: [
      { id: 1, gameName: '三角行动', spec: '护航' },
      { id: 2, gameName: '王者荣耀', spec: '任务' },
    ],
  });
  editModalVisible.value = true;
}

function handleEdit(row) {
  openEdit(row);
}

function saveEdit() {
  if (!currentRow.value) return;
  currentRow.value.clubName = editForm.clubName;
  currentRow.value.ownerName = editForm.ownerName;
  currentRow.value.phone = editForm.phone;
  currentRow.value.businessType = editForm.businessType;
  currentRow.value.status = editForm.status;
  currentRow.value.remark = editForm.remark;
  editModalVisible.value = false;
  show('编辑成功', 'success');
}

function saveAdd() {
  addModalVisible.value = false;
  show('新增成功', 'success');
}

function openSplitConfig() {
  splitModalVisible.value = true;
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

function openClubAssetFilePicker() {
  const input = document.getElementById('club-asset-upload-input');
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
  assetModalVisible.value = true;
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

  assetModalVisible.value = false;
  show('资产已更新', 'success');
}

function addSpecRow() {
  editForm.specList.push({
    id: Date.now() + Math.random(),
    gameName: '',
    spec: '',
  });
}

function removeSpecRow(index) {
  if (editForm.specList.length <= 1) return;
  editForm.specList.splice(index, 1);
}

function getStatusClass(status) {
  switch (status) {
    case '已开通':
      return 'status-success';
    case '已禁用':
      return 'status-danger';
    case '待审核':
      return 'status-warn';
    default:
      return 'status-info';
  }
}

function canShowAction(row, action) {
  switch (action) {
    case '禁止接单':
      return row.accepting;
    case '开启接单':
      return !row.accepting;
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
    message: `确认${action}俱乐部「${row.clubName}」吗？此操作将影响其当前状态。`,
    okText: '确认',
  });
  if (!ok) return;

  if (action === '禁止接单') row.accepting = false;
  if (action === '开启接单') row.accepting = true;
  if (action === '钱包冻结') row.isFrozen = true;
  if (action === '钱包解冻') row.isFrozen = false;
  if (action === '退店') row.isInStore = false;
  if (action === '恢复在店') row.isInStore = true;

  show(`${action}成功`, 'success');
}

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

function pageChange(nextPage) {
  onPageChange(nextPage);
}
</script>

<template>
  <div class="list-page">
    <div class="list-page__search">
      <SearchComponent :fields="searchFields" :initial-values="filter" @search="handleSearch" @reset="handleReset" />
    </div>

    <DataTable
      :columns="columns"
      :data="pagedRows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="pageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #toolbar>
        <div class="table-toolbar">
          <button class="action-btn primary" type="button" @click="openAdd">新增</button>
        </div>
      </template>

      <template #cell-license="{ row }">
        <div v-if="row.businessLicense?.length" class="license-cell" @click="openLicenseViewer(row)">
          <div class="license-thumb-list">
            <img
              v-for="(img, index) in row.businessLicense.slice(0, 3)"
              :key="`${row.id}-${index}`"
              :src="img"
              alt="营业执照"
              class="license-thumb"
            />
          </div>
        </div>
        <span v-else class="muted-text">-</span>
      </template>

      <template #cell-status="{ row }">
        <span :class="['status-badge', getStatusClass(row.status)]">{{ row.status }}</span>
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" type="button" @click="handleEdit(row)">编辑</button>
          <button class="link-btn" type="button" @click="openSplitConfig">分润配置</button>
          <button class="link-btn" type="button" @click="openAsset(row)">资产管理</button>

          <button v-if="canShowAction(row, '禁止接单')" class="link-btn danger" type="button" @click="triggerAction('禁止接单', row)">
            禁止接单
          </button>
          <button v-if="canShowAction(row, '开启接单')" class="link-btn success" type="button" @click="triggerAction('开启接单', row)">
            开启接单
          </button>

          <button v-if="canShowAction(row, '钱包冻结')" class="link-btn warning" type="button" @click="triggerAction('钱包冻结', row)">
            钱包冻结
          </button>
          <button v-if="canShowAction(row, '钱包解冻')" class="link-btn info" type="button" @click="triggerAction('钱包解冻', row)">
            钱包解冻
          </button>

          <button v-if="canShowAction(row, '退店')" class="link-btn muted" type="button" @click="triggerAction('退店', row)">退店</button>
          <button v-if="canShowAction(row, '恢复在店')" class="link-btn link" type="button" @click="triggerAction('恢复在店', row)">
            恢复在店
          </button>
        </div>
      </template>
    </DataTable>

    <AppModal v-model="addModalVisible" title="新增俱乐部" width="560px">
      <div class="prototype-form club-modal-content">
        <div class="field-row">
          <label>俱乐部名称</label>
          <input v-model="editForm.clubName" placeholder="请输入俱乐部名称" />
        </div>
        <div class="field-row">
          <label>手机号</label>
          <input v-model="editForm.phone" placeholder="请输入手机号" />
        </div>
        <div class="field-row">
          <label>营业执照</label>
          <div class="license-uploader">
            <div
              v-for="(item, index) in editForm.licenseFiles"
              :key="item.id"
              class="upload-thumb"
              :title="item.name"
            >
              <img :src="item.url" :alt="item.name" />
              <button type="button" class="upload-thumb-remove" @click="removeLicenseFile(index)">×</button>
            </div>
            <div class="upload-square" @click="openLicensePicker">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>上传图片</span>
              <input type="file" accept="image/*" multiple hidden @change="handleLicenseChange" />
            </div>
          </div>
        </div>

        <div class="field-row spec-group">
          <label>可接单规格</label>
          <div class="spec-list">
            <div v-for="(item, index) in editForm.specList" :key="item.id" class="spec-row">
              <select v-model="item.gameName">
                <option value="">请选择</option>
                <option v-for="game in gameNameOptions" :key="game" :value="game">{{ game }}</option>
              </select>
              <select v-model="item.spec">
                <option value="">请选择</option>
                <option v-for="spec in specOptions" :key="spec" :value="spec">{{ spec }}</option>
              </select>
              <div class="spec-actions">
                <button v-if="editForm.specList.length > 1" type="button" class="mini-icon-btn" @click="removeSpecRow(index)">−</button>
                <button v-if="index === editForm.specList.length - 1" type="button" class="mini-icon-btn add" @click="addSpecRow">＋</button>
              </div>
            </div>
          </div>
        </div>

        <div class="field-row">
          <label>备注</label>
          <textarea v-model="editForm.remark" rows="3" placeholder="请输入备注"></textarea>
          <div class="counter">{{ editForm.remark.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="addModalVisible = false">取消</button>
        <button class="btn btn-primary" type="button" @click="saveAdd">确定</button>
      </template>
    </AppModal>

    <AppModal v-model="editModalVisible" title="编辑俱乐部" width="560px">
      <div class="prototype-form club-modal-content">
        <div class="field-row">
          <label>俱乐部名称</label>
          <input v-model="editForm.clubName" placeholder="请输入俱乐部名称" />
        </div>
        <div class="field-row">
          <label>手机号</label>
          <input v-model="editForm.phone" placeholder="请输入手机号" />
        </div>
        <div class="field-row">
          <label>营业执照</label>
          <div class="license-uploader">
            <div
              v-for="(item, index) in editForm.licenseFiles"
              :key="item.id"
              class="upload-thumb"
              :title="item.name"
            >
              <img :src="item.url" :alt="item.name" />
              <button type="button" class="upload-thumb-remove" @click="removeLicenseFile(index)">×</button>
            </div>
            <div class="upload-square" @click="openLicensePicker">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>上传图片</span>
              <input type="file" accept="image/*" multiple hidden @change="handleLicenseChange" />
            </div>
          </div>
        </div>

        <div class="field-row spec-group">
          <label>可接单规格</label>
          <div class="spec-list">
            <div v-for="(item, index) in editForm.specList" :key="item.id" class="spec-row">
              <select v-model="item.gameName">
                <option value="">请选择</option>
                <option v-for="game in gameNameOptions" :key="game" :value="game">{{ game }}</option>
              </select>
              <select v-model="item.spec">
                <option value="">请选择</option>
                <option v-for="spec in specOptions" :key="spec" :value="spec">{{ spec }}</option>
              </select>
              <div class="spec-actions">
                <button v-if="editForm.specList.length > 1" type="button" class="mini-icon-btn" @click="removeSpecRow(index)">−</button>
                <button v-if="index === editForm.specList.length - 1" type="button" class="mini-icon-btn add" @click="addSpecRow">＋</button>
              </div>
            </div>
          </div>
        </div>

        <div class="field-row">
          <label>备注</label>
          <textarea v-model="editForm.remark" rows="3" placeholder="请输入备注"></textarea>
          <div class="counter">{{ editForm.remark.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="editModalVisible = false">取消</button>
        <button class="btn btn-primary" type="button" @click="saveEdit">保存</button>
      </template>
    </AppModal>

    <AppModal v-model="splitModalVisible" title="分润配置" width="620px">
      <div class="split-config club-modal-content">
        <div class="split-mode">
          <span class="mode-label">分润类型</span>
          <label class="mode-item"><input v-model="splitType" type="radio" value="百分比分润" /> 百分比分润</label>
          <label class="mode-item"><input v-model="splitType" type="radio" value="固定分润" /> 固定分润</label>
        </div>

        <div v-if="splitType === '百分比分润'" class="split-percentage-box">
          <div class="ratio-row">
            <span class="ratio-label">俱乐部分润</span>
            <div class="ratio-input-wrap">
              <input v-model.number="splitConfig.ratio" type="number" min="0" max="100" />
              <span>%</span>
            </div>
          </div>
          <div class="ratio-row">
            <span class="ratio-label">俱乐部分润</span>
            <div class="ratio-input-wrap">
              <input v-model.number="splitConfig.ratio2" type="number" min="0" max="100" />
              <span>%</span>
            </div>
          </div>
        </div>

        <template v-else>
          <div class="split-box">
            <div class="split-row split-head">
              <span>游戏名称</span>
              <span>游戏规则</span>
              <span>打手分成金额（元）</span>
            </div>
            <div v-for="(item, index) in splitFixedPagedRows" :key="`${item.game}-${item.rule}-${index}`" class="split-row">
              <span>{{ item.game }}</span>
              <span>{{ item.rule }}</span>
              <input v-model="item.amount" placeholder="请输入金额" />
            </div>
          </div>
          <div class="split-pagination-wrap">
            <div class="split-total">共 {{ splitFixedTotal }} 条</div>
            <PaginationSimple
              :current-page="splitFixedPage"
              :page-size="splitFixedPageSize"
              :total="splitFixedTotal"
              :show-batch-actions="false"
              @current-change="handleSplitFixedPageChange"
            />
          </div>
        </template>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="splitModalVisible = false">取消</button>
        <button class="btn btn-primary" type="button" @click="splitModalVisible = false">确定</button>
      </template>
    </AppModal>

    <AppModal v-model="assetModalVisible" title="资产管理" width="560px">
      <div class="asset-dialog-card club-modal-content">
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
              id="club-asset-upload-input"
              type="file"
              multiple
              @change="handleAssetFiles"
              hidden
            />
            <div class="upload-toolbar">
              <button type="button" class="upload-trigger" @click="openClubAssetFilePicker">上传文件</button>
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
        <button class="btn btn-plain" type="button" @click="assetModalVisible = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submitAsset">确定</button>
      </template>
    </AppModal>

    <AppModal v-model="licenseModalVisible" title="营业执照" width="760px">
      <div class="club-modal-content">
        <div class="license-gallery" v-if="currentLicenseImages.length">
          <button class="gallery-arrow" type="button" aria-label="上一张" @click="prevLicense">‹</button>
          <div class="gallery-wrap">
            <div class="gallery-stage">
              <img :src="currentLicenseImage" alt="营业执照预览" />
            </div>
            <div class="gallery-thumbs" v-if="currentLicenseImages.length > 1">
              <button
                v-for="(img, index) in currentLicenseImages"
                :key="`${currentLicenseRow.id}-${index}`"
                type="button"
                :class="['thumb-btn', { active: currentLicenseIndex === index }]"
                @click="currentLicenseIndex = index"
              >
                <img :src="img" :alt="`营业执照 ${index + 1}`" />
              </button>
            </div>
          </div>
          <button class="gallery-arrow" type="button" aria-label="下一张" @click="nextLicense">›</button>
        </div>
        <div v-else class="empty-preview">暂无营业执照</div>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

.list-page__search {
  background: var(--bg-card);
  border: 1px solid #edf0f5;
  border-radius: 12px;
  padding: 18px 18px 0;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 0 12px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  height: 34px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 12px 24px var(--primary-glow);
}

.action-btn:hover {
  transform: translateY(-1px);
}

.license-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.license-thumb-list {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.license-thumb {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.license-thumb:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.12);
}

.muted-text {
  color: #667085;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  padding: 5px 10px;
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

.action-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px 8px;
  min-width: max-content;
}

.list-page__body td:last-child {
  min-width: 420px;
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

.license-gallery {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 14px;
  min-height: 360px;
}

.gallery-wrap {
  display: grid;
  gap: 12px;
}

.gallery-arrow {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  color: #475467;
  font-size: 30px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gallery-arrow:hover {
  background: #f2edff;
  border-color: var(--primary-border-strong);
  color: var(--primary);
}

.gallery-stage {
  height: 420px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #f3f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-stage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-thumbs {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.thumb-btn {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: var(--bg-card);
  border-radius: 8px;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.thumb-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-btn.active {
  border-color: var(--primary-hover);
  box-shadow: 0 0 0 2px var(--primary-border-strong);
}

.empty-preview {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667085;
  border: 1px dashed #d9deea;
  border-radius: 12px;
  background: #f9fafb;
}

/* ===== 新增 / 编辑 表单 ===== */
.prototype-form {
  display: grid;
  gap: 16px;
}

.field-row {
  display: grid;
  gap: 8px;
}

.field-row label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.prototype-form input,
.prototype-form select,
.prototype-form textarea {
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

.prototype-form input:focus,
.prototype-form select:focus,
.prototype-form textarea:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.prototype-form textarea {
  resize: vertical;
  min-height: 84px;
}

.license-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.upload-square {
  flex: 0 0 auto;
  width: 88px;
  height: 88px;
  border: 1px dashed #cfd6e4;
  border-radius: 10px;
  background: #fbfcff;
  color: #8a93a6;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.upload-square:hover {
  border-color: var(--primary-hover);
  background: #f7f5ff;
  color: var(--primary);
  box-shadow: 0 8px 18px var(--primary-border);
}

.upload-square svg {
  width: 22px;
  height: 22px;
}

.upload-square span {
  font-size: 12px;
  font-weight: 500;
}

.upload-thumb {
  position: relative;
  flex: 0 0 auto;
  width: 88px;
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.upload-thumb:hover {
  box-shadow: 0 10px 22px var(--primary-border-strong);
  transform: translateY(-1px);
}

.upload-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.upload-thumb:hover img {
  transform: scale(1.06);
}

.upload-thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.55);
  color: var(--text-invert);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
}

.upload-thumb:hover .upload-thumb-remove {
  opacity: 1;
  transform: scale(1);
}

.upload-thumb-remove:hover {
  background: #f04438;
}

.spec-group {
  gap: 10px;
}

.spec-list {
  display: grid;
  gap: 10px;
}

.spec-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.spec-row select,
.spec-row input {
  min-height: 34px;
  width: 100%;
  border: 1px solid #e3e7f0;
  border-radius: 10px;
  background: #fbfcfe;
  padding: 8px 10px;
  box-sizing: border-box;
  font-size: 13px;
  color: #1f2937;
}

.spec-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.mini-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid #dbe1eb;
  background: var(--bg-card);
  color: #475467;
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s ease;
}

.mini-icon-btn:hover {
  border-color: #c9b8ff;
  color: var(--primary);
}

.mini-icon-btn.add {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  border-color: transparent;
  box-shadow: 0 8px 16px var(--primary-glow-strong);
}

.counter {
  text-align: right;
  color: #98a2b3;
  font-size: 12px;
  margin-top: -4px;
  font-variant-numeric: tabular-nums;
}

/* ===== 分润配置 ===== */
.split-config {
  display: grid;
  gap: 14px;
}

.split-mode {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: #475467;
  font-size: 13px;
}

.mode-label {
  color: #5b6478;
  font-weight: 600;
}

.mode-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.split-percentage-box {
  display: grid;
  gap: 12px;
  padding: 12px 12px 0;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.ratio-row {
  display: grid;
  grid-template-columns: 1fr 120px;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  color: #475467;
  font-size: 13px;
  font-weight: 600;
}

.ratio-label {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.ratio-input-wrap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  padding: 0 12px;
  min-height: 40px;
  border: 1px solid #dfe5ee;
  background: var(--bg-card);
  border-radius: 8px;
}

.ratio-input-wrap input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  text-align: right;
  font-size: 14px;
  color: #1f2937;
}

.ratio-input-wrap span {
  color: #667085;
}

.split-box {
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
}

.split-row {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #edf0f5;
  align-items: center;
}

.split-row:last-child {
  border-bottom: none;
}

.split-head {
  background: #f4f1ff;
  color: #5b6478;
  font-size: 12px;
  font-weight: 700;
}

.split-row input {
  width: 100%;
  min-height: 32px;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 8px 10px;
  box-sizing: border-box;
}

.split-pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.split-total {
  color: #667085;
  font-size: 12px;
}

/* ===== 资产管理弹窗 ===== */
.asset-dialog-card {
  display: grid;
  gap: 18px;
}

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
  width: auto;
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

.asset-field-group input:focus,
.asset-field-group textarea:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

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

<!-- 本页所有弹窗外壳外观，通过内容容器 :has 命中 -->
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
