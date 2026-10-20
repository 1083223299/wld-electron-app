import { defineStore } from 'pinia';
import { DEFAULT_THEME, resolveTheme } from '../theme/themes';

/** 主题持久化键（与 main.js 挂载前预加载保持一致） */
export const THEME_STORAGE_KEY = 'futurecave-theme';

/** 跟随系统主题标记：开启后按系统明暗自动切换（暗色用暗夜黑金，亮色用基础主题） */
export const SYSTEM_THEME = 'system';

/** 唯一暗色主题 */
const DARK_THEME = 'nightgold';

/** 读取本地记忆的主题（损坏时返回 null） */
function readSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.name) return saved;
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return null;
}

/** 系统当前是否偏好暗色 */
function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

/** 跟随系统模式下实际生效的主题 id：暗色→暗夜黑金；亮色→基础亮色主题 */
export function resolveSystemThemeId(baseName) {
  if (systemPrefersDark()) return DARK_THEME;
  const base = resolveTheme(baseName);
  return base && base.mode === 'light' ? base.id : DEFAULT_THEME;
}

/**
 * 主题 Store：记录当前主题、应用到 <html data-theme> 并持久化。
 * 支持「跟随系统」：name = system 时，baseName 记录亮色基础主题，
 * 并监听 prefers-color-scheme 在明暗之间自动切换。
 * 持久化由本 Store 自行读写 localStorage，不依赖 pinia 持久化插件。
 */
export const useThemeStore = defineStore('theme', {
  state: () => {
    const saved = readSavedTheme();
    // 未设置过主题 → 默认跟随系统（老用户已保存的主题保持不变）
    const name = saved ? saved.name : SYSTEM_THEME;
    const baseName =
      saved && saved.base ? saved.base : name === SYSTEM_THEME ? DEFAULT_THEME : name;
    return { name, baseName };
  },

  getters: {
    /** 当前实际生效的主题（跟随系统时按系统明暗解析） */
    current(state) {
      const id = state.name === SYSTEM_THEME ? resolveSystemThemeId(state.baseName) : state.name;
      return resolveTheme(id);
    },
    isDark() {
      return this.current.mode === 'dark';
    },
    isFollowSystem(state) {
      return state.name === SYSTEM_THEME;
    },
  },

  actions: {
    /**
     * 应用主题：name = system 进入跟随系统模式（保留 baseName 作为亮色基础）；
     * 否则固定为具体主题并同步 baseName。
     */
    apply(name) {
      const isSystem = name === SYSTEM_THEME;
      if (!isSystem) this.baseName = name;
      this.name = name;

      try {
        localStorage.setItem(
          THEME_STORAGE_KEY,
          JSON.stringify({ name: this.name, base: this.baseName })
        );
      } catch {
        /* 忽略存储失败 */
      }

      this.applyTheme();
      if (isSystem) this.watchSystem();
      else this.unwatchSystem();
    },

    /** 把当前生效主题写入 <html data-theme>（加平滑过渡类） */
    applyTheme() {
      const theme = this.current;
      const root = document.documentElement;
      root.setAttribute('data-theme', theme.id);

      root.classList.add('theme-switching');
      clearTimeout(this._transitionTimer);
      this._transitionTimer = setTimeout(() => {
        root.classList.remove('theme-switching');
      }, 420);
    },

    /** 跟随系统：监听系统明暗变化，自动重算生效主题 */
    watchSystem() {
      this.unwatchSystem();
      if (typeof window === 'undefined' || !window.matchMedia) return;
      this._mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._mqHandler = () => this.applyTheme();
      this._mq.addEventListener('change', this._mqHandler);
    },

    unwatchSystem() {
      if (this._mq && this._mqHandler) {
        this._mq.removeEventListener('change', this._mqHandler);
      }
      this._mq = null;
      this._mqHandler = null;
    },

    /** 启动时应用持久化主题（挂载前 main.js 已预置，这里兜底） */
    init() {
      this.apply(this.name);
    },
  },
});
