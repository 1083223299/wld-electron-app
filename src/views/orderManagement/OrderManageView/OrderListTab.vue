<script setup>
import { computed, reactive, ref } from 'vue';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import AppModal from '../../../components/AppModal.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { useUserStore } from '../../../stores/user';
import OrderDetailDialog from './OrderDetailDialog.vue';
import OrderEditDialog from './OrderEditDialog.vue';
import AuditDialog from './AuditDialog.vue';
import {
  CURRENT_USER,
  orderStore,
  getRelation,
  CHANNELS,
  STATUS_OPTIONS,
  AUDIT_OPTIONS,
  ATTR_OPTIONS,
  TYPE_OPTIONS,
  CLIENT_OPTIONS,
  TAG_OPTIONS,
  CALL_TYPE_OPTIONS,
  GAME_OPTIONS,
  SPEC_OPTIONS,
  CLUB_OPTIONS,
  PLAYER_OPTIONS,
  STATUS_CLASS,
  AUDIT_CLASS,
} from './mockData';

const { confirm } = useConfirm();
const { show } = useToast();
const userStore = useUserStore();

const money = (value) => (Number(value) || 0).toFixed(2);

/** 当前登录角色（客服 service / 审核员 audit / 管理员 admin），fallback 到 mock 常量 */
const userRole = computed(() => userStore.role || CURRENT_USER.role);
const isService = computed(() => userRole.value === 'service');
const isAudit = computed(() => userRole.value === 'audit');

/* ===== 我的订单 / 全部订单（管理员/审核员默认我的订单；客服无"我的订单"入口，仅全部订单） ===== */
const scope = ref(isService.value ? 'all' : 'mine');
const scopeOptions = computed(() =>
  isService.value ? [{ label: '全部订单', value: 'all' }] : [
    { label: '我的订单', value: 'mine' },
    { label: '全部订单', value: 'all' },
  ]
);

/* ===== 筛选 ===== */
const filter = reactive({
  orderNo: '',
  thirdOrderNo: '',
  channel: '',
  status: '',
  auditStatus: '',
  attribute: '',
  orderType: '',
  claimer: '',
  clientType: '',
  tag: '',
  createTime: [],
});

const searchFields = [
  { prop: 'orderNo', label: '本平台订单号', type: 'input', placeholder: '请输入订单号', span: 4 },
  { prop: 'thirdOrderNo', label: '第三方订单号', type: 'input', placeholder: '请输入订单号', span: 4 },
  {
    prop: 'channel', label: '渠道', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...CHANNELS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'status', label: '订单状态', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...STATUS_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'auditStatus', label: '审核状态', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...AUDIT_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'attribute', label: '订单属性', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...ATTR_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'orderType', label: '订单类型', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...TYPE_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  { prop: 'claimer', label: '领取人', type: 'input', placeholder: '请输入领取人', span: 4 },
  {
    prop: 'clientType', label: '客户端', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...CLIENT_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'tag', label: '订单标签', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...TAG_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'createTime',
    label: '创建时间',
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    span: 4,
  },
];

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['orderNo', 'thirdOrderNo', 'channel', 'status', 'auditStatus', 'attribute', 'orderType', 'claimer', 'clientType', 'tag', 'createTime'],
});
restoreFilter(filter);

const baseRows = computed(() => {
  if (scope.value === 'mine') {
    return orderStore.orders.filter((o) => o.claimerName === CURRENT_USER.name);
  }
  return orderStore.orders;
});

const filteredRows = computed(() => {
  return baseRows.value.filter((row) => {
    const orderNoMatch = !filter.orderNo || row.orderNo === String(filter.orderNo).trim();
    const thirdMatch = !filter.thirdOrderNo || row.thirdOrderNo === String(filter.thirdOrderNo).trim();
    const channelMatch = !filter.channel || row.channel === filter.channel;
    const statusMatch = !filter.status || row.status === filter.status;
    const auditMatch = !filter.auditStatus || row.auditStatus === filter.auditStatus;
    const attrMatch = !filter.attribute || row.attribute === filter.attribute;
    const typeMatch = !filter.orderType || row.orderType === filter.orderType;
    const kw = String(filter.claimer || '').trim();
    const claimerMatch = !kw || row.claimerName === kw || row.claimerCorp === kw;
    const clientMatch = !filter.clientType || (row.clientType || []).includes(filter.clientType);
    const tagMatch = !filter.tag || (row.tags || []).includes(filter.tag);
    let timeMatch = true;
    if (Array.isArray(filter.createTime) && filter.createTime.length === 2 && filter.createTime[0]) {
      const start = new Date(filter.createTime[0]).getTime();
      const end = new Date(filter.createTime[1]).getTime();
      const t = new Date(row.createTime.replace(/-/g, '/')).getTime();
      timeMatch = t >= start && t <= end;
    }
    return (
      orderNoMatch && thirdMatch && channelMatch && statusMatch && auditMatch &&
      attrMatch && typeMatch && claimerMatch && clientMatch && tagMatch && timeMatch
    );
  });
});

const total = computed(() => filteredRows.value.length);
const rows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

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

