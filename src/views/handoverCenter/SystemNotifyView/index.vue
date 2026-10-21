<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNotifyStore } from '../../../stores/notify';
import { NOTIFY_TYPE } from '../../../api/notifySocket';
import { notifyApi, normalizeNotification } from '../../../api/modules/notification';
import { useToast } from '../../../composables/useToast';

/**
 * 工作协作 > 系统通知（入口：右上角铃铛）
 * - 顶部「仅看未读」开关（可选中 / 取消选中）+ 全部已读
 * - 列表字段：标题 / 正文 / 时间 / 查看（点击=标记已读并跳转对应页面）
 * - 数据源：管理端接口 GET /api/admin/notifications（后端为权威列表）；
 *   已读走 POST /api/admin/notifications/{id}/read（接口无批量端点，全部已读按未读列表逐条提交）；
 *   接口不可用时（如本地 mock 环境无后端）回落到 store 实时通道列表，保证页面可用
 */
const notify = useNotifyStore();
const router = useRouter();
const { show } = useToast();

const onlyUnread = ref(false); // 仅看未读开关
const items = ref([]); // 接口返回的通知列表（新在前）
const loading = ref(false);

const filtered = computed(() =>
  onlyUnread.value ? items.value.filter((i) => !i.read) : items.value
);
const unreadCount = computed(() => items.value.filter((i) => !i.read).length);

/* ================= 列表加载（管理端接口） ================= */
async function loadList() {
  loading.value = true;
  try {
    const list = await notifyApi.list();
    items.value = (Array.isArray(list) ? list : [])
      .map(normalizeNotification)
      .sort((a, b) => String(b.time).localeCompare(String(a.time)));
    // 同步到 store：铃铛角标 / 托盘未读列表与后端保持一致
    notify.items = items.value;
    notify.syncTrayBadge();
  } catch {
    // 接口不可用（本地 mock 环境等）：回落到实时通道列表
    items.value = notify.items.slice();
  } finally {
    loading.value = false;
  }
}

/* ================= 时间显示（相对时间，如“2分钟前”） ================= */
function relativeTime(t) {
  if (!t) return '';
  const then = new Date(String(t).replace(/-/g, '/')).getTime();
  if (Number.isNaN(then)) return String(t);
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  return String(t).slice(0, 10);
}

/* ================= 跳转（按消息类型） ================= */
function jumpLabel(item) {
  if (item.type === NOTIFY_TYPE.STUCK) return '订单列表';
  if (item.type === NOTIFY_TYPE.HANDOVER) return '交接日志';
  return '系统通知';
}
function jumpTarget(item) {
  if (item.type === NOTIFY_TYPE.STUCK) return { path: '/orders/manage', query: { tab: 'order' } };
  if (item.type === NOTIFY_TYPE.HANDOVER) return '/handover/log';
  return '/notify';
}

/** 点击查看：未读 → 先调接口标记已读，再按类型跳转对应页面 */
async function handleView(item) {
  if (!item.read) {
    try {
      await notifyApi.markRead(item.id);
      item.read = true;
      notify.syncTrayBadge();
    } catch {
      // 接口不可用时（本地 mock 环境）回落到本地标记；真实环境 id 不在 store 中则为空操作
      notify.markRead(item.id);
      notify.syncTrayBadge();
    }
  }
  router.push(jumpTarget(item));
}

/** 全部已读：接口无批量端点，按未读列表逐条提交，全部成功再更新本地状态 */
async function handleMarkAllRead() {
  const unread = items.value.filter((i) => !i.read);
  if (!unread.length) return;
  const results = await Promise.allSettled(unread.map((i) => notifyApi.markRead(i.id)));
  const ok = results.filter((r) => r.status === 'fulfilled').length;

  if (ok === 0) {
    // 接口不可用（本地 mock 环境）：回落到本地全部已读，保持演示可用
    unread.forEach((i) => {
      i.read = true;
    });
    notify.markAllRead();
    show('已全部标记为已读', 'success');
    return;
  }

  unread.forEach((item, idx) => {
    if (results[idx].status === 'fulfilled') item.read = true;
  });
  notify.items = items.value;
  notify.syncTrayBadge();
  if (ok === results.length) {
    show('已全部标记为已读', 'success');
  } else {
    show(`已标记 ${ok} 条，${results.length - ok} 条失败`, 'error');
  }
}

