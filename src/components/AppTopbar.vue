<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const controls = window.windowControls;
const isMaximized = ref(false);

function minimize() {
  controls && controls.minimize();
}
function toggleMaximize() {
  controls && controls.toggleMaximize();
}
function close() {
  controls && controls.close();
}

onMounted(() => {
  if (controls && controls.onMaximizeChange) {
    offMaximizeChange = controls.onMaximizeChange((value) => {
      isMaximized.value = value;
    });
  }
});

let offMaximizeChange = null;
onBeforeUnmount(() => {
  if (offMaximizeChange) offMaximizeChange();
});
</script>

<template>
  <header class="topbar">
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
      <button class="win-btn close" type="button" title="关闭" @click="close">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* 登录页专用：悬浮右上角的窗口控制条，不占布局高度 */
.topbar {
  position: fixed;
  top: 10px;
  right: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  height: 34px;
  padding-left: 18px; /* 左侧留白作为窗口拖动区域 */
  /* border-radius: 12px; */
  /* background: var(--bg-elevated); */
  border: 0px solid var(--border-soft);
  /* box-shadow: var(--shadow-sm, 0 2px 10px rgba(0, 0, 0, 0.08)); */
  -webkit-app-region: drag;
  user-select: none;
  width: 100%;
  justify-content: flex-end;
  background: #ffffff00;
}

.window-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
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

.win-btn:first-child {
  border-radius: 11px 0 0 11px;
}

.win-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-main);
}

.win-btn.close {
  border-radius: 0 11px 11px 0;
}

.win-btn.close:hover {
  background: var(--danger);
  color: #fff;
}
</style>
