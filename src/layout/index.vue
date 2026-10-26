<template>
  <div class="admin-layout">
    <Sidebar class="sidebar" :collapsed="sidebarCollapsed" :class="{ collapsed: sidebarCollapsed }" />
    <div class="main-panel">
      <div class="breadcrumb-row">
        <button class="collapse-btn" type="button" @click="toggleSidebar" aria-label="收起/展开侧边栏">
          <span class="collapse-icon" :class="{ flipped: sidebarCollapsed }">☰</span>
        </button>

        <div class="breadcrumb">
          <template v-for="(item, index) in breadcrumbs" :key="item.path || index">
            <span v-if="index > 0" class="divider">/</span>
            <span
              class="page-name"
              :class="{
                'app-name': index === 0 && breadcrumbs.length > 1,
                current: index === breadcrumbs.length - 1,
              }"
            >
              {{ item.meta?.title }}
            </span>
          </template>
        </div>

        <div class="business-actions">
          <ThemePanel />
          <SettingsPanel />

          <button
            class="notice-chip"
            :class="{ shaking: bellShaking }"
            type="button"
            aria-label="系统通知"
            title="系统通知"
            @click="openNotify"
          >
            <span class="notice-icon">🔔</span>
            <span v-if="notify.badgeText" class="notice-badge">
              {{ notify.badgeText }}
            </span>
          </button>

          <el-dropdown trigger="hover" @command="handleCommand">
            <span class="user">
              <img src="../assets/images/defaulIcon.png" alt="avatar" />
              <span class="user-name">{{ userStore.displayName }}</span>
              <span class="caret"></span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <div class="window-controls">
            <button class="win-btn" type="button" title="最小化" @click="minimize">
              <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.2" /></svg>
            </button>
            <button
              class="win-btn"
              type="button"
              :title="isMaximized ? '还原' : '最大化'"
              @click="toggleMaximize"
            >
              <svg v-if="!isMaximized" viewBox="0 0 12 12" width="12" height="12">
                <rect x="2.4" y="2.4" width="7.2" height="7.2" fill="none" stroke="currentColor" stroke-width="1.2" />
              </svg>
              <svg v-else viewBox="0 0 12 12" width="12" height="12">
                <rect x="2.2" y="3.4" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2" />
                <path d="M4 3.4V2.2h6v6H8.8" fill="none" stroke="currentColor" stroke-width="1.2" />
              </svg>
            </button>
            <button class="win-btn close" type="button" title="关闭" @click="closeWindow">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <AppMain class="content" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../stores/user';
import { useNotifyStore } from '../stores/notify';
import Sidebar from './components/Sidebar.vue';
import AppMain from './components/AppMain.vue';
import ThemePanel from '../components/ThemePanel.vue';
import SettingsPanel from '../components/SettingsPanel.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const notify = useNotifyStore();
const sidebarCollapsed = ref(false);

/* ================= 顶部铃铛（系统通知） ================= */
const bellShaking = ref(false);

// 收到新消息时铃铛晃动（监听 store 的脉冲计数）
watch(
  () => notify.pulse,
  () => {
    bellShaking.value = true;
    setTimeout(() => {
      bellShaking.value = false;
    }, 900);
  }
);

function openNotify() {
  if (window.notifyBridge && window.notifyBridge.clearFlash) {
    window.notifyBridge.clearFlash();
  }
  router.push('/notify');
}

// 面包屑：取 route.matched 中带 meta.title 的层级，非首页时在最前面补「首页」
const breadcrumbs = computed(() => {
  const matched = route.matched.filter((item) => item.meta && item.meta.title);
  const first = matched[0];
  const isHome = first && ['Home', 'home'].includes(String(first.name));
  if (isHome) return matched;
  return [{ path: '/home', name: 'Home', meta: { title: '首页' } }, ...matched];
});

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

/* ================= 窗口控制（桌面端顶栏） ================= */
const winControls = window.windowControls;
const isMaximized = ref(false);
let offMaximizeChange = null;

function minimize() {
  winControls && winControls.minimize();
}
function toggleMaximize() {
  winControls && winControls.toggleMaximize();
}
function closeWindow() {
  winControls && winControls.close();
}

onMounted(() => {
  if (winControls && winControls.onMaximizeChange) {
    offMaximizeChange = winControls.onMaximizeChange((value) => {
      isMaximized.value = value;
    });
  }
});

onBeforeUnmount(() => {
  if (offMaximizeChange) offMaximizeChange();
});

function handleCommand(command) {
  if (command === 'logout') {
    userStore.logout();
    ElMessage.success('已退出登录');
    router.push('/login');
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg-page);
  overflow: hidden;
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 64px;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.breadcrumb-row {
  height: 59px;
  min-height: 59px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 0 18px;
  background: var(--bg-topbar);
  border-bottom: 1px solid var(--border-soft);
  -webkit-app-region: drag; /* 顶栏空白区域可拖动窗口 */
  user-select: none;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-soft);
  background: var(--bg-elevated);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  -webkit-app-region: no-drag;
}

.collapse-btn:hover {
  border-color: var(--primary-border-strong);
  background: var(--primary-soft);
  color: var(--primary);
}

.collapse-icon {
  display: inline-block;
  font-size: 18px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.collapse-icon.flipped {
  transform: rotate(180deg);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-sub);
}

.app-name {
  font-weight: 600;
  color: var(--text-main);
}

.divider {
  color: var(--text-faint);
}

.page-name {
  color: var(--text-sub);
}

.page-name.current {
  color: var(--text-main);
  font-weight: 600;
}

.business-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}

/* ================= 窗口控制按钮 ================= */
.window-controls {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  margin-left: 6px;
  border-left: 1px solid var(--border-soft);
  padding-left: 2px;
}

.win-btn {
  width: 40px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.win-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-main);
}

.win-btn.close:hover {
  background: var(--danger);
  color: #fff;
}

.user {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.user-name {
  color: var(--primary);
  font-weight: 600;
  font-size: 15px;
}

.user .caret {
  color: var(--text-sub);
  font-size: 12px;
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  opacity: 0.8;
  margin-bottom: 5px;
}

.user img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.notice-chip {
  position: relative;
  width: 32px;
  height: 32px;
  border: 1px solid var(--primary-border);
  background: var(--bg-elevated);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-main);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.notice-chip:hover {
  border-color: var(--primary-border-strong);
  box-shadow: 0 4px 12px var(--primary-glow);
}

/* 收到新消息时铃铛晃动 */
.notice-chip.shaking {
  animation: bell-shake 0.9s ease;
}

@keyframes bell-shake {
  0%,
  100% {
    transform: rotate(0);
  }
  15% {
    transform: rotate(16deg);
  }
  30% {
    transform: rotate(-14deg);
  }
  45% {
    transform: rotate(10deg);
  }
  60% {
    transform: rotate(-7deg);
  }
  75% {
    transform: rotate(4deg);
  }
  90% {
    transform: rotate(-2deg);
  }
}

.notice-badge {
  position: absolute;
  right: -3px;
  top: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ff8a65, #ff5a5f);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
