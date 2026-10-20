<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { usePreferencesStore } from '../stores/preferences';
import { useToast } from '../composables/useToast';

const { show: showToast } = useToast();
const bridge = window.settingsBridge;
const bridgeReady = !!bridge;
const prefs = usePreferencesStore();

const open = ref(false); // 面板是否显示
const pinned = ref(false); // 是否已点击固定（固定后移出鼠标不自动关闭）
let closeTimer = null;

/* ---- 设置项状态 ---- */
const version = ref('');
const autoLaunch = ref(true); // 开机自动启动（默认开启，主进程兜底）
const autoUpdate = ref(true); // 自动更新（默认开启）
const checking = ref(false); // 检查更新进行中
const clearing = ref(false); // 清除缓存进行中

/* ---- 纯前端偏好（localStorage 持久化） ---- */
const listMemory = ref(prefs.listMemory); // 列表记忆：记住每个列表页的每页条数
const watermark = ref(prefs.watermark); // 页面水印：防截图泄密

function toggleListMemory(val) {
  prefs.setListMemory(val);
}
function toggleWatermark(val) {
  prefs.setWatermark(val);
}

/* ---- 更新状态 ---- */
const updateStatus = ref('idle'); // idle | checking | available | downloading | downloaded | not-available | error | dev | disabled
const updateVersion = ref(null);
const updateError = ref(null);
const updateProgress = ref(null);

const statusText = computed(() => {
  const v = updateVersion.value ? ` v${updateVersion.value}` : '';
  switch (updateStatus.value) {
    case 'checking': return '正在检查更新…';
    case 'available': return `发现新版本${v}，正在自动下载…`;
    case 'downloading': return `正在下载更新${v}（${Math.round(updateProgress.value || 0)}%）…`;
    case 'downloaded': return `新版本${v}已下载完成`;
    case 'not-available': return '已是最新版本';
    case 'error': return `检查更新失败：${updateError.value || '未知错误'}`;
    // case 'dev': return '开发模式不支持检查更新，请使用打包版本测试';
    case 'disabled': return '自动更新组件未安装（electron-updater）';
    default: return '开启自动更新后，新版本将自动下载并提示安装';
  }
});

/* ---- 面板显示控制：鼠标移入打开 / 移出关闭 / 点击固定 ---- */
function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}
function onMouseEnter() {
  clearCloseTimer();
  open.value = true;
}
function onMouseLeave() {
  if (pinned.value) return;
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    open.value = false;
  }, 180);
}
function onGearClick() {
  if (open.value) {
    if (pinned.value) {
      pinned.value = false;
      open.value = false;
    } else {
      pinned.value = true;
      clearCloseTimer();
    }
  } else {
    open.value = true;
    pinned.value = true;
  }
}
function onMaskClick() {
  pinned.value = false;
  open.value = false;
}

/* ---- 设置操作 ---- */
function applyState(s) {
  if (!s) return;
  if (s.version) version.value = s.version;
  if (s.autoLaunch !== undefined) autoLaunch.value = !!s.autoLaunch;
  if (s.autoUpdate !== undefined) autoUpdate.value = !!s.autoUpdate;
  if (s.updateStatus) updateStatus.value = s.updateStatus;
  if (s.updateVersion) updateVersion.value = s.updateVersion;
  if (s.updateError) updateError.value = s.updateError;
  if (s.updateProgress !== null && s.updateProgress !== undefined) updateProgress.value = s.updateProgress;
}

async function toggleAutoLaunch(val) {
  if (!bridgeReady) return;
  try {
    applyState(await bridge.setAutoLaunch(val));
  } catch (e) {
    autoLaunch.value = !val; // 失败回滚
    console.error('[settings] 切换开机自启失败:', e);
  }
}

async function toggleAutoUpdate(val) {
  if (!bridgeReady) return;
  try {
    applyState(await bridge.setAutoUpdate(val));
  } catch (e) {
    autoUpdate.value = !val;
    console.error('[settings] 切换自动更新失败:', e);
  }
}

async function checkUpdate() {
  if (!bridgeReady || checking.value) return;
  checking.value = true;
  try {
    await bridge.checkUpdate();
  } catch (e) {
    updateStatus.value = 'error';
    updateError.value = String((e && e.message) || e);
  } finally {
    checking.value = false;
  }
}

async function downloadUpdate() {
  if (!bridgeReady) return;
  try {
    await bridge.downloadUpdate();
  } catch (e) {
    updateStatus.value = 'error';
    updateError.value = String((e && e.message) || e);
  }
}