/* ===== 表格列 ===== */
const columns = [
  { key: 'orderType', title: '订单类型' },
  { key: 'orderNo', title: '本平台订单号' },
  { key: 'thirdOrderNo', title: '第三方订单号' },
  { key: 'channel', title: '渠道' },
  { key: 'amount', title: '订单金额' },
  { key: 'product', title: '购买项目' },
  { key: 'gameName', title: '游戏名称' },
  { key: 'clientType', title: '客户端' },
  { key: 'spec', title: '游戏规格' },
  { key: 'roleName', title: '角色名' },
  { key: 'status', title: '订单状态' },
  { key: 'tags', title: '订单标签' },
  { key: 'auditStatus', title: '审核状态' },
  { key: 'attribute', title: '订单属性' },
  { key: 'claimer', title: '领取人' },
  { key: 'createTime', title: '创建时间' },
  { key: 'op', title: '操作' },
];

/* ===== 操作按钮可见规则（依据原型字段说明 + 角色权限：客服=除审核都可操作、审核员=仅有审核查看、管理员=所有按钮） ===== */
function canShow(row, action) {
  /* 角色维度 */
  if (action === '审核') return ['admin', 'audit'].includes(userRole.value) && row.auditStatus === '待审核';
  /* 查看：待接单、进行中、已完成、交易关闭下展示（原型操作按钮规则） */
  if (action === '查看') return ['待接单', '进行中', '已完成', '交易关闭'].includes(row.status);
  if (isAudit.value) return false; // 审核员除"审核/查看"外无其他操作按钮

  /* 状态维度 */
  switch (action) {
    case '编辑': return row.status === '待派单' || (row.status === '进行中' && row.auditStatus === '未提交');
    case '绑主单': return row.status === '待派单' && !row.bound;
    case '派单': return row.status === '待派单';
    case '加减价': return row.status === '待派单' && !row.refunded && !(row.tags || []).includes('部分退款');
    case '呼叫': return !['已完成', '交易关闭'].includes(row.status);
    case '解绑': return ['待派单', '进行中'].includes(row.status) && row.bound;
    case '冻结': return !['已完成', '交易关闭'].includes(row.status) && !row.frozen;
    case '解冻': return row.frozen;
    case '退款': return !row.refunded && ['进行中', '已完成', '交易关闭'].includes(row.status);
    case '转单': return row.status === '进行中';
    case '回退': return row.status === '待接单';
    default: return false;
  }
}

const TAG_CLASS_MAP = {
  呼叫: 'warn',
  卡单: 'warn',
  待发货: 'info',
  已发货: 'success',
  售后中: 'danger',
  部分退款: 'danger',
  冻结: 'muted',
  存单: 'purple',
  转单: 'purple',
};

function tagClass(tag) {
  return TAG_CLASS_MAP[tag] || 'info';
}

function statusText(row) {
  if (row.status === '待接单' && row.statusCount) return `${row.status}(${row.statusCount})`;
  return row.status;
}

/* ===== 详情 ===== */
const detailVisible = ref(false);
const detailRow = ref(null);

function openDetail(row) {
  detailRow.value = row;
  detailVisible.value = true;
}

/* ===== 编辑（依据原型：待派单/进行中-未提交展示；编辑表单含存单/二维码上传/复制） ===== */
const editVisible = ref(false);
const editRow = ref(null);
const editDialogRef = ref(null);

function openEdit(row) {
  editRow.value = row;
  editVisible.value = true;
}

function saveEdit(form) {
  const row = editRow.value;
  if (!row) return;
  Object.assign(row, {
    claimerName: form.claimerName,
    gameName: form.gameName,
    spec: form.spec,
    clientType: [...form.clientType],
    orderType: form.orderType,
    playerCount: Number(form.playerCount) || 0,
    roleName: form.roleName,
    groupCode: form.groupCode,
    remark: form.remark,
    qrImg: form.qrImg,
    depositTarget: form.depositTarget,
    depositReason: form.depositReason,
    depositFirst: form.depositFirst,
    depositSecond: form.depositSecond,
    depositImages: [...form.depositImages],
    depositRemark: form.depositRemark,
  });
  editVisible.value = false;
  show('保存成功', 'success');
}

/* ===== 新增订单 ===== */
const addVisible = ref(false);
const addForm = reactive({
  channel: '抖音',
  thirdOrderNo: '',
  amount: '',
  product: '',
  clientType: [],
  gameName: '',
  spec: '',
  orderType: '',
  playerCount: '',
});

function openAdd() {
  Object.assign(addForm, {
    channel: '抖音', thirdOrderNo: '', amount: '', product: '',
    clientType: [], gameName: '', spec: '', orderType: '', playerCount: '',
  });
  addVisible.value = true;
}

function submitAdd() {
  const { channel, thirdOrderNo, amount, product, clientType, gameName, spec } = addForm;
  if (!channel) return show('请选择所属渠道', 'warning');
  if (!thirdOrderNo.trim()) return show('请输入第三方订单号', 'warning');
  const amountNum = Number(amount);
  if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) return show('请输入正确的订单金额', 'warning');
  if (!product.trim()) return show('请输入购买项目', 'warning');
  if (product.trim().length > 50) return show('购买项目不能超过50字', 'warning');
  if (!clientType.length) return show('请选择客户端', 'warning');
  if (!gameName) return show('请选择游戏名称', 'warning');
  if (!spec) return show('请选择游戏规格', 'warning');

  const maxNo = orderStore.orders.reduce((max, o) => Math.max(max, Number(o.orderNo) || 0), 2455600);
  orderStore.orders.unshift({
    id: `ord-${Date.now()}`,
    orderNo: String(maxNo + 1),
    thirdOrderNo: thirdOrderNo.trim(),
    channel,
    amount: amountNum,
    product: product.trim(),
    gameName,
    spec,
    clientType: [...clientType],
    orderType: addForm.orderType || '常规单',
    claimerCorp: CURRENT_USER.corp,
    claimerName: CURRENT_USER.name,
    auditStatus: '-',
    attribute: '-',
    tags: [],
    roleName: '',
    groupCode: '',
    playerCount: addForm.playerCount ? Number(addForm.playerCount) : 0,
    statusCount: '',
    bound: false,
    mainOrderNo: '',
    frozen: false,
    refunded: false,
    rejectCount: 0,
    remark: '',
    status: '待派单',
    createTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
  });
  addVisible.value = false;
  show('新增成功', 'success');
}

