<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import avatar from '../assets/images/defaulIcon.png';
import logo from '../assets/images/logo.png';
import ThemePanel from './ThemePanel.vue';
import SettingsPanel from './SettingsPanel.vue';

const props = defineProps({
  title: { type: String, default: '' },
});

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
    <div class="toolbar-row">
      <div class="title-wrap">
        <img class="app-logo" :src="logo" alt="logo" />
        <div class="title-block">
          <!-- <span class="label">电商后台</span> -->
          <strong>{{ props.title || '工作台' }}</strong>
        </div>
      </div>

      <div class="top-actions">
        <ThemePanel />
        <SettingsPanel />
      </div>

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
    </div>

  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  flex-direction: column;
  width: 100%;
  background: var(--bg-topbar);
  border-bottom: 1px solid var(--border-soft);
  -webkit-app-region: drag;
  user-select: none;
}

.toolbar-row {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* padding: 0 18px 0 14px; */
  width: 100%;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: auto;
}

.app-logo {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
}

.title-block {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.title-block .label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-sub);
}

.title-block strong {
  font-size: 14px;
  color: var(--text-main);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  margin-left: auto;
  padding-right: 8px;
  -webkit-app-region: no-drag;
}

.window-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
}


.win-btn {
  width: 46px;
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

</style>
