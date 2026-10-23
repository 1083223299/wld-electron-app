<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useUserStore } from '../../../stores/user';
import { handoverApi, LOG_STATUS } from '../../../api/modules/handover';
import { useToast } from '../../../composables/useToast';
import AppModal from '../../../components/AppModal.vue';
import SearchComponent from '../../../components/SearchComponent/index.vue';
import PaginationSimple from '../../../components/PaginationSimple/index.vue';

/**
 * 交接中心 > 交接日志（已联调真实接口）
 * - GET  /api/admin/handovers            列表（服务端分页 + from/to/status/mine 筛选）
 * - POST /api/admin/handovers/{id}/ack   关注人标记已处理（token 识别当前用户）
 * - POST /api/admin/handovers            新建（content 必填，orderId 可选，watcherIds 关注人）
 * - GET  /api/admin/accounts             关注人候选
 * - 列表项 myWatcherStatus：当前登录人作为关注人时的 PENDING/DONE，非关注人为 null
 */
const userStore = useUserStore();
const { show } = useToast();
// 当前登录账号信息（接口通过 token 识别用户身份，accountId 仅用于前端兜底判断）
const myAccountId = computed(() => userStore.user?.accountId);
const myName = computed(() => userStore.displayName || '');

/* ================= 搜索区（复用共享 SearchComponent） ================= */
const filter = reactive({
  dateRange: [], // [开始日期, 结束日期] YYYY-MM-DD
  status: '', // '' 全部 / PENDING 待处理 / DONE 已处理
});

const searchFields = [
  {
    prop: 'dateRange',
    label: '日期',
    type: 'daterange',
    startPlaceholder: '开始时间',
    endPlaceholder: '结束时间',
    shortcuts: [
      { text: '今天', value: () => { const d = new Date(); return [d, d]; } },
      { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return [start, end]; } },
      { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return [start, end]; } },
    ],
  },
  {
    prop: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部',
    options: [
      { value: '', label: '全部' },
      { value: LOG_STATUS.PENDING, label: '待处理' },
      { value: LOG_STATUS.DONE, label: '已处理' },
    ],
  },
];

const relatedToMe = ref(false);
const list = ref([]);
const loading = ref(false);

/* ================= 服务端分页 ================= */
const page = ref(1);
const pageSize = ref(20); // 接口默认 20，最大 100
const total = ref(0);

// 由接口原始字段计算卡片展示字段（watchers 处理明细 → 整体状态）
// candidatesCount：全部候选关注人数量；watchers 覆盖全部候选时按原型聚合展示为「@所有人」
function decorate(item, candidatesCount = 0) {
  const watchers = item.watchers || [];
  const doneCount = watchers.filter((w) => w.status === LOG_STATUS.DONE).length;
  const allWatched = candidatesCount > 0 && watchers.length >= candidatesCount;
  return {
    ...item,
    doneCount,
    totalWatchers: watchers.length,
    status:
      watchers.length > 0 && doneCount === watchers.length
        ? LOG_STATUS.DONE
        : LOG_STATUS.PENDING,
    allWatched,
    watcherNames: allWatched ? [] : watchers.map((w) => w.accountName),
  };
}

async function loadList() {
  loading.value = true;
  try {
    const [startDate, endDate] = filter.dateRange || [];
    // 时间筛选传参：yyyy-MM-ddTHH:mm:ss（后端只接受 yyyy-MM-dd 或 yyyy-MM-ddTHH:mm:ss，空格分隔会报 400；Date 对象直传会被序列化为英文格式，后端无法解析）
    const fmtDT = (d) => {
      if (!d) return '';
      const date = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };
    const res = await handoverApi.list({
      page: page.value,
      pageSize: pageSize.value,
      from: fmtDT(startDate),
      to: fmtDT(endDate),
      status: filter.status,
      mine: relatedToMe.value ? 1 : '', // 传 1 仅看与我相关；空值自动剔除
    });
    total.value = res.total || 0;
    list.value = (res.list || []).map((item) =>
      decorate(item, watcherOptions.value.length)
    );
  } finally {
    loading.value = false;
  }
}

function handleSearch(values) {
  Object.assign(filter, values);
  page.value = 1;
  loadList();
}

function handleReset(values) {
  Object.assign(filter, values);
  page.value = 1;
  loadList();
}

function handlePageChange(val) {
  page.value = val;
  loadList();
}

