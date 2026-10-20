import { defineStore } from 'pinia';

/** 纯前端偏好持久化键（与 theme store 一样手写 localStorage，不依赖持久化插件） */
export const PREFERENCES_STORAGE_KEY = 'futurecave-preferences';

/** 偏好数据结构版本：升级时旧数据不信任其字段值（避免旧默认值污染新版本） */
const PREFERENCES_VERSION = 1;

const DEFAULT_PREFERENCES = {
  listMemory: false, // 列表记忆：默认关闭（用户主动开启后记住每页条数 / 页码 / 筛选条件）
  watermark: false, // 页面水印：半透明水印覆盖页面（防截图泄密）
  pageSizes: {}, // 各路由记忆的每页条数 { [routePath]: size }
  listStates: {}, // 各路由记忆的完整列表状态 { [routePath]: { pageSize, page, filter } }
};

/** 读取本地偏好（损坏时回退默认值；旧版本数据不采用其 listMemory 值） */
function readSaved() {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        const isCurrentVersion = saved.__v === PREFERENCES_VERSION;
        return {
          ...DEFAULT_PREFERENCES,
          ...saved,
          // 仅当前版本数据才采信 listMemory（旧数据统一回退默认：关闭）
          listMemory: isCurrentVersion ? !!saved.listMemory : DEFAULT_PREFERENCES.listMemory,
          pageSizes: saved.pageSizes && typeof saved.pageSizes === 'object' ? saved.pageSizes : {},
          listStates: saved.listStates && typeof saved.listStates === 'object' ? saved.listStates : {},
        };
      }
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return null;
}

/**
 * 纯前端偏好 Store：界面偏好（列表记忆 / 页面水印）与各列表页记忆数据。
 * 所有数据仅存 localStorage，不经过主进程，页面刷新 / 重启后依然生效。
 */
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    ...DEFAULT_PREFERENCES,
    ...(readSaved() || {}),
  }),

  actions: {
    /** 持久化到 localStorage */
    persist() {
      try {
        localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify({
            __v: PREFERENCES_VERSION,
            listMemory: this.listMemory,
            watermark: this.watermark,
            pageSizes: this.pageSizes,
            listStates: this.listStates,
          })
        );
      } catch {
        /* 忽略存储失败 */
      }
    },

    /** 读取某路由记忆的每页条数（未记忆返回 null） */
    getPageSize(routePath) {
      const size = this.pageSizes[routePath];
      return Number.isFinite(size) && size > 0 ? size : null;
    },

    /** 记忆某路由的每页条数 */
    setPageSize(routePath, size) {
      this.pageSizes[routePath] = size;
      this.persist();
    },

    /** 读取某路由记忆的完整列表状态（{ pageSize, page, filter }，未记忆返回 null） */
    getListState(routePath) {
      const state = this.listStates[routePath];
      return state && typeof state === 'object' ? state : null;
    },

    /** 记忆某路由的完整列表状态 */
    setListState(routePath, state) {
      this.listStates[routePath] = state;
      this.persist();
    },

    /** 开关列表记忆 */
    setListMemory(enabled) {
      this.listMemory = !!enabled;
      if (!this.listMemory) {
        this.pageSizes = {}; // 关闭时清理已记忆数据
        this.listStates = {};
      }
      this.persist();
    },

    /** 开关页面水印 */
    setWatermark(enabled) {
      this.watermark = !!enabled;
      this.persist();
    },
  },
});
