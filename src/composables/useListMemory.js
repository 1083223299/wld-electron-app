import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { usePreferencesStore } from '../stores/preferences';

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * 列表记忆 composable：按当前路由记忆列表状态（每页条数 / 页码 / 筛选条件）。
 *
 * 用法（列表页）：
 *   const filter = reactive({ ... }); // 页面原有筛选对象
 *   const { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter } = useListMemory({
 *     filterKeys: ['playerId', 'playerName', ...], // 需要记忆的筛选字段
 *   });
 *   restoreFilter(filter); // 在 filter 定义后调用一次：恢复记忆的筛选条件
 *
 *   // 模板
 *   <DataTable :page="page" :page-size="pageSize"
 *     @page-change="onPageChange"
 *     @page-size-change="onPageSizeChange" />
 *
 *   // 搜索 / 重置后保存筛选（搜索时页码回到 1）
 *   function handleSearch(values) { Object.assign(filter, values); rememberFilter(filter, true); }
 *   function handleReset() { ...; rememberFilter(filter, true); }
 *
 * - 记忆开关（设置面板「列表记忆」）关闭时：全部使用默认值且不写入记忆
 * - 使用 route.fullPath 作为记忆键，可区分同一路由下的不同 tab / query
 */
export function useListMemory({ filterKeys = [] } = {}) {
  const route = useRoute();
  const store = usePreferencesStore();
  const pathKey = route.fullPath;
  const saved = store.listMemory ? store.getListState(pathKey) : null;

  const pageSize = ref((saved && saved.pageSize) || DEFAULT_PAGE_SIZE);
  const page = ref((saved && saved.page) || 1);

  // 最近一次保存的筛选快照（页码/条数变化时沿用，不丢失筛选）
  let lastFilter = null;

  /** 只保存声明过的筛选字段（避免混入无关字段） */
  function pickFilter(filter) {
    if (!filter || !filterKeys.length) return null;
    const picked = {};
    for (const key of filterKeys) {
      picked[key] = filter[key];
    }
    return picked;
  }

  /** 写入记忆（开关关闭时不写） */
  function persist() {
    if (!store.listMemory) return;
    store.setListState(pathKey, {
      pageSize: pageSize.value,
      page: page.value,
      filter: lastFilter,
    });
  }

  /** 恢复记忆的筛选条件到 filter 对象（页面 filter 定义后调用一次） */
  function restoreFilter(filter) {
    if (!store.listMemory || !saved || !saved.filter) return;
    for (const key of filterKeys) {
      if (key in saved.filter) filter[key] = saved.filter[key];
    }
  }

  /** 每页条数变化：更新并重置到第 1 页，保存 */
  function onPageSizeChange(size) {
    const n = Number(size) || DEFAULT_PAGE_SIZE;
    pageSize.value = n;
    page.value = 1;
    persist();
  }

  /** 页码变化：更新并保存 */
  function onPageChange(next) {
    page.value = next;
    persist();
  }

  /** 搜索 / 重置后保存筛选（resetPage=true 时页码回到 1） */
  function rememberFilter(filter, resetPage = false) {
    if (resetPage) page.value = 1;
    lastFilter = pickFilter(filter);
    persist();
  }

  return { page, pageSize, onPageSizeChange, onPageChange, restoreFilter, rememberFilter };
}