onMounted(() => {
  // 进入本页：清空气泡、停止托盘闪烁
  notify.clearBubbles();
  if (window.notifyBridge && window.notifyBridge.clearFlash) {
    window.notifyBridge.clearFlash();
  }
  loadList();
});
</script>

<template>
  <div class="system-notify-page">
    <!-- 顶部工具条：仅看未读 + 全部已读 -->
    <div class="notify-toolbar">
      <el-checkbox v-model="onlyUnread" class="only-unread-check">仅看未读</el-checkbox>
      <div class="toolbar-right">
        <span v-if="unreadCount" class="total-unread">未读 {{ unreadCount }} 条</span>
        <button
          class="btn btn-plain btn-sm"
          type="button"
          :disabled="!unreadCount"
          @click="handleMarkAllRead"
        >全部已读</button>
      </div>
    </div>

    <!-- 通知列表 -->
    <div class="notify-list" v-loading="loading">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="notify-item"
        :class="{ unread: !item.read }"
        @click="handleView(item)"
      >
        <div class="item-body">
          <div class="item-head">
            <span v-if="!item.read" class="unread-dot" title="未读" />
            <strong class="item-title">{{ item.title }}</strong>
            <span class="item-time">{{ relativeTime(item.time) }}</span>
          </div>
          <p class="item-content">{{ item.content }}</p>
        </div>

        <button
          class="btn btn-primary btn-sm view-btn"
          type="button"
          @click.stop="handleView(item)"
        >查看</button>
      </div>

      <el-empty v-if="!filtered.length" :description="onlyUnread ? '暂无未读通知' : '暂无通知'" />
    </div>
  </div>
</template>

<style scoped>
.system-notify-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 24px;
  box-sizing: border-box;
  overflow: hidden; /* 页面本身不滚动，工具条固定，仅列表区滚动 */
}

/* ===== 顶部工具条（固定，不随列表滚动） ===== */
.notify-toolbar {
  flex-shrink: 0; /* 固定在这一栏，不随内容滚动 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border-radius: 14px;
  padding: 12px 20px;
  margin-bottom: 14px;
  box-shadow: 0 6px 18px rgba(30, 41, 59, 0.05);
}

.only-unread-check {
  font-size: 14px;
  font-weight: 600;
  color: #2a3043;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-unread {
  font-size: 12px;
  color: #d92d20;
  font-weight: 600;
}

/* ===== 通知列表（仅此区域滚动） ===== */
.notify-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto; /* 工具条固定后，只有列表区上下滚动 */
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.notify-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid rgba(132, 146, 176, 0.12);
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(30, 41, 59, 0.05);
  cursor: pointer;
  transition: all 0.18s ease;
}

.notify-item:hover {
  border-color: var(--primary-glow-strong);
  box-shadow: 0 10px 24px var(--primary-faint);
}

.notify-item.unread {
  background: linear-gradient(180deg, #fdfbff, #fbfcff);
  border-color: rgba(217, 45, 32, 0.22);
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-title {
  font-size: 14px;
  color: #1f2433;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.14);
}

.item-time {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  color: #9aa3b5;
}

.item-content {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #374151;
  word-break: break-all;
}

.view-btn {
  flex-shrink: 0;
}

/* ===== 按钮（沿用项目主按钮风格） ===== */
.btn {
  border: none;
  border-radius: 10px;
  padding: 9px 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: filter 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, opacity 0.18s ease;
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

.btn-plain:hover:not(:disabled) {
  background: #e8ecf3;
}

.btn-plain:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
  border-radius: 8px;
}
</style>
