<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DataTable from '../../../components/DataTable.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import AppModal from '../../../components/AppModal.vue';
import { useConfirm } from '../../../composables/useConfirm';
import { useToast } from '../../../composables/useToast';
import { useListMemory } from '../../../composables/useListMemory';
import { useUserStore } from '../../../stores/user';
import {
  orderApi,
  STATUS_OPTIONS,
  AUDIT_OPTIONS,
  TYPE_OPTIONS,
  statusText,
  auditText,
  attributeText,
  typeText,
} from '../../../api/modules/order';
import { gameApi } from '../../../api/modules/game';
import { channelApi } from '../../../api/modules/channel';
import { clubApi } from '../../../api/modules/club';
import { playerApi } from '../../../api/modules/player';
import { handoverApi } from '../../../api/modules/handover';
import OrderDetailDialog from './OrderDetailDialog.vue';
import OrderEditDialog from './OrderEditDialog.vue';
import AuditDialog from './AuditDialog.vue';
import {
  ATTR_OPTIONS,
  TAG_OPTIONS,
  STATUS_CLASS,
  AUDIT_CLASS,
  CALL_TYPE_OPTIONS,
  CLIENT_OPTIONS,
} from './mockData';

/**
 * 订单列表（管理端）接口联调（依据最新 OpenAPI 2026-10-20）
 * - 我的订单 / 全部订单：两个接口切换（orderApi.mine / orderApi.all，内部 scope=MINE/ALL），
 *   后续统一为 orderApi.list({ scope, ...params })（见 order.js 顶部 TODO）
 * - 权限（原型标注：仅客服角色有「我的订单/全部订单」切换；管理员、审核员看到的全是全部订单；
 *   领取人/所属客服仅管理员可在列表「领取人」列行内修改：铅笔 → 独立弹窗走 PUT /{id}/owner，不在编辑弹窗编辑）
 * - 鉴权：Bearer token 由 request.js 自动附加；ownerId/ownerName 仅 scope=ALL 时有效
 * - 新 OpenAPI 已支持（已接入）：筛选参数 attribute(MAIN/SUB)/tag/clients(PC/MOBILE)/ownerName、
 *   status 枚举含 WAIT_CLAIM、列表/详情返回 teamCode（组队码）与 statusCounts（状态计数）、
 *   maintain 支持 teamCode、call body 支持 type 英文枚举、create body 支持 orderType/playerCount、
 *   游戏/规格 GET /games + /games/{id}/specs
 * - 已补齐接入（后端已返回）：指派打手 POST /api/admin/orders/{id}/assignments（管理端路径，slots 结构不变）、
 *   订单分润明细 POST /api/admin/orders/{id}/profit-details（详情/审核弹窗已接）、
 *   订单详情扩展字段 refunded/children/parentOrderNo/hold（存单）/coverUrl/endUrl/progressUrls（凭证）/
 *   playerRemark（陪玩备注）/roleName/gameName/specName/canChangeOwner 等已映射并展示，
 *   可绑主单候选 GET /orders/bindable-parents、批量解绑 POST /orders/unbind、回退 POST /orders/{id}/rollback
 * - 仍缺（保留原型 UI/兜底）：编辑存单 hold 独立入口、交易关闭 close 按钮（原型未要求，未擅自加）；
 * - 订单类型 orderType（后端确认 2026-10-22）：新增/筛选/编辑统一规范码 NORMAL/DISCOUNT（特惠单=DISCOUNT）；
 *   SPECIAL 仅为历史兼容码（编辑接口仍收，历史订单回显用，前端 ORDER_TYPE 已含 DISCOUNT/SPECIAL）
 */
const { confirm } = useConfirm();
const { show } = useToast();
const userStore = useUserStore();

const money = (value) => (Number(value) || 0).toFixed(2);

/** 当前登录角色（客服 service / 审核员 audit / 管理员 admin） */
const userRole = computed(() => userStore.role || 'admin');
const isService = computed(() => userRole.value === 'service');
const isAudit = computed(() => userRole.value === 'audit');
const isAdmin = computed(() => userRole.value === 'admin');

/* ===== 我的订单 / 全部订单（原型标注：仅客服角色有切换；管理员、审核员看到的全是全部订单） ===== */
const scope = ref(isService.value ? 'mine' : 'all');
const scopeOptions = computed(() =>
  isService.value ? [
    { label: '我的订单', value: 'mine' },
    { label: '全部订单', value: 'all' },
  ] : [{ label: '全部订单', value: 'all' }]
);

function switchScope(value) {
  scope.value = value;
  page.value = 1;
  fetchList();
}

/* ===== 筛选（接口已支持的参数参与服务端查询；未提供的原型筛选字段保留 UI，暂不参与查询） ===== */
const filter = reactive({
  orderNo: '',
  thirdOrderNo: '',
  channel: '', // channelCode
  status: '',
  auditStatus: '',
  attribute: '', // 主订单/子订单（新 OpenAPI 已支持 attribute=MAIN/SUB）
  orderType: '',
  claimer: '', // 领取人姓名/企微（新 OpenAPI 已支持 ownerName 模糊，仅 scope=ALL 有效）
  ownerId: '', // 领取人账号ID（接口参数，仅 scope=ALL 有效）
  clientType: '', // 客户端（新 OpenAPI 已支持 clients=PC/MOBILE，原型中文做映射）
  tag: '', // 订单标签（新 OpenAPI 已支持 tag=CALL/STUCK 等，原型中文做映射）
  createTime: [],
});

const searchFields = computed(() => [
  { prop: 'orderNo', label: '本平台订单号', type: 'input', placeholder: '请输入订单号（完全匹配）', span: 4 },
  { prop: 'thirdOrderNo', label: '第三方订单号', type: 'input', placeholder: '请输入订单号（完全匹配）', span: 4 },
  {
    prop: 'channel', label: '渠道', type: 'select', placeholder: '全部', span: 4,
    options: filterChannelOptions.value, // 真实渠道接口动态加载（含抖音；无任何本地硬编码渠道）
  },
  {
    prop: 'status', label: '订单状态', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...STATUS_OPTIONS],
  },
  {
    prop: 'auditStatus', label: '审核状态', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...AUDIT_OPTIONS],
  },
  {
    prop: 'attribute', label: '订单属性', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...ATTR_OPTIONS.map((item) => ({ label: item, value: item }))],
  },
  {
    prop: 'orderType', label: '订单类型', type: 'select', placeholder: '全部', span: 4,
    options: [{ label: '全部', value: '' }, ...TYPE_OPTIONS],
  },
  { prop: 'claimer', label: '领取人', type: 'input', placeholder: '请输入领取人（企微名/客服名）', span: 4 },
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
    shortcuts: [
      { text: '今天', value: () => { const d = new Date(); return [d, d]; } },
      { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [start, end]; } },
      { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [start, end]; } },
    ],
  },
]);

const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
  filterKeys: ['orderNo', 'thirdOrderNo', 'channel', 'status', 'auditStatus', 'attribute', 'orderType', 'claimer', 'ownerId', 'clientType', 'tag', 'createTime'],
});
restoreFilter(filter);

// 支持外部跳转定位（如收益明细/提现明细点击"关联订单号"）：URL 带 ?orderNo= 时预填筛选，onMounted 首次查询自动带上该参数
const route = useRoute();
const routeOrderNo = route.query.orderNo;
if (routeOrderNo) filter.orderNo = String(routeOrderNo);