/* ===== 查看关系 ===== */
const relationVisible = ref(false);
const relationRow = ref(null);
const relationData = ref({ main: null, children: [] });

function openRelation(row) {
  relationRow.value = row;
  relationData.value = getRelation(row);
  relationVisible.value = true;
}

const relationMainNo = computed(() => {
  const row = relationRow.value;
  if (!row) return '—';
  if (row.attribute === '子订单') return row.mainOrderNo || '—';
  if (relationData.value.main) return relationData.value.main.orderNo;
  return row.orderNo;
});

/* ===== 绑主单（待派单、未绑定；下拉选项：上行订单规格、下行订单编号） ===== */
const bindVisible = ref(false);
const bindRow = ref(null);
const bindForm = reactive({ mainOrderNo: '' });

/** 可选主单候选：进行中/待接单/待派单，排除自身与已是他人子单的订单（联调时由接口返回可绑定主单列表） */
const mainOptions = computed(() => {
  const self = bindRow.value;
  return orderStore.orders.filter((o) => {
    if (!self || o.orderNo === self.orderNo) return false;
    if (o.attribute === '子订单') return false;
    return ['待派单', '待接单', '进行中'].includes(o.status);
  });
});

function openBindMain(row) {
  bindRow.value = row;
  bindForm.mainOrderNo = '';
  bindVisible.value = true;
}

function submitBindMain() {
  const row = bindRow.value;
  if (!row) return;
  if (!bindForm.mainOrderNo) return show('请选择绑定主单', 'warning');
  const main = orderStore.orders.find((o) => o.orderNo === bindForm.mainOrderNo);
  if (!main) return;
  row.attribute = '子订单';
  row.mainOrderNo = main.orderNo;
  row.bound = true;
  main.bound = true;
  bindVisible.value = false;
  show('绑定成功', 'success');
}

/* ===== 派单 ===== */
const dispatchVisible = ref(false);
const dispatchRow = ref(null);
const dispatchForm = reactive({ dispatchType: '系统派单', club: '', players: [], remark: '' });

function openDispatch(row) {
  const missing = [];
  if (!row.gameName) missing.push('游戏名称');
  if (!row.orderType) missing.push('订单类型');
  if (!row.spec) missing.push('游戏规格');
  if (!row.playerCount) missing.push('打手人数');
  if (!row.clientType || !row.clientType.length) missing.push('客户端');
  if (!row.roleName) missing.push('角色名');
  if (missing.length) {
    show(`该订单尚未维护${missing.join('/')}`, 'warning');
    return;
  }
  dispatchRow.value = row;
  const count = Math.max(1, Number(row.playerCount) || 1);
  Object.assign(dispatchForm, {
    dispatchType: '系统派单',
    club: '',
    players: Array.from({ length: Math.min(count, 3) }, () => ''),
    remark: '',
  });
  dispatchVisible.value = true;
}

function submitDispatch() {
  const row = dispatchRow.value;
  if (!row) return;
  if (dispatchForm.dispatchType === '人工派单') {
    if (!dispatchForm.club) return show('请选择俱乐部', 'warning');
    const emptyIndex = dispatchForm.players.findIndex((p) => !p);
    if (emptyIndex > -1) return show(`请选择打手${emptyIndex + 1}`, 'warning');
  }
  row.status = '待接单';
  row.statusCount = `0/${row.playerCount || 1}`;
  dispatchVisible.value = false;
  show('派单成功', 'success');
}

/* ===== 加减价 ===== */
const priceVisible = ref(false);
const priceRow = ref(null);
const priceForm = reactive({ type: '加价', amount: '' });

function openPrice(row) {
  priceRow.value = row;
  Object.assign(priceForm, { type: '加价', amount: '' });
  priceVisible.value = true;
}

function submitPrice() {
  const row = priceRow.value;
  if (!row) return;
  const amount = Number(priceForm.amount);
  if (!priceForm.amount || !Number.isFinite(amount) || amount <= 0) {
    return show('请输入正确的金额', 'warning');
  }
  if (amount > Number(row.amount)) {
    return show(`${priceForm.type === '加价' ? '加' : '减'}：最多为订单总金额`, 'warning');
  }
  row.priceAdjust = { type: priceForm.type, amount };
  priceVisible.value = false;
  show('加减价成功', 'success');
}

/* ===== 呼叫 ===== */
const callVisible = ref(false);
const callRow = ref(null);
const callForm = reactive({ type: '订单原因', remark: '' });

function openCall(row) {
  callRow.value = row;
  Object.assign(callForm, { type: '订单原因', remark: '' });
  callVisible.value = true;
}

