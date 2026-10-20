<script setup>
import { ref, watch } from 'vue';
import { useThemeStore, SYSTEM_THEME } from '../stores/theme';
import { themes } from '../theme/themes';

const themeStore = useThemeStore();
const open = ref(false);

/** 跟随系统开关状态（同步 store.name） */
const followSystem = ref(themeStore.name === SYSTEM_THEME);

watch(
  () => themeStore.name,
  (name) => {
    followSystem.value = name === SYSTEM_THEME;
  }
);

function pick(id) {
  themeStore.apply(id);
}

/** 切换跟随系统：开启进入 system 模式，关闭回到基础主题 */
function onFollowSystem(val) {
  if (val) themeStore.apply(SYSTEM_THEME);
  else themeStore.apply(themeStore.baseName);
}
</script>

<template>
  <span class="theme-switcher">
    <button
      class="theme-btn"
      :class="{ active: open }"
      type="button"
      title="主题换肤"
      aria-label="主题换肤"
      @click="open = !open"
    >
      <svg class="palette-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <defs>
          <linearGradient id="theme-palette-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style="stop-color: var(--primary)" />
            <stop offset="55%" style="stop-color: var(--primary-hover)" />
            <stop offset="100%" style="stop-color: var(--primary-deep)" />
          </linearGradient>
        </defs>
        <path
          d="M12 2.5A9.5 9.5 0 1 0 21.5 12c0-1.66-1.34-3-3-3h-2.2c-1.1 0-2-.9-2-2 0-.55.22-1.05.57-1.41.4-.4.63-.96.63-1.59 0-1.66-1.34-2.5-3.5-2.5z"
          fill="url(#theme-palette-grad)"
        />
        <circle cx="7.4" cy="11.2" r="1.25" fill="#ffffff" />
        <circle cx="12" cy="7.2" r="1.25" fill="#ffffff" />
        <circle cx="16.4" cy="11.2" r="1.25" fill="#ffffff" />
      </svg>
      <span class="theme-btn-dot" :style="{ background: themeStore.current.preview.primary }"></span>
    </button>

    <transition name="theme-pop">
      <div v-if="open" class="theme-panel" role="dialog" aria-label="主题换肤">
        <div class="panel-head">
          <div>
            <div class="panel-title">主题换肤</div>
            <div class="panel-sub">THEME CENTER · 一键切换全局视觉</div>
          </div>
          <span class="panel-mode" :class="themeStore.isDark ? 'dark' : 'light'">
            {{ themeStore.isDark ? '暗色' : '亮色' }}
          </span>
        </div>

        <!-- 跟随系统：随系统明暗自动切换 -->
        <div class="system-toggle">
          <span class="system-text">
            <span class="system-title">跟随系统</span>
            <span class="system-sub">随系统明暗自动切换（暗色用「暗夜黑金」）</span>
          </span>
          <el-switch v-model="followSystem" size="small" @change="onFollowSystem" />
        </div>

        <div class="theme-grid">
          <button
            v-for="t in themes"
            :key="t.id"
            class="theme-card"
            :class="{ active: t.id === themeStore.name }"
            type="button"
            @click="pick(t.id)"
          >
            <span class="preview" :style="{ background: t.preview.page }">
              <span class="pv-sidebar" :style="{ background: t.preview.sidebar }">
                <span class="pv-logo" :style="{ background: t.preview.primary }"></span>
              </span>
              <span class="pv-main">
                <span class="pv-bar" :style="{ background: t.preview.card }"></span>
                <span class="pv-body">
                  <span class="pv-btn" :style="{ background: t.preview.gradient }"></span>
                </span>
              </span>
              <span v-if="t.id === themeStore.name" class="pv-check">✓</span>
            </span>
            <span class="theme-meta">
              <span class="theme-name">{{ t.name }}</span>
              <span class="theme-sub">{{ t.subtitle }}</span>
            </span>
          </button>
        </div>

        <div class="panel-foot">
          <span class="foot-tip">✦ 选择后即时生效，自动记忆</span>
        </div>
      </div>
    </transition>

    <div v-if="open" class="theme-mask" @click="open = false"></div>
  </span>
</template>

<style scoped>
.theme-switcher {
  position: relative;
  display: inline-flex;
  -webkit-app-region: no-drag;
}

/* ---- 触发按钮：圆形渐变描边 + 主题色圆点 ---- */
.theme-btn {
  position: relative;
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
.theme-btn:hover,
.theme-btn.active {
  border-color: var(--primary-border-strong);
  color: var(--primary);
  box-shadow: 0 4px 12px var(--primary-glow);
}
.theme-btn:active {
  transform: scale(0.94);
}
.palette-icon {
  display: block;
}
.theme-btn-dot {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--bg-elevated);
  box-shadow: 0 0 0 1px var(--primary-border);
  transition: background 0.3s ease;
}

/* ---- 面板 ---- */
.theme-panel {
  position: absolute;
  top: calc(100% + 12px);
  right: -4px;
  width: 358px;
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
.panel-mode {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
}
.panel-mode.light {
  background: var(--primary-soft);
  color: var(--primary);
}
.panel-mode.dark {
  background: var(--primary);
  color: var(--text-invert);
}

/* ---- 跟随系统开关 ---- */
.system-toggle {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  background: var(--bg-elevated);
}
.system-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.system-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}
.system-sub {
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--text-faint);
}

/* ---- 主题卡片 ---- */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.theme-card {
  padding: 5px 5px 7px;
  border: 1px solid var(--border-soft);
  border-radius: 13px;
  background: transparent;
  cursor: pointer;
  text-align: center;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.theme-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary-border-strong);
  box-shadow: 0 8px 16px var(--primary-glow);
}
.theme-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), 0 8px 18px var(--primary-glow);
}

.preview {
  position: relative;
  display: flex;
  height: 62px;
  border-radius: 9px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.pv-sidebar {
  width: 32%;
  display: flex;
  justify-content: center;
  padding-top: 8px;
}
.pv-logo {
  width: 9px;
  height: 9px;
  border-radius: 3px;
}
.pv-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 6px;
  gap: 4px;
}
.pv-bar {
  height: 7px;
  border-radius: 4px;
  opacity: 0.95;
}
.pv-body {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}
.pv-btn {
  width: 24px;
  height: 9px;
  border-radius: 5px;
}
.pv-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--text-invert);
  font-size: 9px;
  line-height: 1;
  display: grid;
  place-items: center;
}

.theme-meta {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}
.theme-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-main);
}
.theme-sub {
  font-size: 9px;
  color: var(--text-faint);
}

/* ---- 底部提示 ---- */
.panel-foot {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-soft);
}
.foot-tip {
  font-size: 11px;
  color: var(--text-sub);
}

/* ---- 关闭蒙层（点击面板外关闭） ---- */
.theme-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: transparent;
}

/* ---- 弹出动画 ---- */
.theme-pop-enter-active,
.theme-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.theme-pop-enter-from,
.theme-pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.97);
}
</style>