/* ===== 游戏/规格目录（供下拉选择与列表展示；规格 id 取真实接口 GET /games/{id}/specs，新增/编辑提交真实 specId） ===== */
const catalog = ref([]); // [{ id, name, specs: [{ id, name }] }]
const catalogLoaded = ref(false);

async function loadCatalog() {
  if (catalogLoaded.value) return;
  try {
    const games = await gameApi.listAll(); // 真实游戏列表 [{ id, name }]（服务端分页接口取全量）
    const list = await Promise.all(
      (games || []).map(async (game) => {
        let specs = [];
        try {
          specs = await gameApi.specs(game.id); // 真实规格列表 [{ id, name }]
        } catch {
          specs = [];
        }
        return { id: game.id, name: game.name, specs: specs.map((s) => ({ id: s.id, name: s.name })) };
      })
    );
    catalog.value = list;
  } catch {
    catalog.value = [];
  } finally {
    catalogLoaded.value = true;
  }
}

const gameOptions = computed(() => catalog.value.map((g) => ({ label: g.name, value: g.id })));

function specOptionsOf(gameId) {
  const game = catalog.value.find((g) => g.id === Number(gameId));
  return game ? game.specs.map((s) => ({ label: s.name, value: s.id })) : [];
}

function gameNameOf(gameId) {
  const game = catalog.value.find((g) => g.id === Number(gameId));
  return game ? game.name : '—';
}

function specNameOf(gameId, specId) {
  const game = catalog.value.find((g) => g.id === Number(gameId));
  const spec = game && game.specs.find((s) => s.id === Number(specId));
  return spec ? spec.name : '—';
}

/* ===== 列表数据（服务端分页/筛选） ===== */
const rows = ref([]);
const total = ref(0);
const loading = ref(false);

/**
 * 后端订单标签枚举 → 中文（列表/详情已返回；新 OpenAPI 枚举：
 * CALL/STUCK/WAIT_SHIP/SHIPPED/AFTER_SALE/FROZEN/TRANSFER/PARTIAL_REFUND/REFUNDED）
 */
const TAG_TEXT = {
  CALL: '呼叫',
  STUCK: '卡单',
  WAIT_SHIP: '待发货',
  SHIPPED: '已发货',
  AFTER_SALE: '售后中',
  FROZEN: '冻结',
  TRANSFER: '转单',
  PARTIAL_REFUND: '部分退款',
  REFUNDED: '已退款',
};

/** 中文标签 → 后端枚举（筛选参数 tag 用） */
const TAG_ENUM = Object.fromEntries(Object.entries(TAG_TEXT).map(([k, v]) => [v, k]));

/** 订单属性：原型中文 → 后端枚举（attribute=MAIN/SUB） */
const ATTR_ENUM = { 主订单: 'MAIN', 子订单: 'SUB' };

/** 客户端：原型中文 → 后端枚举（clients=PC/MOBILE；后端也接受自由字符串） */
const CLIENT_ENUM = { 端游: 'PC', 手游: 'MOBILE' };

/** 合并接口 tags 与派生标签（冻结/售后中/存单——存单由 hold.stored 派生，原型列表"存单"标签） */
function mapTags(item = {}) {
  const tags = new Set((item.tags || []).map((t) => TAG_TEXT[t] || t));
  if (Number(item.frozen) === 1) tags.add('冻结');
  if (Number(item.afterSaleFlag) === 1) tags.add('售后中');
  if (item.hold && item.hold.stored) tags.add('存单');
  return Array.from(tags);
}

/**
 * 后端列表字段 → 页面展示字段。
 * 接口已返回：parentOrderId（主子单列）、tags、createdAt 等；
 * 仍未返回的原型字段（组队码/存单/凭证等）兜底注入，待后端补充接口后自动有数据。
 */
function mapOrderRow(item = {}) {
  return {
    id: item.id,
    orderNo: item.orderNo || '',
    thirdOrderNo: item.thirdOrderNo || '',
    channel: channelDisplayName(item.channelCode),
    channelCode: item.channelCode,
    amount: Number(item.amount) || 0,
    product: item.itemName || '',
    gameName: item.gameName || gameNameOf(item.gameId), // 详情接口直接返回游戏名；列表无则目录反查
    gameId: item.gameId,
    spec: item.specName || specNameOf(item.gameId, item.specId), // 详情接口直接返回规格名
    specId: item.specId,
    clients: item.clients || '',
    status: statusText(item.status),
    statusCode: item.status,
    preStatus: item.preStatus,
    auditStatus: auditText(item.auditStatus),
    auditCode: item.auditStatus,
    claimerName: item.ownerName || '',
    claimerCorp: item.ownerWecomName || '',
    ownerAccountId: item.ownerAccountId,
    tags: mapTags(item),
    frozen: Number(item.frozen) === 1,
    afterSale: Number(item.afterSaleFlag) === 1,
    createTime: item.createdAt || '',
    orderType: typeText(item.orderType),
    orderTypeCode: item.orderType,
    /* ---- 接口已返回（后端已补齐） ---- */
    roleName: item.roleName || '',
    /* teamCode（组队码）：列表/详情已返回 */
    groupCode: item.teamCode || item.groupCode || '',
    /* 主子单：接口返回 MAIN/SUB（英文），attributeText 转中文；parentOrderId 兜底判断 */
    attribute: item.attribute ? attributeText(item.attribute) : (item.parentOrderId ? '子订单' : '—'),
    bound: !!item.parentOrderId,
    mainOrderId: item.parentOrderId,
    mainOrderNo: item.parentOrderNo || (item.parentOrderId ? String(item.parentOrderId) : ''),
    children: item.children || [], // [{ id, orderNo }]
    refunded: !!item.refunded, // 退款标记（接口已返回）
    partialRefunded: Number(item.partialRefunded) === 1,
    groupQrUrl: item.groupQrUrl || '', // 企业群二维码
    /* 存单（hold 对象：form/stored/warrantyTarget/reason/rounds/shots/doneAmount/remainAmount/remark） */
    hold: item.hold || null,
    depositTarget: item.hold && item.hold.warrantyTarget != null ? String(item.hold.warrantyTarget) : (item.depositTarget || ''),
    depositReason: (item.hold && item.hold.reason) || item.depositReason || '',
    depositFirst: item.hold && item.hold.rounds && item.hold.rounds[0] != null ? String(item.hold.rounds[0]) : (item.depositFirst || ''),
    depositSecond: item.hold && item.hold.rounds && item.hold.rounds[1] != null ? String(item.hold.rounds[1]) : (item.depositSecond || ''),
    depositImages: (item.hold && item.hold.shots) || item.depositImages || [],
    depositRemark: (item.hold && item.hold.remark) || item.depositRemark || '',
    depositStored: item.hold ? !!item.hold.stored : false,
    /* 完成凭证：coverUrl 首图 / endUrl 尾图 / progressUrls 进程图（接口已返回） */
    proofFirst: item.coverUrl || '',
    proofLast: item.endUrl || '',
    proofProcess: item.progressUrls || [],
    proofUploadTime: item.proofUploadTime || '',
    playerRemark: item.playerRemark || '',
    lastRejectReason: item.rejectReason || item.lastRejectReason || '',
    /* 待接单名额数（原型：待接单(1/2) = 当前接单/总数）：列表返回 takenCount/playerCount 时自动拼，未返回则留空 */
    playerCount: item.playerCount,
    takenCount: item.takenCount,
    assignedPlayerCount: item.assignedPlayerCount,
    statusCount: item.takenCount != null && item.playerCount != null ? `${item.takenCount}/${item.playerCount}` : '',
  };
}