function submitCall() {
  const row = callRow.value;
  if (!row) return;
  if (!callForm.type) return show('请选择呼叫类型', 'warning');
  if (!(row.tags || []).includes('呼叫')) row.tags.push('呼叫');
  callVisible.value = false;
  show('呼叫成功', 'success');
}

/* ===== 解绑 ===== */
const unbindVisible = ref(false);
const unbindRow = ref(null);
const unbindOptions = ref([]);
const unbindSelected = ref([]);

function openUnbind(row) {
  unbindRow.value = row;
  const relation = getRelation(row);
  const options = [];
  if (row.attribute === '子订单' && row.mainOrderNo) {
    options.push({ no: row.mainOrderNo, label: '主订单' });
  }
  if (row.attribute === '主订单') {
    options.push({ no: row.orderNo, label: '主订单' });
  }
  relation.children.forEach((child) => {
    options.push({ no: child.orderNo, label: '子订单' });
  });
  unbindOptions.value = options;
  unbindSelected.value = [];
  unbindVisible.value = true;
}

function submitUnbind() {
  const row = unbindRow.value;
  if (!row) return;
  if (!unbindSelected.value.length) return show('请选择需要解绑的订单', 'warning');

  unbindSelected.value.forEach((no) => {
    const target = orderStore.orders.find((o) => o.orderNo === no);
    if (target) {
      target.bound = false;
      target.mainOrderNo = '';
    }
    if (row.orderNo === no) {
      row.bound = false;
      row.mainOrderNo = '';
    }
  });
  unbindVisible.value = false;
  show('解绑成功', 'success');
}

/* ===== 冻结 / 解冻 / 回退（二次确认） ===== */
async function freezeRow(row) {
  const ok = await confirm({ title: '冻结', message: `确定冻结订单 ${row.orderNo} 吗？冻结后打手无法操作该订单。`, okText: '确定' });
  if (!ok) return;
  row.frozen = true;
  if (!row.tags.includes('冻结')) row.tags.push('冻结');
  show('冻结成功', 'success');
}

async function unfreezeRow(row) {
  const ok = await confirm({ title: '解冻', message: `确定解冻订单 ${row.orderNo} 吗？`, okText: '确定' });
  if (!ok) return;
  row.frozen = false;
  const idx = row.tags.indexOf('冻结');
  if (idx > -1) row.tags.splice(idx, 1);
  show('解冻成功', 'success');
}

async function rollbackRow(row) {
  const ok = await confirm({ title: '回退', message: '进行二次确认，已接单人将被清除，订单回退为待派单。', okText: '确定' });
  if (!ok) return;
  row.status = '待派单';
  row.statusCount = '';
  show('回退成功', 'success');
}

/* ===== 退款 ===== */
const refundVisible = ref(false);
const refundRow = ref(null);
const refundForm = reactive({ amount: '' });

function openRefund(row) {
  refundRow.value = row;
  refundForm.amount = '';
  refundVisible.value = true;
}

function submitRefund() {
  const row = refundRow.value;
  if (!row) return;
  const amount = Number(refundForm.amount);
  if (!refundForm.amount || !Number.isFinite(amount) || amount <= 0) {
    return show('请输入正确的退款金额（大于0）', 'warning');
  }
  if (amount > Number(row.amount)) {
    return show('退款金额不能超过订单总金额', 'warning');
  }
  if (row.channel === '抖音') {
    return show('抖音订单不支持人工部分退款', 'warning');
  }
  row.refunded = true;
  row.refundAmount = amount;
  if (!row.tags.includes('部分退款')) row.tags.push('部分退款');
  refundVisible.value = false;
  show('退款成功', 'success');
}

/* ===== 转单 ===== */
const transferVisible = ref(false);
const transferRow = ref(null);
const transferForm = reactive({ deduct: '否', amount: '', target: '进入公共抢单大厅' });

function openTransfer(row) {
  transferRow.value = row;
  Object.assign(transferForm, { deduct: '否', amount: '', target: '进入公共抢单大厅' });
  transferVisible.value = true;
}

function submitTransfer() {
  const row = transferRow.value;
  if (!row) return;
  if (transferForm.deduct === '是') {
    const amount = Number(transferForm.amount);
    if (!transferForm.amount || !Number.isFinite(amount) || amount <= 0) {
      return show('请输入扣款金额（总数）', 'warning');
    }
  }
  if (!transferForm.target) return show('请选择转单类型', 'warning');
  row.status = '待接单';
  row.statusCount = `0/${row.playerCount || 1}`;
  if (!row.tags.includes('转单')) row.tags.push('转单');
  transferVisible.value = false;
  show('转单成功', 'success');
}

/* ===== 审核（信息展示 + 审核操作，由 AuditDialog 提交） ===== */
const auditVisible = ref(false);
const auditRow = ref(null);
const auditDialogRef = ref(null);

function openAudit(row) {
  auditRow.value = row;
  auditVisible.value = true;
}

function submitAudit({ result, reason }) {
  const row = auditRow.value;
  if (!row) return;
  if (result === '通过') {
    row.status = '已完成';
    row.auditStatus = '-';
    auditVisible.value = false;
    show('审核通过，订单已完成', 'success');
    return;
  }
  row.auditStatus = '已驳回';
  row.rejectCount = (row.rejectCount || 0) + 1;
  row.lastRejectReason = reason;
  if (row.rejectCount >= 2) {
    if (!row.tags.includes('冻结')) row.tags.push('冻结');
    show('审核已驳回，被驳回两次订单已自动冻结', 'warning');
  } else {
    show('已驳回', 'warning');
  }
  auditVisible.value = false;
}
</script>