/* 清除缓存（轻量版：只清 HTTP 请求缓存，不影响登录与本地数据） */
async function clearCache() {
  if (!bridgeReady || clearing.value) return;
  const clearFn = window.appInfo && window.appInfo.clearCache;
  if (typeof clearFn !== 'function') {
    showToast('当前运行版本未包含清除缓存功能，请重启应用后重试', 'error');
    return;
  }
  clearing.value = true;
  try {
    const res = await clearFn();
    if (res && res.ok) {
      showToast('缓存已清除，下次请求自动加载最新数据');
    } else {
      showToast((res && res.message) || '清除缓存失败', 'error');
    }
  } catch (e) {
    showToast('清除缓存失败：' + String((e && e.message) || e), 'error');
  } finally {
    clearing.value = false;
  }
}

function quitAndInstall() {
  if (!bridgeReady) return;
  bridge.quitAndInstall();
}

/* ---- 生命周期 ---- */
let offUpdateStatus = null;
onMounted(async () => {
  if (!bridgeReady) return;
  try {
    applyState(await bridge.getState());
  } catch (e) {
    console.error('[settings] 读取设置失败:', e);
  }
  offUpdateStatus = bridge.onUpdateStatus((payload) => {
    if (!payload) return;
    updateStatus.value = payload.status || updateStatus.value;
    if (payload.version) updateVersion.value = payload.version;
    if (payload.extra && payload.extra.percent !== undefined) updateProgress.value = payload.extra.percent;
    if (payload.status === 'error') updateError.value = payload.extra || updateError.value;
    if (payload.status === 'available') updateError.value = null;
  });
});
onBeforeUnmount(() => {
  clearCloseTimer();
  if (offUpdateStatus) offUpdateStatus();
});
</script>

<template>
  <span
    class="settings-switcher"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <button
      class="settings-btn"
      :class="{ active: open }"
      type="button"
      title="设置"
      aria-label="设置"
      @click="onGearClick"
    >
      <svg class="gear-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
          fill="currentColor"
        />
      </svg>
    </button>

    <transition name="settings-pop">
      <div v-if="open" class="settings-panel" role="dialog" aria-label="应用设置">
        <div class="panel-head">
          <div>
            <div class="panel-title">设置</div>
            <div class="panel-sub">SETTINGS · 应用偏好</div>
          </div>
          <span class="panel-badge" :class="updateStatus === 'downloaded' ? 'has-update' : ''">
            {{ version ? 'v' + version : '--' }}
          </span>
        </div>

        <div class="panel-body">
          <!-- 开机自动启动 -->
          <div class="setting-row">
            <div class="row-text">
              <div class="row-title">开机自动启动</div>
              <div class="row-desc">登录系统后自动在后台运行</div>
            </div>
            <el-switch
              v-model="autoLaunch"
              :disabled="!bridgeReady"
              size="small"
              @change="toggleAutoLaunch"
            />
          </div>

          <!-- 自动更新 -->
          <div class="setting-row">
            <div class="row-text">
              <div class="row-title">自动启动检测更新</div>
              <div class="row-desc">有新版本时自动下载，完成后提示安装</div>
            </div>
            <el-switch
              v-model="autoUpdate"
              :disabled="!bridgeReady"
              size="small"
              @change="toggleAutoUpdate"
            />
          </div>

          <!-- 界面偏好（纯前端，localStorage 记忆） -->
          <div class="pref-title">界面偏好</div>

          <!-- <div class="setting-row">
            <div class="row-text">
              <div class="row-title">列表记忆</div>
              <div class="row-desc">记住每个列表页的每页条数</div>
            </div>
            <el-switch
              v-model="listMemory"
              size="small"
              @change="toggleListMemory"
            />
          </div> -->

          <div class="setting-row">
            <div class="row-text">
              <div class="row-title">页面水印</div>
              <div class="row-desc">半透明水印覆盖页面</div>
            </div>
            <el-switch
              v-model="watermark"
              size="small"
              @change="toggleWatermark"
            />
          </div>

          <!-- 版本与检查更新 -->
          <div class="setting-row version-row">
            <div class="row-text">
              <div class="row-title">当前版本</div>
              <div class="row-desc">{{ bridgeReady ? 'v' + (version || '--') : '当前环境不可用' }}</div>
            </div>
            <button
              class="check-btn"
              type="button"
              :disabled="!bridgeReady || checking || updateStatus === 'downloading'"
              @click="checkUpdate"
            >
              {{ checking ? '检查中…' : '检查更新' }}
            </button>
          </div>

          <!-- 清除缓存 -->
          <div class="setting-row">
            <div class="row-text">
              <div class="row-title">清除缓存</div>
              <div class="row-desc">清理网络请求缓存，解决页面异常（不影响登录）</div>
            </div>
            <button
              class="check-btn"
              type="button"
              :disabled="!bridgeReady || clearing"
              @click="clearCache"
            >
              {{ clearing ? '清除中…' : '清除缓存' }}
            </button>
          </div>

          <!-- 更新状态 -->
          <div
            v-if="updateStatus !== 'idle'"
            class="update-status"
            :class="{ error: updateStatus === 'error' || updateStatus === 'dev' || updateStatus === 'disabled' }"
          >
            <span class="status-dot" :class="updateStatus"></span>
            <span class="status-text">{{ statusText }}</span>
            <button
              v-if="updateStatus === 'available' && !autoUpdate"
              class="mini-btn"
              type="button"
              @click="downloadUpdate"
            >
              立即下载
            </button>
            <button
              v-if="updateStatus === 'downloaded'"
              class="mini-btn primary"
              type="button"
              @click="quitAndInstall"
            >
              立即重启安装
            </button>
          </div>
        </div>

        <div class="panel-foot">
          <span class="foot-tip">✦ 设置自动保存，重启后依然生效</span>
        </div>
      </div>
    </transition>

    <div v-if="open" class="settings-mask" @click="onMaskClick"></div>
  </span>