const fmtDay = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** 时间筛选传参：yyyy-MM-ddTHH:mm:ss（后端只接受 yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss，空格分隔会报 400） */
const fmtDateTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

function buildParams() {
  const [fromDay, toDay] = Array.isArray(filter.createTime) ? filter.createTime : [];
  const params = {
    page: page.value,
    pageSize: pageSize.value,
    orderNo: String(filter.orderNo || '').trim(),
    thirdOrderNo: String(filter.thirdOrderNo || '').trim(),
    channelCode: filter.channel,
    status: filter.status,
    auditStatus: filter.auditStatus,
    orderType: filter.orderType,
    from: fmtDateTime(fromDay),
    to: fmtDateTime(toDay),
  };
  // ownerId/ownerName 仅 scope=ALL 时有效（新 OpenAPI）
  if (scope.value === 'all' && filter.ownerId !== '' && filter.ownerId !== null && filter.ownerId !== undefined) {
    const n = Number(filter.ownerId);
    if (Number.isFinite(n) && n > 0) params.ownerId = n;
  }
  if (scope.value === 'all' && String(filter.claimer || '').trim()) {
    params.ownerName = String(filter.claimer).trim(); // 客服姓名/企微模糊
  }
  // 订单属性/标签/客户端：新 OpenAPI 已支持，原型中文做枚举映射后参与查询
  const attrEnum = ATTR_ENUM[filter.attribute];
  if (attrEnum) params.attribute = attrEnum;
  const tagEnum = TAG_ENUM[filter.tag];
  if (tagEnum) params.tag = tagEnum;
  const clientEnum = CLIENT_ENUM[filter.clientType];
  if (clientEnum) params.clients = clientEnum;
  return params;
}