<template>
  <div class="order-list-tab list-page">
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        :row-columns="4"
        :labelWidth="97"
        @search="handleSearch"
        @reset="handleReset"
      />
    </div>

    <DataTable
      class="list-panel"
      :columns="columns"
      :data="rows"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @page-change="onPageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #toolbar>
        <div class="toolbar-left">
          <!-- <h2 class="list-title">订单列表</h2> -->
          <div class="scope-switch">
            <button
              v-for="item in scopeOptions"
              :key="item.value"
              type="button"
              :class="['scope-btn', { active: scope === item.value }]"
              @click="scope = item.value; page = 1"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <button class="add-btn" @click="openAdd">新增</button>
      </template>

      <template #cell-orderType="{ row }">
        <span :class="['order-type-tag', { 'is-special': row.orderType === '特惠单' }]">{{ row.orderType || '常规单' }}</span>
      </template>

      <template #cell-channel="{ row }">
        <span class="channel-tag">{{ (row.channel || '抖').slice(0, 1) }}</span>
      </template>

      <template #cell-orderNo="{ row }">
        <span class="order-no-cell">
          <span v-if="row.orderType === '特惠单'" class="special-tag">特惠</span>
          <span>{{ row.orderNo }}</span>
        </span>
      </template>

      <template #cell-amount="{ row }">{{ money(row.amount) }}</template>

      <template #cell-clientType="{ row }">{{ row.clientType.length ? row.clientType.join('、') : '—' }}</template>

      <template #cell-status="{ row }">
        <div class="status-wrap">
          <span class="status-badge" :class="STATUS_CLASS[row.status] || 'status-info'">{{ statusText(row) }}</span>
          <span v-for="tag in row.tags" :key="tag" class="order-tag" :class="`tag-${tagClass(tag)}`">{{ tag }}</span>
        </div>
      </template>

      <template #cell-tags="{ row }">
        <div class="status-wrap">
          <span v-for="tag in row.tags" :key="tag" class="order-tag" :class="`tag-${tagClass(tag)}`">{{ tag }}</span>
          <span v-if="!row.tags?.length" class="muted-text">—</span>
        </div>
      </template>

      <template #cell-auditStatus="{ row }">
        <span class="status-badge" :class="AUDIT_CLASS[row.auditStatus] || 'status-muted'">{{ row.auditStatus }}</span>
      </template>

      <template #cell-attribute="{ row }">
        <div v-if="row.attribute !== '-'" class="attr-cell">
          <span>{{ row.attribute }}</span>
          <button class="link-btn" @click="openRelation(row)">查看关系</button>
        </div>
        <span v-else>—</span>
      </template>

      <template #cell-claimer="{ row }">
        <div class="claimer-cell">
          <span>企微名：{{ row.claimerCorp }}</span>
          <span>客服名：{{ row.claimerName }}</span>
        </div>
      </template>

      <template #cell-op="{ row }">
        <div class="action-group">
          <button v-if="canShow(row, '编辑')" class="link-btn" @click="openEdit(row)">编辑</button>
          <button v-if="canShow(row, '查看')" class="link-btn" @click="openDetail(row)">查看</button>
          <button v-if="canShow(row, '绑主单')" class="link-btn" @click="openBindMain(row)">绑主单</button>
          <button v-if="canShow(row, '派单')" class="link-btn primary" @click="openDispatch(row)">派单</button>
          <button v-if="canShow(row, '加减价')" class="link-btn" @click="openPrice(row)">加减价</button>
          <button v-if="canShow(row, '呼叫')" class="link-btn" @click="openCall(row)">呼叫</button>
          <button v-if="canShow(row, '解绑')" class="link-btn" @click="openUnbind(row)">解绑</button>
          <button v-if="canShow(row, '冻结')" class="link-btn warning" @click="freezeRow(row)">冻结</button>
          <button v-if="canShow(row, '解冻')" class="link-btn info" @click="unfreezeRow(row)">解冻</button>
          <button v-if="canShow(row, '退款')" class="link-btn danger" @click="openRefund(row)">退款</button>
          <button v-if="canShow(row, '审核')" class="link-btn primary" @click="openAudit(row)">审核</button>
          <button v-if="canShow(row, '转单')" class="link-btn" @click="openTransfer(row)">转单</button>
          <button v-if="canShow(row, '回退')" class="link-btn warning" @click="rollbackRow(row)">回退</button>
        </div>
      </template>
    </DataTable>

    <!-- <p class="perm-hint">仅管理员可编辑修改领取客服</p> -->

    <!-- 查看详情（只读） -->
    <AppModal v-model="detailVisible" :title="`${''} · 查看`" width="720px">
      <OrderDetailDialog v-if="detailRow" :row="detailRow" />
      <template #footer>
        <button class="btn btn-primary" @click="detailVisible = false">确定</button>
      </template>
    </AppModal>

    <!-- 编辑（待派单 / 进行中-未提交） -->
    <AppModal v-model="editVisible" :title="`${''} · 编辑`" width="760px">
      <OrderEditDialog v-if="editRow" ref="editDialogRef" :row="editRow" @save="saveEdit" />
      <template #footer>
        <button class="btn btn-plain" @click="editVisible = false">取消</button>
        <button class="btn btn-primary" @click="editDialogRef?.submit()">确定</button>
      </template>
    </AppModal>

    <!-- 新增订单 -->
    <AppModal v-model="addVisible" title="新增数据" width="520px">
      <div class="dialog-form">
        <div class="form-row">
          <label class="required">所属渠道</label>
          <el-select v-model="addForm.channel" style="width: 100%">
            <el-option v-for="item in CHANNELS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label class="required">第三方订单号</label>
          <input v-model="addForm.thirdOrderNo" placeholder="请输入第三方订单号" />
        </div>
        <div class="form-row">
          <label class="required">订单金额(元)</label>
          <input v-model="addForm.amount" type="number" step="0.01" min="0" placeholder="支持小数点后两位" />
        </div>
        <div class="form-row">
          <label class="required">购买项目</label>
          <input v-model="addForm.product" maxlength="50" placeholder="上限50字" />
        </div>
        <div class="form-row">
          <label class="required">客户端</label>
          <el-select v-model="addForm.clientType" multiple style="width: 100%" placeholder="支持多选">
            <el-option v-for="item in CLIENT_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label class="required">游戏名称</label>
          <el-select v-model="addForm.gameName" style="width: 100%" placeholder="请选择游戏">
            <el-option v-for="item in GAME_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label class="required">游戏规格</label>
          <el-select v-model="addForm.spec" style="width: 100%" placeholder="请选择规格">
            <el-option v-for="item in SPEC_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="form-row">
          <label>订单类型</label>
          <el-radio-group v-model="addForm.orderType">
            <el-radio v-for="item in TYPE_OPTIONS" :key="item" :value="item">{{ item }}</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label>打手人数</label>
          <input v-model="addForm.playerCount" type="number" min="0" step="1" placeholder="仅支持输入整数" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="addVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitAdd">确定</button>
      </template>
    </AppModal>

    <!-- 查看关系 -->
    <AppModal v-model="relationVisible" title="查看关系" width="480px">
      <div class="relation-dialog">
        <div class="relation-row">
          <span>主订单</span>
          <strong>{{ relationMainNo }}</strong>
        </div>
        <div class="relation-row">
          <span>子订单</span>
          <div class="relation-list">
            <strong v-for="child in relationData.children" :key="child.orderNo">{{ child.orderNo }}</strong>
            <span v-if="!relationData.children.length" class="muted-text">暂无子订单</span>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-primary" @click="relationVisible = false">确定</button>
      </template>
    </AppModal>

    <!-- 绑主单：当前订单只读；绑定主单必填，选项上行规格、下行订单号 -->
    <AppModal v-model="bindVisible" title="绑主单" width="480px">
      <div class="dialog-form">
        <div class="form-row">
          <label>当前订单</label>
          <strong class="readonly-value">{{ bindRow?.orderNo || '—' }}</strong>
        </div>
        <div class="form-row">
          <label class="required">绑定主单</label>
          <el-select v-model="bindForm.mainOrderNo" placeholder="请选择主订单" style="width: 100%" filterable>
            <el-option v-for="opt in mainOptions" :key="opt.orderNo" :value="opt.orderNo" :label="`${opt.spec || '未维护规格'} ${opt.orderNo}`">
              <div class="bind-option">
                <span class="bind-option__spec">{{ opt.spec || '未维护规格' }}</span>
                <span class="bind-option__no">{{ opt.orderNo }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="bindVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitBindMain">确定</button>
      </template>
    </AppModal>

    <!-- 派单 -->
    <AppModal v-model="dispatchVisible" title="派单" width="520px">
      <div class="dialog-form">
        <div class="form-row">
          <label>接单人数</label>
          <strong>{{ dispatchRow?.playerCount ? `${dispatchRow.playerCount}人` : '未维护' }}</strong>
        </div>
        <div class="form-row">
          <label>派单类型</label>
          <el-radio-group v-model="dispatchForm.dispatchType">
            <el-radio value="系统派单">系统派单</el-radio>
            <el-radio value="人工派单">人工派单</el-radio>
          </el-radio-group>
        </div>
        <template v-if="dispatchForm.dispatchType === '人工派单'">
          <div class="form-row">
            <label class="required">选择俱乐部</label>
            <el-select v-model="dispatchForm.club" placeholder="请选择俱乐部" style="width: 100%">
              <el-option v-for="item in CLUB_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </div>
          <div v-for="(_, index) in dispatchForm.players" :key="index" class="form-row">
            <label class="required">打手{{ index + 1 }}</label>
            <el-select v-model="dispatchForm.players[index]" placeholder="请选择打手" style="width: 100%">
              <el-option v-for="item in PLAYER_OPTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </div>
          <!-- <p class="form-tip">
            人工派单：1、平台只派到俱乐部维度；2、订单超过卡单时长，不退回到抢单大厅，还在该俱乐部下；3、退店状态、不符合游戏规格条件的俱乐部不支持选择。
          </p> -->
        </template>
        <div class="form-row">
          <label>备注</label>
          <textarea v-model="dispatchForm.remark" rows="3" maxlength="200" placeholder="请输入备注"></textarea>
          <div class="char-count">{{ dispatchForm.remark.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="dispatchVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitDispatch">确定</button>
      </template>
    </AppModal>

    <!-- 加减价 -->
    <AppModal v-model="priceVisible" title="加减价" width="440px">
      <div class="dialog-form">
        <!-- <p class="form-tip">待派单状态下可修改；注意部分退款不支持加减价。</p> -->
        <div class="form-row">
          <label class="required">选择加减价</label>
          <el-radio-group v-model="priceForm.type">
            <el-radio value="加价">加价</el-radio>
            <el-radio value="减价">减价</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label class="required">金额(元)</label>
          <input v-model="priceForm.amount" type="number" step="0.01" min="0" placeholder="仅支持正数，最多两位小数" />
        </div>
        <!-- <p class="form-tip">加：最多为订单总金额　减：最多为订单总金额</p> -->
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="priceVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitPrice">确定</button>
      </template>
    </AppModal>

    <!-- 呼叫 -->
    <AppModal v-model="callVisible" title="呼叫" width="440px">
      <div class="dialog-form">
        <div class="form-row">
          <label class="required">类型</label>
          <el-select v-model="callForm.type" style="width: 100%">
            <el-option v-for="item in CALL_TYPE_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <!-- <p class="form-tip">类型包含：1、订单原因　2、老板投诉　3、打手问题　4、技术问题　5、其他</p> -->
        <div class="form-row">
          <label>备注</label>
          <textarea v-model="callForm.remark" rows="3" maxlength="200" placeholder="请输入备注"></textarea>
          <div class="char-count">{{ callForm.remark.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="callVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitCall">确定</button>
      </template>
    </AppModal>

    <!-- 解绑 -->
    <AppModal v-model="unbindVisible" title="解绑" width="520px">
      <div class="dialog-form">
        <div class="form-row">
          <label>选择要解绑的订单</label>
          <el-checkbox-group v-model="unbindSelected" class="checkbox-col">
            <el-checkbox v-for="opt in unbindOptions" :key="opt.no" :value="opt.no">
              {{ opt.label }}：{{ opt.no }}（当前订单号：{{ unbindRow?.orderNo }}）
            </el-checkbox>
          </el-checkbox-group>
        </div>
        <!-- <p class="form-tip">解绑弹框中，在对应的订单号后面拼上当前订单号（告知操作人当前订单是哪个）。</p> -->
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="unbindVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitUnbind">确定</button>
      </template>
    </AppModal>

    <!-- 退款 -->
    <AppModal v-model="refundVisible" title="退款" width="440px">
      <div class="dialog-form">
        <div class="form-row">
          <label>订单金额(元)</label>
          <strong>{{ refundRow ? money(refundRow.amount) : '—' }}</strong>
        </div>
        <div v-if="refundRow?.refunded" class="form-row">
          <label>原金额(元)</label>
          <strong>{{ money(refundRow.amount + (refundRow.refundAmount || 0)) }}</strong>
        </div>
        <div v-if="refundRow?.refunded" class="form-row">
          <label>部分退款金额(元)</label>
          <strong>{{ money(refundRow.refundAmount || 0) }}</strong>
        </div>
        <div class="form-row">
          <label class="required">退款金额</label>
          <div class="amount-input">
            <input v-model="refundForm.amount" type="number" step="0.01" min="0" placeholder="0＜退款金额≤订单总金额" />
            <span>元</span>
          </div>
        </div>
        <!-- <p class="form-tip">一笔订单仅支持退款一次；涉及部分退款时加减价失效；抖音订单不支持人工部分退款。</p> -->
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="refundVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitRefund">确定</button>
      </template>
    </AppModal>

    <!-- 转单 -->
    <AppModal v-model="transferVisible" title="转单" width="480px">
      <div class="dialog-form">
        <div class="form-row">
          <label class="required">是否扣款</label>
          <el-radio-group v-model="transferForm.deduct">
            <el-radio value="是">是</el-radio>
            <el-radio value="否">否</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label :class="{ required: transferForm.deduct === '是' }">扣款金额(总数)</label>
          <input
            v-model="transferForm.amount"
            type="number"
            step="0.01"
            min="0"
            :disabled="transferForm.deduct === '否'"
            placeholder="若多人订单，此处为总值"
          />
        </div>
        <div class="form-row">
          <label class="required">选择转单类型</label>
          <el-radio-group v-model="transferForm.target">
            <el-radio value="进入公共抢单大厅">进入公共抢单大厅</el-radio>
            <el-radio value="进入当前俱乐部">进入当前俱乐部</el-radio>
          </el-radio-group>
        </div>
        <!-- <p class="form-tip">订单重新转为待接单状态；进入公共抢单 → 公共抢单大厅；进入当前俱乐部 → 当前俱乐部抢单大厅；需要打上标签。</p> -->
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="transferVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitTransfer">确定</button>
      </template>
    </AppModal>

    <!-- 审核（分润信息/日志/凭证 + 审核操作） -->
    <AppModal v-model="auditVisible" title="审核" width="620px">
      <AuditDialog v-if="auditRow" ref="auditDialogRef" :row="auditRow" @submit="submitAudit" />
      <template #footer>
        <button class="btn btn-plain" @click="auditVisible = false">取消</button>
        <button class="btn btn-primary" @click="auditDialogRef?.submit()">确定</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
/* .order-list-tab {
  gap: 12px;
} */

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.scope-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
}

.scope-btn {
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 6px 14px;
  background: transparent;
  color: var(--text-sub);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.scope-btn:hover {
  color: var(--primary);
  background: var(--bg-hover);
}

.scope-btn.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  font-weight: 700;
  box-shadow: 0 6px 14px var(--primary-glow-strong);
}

.add-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 20px;
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 20px var(--primary-glow-strong);
  transition: filter 0.18s ease, box-shadow 0.18s ease;
}

.add-btn:hover {
  filter: brightness(1.08);
  box-shadow: 0 14px 26px var(--primary-glow-strong);
}

.order-no-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.special-tag {
  padding: 2px 6px;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff8a65, #ff5a5f);
  color: var(--text-invert);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
}

/* 订单类型列 */
.order-type-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-sub);
  background: var(--bg-hover);
}

.order-type-tag.is-special {
  color: #ff5a5f;
  background: rgba(255, 90, 95, 0.1);
}

/* 渠道首字标签 */
.channel-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--primary-faint);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}

