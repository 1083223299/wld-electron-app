<script setup>
import { useRouter } from 'vue-router';
import { useNotifyStore } from '../stores/notify';
import { NOTIFY_TYPE } from '../api/notifySocket';

/**
 * 系统通知 · 消息冒泡组件
 * 收到 WebSocket 消息时在窗口右上角自动弹出气泡：
 * - 滑入动画，自动消失（8s），最多同屏 3 条
 * - 点击气泡跳转「系统通知」列表
 * - 点击 × 手动关闭
 */
const notify = useNotifyStore();
const router = useRouter();

const ICONS = {
  [NOTIFY_TYPE.STUCK]: { text: '卡', title: '卡单预警' },
  [NOTIFY_TYPE.HANDOVER]: { text: '交', title: '交接提醒' },
  [NOTIFY_TYPE.SYSTEM]: { text: '告', title: '系统公告' },
};

function openList(bubble) {
  notify.dismissBubble(bubble.id);
  router.push('/notify');
}
</script>

<template>
  <Teleport to="body">
    <div class="ws-bubble-host">
      <TransitionGroup name="bubble">
        <div
          v-for="b in notify.bubbles"
          :key="b.id"
          class="ws-bubble"
          :class="`is-${b.type}`"
          @click="openList(b)"
        >
          <div class="bubble-icon">{{ ICONS[b.type]?.text || '告' }}</div>

          <div class="bubble-body">
            <div class="bubble-head">
              <strong class="bubble-title">{{ b.title }}</strong>
              <span class="bubble-time">{{ b.time.slice(11, 19) }}</span>
            </div>
            <p class="bubble-content">{{ b.content }}</p>
            <div v-if="b.mentions.length" class="bubble-mentions">
              <span v-for="m in b.mentions" :key="m" class="mention-chip">@{{ m }}</span>
            </div>
          </div>

          <span class="bubble-close" title="关闭" @click.stop="notify.dismissBubble(b.id)">×</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.ws-bubble-host {
  position: fixed;
  top: 68px;
  right: 18px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.ws-bubble {
  pointer-events: auto;
  width: 340px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}

.ws-bubble:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(30, 41, 59, 0.24);
}

.bubble-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.is-stuck .bubble-icon {
  background: linear-gradient(135deg, #ef4444, #f97316);
  box-shadow: 0 6px 14px rgba(239, 68, 68, 0.3);
}

.is-handover .bubble-icon {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  box-shadow: 0 6px 14px var(--primary-glow);
}

.is-system .bubble-icon {
  background: linear-gradient(135deg, #64748b, #94a3b8);
  box-shadow: 0 6px 14px rgba(100, 116, 139, 0.28);
}

.bubble-body {
  flex: 1;
  min-width: 0;
}

.bubble-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bubble-title {
  font-size: 13px;
  color: var(--text-main);
}

.bubble-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-sub);
  font-variant-numeric: tabular-nums;
}

.bubble-content {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-sub);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.bubble-mentions {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mention-chip {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #b45309;
  background: rgba(253, 230, 138, 0.65);
}

.bubble-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  color: var(--text-sub);
  background: var(--bg-stripe);
  transition: all 0.15s ease;
}

.bubble-close:hover {
  color: var(--text-main);
  background: var(--border);
}

/* 滑入动画 */
.bubble-enter-from {
  opacity: 0;
  transform: translateX(36px);
}

.bubble-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.bubble-enter-active,
.bubble-leave-active {
  transition: all 0.26s ease;
}

.bubble-leave-active {
  position: absolute;
  right: 0;
}
</style>