function handlePageSizeChange(size) {
  pageSize.value = size;
  page.value = 1;
  loadList();
}

/* ================= 卡片状态 ================= */
// 当前登录用户是否是本条交接的关注人
function isMyWatcher(item) {
  if (item.myWatcherStatus != null) return true;
  return (item.watchers || []).some(
    (w) => w.accountId === myAccountId.value || w.accountName === myName.value
  );
}

// 当前登录用户在该条日志中是否已处理（优先使用接口返回的 myWatcherStatus）
function isMineDone(item) {
  if (item.myWatcherStatus != null) return item.myWatcherStatus === LOG_STATUS.DONE;
  return (item.watchers || []).some(
    (w) =>
      w.status === LOG_STATUS.DONE &&
      (w.accountId === myAccountId.value || w.accountName === myName.value)
  );
}

async function handleMarkDone(item) {
  await handoverApi.ack(item.id);
  show('已处理', 'success');
  loadList();
}

/* ================= 新增弹窗 ================= */
const createVisible = ref(false);
const createForm = reactive({
  content: '',
  watcherIds: [],
  watchAll: false,
  orderId: '',
});

// 关注人候选（账号列表）
const watcherOptions = ref([]);

// 候选加载完成后重新装饰已加载列表（watchers 覆盖全部候选时按原型聚合展示为「@所有人」）
watch(watcherOptions, (opts) => {
  list.value = list.value.map((item) => decorate(item, opts.length));
});

async function loadAccounts() {
  try {
    watcherOptions.value = await handoverApi.accounts();
  } catch {
    watcherOptions.value = [];
  }
}

function openCreate() {
  createForm.content = '';
  createForm.watcherIds = [];
  createForm.watchAll = false;
  createForm.orderId = '';
  createVisible.value = true;
}

function toggleWatchAll() {
  createForm.watchAll = !createForm.watchAll;
  createForm.watcherIds = createForm.watchAll
    ? watcherOptions.value.map((a) => a.accountId)
    : [];
}

async function submitCreate() {
  if (!createForm.content.trim()) {
    show('请输入交接内容', 'error');
    return;
  }
  const payload = { content: createForm.content.trim() };
  if (createForm.watcherIds.length) {
    payload.watcherIds = createForm.watcherIds;
  }
  if (createForm.orderId) {
    const orderId = Number(createForm.orderId);
    if (!Number.isInteger(orderId)) {
      show('请输入正确的订单号', 'error');
      return;
    }
    payload.orderId = orderId;
  }
  await handoverApi.create(payload);
  createVisible.value = false;
  show('新增成功', 'success');
  loadList();
}

/* ================= 处理日志弹窗 ================= */
const logsVisible = ref(false);
const logsList = ref([]);
const logsTitle = ref('处理日志');

// 接口未提供独立明细接口，直接使用列表返回的 watchers 处理明细
function openLogs(item) {
  logsTitle.value = '处理日志';
  logsList.value = item.watchers || [];
  logsVisible.value = true;
}

onMounted(() => {
  loadList();
  loadAccounts();
});
</script>