.readonly-value {
  font-size: 13px;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
}

/* 绑主单下拉选项：上行规格、下行订单号 */
.bind-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
  line-height: 1.4;
}

.bind-option__spec {
  font-size: 13px;
  color: var(--text-main);
}

.bind-option__no {
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.muted-text {
  color: var(--text-faint);
  font-size: 12px;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.status-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.status-success { color: #0f9f6e; background: rgba(15, 159, 110, 0.08); }
.status-warning { color: #b45309; background: rgba(180, 83, 9, 0.08); }
.status-info { color: #1d4ed8; background: rgba(29, 78, 216, 0.08); }
.status-danger { color: #d92d20; background: rgba(217, 45, 32, 0.08); }
.status-muted { color: #475467; background: rgba(71, 84, 103, 0.08); }

.order-tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  white-space: nowrap;
}

.tag-warn { color: #b45309; background: rgba(245, 158, 11, 0.12); }
.tag-info { color: #1d4ed8; background: rgba(59, 130, 246, 0.12); }
.tag-success { color: #0f9f6e; background: rgba(15, 159, 110, 0.1); }
.tag-danger { color: #d92d20; background: rgba(217, 45, 32, 0.1); }
.tag-muted { color: #475467; background: rgba(71, 84, 103, 0.1); }
.tag-purple { color: var(--primary); background: var(--primary-faint); }

.attr-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.claimer-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--text-main);
  line-height: 1.5;
  white-space: nowrap;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 4px 10px;
  flex-wrap: nowrap;
  min-width: max-content;
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.link-btn:hover {
  background: var(--primary-faint);
}

.link-btn.primary {
  color: var(--primary);
  font-weight: 600;
}

.link-btn.danger { color: #d92d20; }
.link-btn.danger:hover { background: rgba(217, 45, 32, 0.08); }
.link-btn.warning { color: #d97706; }
.link-btn.warning:hover { background: rgba(217, 119, 6, 0.08); }
.link-btn.info { color: #1d4ed8; }
.link-btn.info:hover { background: rgba(29, 78, 216, 0.08); }

.perm-hint {
  flex: 0 0 auto;
  margin: 0;
  text-align: right;
  font-size: 12px;
  color: #8a93a6;
}

/* ===== 弹窗通用 ===== */
.dialog-form {
  display: grid;
  gap: 16px;
}

.form-row {
  display: grid;
  gap: 8px;
}

.form-row label {
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.form-row label.required::before {
  content: '*';
  color: #f04438;
  margin-right: 4px;
}

.form-row input,
.form-row textarea {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  color: var(--text-main);
  box-sizing: border-box;
  background: var(--input-bg);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.form-row input:focus,
.form-row textarea:focus {
  border-color: var(--primary);
  outline: none;
  background: var(--input-bg-focus);
  box-shadow: 0 0 0 4px var(--input-focus-ring);
}

.form-row textarea {
  resize: vertical;
  min-height: 76px;
}

/* 弹窗内 el-select 与原生输入框统一圆角/内边距/高度，多选框随内容增高 */
.dialog-form :deep(.el-select) {
  width: 100%;
}

.dialog-form :deep(.el-select__wrapper) {
  min-height: 42px;
  border-radius: 12px !important;
  padding: 4px 14px;
  align-items: center;
}

.dialog-form :deep(.el-select:not(.is-multiple) .el-select__wrapper) {
  height: 42px !important;
  line-height: 34px;
}

/* 单选组：横向均匀排布、与控件基线对齐 */
.dialog-form :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 22px;
  min-height: 30px;
}

.dialog-form :deep(.el-radio) {
  margin-right: 0;
  height: 30px;
}

.amount-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.amount-input span {
  color: var(--text-sub);
  font-size: 13px;
}

.char-count {
  text-align: right;
  color: var(--text-faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.form-tip {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(250, 204, 21, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.28);
  color: var(--warning-text);
  font-size: 12px;
  line-height: 1.8;
}

.muted-text {
  color: var(--text-faint);
}

.checkbox-col {
  display: grid;
  gap: 6px;
}

.checkbox-col :deep(.el-checkbox) {
  height: auto;
  margin-right: 0;
  white-space: normal;
}

/* ===== 查看关系 ===== */
.relation-dialog {
  display: grid;
  gap: 14px;
}

.relation-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.relation-row > span {
  flex: 0 0 70px;
  color: var(--text-sub);
  font-size: 13px;
  font-weight: 600;
}

.relation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.relation-list strong {
  padding: 4px 12px;
  border-radius: 8px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

/* ===== 底部按钮 ===== */
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
  background: var(--border-faint);
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
