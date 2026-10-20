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
          <button
            class="notice-chip"
            :class="{ shaking: bellShaking }"
            type="button"
            aria-label="系统通知"
            title="系统通知"
            @click="openNotify"
          >
            <span class="notice-icon">🔔</span>
            <span v-if="notify.unreadCount" class="notice-badge">
              {{ notify.unreadCount > 99 ? '99+' : notify.unreadCount }}
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
        </div>
      </div>

      <AppMain class="content" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../stores/user';
import { useNotifyStore } from '../stores/notify';
import Sidebar from './components/Sidebar.vue';
import AppMain from './components/AppMain.vue';

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
