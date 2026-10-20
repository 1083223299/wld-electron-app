<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useToast } from '../composables/useToast';

/**
 * 全局更新弹窗
 * ---------------------------------------------------------------
 * 监听主进程 settings:update-status 推送，驱动三种界面：
 *  - available   → 弹确认框「发现新版本，是否立即更新？」
 *  - downloading → 全屏遮罩 + 转圈动画 + 进度条，阻断一切操作
 *  - downloaded  → 弹提示框「更新已下载完成，重启后生效？」
 * ---------------------------------------------------------------
 */
const bridge = window.settingsBridge;
const { show: toast } = useToast();

const confirmVisible = ref(false);   // 确认/提示弹窗
const confirmMode = ref('available'); // available | downloaded
const downloading = ref(false);      // 下载中遮罩
const progress = ref(0);             // 下载进度 0-100
const version = ref('');
const errorMsg = ref('');

// 下载中遮罩最小展示时长：防止下载太快动画一闪而过
const MIN_SHOW_MS = 1500;
let minShowTimer = null;
let offUpdateStatus = null;

/** 处理主进程推送的更新状态 */
function handleStatus(payload) {
  const status = payload && payload.status;
  if (!status) return;

  switch (status) {
    case 'available':
      version.value = payload.version || '';
      errorMsg.value = '';
      confirmMode.value = 'available';
      confirmVisible.value = true;
      downloading.value = false;
      break;

    case 'downloading':
      confirmVisible.value = false;
      downloading.value = true;
      if (payload.extra && payload.extra.percent !== undefined) {
        progress.value = payload.extra.percent;
      }
      break;

    case 'downloaded':
      version.value = payload.version || version.value;
      progress.value = 100;
      // 如果下载过快（小于最小展示时长），遮罩稍作停留再切提示框，避免闪烁
      if (minShowTimer) clearTimeout(minShowTimer);
      minShowTimer = setTimeout(() => {
        downloading.value = false;
        confirmMode.value = 'downloaded';
        confirmVisible.value = true;
      }, 400);
      break;

    case 'error':
      downloading.value = false;
      confirmVisible.value = false;
      errorMsg.value = payload.extra || '未知错误';
      toast(`更新失败：${errorMsg.value}`, 'error', 4000);
      break;

    case 'not-available':
      break; // 已是最新，静默

    // case 'dev':
    //   toast(payload.extra || '开发模式不支持检查更新', 'warning', 4000);
    //   break;

    case 'disabled':
      toast(payload.extra || '自动更新组件未安装', 'warning', 4000);
      break;

    default:
      break;
  }
}

/** 用户点「立即更新」→ 通知主进程开始下载 */
function updateNow() {
  confirmVisible.value = false;
  progress.value = 0;
  if (bridge && bridge.downloadUpdate) {
    bridge.downloadUpdate();
  }
}

/** 「暂不更新 / 稍后重启」→ 关闭弹窗（已下载的更新会在退出时自动安装） */
function later() {
  confirmVisible.value = false;
  downloading.value = false;
}

/** 用户点「立即重启」→ 退出并安装更新 */
function restartNow() {
  if (bridge && bridge.quitAndInstall) {
    bridge.quitAndInstall();
  }
}

/* 下载中：遮罩至少展示 MIN_SHOW_MS 毫秒，避免闪烁 */
watch(downloading, (v) => {
  if (minShowTimer) clearTimeout(minShowTimer);
  if (v) {
    minShowTimer = setTimeout(() => {
      if (downloading.value) {
        /* 时间到，若仍在下载则无需处理；若已完成由 downloaded 分支接管 */
      }
    }, MIN_SHOW_MS);
  }
});

onMounted(() => {
  if (bridge && bridge.onUpdateStatus) {
    offUpdateStatus = bridge.onUpdateStatus(handleStatus);
  }
});

onBeforeUnmount(() => {
  if (offUpdateStatus) offUpdateStatus();
  if (minShowTimer) clearTimeout(minShowTimer);
});
</script>