<template>
  <div class="handover-log-page">
    <!-- 搜索区（共享 SearchComponent） -->
    <div class="list-page__search">
      <SearchComponent
        :fields="searchFields"
        :initial-values="filter"
        :row-columns="2"
        :labelWidth="70"
        @search="handleSearch"
        @reset="handleReset"
      />
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <button class="btn btn-primary" type="button" @click="openCreate">新增</button>
      <el-checkbox v-model="relatedToMe" class="related-check" @change="loadList">
        与我相关
      </el-checkbox>
    </div>

    <!-- 卡片网格 -->
    <div v-loading="loading" class="card-grid">
      <div v-for="item in list" :key="item.id" class="log-card">
        <div class="card-head">
          <div class="creator">
            <span class="avatar">{{ item.creatorName?.slice(0, 1) }}</span>
            <div class="creator-meta">
              <span class="creator-name">{{ item.creatorName }}</span>
              <span class="create-time">{{ item.createdAt }}提交</span>
            </div>
          </div>
          <span
            v-if="item.status === LOG_STATUS.DONE"
            class="badge badge-done"
          >已处理</span>
          <span
            v-else
            class="badge badge-pending"
          >待处理<template v-if="item.totalWatchers"> ({{ item.doneCount }}/{{ item.totalWatchers }})</template></span>
        </div>

        <p class="card-content">{{ item.content }}</p>

        <div class="card-field">
          <span class="field-label">关联订单：</span>
          <span v-if="item.orderId" class="order-tag">{{ item.orderId }}</span>
          <span v-else class="field-empty">无</span>
        </div>

        <div class="card-footer">
          <div class="watchers">
            <span class="field-label">关注人：</span>
            <template v-if="item.allWatched">
              <span class="watcher-tag">@所有人</span>
            </template>
            <template v-else>
              <span
                v-for="w in item.watchers"
                :key="w.accountId"
                class="watcher-tag"
              >@{{ w.accountName }}</span>
              <span v-if="!item.watchers?.length" class="field-empty">无</span>
            </template>
          </div>
          <div class="card-actions">
            <button
              v-if="item.status === LOG_STATUS.PENDING && isMyWatcher(item) && !isMineDone(item)"
              class="btn btn-primary btn-sm"
              type="button"
              @click="handleMarkDone(item)"
            >已处理</button>
            <button
              class="btn btn-primary btn-sm"
              type="button"
              @click="openLogs(item)"
            >处理日志</button>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && !list.length" description="暂无交接日志">
        <template #image>
          <img
            class="empty-img"
            src="../../../assets/images/noTransactionHistory.png"
            alt="暂无交接日志"
          />
        </template>
      </el-empty>
    </div>

    <!-- 分页（服务端分页） -->
    <div class="page-footer">
      <PaginationSimple
        :current-page="page"
        :total="total"
        :page-size="pageSize"
        :show-batch-actions="false"
        @current-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      />
    </div>

    <!-- 新增弹窗 -->
    <AppModal v-model="createVisible" title="新增" width="640px">
      <div class="create-form">
        <div class="form-section">
          <div class="section-head">
            <h4>交接内容</h4>
            <em class="required">*</em>
          </div>
          <el-input
            v-model="createForm.content"
            type="textarea"
            :rows="5"
            maxlength="300"
            show-word-limit
            resize="none"
            placeholder="请输入交接内容，例如：凌晨单量低，早班关注永劫无匹配 SKU 单…"
          />
        </div>

        <div class="form-section">
          <div class="section-head">
            <h4>关注人</h4>
            <span
              class="quick-chip"
              :class="{ active: createForm.watchAll }"
              @click="toggleWatchAll"
            >快捷@全部人员</span>
          </div>
          <el-select
            v-model="createForm.watcherIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择关注人（可@自己）"
            style="width: 100%"
            :disabled="createForm.watchAll"
          >
            <el-option
              v-for="acc in watcherOptions"
              :key="acc.accountId"
              :label="acc.accountName"
              :value="acc.accountId"
            />
          </el-select>
        </div>

        <div class="form-section">
          <div class="section-head">
            <h4>关联订单</h4>
          </div>
          <el-input
            v-model="createForm.orderId"
            placeholder="请输入订单号（数字）"
            clearable
          />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-plain" type="button" @click="createVisible = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submitCreate">确定</button>
      </template>
    </AppModal>

    <!-- 处理日志弹窗 -->
    <AppModal v-model="logsVisible" :title="logsTitle" width="640px">
      <div class="logs-panel">
        <table class="logs-table">
          <thead>
            <tr>
              <th>人员</th>
              <th>状态</th>
              <th>处理时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in logsList" :key="row.accountId">
              <td>
                <div class="log-user">
                  <span class="log-avatar">{{ row.accountName?.slice(0, 1) }}</span>
                  <span>{{ row.accountName }}</span>
                </div>
              </td>
              <td>
                <span
                  class="logs-status"
                  :class="row.status === LOG_STATUS.DONE ? 'is-done' : 'is-undone'"
                >{{ row.status === LOG_STATUS.DONE ? '已处理' : '未处理' }}</span>
              </td>
              <td class="log-time">
                {{ row.status === LOG_STATUS.DONE ? row.handledAt : '—' }}
              </td>
            </tr>
            <tr v-if="!logsList.length">
              <td colspan="3" class="logs-empty">暂无记录</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <button class="btn btn-primary btn-center" type="button" @click="logsVisible = false">
          确定
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.handover-log-page {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px 20px 24px;
  box-sizing: border-box;
}

/* ===== 工具栏 ===== */
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 16px 0 12px;
}

.related-check {
  font-size: 13px;
}