</template>

<style scoped>
.settings-switcher {
  position: relative;
  display: inline-flex;
  -webkit-app-region: no-drag;
}

/* ---- 触发按钮：与主题换肤按钮同风格 ---- */
.settings-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--primary-border);
  background: var(--bg-elevated);
  color: var(--text-main);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
.settings-btn:hover,
.settings-btn.active {
  border-color: var(--primary-border-strong);
  color: var(--primary);
  box-shadow: 0 4px 12px var(--primary-glow);
}
.settings-btn:active {
  transform: scale(0.94);
}
.gear-icon {
  display: block;
  transition: transform 0.4s ease;
}
.settings-btn:hover .gear-icon,
.settings-btn.active .gear-icon {
  transform: rotate(60deg);
}

/* ---- 面板 ---- */
.settings-panel {
  position: absolute;
  top: calc(100% + 12px);
  right: -4px;
  width: 316px;
  padding: 16px;
  z-index: 61;
  background: var(--panel-glass);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  text-align: left;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: 0.02em;
}
.panel-sub {
  margin-top: 3px;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--text-faint);
}
.panel-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
  background: var(--primary-soft);
  color: var(--primary);
}
.panel-badge.has-update {
  background: var(--danger);
  color: #fff;
}

/* ---- 设置项 ---- */
.panel-body {
  margin-top: 12px;
}
/* ---- 界面偏好分区标题 ---- */
.pref-title {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-soft);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 2px;
}
.setting-row + .setting-row {
  border-top: 1px dashed var(--border-soft);
}
.row-text {
  min-width: 0;
}
.row-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}
.row-desc {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-faint);
}

/* ---- 检查更新按钮 ---- */
.check-btn {
  flex-shrink: 0;
  border: 1px solid var(--primary-border-strong);
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}
.check-btn:hover:not(:disabled) {
  background: var(--primary);
  color: var(--text-invert);
  box-shadow: 0 4px 12px var(--primary-glow);
}
.check-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ---- 更新状态行 ---- */
.update-status {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--text-sub);
}
.update-status.error {
  border-color: rgba(239, 68, 68, 0.35);
  color: var(--danger);
}
.status-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
}
.status-dot.checking,
.status-dot.downloading {
  background: var(--primary);
  animation: dot-pulse 1s ease-in-out infinite;
}
.status-dot.available {
  background: #f59e0b;
}
.status-dot.downloaded {
  background: #22c55e;
}
.status-dot.error,
.status-dot.dev,
.status-dot.disabled {
  background: var(--danger);
}
.status-dot.not-available {
  background: #22c55e;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.status-text {
  flex: 1;
  min-width: 0;
  line-height: 1.5;
}

.mini-btn {
  flex-shrink: 0;
  border: 1px solid var(--primary-border-strong);
  background: transparent;
  color: var(--primary);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}
.mini-btn:hover {
  background: var(--primary-soft);
}
.mini-btn.primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-hover));
  color: var(--text-invert);
  border: none;
}
.mini-btn.primary:hover {
  filter: brightness(1.06);
}

/* ---- 底部提示 ---- */
.panel-foot {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-soft);
}
.foot-tip {
  font-size: 11px;
  color: var(--text-sub);
}

/* ---- 关闭蒙层（点击面板外关闭） ---- */
.settings-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: transparent;
}

/* ---- 弹出动画 ---- */
.settings-pop-enter-active,
.settings-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.settings-pop-enter-from,
.settings-pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
