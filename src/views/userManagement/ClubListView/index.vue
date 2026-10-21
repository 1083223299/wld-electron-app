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
import { useUserStore } from '../../../stores/user';

const { confirm } = useConfirm();
const { show } = useToast();

/** 当前角色：客服（service）仅有查看权限，隐藏新增按钮与全部操作按钮 */
const userStore = useUserStore();
const isService = computed(() => (userStore.role || '') === 'service');

// ============ 筛选 ============
const filter = reactive({
  clubId: '',
  clubName: '',
  phone: '',
  accountStatus: '',
  createTime: [],
});

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['clubId', 'clubName', 'phone', 'accountStatus', 'createTime'],
});
restoreFilter(filter);

// ============ 列表（服务端分页） ============
const rows = ref([]);
const total = ref(0);
const loading = ref(false);

const allColumns = [
  { key: 'id', title: '俱乐部ID' },
  { key: 'name', title: '俱乐部名称' },
  { key: 'license', title: '营业执照' },
  { key: 'incomeBalance', title: '收益余额(元)' },
  { key: 'depositBalance', title: '押金余额(元)' },
  { key: 'completedCount', title: '已完成' },
  { key: 'rejectedCount', title: '未通过' },
  { key: 'frozenCount', title: '冻结' },
  { key: 'status', title: '状态' },
  { key: 'op', title: '操作' },
];

/** 客服仅查看：隐藏"操作"列（编辑/分润/规格/资产管理/接单/冻结/退店/停用启用等按钮均不可见） */
const columns = computed(() =>
  isService.value ? allColumns.filter((col) => col.key !== 'op') : allColumns
);

const accountStatusOptions = [
  { label: '可接单', value: 'CAN_TAKE' },
  { label: '禁止接单', value: 'BLOCK_TAKE' },
  { label: '未冻结', value: 'UNFROZEN' },
  { label: '冻结', value: 'FROZEN' },
  { label: '在店', value: 'IN_STORE' },
  { label: '退店', value: 'QUIT' },
];