async function fetchList() {
  loading.value = true;
  try {
    // 我的订单/全部订单：两个接口切换（mine/all），后续统一为 orderApi.list({ scope }) 查询方式
    const res = scope.value === 'mine' ? await orderApi.mine(buildParams()) : await orderApi.all(buildParams());
    rows.value = ((res && res.list) || []).map(mapOrderRow);
    total.value = (res && res.total) || 0;
  } catch {
    rows.value = [];
    total.value = 0;
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

onMounted(async () => {
  await loadCatalog();
  await loadChannels(); // 渠道映射就绪后再拉列表（列表渠道列回显渠道名称，非写死编码映射）
  fetchList();
});

/* ===== 表格列（依据原型列顺序：本平台订单号/第三方订单号/订单金额（元）/购买项目/游戏名称/客户端/游戏规格/角色名/订单状态/审核状态/订单属性/领取人/创建时间/操作；标签并入订单状态列） ===== */
const columns = [
  { key: 'orderType', title: '订单类型' },
  { key: 'orderNo', title: '本平台订单号' },
  { key: 'thirdOrderNo', title: '第三方订单号' },
  { key: 'amount', title: '订单金额（元）' },
  { key: 'product', title: '购买项目' },
  { key: 'gameName', title: '游戏名称' },
  { key: 'clientType', title: '客户端' },
  { key: 'spec', title: '游戏规格' },
  { key: 'roleName', title: '角色名' },
  { key: 'status', title: '订单状态' },
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
  /* 查看：待接单、进行中（审核已提交，未提交时由编辑代替）、已完成、交易关闭下展示（原型图） */
  if (action === '查看')
    return (
      ['待接单', '已完成', '交易关闭'].includes(row.status) ||
      (row.status === '进行中' && row.auditStatus !== '未提交')
    );
  if (isAudit.value) return false; // 审核员除"审核/查看"外无其他操作按钮

  /* 状态维度（bound/refunded 接口暂未返回，待后端补充后自动收紧） */
  switch (action) {
    case '编辑': return row.status === '待派单' || (row.status === '进行中' && row.auditStatus === '未提交');
    case '绑主单': return row.status === '待派单' && !row.bound;
    case '派单': return ['待派单', '待接单'].includes(row.status);
    case '加减价': return row.status === '待派单' && !row.refunded && !(row.tags || []).includes('部分退款');
    case '呼叫': return !['已完成', '交易关闭'].includes(row.status);
    case '解绑': return ['待派单', '进行中'].includes(row.status) && row.bound;
    case '冻结': return !['已完成', '交易关闭'].includes(row.status) && !row.frozen;
    case '解冻': return row.frozen;
    /* 退款：原型「仅冻结后展示，点击后输入退款金额」；抖音订单不支持人工部分退款（提交时校验） */
    case '退款': return row.frozen && !row.refunded;
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

/** 待接单订单带名额数展示：待接单(0/N)（statusCount 聚合字段接口待补充，兜底为空） */
function displayStatus(row) {
  if (row.status === '待接单' && row.statusCount) return `${row.status}(${row.statusCount})`;
  return row.status;
}

/* ===== 详情（接口：GET /{id} + GET /{id}/logs） ===== */
const detailVisible = ref(false);
const detailRow = ref(null);
const detailLogs = ref([]);

function mapDetail(item = {}) {
  return {
    // 复用列表行映射：hold（存单）/coverUrl/endUrl/progressUrls（凭证）/refunded/children/
    // parentOrderNo/playerRemark/rejectReason/游戏名/规格名 等后端已补齐字段直接可用
    ...mapOrderRow(item),
    // 详情专属字段
    shopId: item.shopId || '',
    refundedAmount: Number(item.refundedAmount) || 0,
    playerCount: item.playerCount,
    takenCount: item.takenCount,
    assignedPlayerCount: item.assignedPlayerCount,
    platformAdjust: item.platformAdjust, // 减价为负
    clubAdjust: item.clubAdjust, // 减价为负
    settleDueAt: item.settleDueAt || '',
    settleDaysSnapshot: item.settleDaysSnapshot,
    slots: (item.slots || []).map((s) => ({ ...s })),
    freezeReason: item.freezeReason || '',
    rejectCount: item.rejectCount || 0,
  };
}

async function openDetail(row) {
  try {
    const [detail, logs] = await Promise.all([orderApi.detail(row.id), orderApi.logs(row.id)]);
    detailRow.value = { ...mapDetail(detail), ...row };
    detailLogs.value = (logs || []).map((l) => ({
      time: l.createdAt || '',
      text: l.content || '',
      op: l.operatorName || '',
      action: l.action || '',
    }));
    detailVisible.value = true;
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 编辑（接口：POST /{id}/maintain 维护订单信息；原型其余字段待后端补充） ===== */
const editVisible = ref(false);
const editRow = ref(null);
const editLogs = ref([]);
const editDialogRef = ref(null);

async function openEdit(row) {
  editRow.value = row;
  editLogs.value = [];
  editVisible.value = true;
  try {
    // 详情+日志：为编辑弹窗的打手信息/存单/凭证/日志区块补齐接口数据
    const [detail, logs] = await Promise.all([orderApi.detail(row.id), orderApi.logs(row.id)]);
    editRow.value = { ...mapDetail(detail), ...row };
    editLogs.value = (logs || []).map((l) => ({
      time: l.createdAt || '',
      text: l.content || '',
      op: l.operatorName || '',
      action: l.action || '',
    }));
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

async function saveEdit(form) {
  const row = editRow.value;
  if (!row) return;
  try {
    // amount：不传保持原金额，已退款订单后端拒绝修改；groupQrUrl：传空串清除，不传保持原值
    await orderApi.maintain(row.id, {
      gameId: form.gameId,
      specId: form.specId,
      clients: form.clients,
      orderType: form.orderType,
      playerCount: form.playerCount,
      roleName: form.roleName,
      teamCode: form.teamCode,
      remark: form.remark,
      ...(form.amount !== undefined ? { amount: form.amount } : {}),
      groupQrUrl: form.groupQrUrl,
    });
    // 领取人（所属客服）不在本弹窗修改：列表领取人列铅笔 → 独立弹窗调 PUT /{id}/owner
    editVisible.value = false;
    show('保存成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 新增订单（接口：POST /api/admin/orders 人工新增；字段与后端最新契约对齐 2026-10-22）
 * 字段规则（后端确认，测试服已验证）：
 * - 所属渠道：必填，传渠道编码或渠道名称；抖音仍走渠道同步，不能人工新增（下拉已过滤）
 * - 第三方订单号：必填，最多64字；订单金额：必填，大于0，最多两位小数
 * - 购买项目：必填，最多50字；客户端：必填，端游/手游可多选（提交中文逗号分隔）
 * - 游戏名称/规格：必填，规格必须属于所选游戏（提交真实 gameId/specId）
 * - 订单类型：可不填，只能是常规单或特惠单，不填按常规单（提交规范英文码 NORMAL/DISCOUNT，后端确认中英文都能收）
 * - 打手人数：可不填，填了必须是正整数
 * - 店铺ID/备注不在新增表单上（后端不接收，传了也丢弃），不展示不提交
 */
const addVisible = ref(false);
const addForm = reactive({
  channel: '',
  thirdOrderNo: '',
  amount: '',
  product: '',
  clientType: [],
  gameId: '',
  specId: '',
  orderType: '',
  playerCount: '',
});

/* 渠道数据：全部来自后端接口 GET /api/admin/channels（无本地硬编码渠道、无 mock）。
 * 一份全量数据供两处使用：新增弹窗下拉（过滤抖音）与列表筛选下拉（含抖音）。 */
const rawChannels = ref([]); // 渠道层原样数据 [{ id, name, code, editable, shops }]（不展开 shops）
const channelsLoaded = ref(false);
const channelLoading = ref(false);

/* 渠道字段兼容：后端列表接口返回 name（渠道名）+ code（渠道编码，服务端生成），
 * 早期/历史结构可能为 shopName / channelCode，统一兼容读取（后端确认：名称字段是 name、编码字段是 code） */
const channelNameOf = (ch = {}) => String(ch.name || ch.shopName || ch.channelName || '').trim();
const channelCodeOf = (ch = {}) => String(ch.channelCode || ch.code || '').trim();

const isDouyinChannel = (ch = {}) => {
  const code = channelCodeOf(ch).toUpperCase();
  const name = channelNameOf(ch);
  return code === 'DOUYIN' || code.startsWith('DOUYIN') || name === '抖音' || name.includes('抖音');
};

async function loadChannels() {
  if (channelsLoaded.value) return;
  channelLoading.value = true;
  try {
    rawChannels.value = (await channelApi.list()) || [];
    channelsLoaded.value = true;
  } catch {
    rawChannels.value = []; // 拉取失败不置 loaded，下次自动重试
  } finally {
    channelLoading.value = false;
  }
}

/** 渠道项 → 下拉选项：label 优先渠道名（后端 name），value 优先渠道编码（后端接受编码或名称）；
 * 名称和编码都读不到的行剔除（无可用标识、空 value 会导致下拉选不中） */
const toChannelOption = (ch) => {
  const code = channelCodeOf(ch);
  const name = channelNameOf(ch);
  return { label: name || code, value: code || name };
};

/** 新增弹窗渠道下拉：真实渠道，剔除抖音（抖音走渠道同步，人工建单会拒绝） */
const addChannelOptions = computed(() =>
  rawChannels.value.filter((ch) => !isDouyinChannel(ch)).map(toChannelOption).filter((opt) => opt.value)
);

/** 列表筛选渠道下拉：全部真实渠道（含抖音，展示 name、值为 code，供服务端按 channelCode 查询） */
const filterChannelOptions = computed(() => [
  { label: '全部', value: '' },
  ...rawChannels.value.map(toChannelOption).filter((opt) => opt.value),
]);

/* 渠道编码 → 名称映射（后端契约：列表/详情只回 channelCode，渠道列显示名称用渠道接口 code→name 映射，
 * 不使用写死的 DOUYIN / XHS / PRIVATE；映射来源 GET /api/admin/channels） */
const channelNameMap = computed(() => {
  const map = new Map();
  rawChannels.value.forEach((ch) => {
    const code = channelCodeOf(ch);
    const name = channelNameOf(ch);
    if (code) map.set(code, name || code);
  });
  return map;
});

/** 渠道编码 → 渠道名称；未匹配到时原样显示编码 */
function channelDisplayName(code) {
  if (!code) return '—';
  const key = String(code).trim();
  return channelNameMap.value.get(key) || key;
}

function openAdd() {
  Object.assign(addForm, {
    channel: '', thirdOrderNo: '', amount: '', product: '',
    clientType: [], gameId: '', specId: '', orderType: '', playerCount: '',
  });
  loadChannels(); // 首次打开时拉取真实渠道（新增与列表筛选共用）
  addVisible.value = true;
}

const addSpecOptions = computed(() => specOptionsOf(addForm.gameId));

async function submitAdd() {
  const { channel, thirdOrderNo, amount, product, clientType, gameId, specId } = addForm;
  if (!String(channel || '').trim()) return show('请选择所属渠道', 'warning');
  const thirdNo = String(thirdOrderNo || '').trim();
  if (!thirdNo) return show('请输入第三方订单号', 'warning');
  if (thirdNo.length > 64) return show('第三方订单号最多64字', 'warning');
  const amountStr = String(amount ?? '').trim();
  if (!amountStr) return show('请输入订单金额', 'warning');
  if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) return show('订单金额需大于0，最多两位小数', 'warning');
  const amountNum = Number(amountStr);
  if (!Number.isFinite(amountNum) || amountNum <= 0) return show('订单金额需大于0', 'warning');
  if (!String(product || '').trim()) return show('请输入购买项目', 'warning');
  if (String(product).trim().length > 50) return show('购买项目不能超过50字', 'warning');
  if (!clientType.length) return show('请选择客户端', 'warning');
  if (!gameId) return show('请选择游戏名称', 'warning');
  if (!specId) return show('请选择游戏规格', 'warning');

  // 打手人数：可不填，填了必须是正整数
  let playerCount;
  if (addForm.playerCount !== '' && addForm.playerCount != null) {
    const pc = Number(addForm.playerCount);
    if (!Number.isInteger(pc) || pc <= 0) return show('打手人数必须是正整数', 'warning');
    playerCount = pc;
  }

  const payload = {
    channelCode: String(channel).trim(), // 传渠道编码（后端也接受渠道名称）
    thirdOrderNo: thirdNo,
    amount: amountNum,
    itemName: String(product).trim(),
    clients: clientType.join(','), // 后端契约示例："端游,手游"
    gameId: Number(gameId),
    specId: Number(specId),
  };
  // 订单类型：可不填，不填按常规单；填了提交规范英文码 NORMAL/DISCOUNT（后端确认中英文都能收、入库英文码；
  // 特惠单对应 DISCOUNT，SPECIAL 在新增里会被拒绝）
  if (addForm.orderType) payload.orderType = addForm.orderType;
  // 打手人数：可不填，填了必须是正整数
  if (playerCount !== undefined) payload.playerCount = playerCount;
  // 店铺ID/备注：不在新增表单上（后端不接收），不提交

  try {
    await orderApi.create(payload);
    addVisible.value = false;
    show('新增成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 查看关系（children/parentOrderNo 已由订单详情接口返回，行内缺失时拉详情） ===== */
const relationVisible = ref(false);
const relationRow = ref(null);
const relationData = ref({ main: null, children: [] });

async function openRelation(row) {
  relationRow.value = row;
  relationData.value = { main: null, children: [] };
  relationVisible.value = true;
  const useData = (d) => {
    relationData.value.children = (d.children || []).filter((c) => c && c.orderNo);
    if (d.parentOrderNo) relationData.value.main = { orderNo: d.parentOrderNo };
  };
  useData(row);
  if (!relationData.value.children.length || !relationData.value.main) {
    try {
      const detail = await orderApi.detail(row.id);
      if (detail) useData(detail);
    } catch {
      /* 详情拉取失败时保留行内已有数据 */
    }
  }
}

const relationMainNo = computed(() => {
  const row = relationRow.value;
  if (!row) return '—';
  if (row.attribute === '子订单') return row.mainOrderNo || '—';
  if (relationData.value.main) return relationData.value.main.orderNo;
  return row.orderNo;
});

/* ===== 绑主单（接口：POST /{id}/bind，parentOrderId 必填） ===== */
const bindVisible = ref(false);
const bindRow = ref(null);
const bindForm = reactive({ parentOrderId: '' });
const bindCandidates = ref([]); // [{ id, orderNo, spec }]

/** 可绑主单候选：GET /api/admin/orders/bindable-parents（excludeId 排除当前订单，避免绑自己） */
async function openBindMain(row) {
  bindRow.value = row;
  bindForm.parentOrderId = '';
  bindCandidates.value = [];
  bindVisible.value = true;
  try {
    const res = await orderApi.bindableParents({ excludeId: row.id, page: 1, pageSize: 50 });
    bindCandidates.value = ((res && res.list) || []).map((c) => ({
      id: c.id,
      orderNo: c.orderNo || '',
      status: c.status || '',
      statusText: statusText(c.status),
      ownerName: c.ownerName || '',
      spec: '',
    }));
  } catch {
    bindCandidates.value = [];
  }
}

async function submitBindMain() {
  const row = bindRow.value;
  if (!row) return;
  if (!bindForm.parentOrderId) return show('请选择绑定主单', 'warning');
  try {
    await orderApi.bind(row.id, { parentOrderId: Number(bindForm.parentOrderId) });
    bindVisible.value = false;
    show('绑定成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 解绑（接口：POST /orders/unbind 批量；候选=主订单+当前订单，主单行追加 children 子订单） ===== */
const unbindVisible = ref(false);
const unbindRow = ref(null);
const unbindOptions = ref([]);
const unbindSelected = ref([]);

async function openUnbind(row) {
  unbindRow.value = row;
  unbindSelected.value = [];
  const options = [];
  // 本订单为子订单时可列出主订单（parentOrderId/parentOrderNo 已返回）
  if (row.attribute === '子订单' && row.mainOrderNo) {
    const parentId = Number(row.mainOrderNo);
    if (Number.isFinite(parentId) && parentId > 0) {
      options.push({ id: parentId, no: row.mainOrderNo, label: '主订单' });
    }
  }
  options.push({ id: row.id, no: row.orderNo, label: '当前订单' });
  // 主订单行：拉详情取 children（子订单列表接口已返回），追加为解绑候选
  if (row.attribute !== '子订单') {
    try {
      const detail = await orderApi.detail(row.id);
      ((detail && detail.children) || []).forEach((c) => {
        if (c && c.id && c.orderNo) options.push({ id: c.id, no: c.orderNo, label: `子订单·${c.orderNo}` });
      });
    } catch {
      /* 详情拉取失败则仅保留基础候选 */
    }
  }
  unbindOptions.value = options;
  unbindVisible.value = true;
}

async function submitUnbind() {
  const row = unbindRow.value;
  if (!row) return;
  if (!unbindSelected.value.length) return show('请选择需要解绑的订单', 'warning');
  try {
    // 批量解绑：POST /api/admin/orders/unbind（orderIds 传订单 ID 数组；选单项已存 ID）
    const res = await orderApi.unbindBatch(unbindSelected.value);
    const failures = (res && res.failures) || [];
    if (failures.length) {
      show(`部分解绑失败：${failures.map((f) => f.message || `订单${f.orderId}`).join('；')}`, 'warning');
    } else {
      show('解绑成功', 'success');
    }
    unbindVisible.value = false;
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 派单（系统派单=SYSTEM 大厅；人工派单=CLUB 指定俱乐部并指派打手） =====
 * 打手列表：GET /api/admin/players?clubId={俱乐部}&status=NORMAL&pageSize=100，下拉展示 姓名(id)，值为 playerId
 * 指派：POST /api/club/orders/{orderId}/assignments { slots:[{slotNo, playerId}] }（管理端前缀以后端契约为准）
 */
const dispatchVisible = ref(false);
const dispatchRow = ref(null);
const dispatchForm = reactive({ dispatchType: '系统派单', club: '', players: [], remark: '' });
const clubOptions = ref([]); // [{ id, name }]
const playerOptions = ref([]); // [{ id, name }]
const dispatchLoading = ref(false);
const playersLoading = ref(false);

async function loadClubOptions() {
  if (clubOptions.value.length) return;
  try {
    const res = await clubApi.list({ page: 1, pageSize: 100 });
    clubOptions.value = ((res && res.list) || []).map((c) => ({
      id: c.id,
      name: c.name || c.clubName || String(c.id),
    }));
  } catch {
    clubOptions.value = [];
  }
}

/** 按所选俱乐部拉取正常状态打手，下拉展示 姓名(id)，值为 playerId */
async function loadPlayers(clubId) {
  playerOptions.value = [];
  if (!clubId) return;
  playersLoading.value = true;
  try {
    const res = await playerApi.list({ clubId: Number(clubId), status: 'NORMAL', pageSize: 100 });
    playerOptions.value = ((res && res.list) || []).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    playerOptions.value = [];
  } finally {
    playersLoading.value = false;
  }
}

// 人工派单：切换俱乐部联动刷新打手列表，并清空已选打手
watch(
  () => dispatchForm.club,
  (val) => {
    dispatchForm.players = dispatchForm.players.map(() => '');
    loadPlayers(val);
  }
);

async function openDispatch(row) {
  const missing = [];
  if (!row.gameId) missing.push('游戏名称');
  if (!row.specId) missing.push('游戏规格');
  if (!row.orderTypeCode) missing.push('订单类型');
  if (!row.clients) missing.push('客户端');
  // 角色名接口未返回，暂不参与派单前置校验（待后端补充）
  if (missing.length) {
    show(`该订单尚未维护${missing.join('/')}`, 'warning');
    return;
  }
  dispatchRow.value = row;
  Object.assign(dispatchForm, { dispatchType: '系统派单', club: '', players: [], remark: '' });
  playerOptions.value = [];
  dispatchVisible.value = true;
  dispatchLoading.value = true;
  try {
    // 打手人数/锁定俱乐部从详情补齐
    const detail = await orderApi.detail(row.id);
    dispatchRow.value = {
      ...row,
      playerCount: detail.playerCount,
      takenCount: detail.takenCount,
      lockedClubId: detail.lockedClubId,
    };
    const count = Math.max(1, Number(detail.playerCount) || 1);
    dispatchForm.players = Array.from({ length: Math.min(count, 3) }, () => '');
    // 订单已锁定俱乐部则预填（watch 会联动拉打手）
    if (detail.lockedClubId) dispatchForm.club = detail.lockedClubId;
    await loadClubOptions();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  } finally {
    dispatchLoading.value = false;
  }
}

async function submitDispatch() {
  const row = dispatchRow.value;
  if (!row) return;
  const dispatchType = dispatchForm.dispatchType === '系统派单' ? 'SYSTEM' : 'CLUB';
  if (dispatchType === 'CLUB' && !dispatchForm.club) {
    return show('请选择俱乐部', 'warning');
  }
  let slots = [];
  if (dispatchType === 'CLUB') {
    const emptyIndex = dispatchForm.players.findIndex((p) => !p);
    if (emptyIndex > -1) return show(`请选择打手${emptyIndex + 1}`, 'warning');
    slots = dispatchForm.players.map((playerId, i) => ({ slotNo: i + 1, playerId: Number(playerId) }));
  }
  try {
    await orderApi.dispatch(row.id, {
      dispatchType,
      targetClubId: dispatchType === 'CLUB' ? Number(dispatchForm.club) : undefined,
    });
    // 人工派单：把选中打手指派到名额（slots: [{ slotNo, playerId }]）
    if (dispatchType === 'CLUB' && slots.length) {
      await orderApi.assign(row.id, { slots });
    }
    dispatchVisible.value = false;
    show('派单成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 加减价（接口：POST /{id}/platform-adjust；UI 保持原型"加价/减价"文案） ===== */
const priceVisible = ref(false);
const priceRow = ref(null);
const priceForm = reactive({ type: '加价', amount: '' });

function openPrice(row) {
  priceRow.value = row;
  Object.assign(priceForm, { type: '加价', amount: '' });
  priceVisible.value = true;
}

async function submitPrice() {
  const row = priceRow.value;
  if (!row) return;
  const amount = Number(priceForm.amount);
  if (!priceForm.amount || !Number.isFinite(amount) || amount <= 0) {
    return show('请输入正确的金额', 'warning');
  }
  if (amount > Number(row.amount)) {
    return show(`${priceForm.type === '加价' ? '加' : '减'}：最多为订单总金额`, 'warning');
  }
  try {
    await orderApi.platformAdjust(row.id, {
      direction: priceForm.type === '加价' ? 'INCREASE' : 'DECREASE',
      amount,
    });
    priceVisible.value = false;
    show('加减价成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 呼叫（接口：POST /{id}/call，callType 必填；UI 保持原型类型选项） ===== */
const callVisible = ref(false);
const callRow = ref(null);
const callForm = reactive({ type: '', remark: '' });

function openCall(row) {
  callRow.value = row;
  Object.assign(callForm, { type: '', remark: '' });
  callVisible.value = true;
}

async function submitCall() {
  const row = callRow.value;
  if (!row) return;
  if (!callForm.type) return show('请选择呼叫类型', 'warning');
  try {
    // body 优先 type（英文枚举 ORDER/COMPLAINT/PLAYER/TECH/OTHER），其次 callType（也接受中文）
    await orderApi.call(row.id, { type: callForm.type, remark: callForm.remark });
    callVisible.value = false;
    show('呼叫成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 修改领取客服（列表领取人列铅笔；仅 ADMIN；PUT /{id}/owner，ownerAccountId 必填；
   候选人 GET /api/admin/accounts，KEFU 调用返回 403「仅管理员可修改领取客服」） ===== */
const ownerVisible = ref(false);
const ownerRow = ref(null);
const ownerForm = reactive({ ownerAccountId: '' });
const ownerOptions = ref([]); // [{ id, name }]
const ownerLoading = ref(false);

async function openOwnerEdit(row) {
  ownerRow.value = row;
  Object.assign(ownerForm, { ownerAccountId: '' });
  ownerVisible.value = true;
  ownerLoading.value = true;
  try {
    const list = await handoverApi.accounts({ status: 'NORMAL' });
    ownerOptions.value = list.map((a) => ({ id: a.accountId, name: a.accountName }));
  } catch {
    ownerOptions.value = [];
  } finally {
    ownerLoading.value = false;
  }
}

async function submitOwner() {
  const row = ownerRow.value;
  if (!row) return;
  if (!ownerForm.ownerAccountId) return show('请选择领取客服', 'warning');
  try {
    await orderApi.changeOwner(row.id, { ownerAccountId: Number(ownerForm.ownerAccountId) });
    ownerVisible.value = false;
    show('领取客服修改成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出（KEFU 403「仅管理员可修改领取客服」） */
  }
}

/* ===== 冻结 / 解冻 / 回退（冻结/解冻走接口；回退接口待后端补充） ===== */
async function freezeRow(row) {
  const ok = await confirm({ title: '冻结', message: `确定冻结订单 ${row.orderNo} 吗？冻结后打手无法操作该订单。`, okText: '确定' });
  if (!ok) return;
  try {
    await orderApi.freeze(row.id, { reason: 'MANUAL' });
    show('冻结成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

async function unfreezeRow(row) {
  const ok = await confirm({ title: '解冻', message: `确定解冻订单 ${row.orderNo} 吗？`, okText: '确定' });
  if (!ok) return;
  try {
    await orderApi.unfreeze(row.id);
    show('解冻成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

async function rollbackRow(row) {
  const ok = await confirm({ title: '回退', message: '进行二次确认，已接单人将被清除，订单回退为待派单。', okText: '确定' });
  if (!ok) return;
  // 回退：POST /api/admin/orders/{id}/rollback（文档名为「回退到待领取」，目标状态以后端契约为准，文案后续可再对齐）
  try {
    await orderApi.rollback(row.id);
    show('回退成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 退款（接口：POST /{id}/refund 人工退款；原金额/部分退款展示依赖 refunded 字段接口待补充） ===== */
const refundVisible = ref(false);
const refundRow = ref(null);
const refundForm = reactive({ amount: '', reason: '' });

function openRefund(row) {
  refundRow.value = row;
  Object.assign(refundForm, { amount: '', reason: '' });
  refundVisible.value = true;
}

async function submitRefund() {
  const row = refundRow.value;
  if (!row) return;
  const amount = Number(refundForm.amount);
  if (!refundForm.amount || !Number.isFinite(amount) || amount <= 0) {
    return show('请输入正确的退款金额（大于0）', 'warning');
  }
  if (amount > Number(row.amount)) {
    return show('退款金额不能超过订单总金额', 'warning');
  }
  if (row.channelCode === 'DOUYIN') {
    return show('抖音订单不支持人工部分退款', 'warning');
  }
  try {
    await orderApi.refund(row.id, {
      amount,
      reason: String(refundForm.reason || '').trim(),
    });
    refundVisible.value = false;
    show('退款成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 转单（接口：POST /{id}/transfer；UI 保持原型目标文案，提交映射枚举） ===== */
const transferVisible = ref(false);
const transferRow = ref(null);
const transferForm = reactive({ deduct: '否', amount: '', target: '进入公共抢单大厅' });

function openTransfer(row) {
  transferRow.value = row;
  Object.assign(transferForm, { deduct: '否', amount: '', target: '进入公共抢单大厅' });
  transferVisible.value = true;
}

async function submitTransfer() {
  const row = transferRow.value;
  if (!row) return;
  let deduct = 0;
  if (transferForm.deduct === '是') {
    const amount = Number(transferForm.amount);
    if (!transferForm.amount || !Number.isFinite(amount) || amount <= 0) {
      return show('请输入扣款金额（总数）', 'warning');
    }
    deduct = amount;
  }
  if (!transferForm.target) return show('请选择转单类型', 'warning');
  try {
    await orderApi.transfer(row.id, {
      type: transferForm.target === '进入公共抢单大厅' ? 'PUBLIC' : 'CLUB_HALL',
      deduct,
    });
    transferVisible.value = false;
    show('转单成功', 'success');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

/* ===== 审核（接口：POST /{id}/audit，pass 必填，驳回必填 reason） ===== */
const auditVisible = ref(false);
const auditRow = ref(null);
const auditLogs = ref([]);
const auditDialogRef = ref(null);

async function openAudit(row) {
  auditRow.value = row;
  auditLogs.value = [];
  auditVisible.value = true;
  try {
    // 审核弹窗需展示分润信息（平台/俱乐部加减价、账期），先拉订单详情 + 日志
    const [detail, logs] = await Promise.all([orderApi.detail(row.id), orderApi.logs(row.id)]);
    auditRow.value = { ...mapDetail(detail), ...row };
    auditLogs.value = (logs || []).map((l) => ({
      time: l.createdAt || '',
      text: l.content || '',
      op: l.operatorName || '',
      action: l.action || '',
    }));
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
}

async function submitAudit({ pass, reason }) {
  const row = auditRow.value;
  if (!row) return;
  try {
    await orderApi.audit(row.id, { pass, reason });
    auditVisible.value = false;
    show(pass ? '审核通过，订单已完成' : '已驳回', pass ? 'success' : 'warning');
    fetchList();
  } catch {
    /* 错误提示由 request.js 统一弹出 */
  }
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
      @page-change="(p) => { onPageChange(p); fetchList(); }"
      @page-size-change="(s) => { onPageSizeChange(s); fetchList(); }"
    >
      <template #toolbar>
        <div class="toolbar-left">
          <div class="scope-switch">
            <button
              v-for="item in scopeOptions"
              :key="item.value"
              type="button"
              :class="['scope-btn', { active: scope === item.value }]"
              @click="switchScope(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <button class="add-btn" @click="openAdd">新增</button>
      </template>

      <template #cell-orderType="{ row }">
        <span :class="['order-type-tag', { 'is-special': row.orderType === '特惠单' }]">{{ row.orderType || '—' }}</span>
      </template>

      <template #cell-orderNo="{ row }">
        <span class="order-no-cell">{{ row.orderNo }}</span>
      </template>

      <template #cell-amount="{ row }">{{ money(row.amount) }}</template>

      <template #cell-product="{ row }">{{ row.product || '—' }}</template>

      <template #cell-gameName="{ row }">{{ row.gameName || '—' }}</template>

      <template #cell-clientType="{ row }">{{ row.clients ? row.clients.split(/[,，]/).filter(Boolean).join('、') : '—' }}</template>

      <template #cell-spec="{ row }">{{ row.spec || '—' }}</template>

      <template #cell-roleName="{ row }">{{ row.roleName || '—' }}</template>

      <template #cell-status="{ row }">
        <div class="status-wrap">
          <span class="status-badge" :class="STATUS_CLASS[row.status] || 'status-info'">{{ displayStatus(row) }}</span>
          <span v-for="tag in row.tags" :key="tag" class="order-tag" :class="`tag-${tagClass(tag)}`">{{ tag }}</span>
        </div>
      </template>

      <template #cell-auditStatus="{ row }">
        <span class="status-badge" :class="AUDIT_CLASS[row.auditStatus] || 'status-muted'">{{ row.auditStatus }}</span>
      </template>

      <template #cell-attribute="{ row }">
        <div v-if="row.attribute !== '—'" class="attr-cell">
          <span>{{ row.attribute }}</span>
          <button class="link-btn" @click="openRelation(row)">查看关系</button>
        </div>
        <span v-else>—</span>
      </template>

      <template #cell-claimer="{ row }">
        <div class="claimer-cell">
          <span>企微名：{{ row.claimerCorp || '—' }}</span>
          <span class="claimer-name">
            客服名：{{ row.claimerName || '—' }}
            <!-- 仅管理员可编辑修改领取客服（原型标注）：列表行内铅笔 → 独立弹窗 PUT /{id}/owner -->
            <button v-if="isAdmin && row.claimerName" class="owner-edit-btn" type="button" title="修改领取客服" @click="openOwnerEdit(row)">✎</button>
          </span>
        </div>
      </template>

      <template #cell-createTime="{ row }">{{ row.createTime || '—' }}</template>

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

    <!-- 查看详情（接口：detail + logs） -->
    <AppModal v-model="detailVisible" title="查看" width="720px">
      <OrderDetailDialog v-if="detailRow" :row="detailRow" :logs="detailLogs" />
      <template #footer>
        <button class="btn btn-primary" @click="detailVisible = false">确定</button>
      </template>
    </AppModal>

    <!-- 编辑（维护订单信息 maintain；原型其余字段接口待补充） -->
    <AppModal v-model="editVisible" title="编辑" width="760px">
      <OrderEditDialog v-if="editRow" ref="editDialogRef" :row="editRow" :catalog="catalog" :logs="editLogs" @save="saveEdit" />
      <template #footer>
        <button class="btn btn-plain" @click="editVisible = false">取消</button>
        <button class="btn btn-primary" @click="editDialogRef?.submit()">确定</button>
      </template>
    </AppModal>

    <!-- 新增订单（接口：POST /api/admin/orders；店铺ID/备注后端不接收，不展示） -->
    <AppModal v-model="addVisible" title="新增数据" width="520px">
      <div class="dialog-form">
        <div class="form-row">
          <label class="required">所属渠道</label>
          <el-select v-model="addForm.channel" placeholder="请选择渠道（抖音不支持人工新增）" style="width: 100%" filterable :loading="channelLoading">
            <el-option v-for="item in addChannelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
        <div class="form-row">
          <label class="required">第三方订单号</label>
          <input v-model="addForm.thirdOrderNo" maxlength="64" placeholder="请输入第三方订单号，最多64字" />
        </div>
        <div class="form-row">
          <label class="required">订单金额(元)</label>
          <input v-model="addForm.amount" type="number" step="0.01" min="0" placeholder="大于0，最多两位小数" />
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
          <el-select v-model="addForm.gameId" style="width: 100%" placeholder="请选择游戏" @change="addForm.specId = ''">
            <el-option v-for="item in gameOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
        <div class="form-row">
          <label class="required">游戏规格</label>
          <el-select v-model="addForm.specId" style="width: 100%" placeholder="请选择规格">
            <el-option v-for="item in addSpecOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
        <div class="form-row">
          <label>订单类型</label>
          <el-radio-group v-model="addForm.orderType">
            <el-radio v-for="item in TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </div>
        <div class="form-row">
          <label>打手人数</label>
          <input v-model="addForm.playerCount" type="number" min="1" step="1" placeholder="仅支持输入正整数" />
        </div>
        <!-- 店铺ID / 备注：不在新增表单上（后端不接收，传了也丢弃），不展示 -->
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="addVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitAdd">确定</button>
      </template>
    </AppModal>

    <!-- 查看关系（children/parentOrderNo 已由订单详情接口返回，行内缺失时拉详情） -->
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

    <!-- 绑主单（接口：bind） -->
    <AppModal v-model="bindVisible" title="绑主单" width="480px">
      <div class="dialog-form">
        <div class="form-row">
          <label>当前订单</label>
          <strong class="readonly-value">{{ bindRow?.orderNo || '—' }}</strong>
        </div>
        <div class="form-row">
          <label class="required">绑定主单</label>
          <el-select v-model="bindForm.parentOrderId" placeholder="请选择主订单" style="width: 100%" filterable>
            <el-option v-for="opt in bindCandidates" :key="opt.id" :value="opt.id" :label="`${opt.orderNo}（${opt.statusText || opt.status || '—'}）`">
              <div class="bind-option">
                <span class="bind-option__spec">{{ opt.orderNo }}</span>
                <span class="bind-option__no">{{ opt.statusText || opt.status || '—' }}</span>
              </div>
            </el-option>
            <template v-if="!bindCandidates.length">
              <el-option disabled :value="''" label="暂无可用主单候选（请确认订单状态/属性）" />
            </template>
          </el-select>
          <!-- <p class="form-tip">可绑主单候选接口待后端补充（后端建议勿用全部订单列表硬筛），当前暂无候选可选。</p> -->
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="bindVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitBindMain">确定</button>
      </template>
    </AppModal>

    <!-- 解绑（unbind 单订单接口；多选依赖主/子单关系接口待补充） -->
    <AppModal v-model="unbindVisible" title="解绑" width="520px">
      <div class="dialog-form">
        <div class="form-row">
          <label>选择要解绑的订单</label>
          <el-checkbox-group v-model="unbindSelected" class="checkbox-col">
            <el-checkbox v-for="opt in unbindOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}：{{ opt.no }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="unbindVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitUnbind">确定</button>
      </template>
    </AppModal>

    <!-- 派单（接口：dispatch；打手名单/备注字段接口未提供） -->
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
            <el-select
              v-model="dispatchForm.club"
              filterable
              :loading="dispatchLoading"
              placeholder="请选择俱乐部"
              style="width: 100%"
            >
              <el-option v-for="item in clubOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </div>
          <div v-if="!dispatchForm.club" class="form-row">
            <label>打手列表</label>
            <p class="form-tip">请先选择俱乐部，再按俱乐部拉取正常状态打手。</p>
          </div>
          <div v-for="(_, index) in dispatchForm.players" v-else :key="index" class="form-row">
            <label class="required">打手{{ index + 1 }}</label>
            <el-select
              v-model="dispatchForm.players[index]"
              :loading="playersLoading"
              filterable
              placeholder="请选择打手（姓名 id）"
              style="width: 100%"
            >
              <el-option
                v-for="item in playerOptions"
                :key="item.id"
                :label="`${item.name}（${item.id}）`"
                :value="item.id"
              />
            </el-select>
          </div>
        </template>
        <div class="form-row">
          <label>备注</label>
          <textarea v-model="dispatchForm.remark" rows="3" maxlength="200" placeholder="请输入备注"></textarea>
          <div class="char-count">{{ dispatchForm.remark.length }}/200</div>
        </div>
        <!-- <p class="form-tip">打手名单与备注字段接口暂未提供，提交时仅携带派单类型与目标俱乐部（待后端补充）。</p> -->
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="dispatchVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitDispatch">确定</button>
      </template>
    </AppModal>

    <!-- 加减价（接口：platform-adjust） -->
    <AppModal v-model="priceVisible" title="加减价" width="440px">
      <div class="dialog-form">
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
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="priceVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitPrice">确定</button>
      </template>
    </AppModal>

    <!-- 呼叫（接口：call） -->
    <AppModal v-model="callVisible" title="呼叫" width="440px">
      <div class="dialog-form">
        <div class="form-row">
          <label class="required">类型</label>
          <el-select v-model="callForm.type" style="width: 100%">
            <el-option v-for="item in CALL_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <!-- <p class="form-tip">呼叫类型文案已对齐后端枚举：订单问题/投诉/打手问题/技术问题/其他（提交英文枚举）。</p> -->
        </div>
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

    <!-- 修改领取客服（列表领取人列铅笔入口；仅管理员；PUT /{id}/owner） -->
    <AppModal v-model="ownerVisible" title="修改领取客服" width="440px">
      <div class="dialog-form">
        <div class="form-row">
          <label>当前客服</label>
          <strong>{{ ownerRow ? `${ownerRow.claimerName || '—'}（${ownerRow.claimerCorp || '—'}）` : '—' }}</strong>
        </div>
        <div class="form-row">
          <label class="required">领取客服</label>
          <el-select
            v-model="ownerForm.ownerAccountId"
            filterable
            :loading="ownerLoading"
            placeholder="请选择领取客服"
            style="width: 100%"
          >
            <el-option v-for="item in ownerOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="ownerVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitOwner">确定</button>
      </template>
    </AppModal>

    <!-- 退款（接口：refund） -->
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
        <div class="form-row">
          <label>退款原因</label>
          <textarea v-model="refundForm.reason" rows="3" maxlength="200" placeholder="请输入退款原因（可选）"></textarea>
          <div class="char-count">{{ refundForm.reason.length }}/200</div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="refundVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitRefund">确定</button>
      </template>
    </AppModal>

    <!-- 转单（接口：transfer） -->
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
      </div>
      <template #footer>
        <button class="btn btn-plain" @click="transferVisible = false">取消</button>
        <button class="btn btn-primary" @click="submitTransfer">确定</button>
      </template>
    </AppModal>

    <!-- 审核（接口：audit，pass/reason） -->
    <AppModal v-model="auditVisible" title="审核" width="620px">
      <AuditDialog v-if="auditRow" ref="auditDialogRef" :row="auditRow" :logs="auditLogs" @submit="submitAudit" />
      <template #footer>
        <button class="btn btn-plain" @click="auditVisible = false">取消</button>
        <button class="btn btn-primary" @click="auditDialogRef?.submit()">确定</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
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
  padding: 3px 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
  color: #fff;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.status-success { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35); }
.status-warning { background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35); }
.status-info { background: linear-gradient(135deg, #3b82f6, #2563eb); box-shadow: 0 2px 10px rgba(59, 130, 246, 0.35); }
.status-danger { background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 2px 10px rgba(239, 68, 68, 0.35); }
.status-muted { background: linear-gradient(135deg, #6b7280, #4b5563); box-shadow: 0 2px 8px rgba(107, 114, 128, 0.25); }

/* 订单标签独立列（原型列表字段） */
.tag-list {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

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
  gap: 10px;
  white-space: nowrap;
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

.claimer-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.owner-edit-btn {
  border: none;
  background: transparent;
  color: var(--brand-color, #409eff);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
}

.owner-edit-btn:hover {
  opacity: 0.8;
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

.checkbox-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

/* 查看关系弹窗 */
.relation-dialog {
  display: grid;
  gap: 16px;
}

.relation-row {
  display: flex;
  gap: 16px;
  align-items: baseline;
}

.relation-row > span {
  flex: 0 0 64px;
  color: var(--text-sub);
  font-size: 12.5px;
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-main);
  word-break: break-all;
}

.form-tip {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(250, 204, 21, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.28);
  color: var(--warning-text);
  font-size: 12px;
  line-height: 1.8;
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