<template>
  <Teleport to="body">
    <!-- 下载中遮罩：全屏 + 转圈 + 进度，阻断操作 -->
    <Transition name="ud-fade">
      <div v-if="downloading" class="ud-mask">
        <div class="ud-downloading">
          <div class="ud-spinner"></div>
          <div class="ud-title">正在下载更新{{ version ? ` v${version}` : '' }}</div>
          <div class="ud-sub">更新下载中，请勿关闭应用</div>
          <div class="ud-bar">
            <div class="ud-bar-inner" :style="{ width: Math.min(100, progress) + '%' }"></div>
          </div>
          <div class="ud-percent">{{ Math.round(Math.min(100, progress)) }}%</div>
        </div>
      </div>
    </Transition>

    <!-- 确认弹窗：发现新版本 / 下载完成 -->
    <Transition name="ud-fade">
      <div v-if="confirmVisible" class="ud-mask" @click.self="later">
        <div class="ud-dialog">
          <div class="ud-dialog-title">
            {{ confirmMode === 'available' ? '发现新版本' : '更新已就绪' }}
          </div>
          <div class="ud-desc">
            {{ confirmMode === 'available'
              ? `检测到新版本${version ? ` v${version}` : ''}，是否立即下载更新？`
              : `新版本${version ? ` v${version}` : ''}已下载完成，重启后生效。` }}
          </div>
          <div class="ud-actions">
            <button class="ud-btn ghost" type="button" @click="later">
              {{ confirmMode === 'available' ? '暂不更新' : '稍后重启' }}
            </button>
            <button class="ud-btn primary" type="button" @click="confirmMode === 'available' ? updateNow() : restartNow()">
              {{ confirmMode === 'available' ? '立即更新' : '立即重启' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 全屏遮罩：半透明毛玻璃，挡住下层所有操作 */
.ud-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 18, 32, 0.45);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  user-select: none;
}

/* ===== 下载中卡片 ===== */
.ud-downloading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 56px;
  background: var(--bg-elevated, #fff);
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  border: 1px solid var(--border-soft, rgba(0, 0, 0, 0.06));
}

/* 转圈动画 */
.ud-spinner {
  width: 46px;
  height: 46px;
  border: 4px solid rgba(106, 53, 255, 0.15);
  border-top-color: #6a35ff;
  border-radius: 50%;
  animation: ud-spin 0.8s linear infinite;
}
@keyframes ud-spin {
  to { transform: rotate(360deg); }
}

.ud-title {
  margin-top: 18px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1d2129);
}
.ud-sub {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-sub, #6b7280);
}

/* 进度条 */
.ud-bar {
  margin-top: 18px;
  width: 280px;
  height: 8px;
  border-radius: 999px;
  background: rgba(106, 53, 255, 0.12);
  overflow: hidden;
}
.ud-bar-inner {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #6a35ff, #8f5eff);
  transition: width 0.3s ease;
}
.ud-percent {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #6a35ff;
  font-variant-numeric: tabular-nums;
}

/* ===== 确认弹窗 ===== */
.ud-dialog {
  width: 360px;
  padding: 26px 28px 22px;
  background: var(--bg-elevated, #fff);
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  border: 1px solid var(--border-soft, rgba(0, 0, 0, 0.06));
}
.ud-dialog-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main, #1d2129);
}
.ud-desc {
  margin-top: 10px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-sub, #6b7280);
  word-break: break-all;
}
.ud-actions {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.ud-btn {
  border: none;
  cursor: pointer;
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  transition: filter 0.15s ease, background 0.15s ease;
}
.ud-btn.ghost {
  background: rgba(106, 53, 255, 0.08);
  color: #6a35ff;
}
.ud-btn.ghost:hover {
  background: rgba(106, 53, 255, 0.14);
}
.ud-btn.primary {
  background: linear-gradient(135deg, #6a35ff, #8f5eff);
  color: #fff;
}
.ud-btn.primary:hover {
  filter: brightness(1.08);
}

/* 过渡动画 */
.ud-fade-enter-active,
.ud-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ud-fade-enter-from,
.ud-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