const searchFields = [
  { prop: 'clubId', label: '俱乐部ID', type: 'input', placeholder: '请输入俱乐部ID', span: 6 },
  { prop: 'clubName', label: '俱乐部名称', type: 'input', placeholder: '请输入俱乐部名称', span: 6 },
  { prop: 'phone', label: '俱乐部手机号', type: 'input', placeholder: '请输入手机号', span: 6 },
  {
    prop: 'accountStatus',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    span: 6,
    options: [{ label: '全部', value: '' }, ...accountStatusOptions],
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

function toDateStr(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return '0.00';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function orderCount(value) {
  const num = Number(value);
  return `${Number.isFinite(num) ? num : 0}单`;
}

async function fetchList() {
  loading.value = true;
  try {
    const [start, end] = Array.isArray(filter.createTime) ? filter.createTime : [];
    const res = await clubApi.list({
      page: page.value,
      pageSize: pageSize.value,
      id: filter.clubId,
      name: filter.clubName,
      phone: filter.phone,
      accountStatus: filter.accountStatus,
      createdFrom: toDateStr(start),
      createdTo: toDateStr(end),
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

// ============ 新增 / 编辑俱乐部 ============
const editModalVisible = ref(false);
const editingId = ref(null); // null = 新增
const editForm = reactive({
  name: '',
  phone: '',
  password: '',
  publicGrab: 0,
});

function openAdd() {
  editingId.value = null;
  Object.assign(editForm, { name: '', phone: '', password: '', publicGrab: 0 });
  editModalVisible.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  Object.assign(editForm, {
    name: row.name || '',
    phone: row.phone || '',
    password: '',
    publicGrab: Number(row.publicGrab) || 0,
  });
  editModalVisible.value = true;
}

async function submitEdit() {
  if (!editForm.name.trim()) {
    show('请输入俱乐部名称', 'warning');
    return;
  }
  if (!editForm.phone.trim()) {
    show('请输入手机号', 'warning');
    return;
  }
  if (!editingId.value && !editForm.password) {
    show('请输入登录密码', 'warning');
    return;
  }
  const payload = {
    name: editForm.name.trim(),
    phone: editForm.phone.trim(),
    publicGrab: Number(editForm.publicGrab),
  };
  // 编辑时密码留空表示不修改
  if (editForm.password) payload.password = editForm.password;
  try {
    if (editingId.value) {
      await clubApi.update(editingId.value, payload);
      show('编辑成功', 'success');
    } else {
      await clubApi.create(payload);
      show('新增成功', 'success');
    }
    editModalVisible.value = false;
    fetchList();
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  }
}

// ============ 营业执照预览 ============
const licenseModalVisible = ref(false);
const currentLicenseRow = ref(null);

const currentLicenseUrl = computed(() => currentLicenseRow.value?.licenseUrl || '');

function openLicenseViewer(row) {
  currentLicenseRow.value = row;
  licenseModalVisible.value = true;
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
    row.status = next;
    show(`${actionLabel}成功`, 'success');
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  }
}

// ============ 接单 / 冻结 / 退店标志 ============
function canShowAction(row, action) {
  switch (action) {
    case '禁止接单':
      return Number(row.canTake) === 1;
    case '开启接单':
      return Number(row.canTake) === 0;
    case '钱包冻结':
      return Number(row.walletFrozen ?? 0) !== 1;
    case '钱包解冻':
      return Number(row.walletFrozen ?? 0) === 1;
    case '退店':
      return Number(row.inStore) === 1;
    case '恢复在店':
      return Number(row.inStore) === 0;
    default:
      return true;
  }
}

const ACTION_RULES = {
  禁止接单: '仅禁止主动接单（抢单大厅），系统仍可派发订单',
  钱包冻结: '冻结后押金、收益均无法提现',
  退店: '退店后该账号将变为禁止接单，且不再允许转单、派单；押金提现需同时满足已退店且钱包未冻结',
};

async function triggerAction(action, row) {
  const ok = await confirm({
    title: '提示',
    message: ACTION_RULES[action]
      ? `确认${action}俱乐部「${row.name}」吗？\n${ACTION_RULES[action]}`
      : `确认${action}俱乐部「${row.name}」吗？此操作将影响其当前状态。`,
    okText: '确认',
  });
  if (!ok) return;

  let flags = {};
  if (action === '禁止接单') flags = { canTake: 0 };
  if (action === '开启接单') flags = { canTake: 1 };
  if (action === '钱包冻结') flags = { walletFrozen: 1 };
  if (action === '钱包解冻') flags = { walletFrozen: 0 };
  if (action === '退店') flags = { inStore: 0 };
  if (action === '恢复在店') flags = { inStore: 1 };

  try {
    await clubApi.updateFlags(row.id, flags);
    // 本地同步可见状态；列表接口已返回 walletFrozen，刷新列表后以接口字段为准
    if (action === '禁止接单') row.canTake = 0;
    if (action === '开启接单') row.canTake = 1;
    if (action === '钱包冻结') row.walletFrozen = 1;
    if (action === '钱包解冻') row.walletFrozen = 0;
    if (action === '退店') {
      // 规则：退店后该账号变为禁止接单
      row.inStore = 0;
      row.canTake = 0;
      row.quitAt = new Date().toISOString();
    }
    if (action === '恢复在店') {
      row.inStore = 1;
      row.quitAt = '';
    }
    show(`${action}成功`, 'success');
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  }
}

// ============ 分润配置 ============
const profitDialogVisible = ref(false);
const profitLoading = ref(false);
const profitSaving = ref(false);
const profitLoadError = ref(false);
const profitCurrentRow = ref(null);
const profitKeyword = ref('');
// 分润类型：percent 百分比分润（统一比例）/ fixed 固定分润（按规格填金额）
const profitMode = ref('percent');
const percentRate = ref('');
// 每行：{ gameId, gameName, specId, specName, configured, clubRate, clubFixed, playerRate, playerFixed, settleDays, fixedAmount }
const profitRows = ref([]);

const profitColumns = [
  { key: 'gameName', title: '游戏名称' },
  { key: 'specName', title: '游戏规格' },
  { key: 'fixedAmount', title: '俱乐部/打手总金额(元)' },
];

const profitDialogTitle = computed(() => `分润配置 - ${profitCurrentRow.value?.name ?? ''}`);

// 平台分润 = 100 - 俱乐部/打手总分润
const platformRateText = computed(() => {
  const rate = Number(percentRate.value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return '--';
  return `${(100 - rate).toFixed(2)}%`;
});

function toProfitArray(list) {
  if (Array.isArray(list)) return list;
  if (list && typeof list === 'object') {
    if (Array.isArray(list.list)) return list.list;
    if (Array.isArray(list.items)) return list.items;
    if (Array.isArray(list.data)) return list.data;
  }
  return [];
}

async function loadProfitConfigs() {
  profitLoading.value = true;
  try {
    const list = toProfitArray(await clubApi.getProfitConfigs(Number(profitCurrentRow.value.id), profitKeyword.value));
    profitRows.value = list.map((item) => ({
      gameId: Number(item.gameId),
      gameName: item.gameName || '',
      specId: Number(item.specId),
      specName: item.specName || '',
      configured: Number(item.configured) === 1,
      clubMode: item.clubMode || 'PERCENT',
      clubRate: item.clubRate ?? '',
      clubFixed: item.clubFixed ?? '',
      playerMode: item.playerMode || 'PERCENT',
      playerRate: item.playerRate ?? '',
      playerFixed: item.playerFixed ?? '',
      settleDays: item.settleDays ?? '',
      // 固定分润界面输入值：已配置行回填俱乐部固定额
      fixedAmount: item.clubFixed ?? '',
    }));
    profitLoadError.value = false;
  } catch (e) {
    profitLoadError.value = true;
  } finally {
    profitLoading.value = false;
  }
}

async function openProfitConfig(row) {
  profitCurrentRow.value = row;
  profitKeyword.value = '';
  profitRows.value = [];
  profitMode.value = 'percent';
  percentRate.value = '';
  profitDialogVisible.value = true;
  await loadProfitConfigs();
  // 百分比默认值：取已配置行一致的俱乐部比例
  const configuredRates = profitRows.value
    .filter((r) => r.configured && r.clubMode === 'PERCENT')
    .map((r) => Number(r.clubRate));
  const rateSet = new Set(configuredRates.filter((v) => Number.isFinite(v)));
  percentRate.value = rateSet.size === 1 ? [...rateSet][0] : '';
}

function searchProfit() {
  loadProfitConfigs();
}

async function submitProfit() {
  if (!profitCurrentRow.value) return;
  const clubId = Number(profitCurrentRow.value.id);

  if (profitMode.value === 'percent') {
    // 百分比：统一比例应用于全部授权规格
    const rate = Number(percentRate.value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      show('俱乐部/打手总分润需为 0-100 的数字', 'warning');
      return;
    }
    if (!profitRows.value.length) {
      show('该俱乐部暂无授权规格，无法保存', 'warning');
      return;
    }
    const payload = profitRows.value.map((row) => ({
      clubId,
      specId: row.specId,
      clubMode: 'PERCENT',
      clubRate: rate,
      playerMode: 'PERCENT',
      playerRate: 0,
      settleDays: Number(row.settleDays) >= 0 ? Number(row.settleDays) : 0,
    }));
    await saveProfit(payload);
    return;
  }

  // 固定：按规格填写金额，空值行不提交
  const targets = profitRows.value.filter((row) => String(row.fixedAmount).trim() !== '');
  if (!targets.length) {
    show('请至少为一条规格填写分润金额', 'warning');
    return;
  }
  for (const row of targets) {
    const amount = Number(row.fixedAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      show(`「${row.gameName}·${row.specName}」金额仅支持输入 0 及正数，最多保留两位小数`, 'warning');
      return;
    }
  }
  const payload = targets.map((row) => ({
    clubId,
    specId: row.specId,
    clubMode: 'FIXED',
    clubFixed: Number(row.fixedAmount),
    playerMode: 'FIXED',
    playerFixed: 0,
    settleDays: Number(row.settleDays) >= 0 ? Number(row.settleDays) : 0,
  }));
  await saveProfit(payload);
}

async function saveProfit(payload) {
  profitSaving.value = true;
  try {
    await clubApi.saveProfitConfigs(payload);
    show('分润配置保存成功', 'success');
    profitDialogVisible.value = false;
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  } finally {
    profitSaving.value = false;
  }
}

// ============ 资产管理（充值 / 扣减 / 余额抵扣） ============
const assetModalVisible = ref(false);
const currentRow = ref(null);

const assetForm = reactive({
  assetType: '收益', // 收益 / 押金
  operation: '充值', // 充值 / 扣减 / 余额抵扣
  amount: '',
  reason: '',
});

const WALLET_TYPE_MAP = { 收益: 'INCOME', 押金: 'DEPOSIT' };
const WALLET_ACTION_MAP = { 充值: 'CREDIT', 扣减: 'DEDUCT', 余额抵扣: 'OFFSET' };

const assetTypeOptions = ['收益', '押金'];

const assetOperationOptions = computed(() => {
  if (assetForm.assetType === '押金') {
    return ['充值', '扣减'];
  }
  return ['充值', '扣减', '余额抵扣'];
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

// 列表接口返回收益/押金余额：incomeBalance / depositBalance（单位元）
const currentAssetBalance = computed(() => {
  const row = currentRow.value;
  if (!row) return '-';
  const key = assetForm.assetType === '收益' ? 'incomeBalance' : 'depositBalance';
  const value = row[key];
  if (value === undefined || value === null || value === '') return '-';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '-';
});

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

function openAsset(row) {
  currentRow.value = row;
  Object.assign(assetForm, {
    assetType: '收益',
    operation: '充值',
    amount: '',
    reason: '',
  });
  assetModalVisible.value = true;
}

async function submitAsset() {
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

  try {
    await clubApi.adjustWallet(currentRow.value.id, {
      walletType: WALLET_TYPE_MAP[assetForm.assetType],
      action: WALLET_ACTION_MAP[assetForm.operation],
      amount,
      reason: assetForm.reason.trim(),
    });
    assetModalVisible.value = false;
    show('资产已更新', 'success');
  } catch (e) {
    // 错误提示由 request.js 统一弹出
  }
}

// ============ 可接单规格 ============
const specDialogVisible = ref(false);
const specLoading = ref(false);
const specSaving = ref(false);
const specLoadError = ref(false);
const specLoadErrorMsg = ref('');
// 游戏-规格目录：真实规格 ID 取游戏列表/规格接口 data.list[].specs[].id
const specCatalog = ref([]); // [{ gameId, gameName, specs: [{ id, name }] }]
const specGameRows = ref([]); // [{ gameId, gameName, specs, all, checked:Set<number> }]

const specDialogTitle = computed(() => `可接单规格 - ${currentRow.value?.name ?? ''}`);

async function loadSpecCatalog() {
  if (specCatalog.value.length) return;
  const games = await gameApi.list();
  const catalog = await Promise.all(
    (games || []).map(async (game) => {
      let specs = [];
      // 优先使用游戏列表自带的规格（含真实规格 ID），否则按游戏拉取
      if (Array.isArray(game.specs) && game.specs.length) {
        specs = game.specs;
      } else {
        try {
          specs = await gameApi.specs(game.id);
        } catch (e) {
          // 单个游戏规格拉取失败不阻塞整个目录
        }
      }
      return {
        gameId: game.id,
        gameName: game.name,
        specs: (specs || []).map((s) => ({ id: Number(s.id ?? s), name: s.name ?? s })),
      };
    })
  );
  specCatalog.value = catalog;
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

// 兼容后端 data 返回结构差异：数组 / { list: [] } / { specs: [] } / { items: [] } / 单个对象
function normalizeSpecList(list) {
  if (Array.isArray(list)) return list;
  if (list && typeof list === 'object') {
    if (Array.isArray(list.list)) return list.list;
    if (Array.isArray(list.specs)) return list.specs;
    if (Array.isArray(list.items)) return list.items;
    if ('gameId' in list) return [list];
  }
  return [];
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
    buildSpecRows(normalizeSpecList(list));
  } catch (e) {
    // 错误提示由 request.js 统一弹出，这里仅标记加载失败态并记录原因
    specLoadError.value = true;
    specLoadErrorMsg.value = e?.message || '未知错误';
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
      <template #toolbar>
        <div class="table-toolbar">
          <button v-if="!isService" class="action-btn primary" type="button" @click="openAdd">新增</button>
        </div>
      </template>

      <template #cell-license="{ row }">
        <button
          v-if="row.licenseUrl"
          class="license-link"
          type="button"
          title="点击查看大图"
          @click="openLicenseViewer(row)"
        >
          查看
        </button>
        <span v-else class="muted-text">暂无</span>
      </template>

      <template #cell-incomeBalance="{ row }">{{ formatMoney(row.incomeBalance) }}</template>

      <template #cell-depositBalance="{ row }">{{ formatMoney(row.depositBalance) }}</template>

      <template #cell-completedCount="{ row }">{{ orderCount(row.completedCount) }}</template>

      <template #cell-rejectedCount="{ row }">{{ orderCount(row.rejectedCount) }}</template>

      <template #cell-frozenCount="{ row }">{{ orderCount(row.frozenCount) }}</template>

      <template #cell-status="{ row }">
        <div class="status-group">
          <span :class="['status-badge', Number(row.canTake) === 1 ? 'status-success' : 'status-danger']">
            {{ Number(row.canTake) === 1 ? '可接单' : '禁止接单' }}
          </span>
          <span :class="['status-badge', Number(row.walletFrozen) === 1 ? 'status-danger' : 'status-success']">
            {{ Number(row.walletFrozen) === 1 ? '冻结' : '未冻结' }}
          </span>
          <span :class="['status-badge', Number(row.inStore) === 1 ? 'status-success' : 'status-muted']">
            {{ Number(row.inStore) === 1 ? '在店' : '退店' }}
          </span>
        </div>
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button class="link-btn" type="button" @click="openEdit(row)">编辑</button>
          <button class="link-btn" type="button" @click="openProfitConfig(row)">分润配置</button>
          <button class="link-btn" type="button" @click="openSpecs(row)">可接单规格</button>
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

          <button v-if="row.status === 'NORMAL'" class="link-btn danger" type="button" @click="toggleStatus(row)">停用</button>
          <button v-else class="link-btn success" type="button" @click="toggleStatus(row)">启用</button>
        </div>
      </template>
    </DataTable>

    <!-- 分润配置 -->
    <AppModal v-model="profitDialogVisible" :title="profitDialogTitle" width="860px">
      <div class="profit-dialog-card club-modal-content">
        <div class="profit-type-switch">
          <button
            type="button"
            :class="['profit-type-btn', { active: profitMode === 'percent' }]"
            @click="profitMode = 'percent'"
          >
            百分比分润
          </button>
          <button
            type="button"
            :class="['profit-type-btn', { active: profitMode === 'fixed' }]"
            @click="profitMode = 'fixed'"
          >
            固定分润
          </button>
        </div>

        <!-- 百分比分润：统一比例，应用于全部授权规格 -->
        <template v-if="profitMode === 'percent'">
          <div class="profit-field">
            <label>俱乐部/打手总分润</label>
            <div class="profit-rate-input">
              <input v-model="percentRate" type="number" min="0" max="100" placeholder="请输入比例" />
              <span>%</span>
            </div>
          </div>
          <div class="profit-platform-row">
            <span>平台分润</span>
            <strong>{{ platformRateText }}</strong>
          </div>
          <div class="profit-tip">该比例统一应用于该俱乐部的全部授权规格；打手分润按 0 保存。</div>
        </template>

        <!-- 固定分润：按规格填写金额 -->
        <template v-else>
          <div class="profit-search">
            <input
              v-model="profitKeyword"
              placeholder="搜索游戏名或规格名"
              @keyup.enter="searchProfit"
            />
            <button class="btn btn-primary" type="button" @click="searchProfit">搜索</button>
          </div>

          <div v-if="profitLoading" class="profit-loading">分润配置加载中…</div>
          <template v-else>
            <div v-if="profitLoadError" class="profit-empty">分润配置加载失败，请检查接口或稍后重试</div>
            <div v-else-if="!profitRows.length" class="profit-empty">该俱乐部暂无授权规格</div>
            <DataTable
              v-else
              :columns="profitColumns"
              :data="profitRows"
              :total="profitRows.length"
              :page="1"
              :page-size="100"
            >
              <template #cell-fixedAmount="{ row }">
                <input
                  v-model="row.fixedAmount"
                  class="profit-amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </template>
            </DataTable>
          </template>

          <div class="profit-tip">
            此处仅展示该俱乐部所拥有的游戏及规格数据，优先展示未配置金额的数据，支持按关键词搜索；金额仅支持输入 0 及正数，最多保留两位小数。
          </div>
        </template>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="profitDialogVisible = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="profitLoading || profitSaving" @click="submitProfit">
          {{ profitSaving ? '保存中…' : '确定' }}
        </button>
      </template>
    </AppModal>

    <!-- 营业执照预览 -->
    <AppModal v-model="licenseModalVisible" title="营业执照" width="760px">
      <div class="club-modal-content">
        <div v-if="currentLicenseUrl" class="license-preview">
          <img :src="currentLicenseUrl" alt="营业执照预览" />
        </div>
        <div v-else class="empty-preview">暂无营业执照</div>
      </div>
    </AppModal>

    <!-- 新增 / 编辑俱乐部 -->
    <AppModal v-model="editModalVisible" :title="editingId ? '编辑俱乐部' : '新增俱乐部'" width="480px">
      <div class="prototype-form club-modal-content">
        <div class="field-row">
          <label>俱乐部名称</label>
          <input v-model="editForm.name" placeholder="请输入俱乐部名称" />
        </div>
        <div class="field-row">
          <label>手机号</label>
          <input v-model="editForm.phone" placeholder="请输入登录手机号" />
        </div>
        <div class="field-row">
          <label>{{ editingId ? '登录密码（不修改请留空）' : '登录密码' }}</label>
          <input v-model="editForm.password" type="password" placeholder="请输入登录密码" autocomplete="new-password" />
        </div>
        <div class="field-row">
          <label>是否公开抢单</label>
          <select v-model.number="editForm.publicGrab">
            <option :value="0">否</option>
            <option :value="1">是</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="editModalVisible = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submitEdit">{{ editingId ? '保存' : '确定' }}</button>
      </template>
    </AppModal>

    <!-- 资产管理 -->
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

    <!-- 可接单规格 -->
    <AppModal v-model="specDialogVisible" :title="specDialogTitle" width="640px">
      <div class="spec-dialog-card club-modal-content">
        <div v-if="specLoading" class="spec-loading">规格加载中…</div>
        <template v-else>
          <div v-if="specLoadError" class="spec-empty">
            规格加载失败，请检查接口或稍后重试
            <span v-if="specLoadErrorMsg" class="spec-error-detail">{{ specLoadErrorMsg }}</span>
          </div>
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

.list-page__body td:last-child {
  min-width: 560px;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.license-link {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.license-link:hover {
  background: rgba(37, 99, 235, 0.08);
}

.muted-text {
  color: #98a2b3;
}

.status-group {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  min-width: max-content;
}

.license-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 70vh;
  overflow: auto;
}

.license-preview img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(46, 16, 101, 0.14);
}

.empty-preview {
  padding: 48px 12px;
  text-align: center;
  color: #8a93a6;
  font-size: 13px;
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
.prototype-form select {
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
.prototype-form select:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
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

.asset-field-group textarea {
  resize: vertical;
  min-height: 84px;
}

.reason-count {
  text-align: right;
  color: #98a2b3;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* ===== 分润配置弹窗 ===== */
.profit-dialog-card {
  display: grid;
  gap: 16px;
}

.profit-search {
  display: flex;
  gap: 10px;
}

.profit-search input {
  flex: 1;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  background: #fbfcfe;
  padding: 10px 14px;
  font-size: 13px;
  color: #1f2937;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.profit-search input:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.profit-loading,
.profit-empty {
  padding: 40px 12px;
  text-align: center;
  color: #8a93a6;
  font-size: 13px;
}

.profit-type-switch {
  display: inline-flex;
  gap: 6px;
  width: 100%;
  padding: 5px;
  border: 1px solid #eceef6;
  border-radius: 14px;
  background: #f5f6fb;
  box-sizing: border-box;
}

.profit-type-btn {
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

.profit-type-btn:hover {
  color: var(--primary);
}

.profit-type-btn.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  border-color: transparent;
  color: var(--text-invert);
  box-shadow: 0 10px 22px var(--primary-glow-strong);
}

.profit-field {
  display: grid;
  gap: 8px;
}

.profit-field label {
  color: #5b6478;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.profit-rate-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.profit-rate-input input {
  flex: 1;
  border: 1px solid #e3e7f0;
  border-radius: 12px;
  background: #fbfcfe;
  padding: 11px 14px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.profit-rate-input input:focus {
  border-color: #8b5cf6;
  outline: none;
  background: var(--bg-card);
  box-shadow: 0 0 0 4px var(--primary-border);
}

.profit-rate-input span {
  color: #5b6478;
  font-size: 14px;
  font-weight: 600;
  flex: 0 0 auto;
}

.profit-platform-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 14px;
  color: var(--text-invert);
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(135deg, var(--primary), var(--primary-hover));
  box-shadow: 0 14px 30px var(--primary-glow-strong);
}

.profit-platform-row span {
  font-size: 13px;
  opacity: 0.9;
}

.profit-platform-row strong {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.profit-amount-input {
  width: 120px;
  border: 1px solid #e3e7f0;
  border-radius: 8px;
  background: #fbfcfe;
  padding: 6px 10px;
  font-size: 12.5px;
  color: #1f2937;
  box-sizing: border-box;
  text-align: right;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.profit-amount-input:focus {
  border-color: #8b5cf6;
  outline: none;
  box-shadow: 0 0 0 3px var(--primary-border);
}

.profit-tip {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--primary-faint);
  color: #8a93a6;
  font-size: 12px;
  line-height: 1.6;
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

.spec-error-detail {
  display: block;
  margin-top: 8px;
  color: #d92d20;
  font-size: 12px;
  word-break: break-all;
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

<!-- 弹窗外壳外观，通过内容容器 :has 命中 -->
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
