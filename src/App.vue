<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
import AppTopbar from './components/AppTopbar.vue';
import ToastHost from './components/ToastHost.vue';
import ConfirmHost from './components/ConfirmHost.vue';
import WsBubbleHost from './components/WsBubbleHost.vue';
import UpdateDialog from './components/UpdateDialog.vue';
import { config, CURRENT_ENV, CLIENT_VERSION } from './config/env';
import { useNotifyStore } from './stores/notify';
import { usePreferencesStore } from './stores/preferences';
import { useUserStore } from './stores/user';
import { applyWatermark, removeWatermark } from './utils/watermark';

const route = useRoute();
const router = useRouter();
const isLoginPage = computed(() => route.name === 'Login');

const notifyStore = useNotifyStore();
const prefs = usePreferencesStore();
const userStore = useUserStore();

let offOpenNotify = null;
let stopWatermarkWatch = null;

/** 水印文字：应用名 + 当前登录人 + 日期（登录人取自 userStore，登录/登出自动刷新） */
function watermarkText() {
  const who = userStore.displayName && userStore.displayName !== '未登录' ? userStore.displayName : '';
  const date = dayjs().format('YYYY-MM-DD');
  return who ? `未来电竞管理系统 · ${who} · ${date}` : `未来电竞管理系统 · ${date}`;
}

onMounted(() => {
  const info = { env: CURRENT_ENV, name: config.name, version: CLIENT_VERSION, baseURL: config.apibaseURL };
  console.log('[ENV] 当前环境:', info);
  if (window.appInfo) {
    window.appInfo.reportEnv(info);
  }

  // 初始化系统通知即时通讯通道（卡单订单推送 / 消息冒泡 / 托盘闪烁）
  notifyStore.init();

  // 窗口重新聚焦时停止托盘闪烁（提醒目的已达到）
  if (window.notifyBridge && window.notifyBridge.clearFlash) {
    window.addEventListener('focus', () => window.notifyBridge.clearFlash());
  }

  // 主进程拉起系统通知相关页面（点击托盘悬停未读列表条目 / 冒泡小窗跳转时触发）
  if (window.notifyBridge && window.notifyBridge.onOpenNotify) {
    offOpenNotify = window.notifyBridge.onOpenNotify((path) => {
      router.push(path || '/notify');
    });
  }

  // 页面水印（设置面板开关控制）：开启时立即挂载，关闭时移除；登录人变化时刷新水印文字
  if (prefs.watermark) {
    applyWatermark(watermarkText());
  }
  stopWatermarkWatch = watch(
    () => `${prefs.watermark}:${userStore.displayName}`,
    () => {
      if (prefs.watermark) applyWatermark(watermarkText());
      else removeWatermark();
    }
  );
});

onBeforeUnmount(() => {
  if (offOpenNotify) {
    offOpenNotify();
    offOpenNotify = null;
  }
  if (stopWatermarkWatch) {
    stopWatermarkWatch();
    stopWatermarkWatch = null;
  }
  removeWatermark();
});
</script>

<template>
  <div class="app-frame">
    <AppTopbar />

    <div class="app-root">
      <router-view />
    </div>

    <ToastHost />
    <ConfirmHost />
    <WsBubbleHost />
    <UpdateDialog />
  </div>
</template>

<style scoped>
.app-frame {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid var(--app-frame-border);
  /* box-shadow: 1px 1px 70px rgba(8, 5, 28, .6), 0 2px 12px rgba(8, 5, 28, .45), inset 0 0 0 1px hsla(0, 0%, 100%, .04); */
}

.app-root {
  flex: 1;
  width: 100%;
  min-height: 0;
}
</style>