/* ===== 卡片网格 ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  min-height: 200px;
}

.log-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 6px 18px rgba(30, 41, 59, 0.05);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.creator {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #4b5563;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.creator-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.creator-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.create-time {
  font-size: 12px;
  color: #8a93a6;
}

.badge {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.badge-pending {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.badge-done {
  color: #0f9f6e;
  background: rgba(15, 159, 110, 0.1);
}

.card-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #374151;
  word-break: break-all;
}

.card-field {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.field-label {
  color: #8a93a6;
}

.field-empty {
  color: #b6bdcb;
}

.order-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-faint);
}

.card-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px dashed #eef1f6;
}

.watchers {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.watcher-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
  background: rgba(253, 230, 138, 0.65);
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ===== 空状态（noTransactionHistory.png 居中展示） ===== */
.card-grid :deep(.el-empty) {
  padding: 48px 0 24px;
}

.card-grid :deep(.el-empty__image) {
  height: auto;
  display: flex;
  justify-content: center;
}

.empty-img {
  width: 96px;
  opacity: 0.85;
  margin-bottom: 8px;
}

.card-grid :deep(.el-empty__description p) {
  color: var(--text-sub);
  font-size: 13px;
}

/* ===== 分页 ===== */
.page-footer {
  margin-top: 14px;
}

/* ===== 按钮（沿用项目主按钮风格） ===== */
.btn {
  border: none;
  border-radius: 10px;
  padding: 9px 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: filter 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  box-shadow: 0 10px 20px var(--primary-glow-strong);
}

.btn-primary:hover {
  filter: brightness(1.06);
}

.btn-plain {
  background: #f2f4f7;
  color: #475467;
}

.btn-plain:hover {
  background: #e8ecf3;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 8px;
}

/* ===== 新增弹窗 ===== */
.create-form {
  display: grid;
  gap: 14px;
}

.form-section {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid #eef0f6;
  border-radius: 14px;
  background: #fbfcff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.form-section:focus-within {
  border-color: var(--primary-border-strong);
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.section-head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1f2433;
  padding-left: 8px;
  border-left: 3px solid var(--primary);
  line-height: 1.2;
}

.required {
  font-style: normal;
  color: #d92d20;
  font-size: 14px;
  margin-left: -6px;
}

.quick-chip {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #667085;
  background: var(--bg-card);
  border: 1px dashed #cfd5e4;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
}

.quick-chip:hover {
  border-color: #8b5cf6;
  color: var(--primary);
}

.quick-chip.active {
  color: var(--text-invert);
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  border-style: solid;
  border-color: transparent;
  box-shadow: 0 6px 14px var(--primary-glow-strong);
}

/* 弹窗内输入框/下拉统一圆角与聚焦色 */
.create-form :deep(.el-textarea__inner),
.create-form :deep(.el-select__wrapper),
.create-form :deep(.el-input__wrapper) {
  border-radius: 10px;
}

.create-form :deep(.el-textarea__inner:focus),
.create-form :deep(.el-select__wrapper.is-focused),
.create-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 3px var(--primary-border);
}

/* ===== 处理日志弹窗 ===== */
.logs-panel {
  border: 1px solid #eef0f6;
  border-radius: 14px;
  background: #fbfcff;
  overflow: hidden;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.logs-table th,
.logs-table td {
  padding: 13px 16px;
  text-align: center;
}

.logs-table thead th {
  background: linear-gradient(180deg, #f3f0ff, #eef1fb);
  color: #4b3f72;
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: 0.02em;
}

.logs-table tbody tr {
  background: var(--bg-card);
  border-bottom: 1px solid #f2f4f9;
  transition: background 0.15s ease;
}

.logs-table tbody tr:last-child {
  border-bottom: none;
}

.logs-table tbody tr:hover {
  background: #faf9ff;
}

.log-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #344054;
  font-weight: 500;
}

.log-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #eef0f7;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.logs-status {
  display: inline-block;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.logs-status.is-done {
  color: #0f9f6e;
  background: rgba(15, 159, 110, 0.1);
}

.logs-status.is-undone {
  color: #98a2b3;
  background: rgba(152, 162, 179, 0.12);
}

.log-time {
  color: #667085;
  font-variant-numeric: tabular-nums;
}

.logs-empty {
  color: #b6bdcb;
  padding: 28px 0 !important;
}

.btn-center {
  margin: 0 auto;
  min-width: 140px;
  display: block!important;
}

@media (max-width: 1100px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
