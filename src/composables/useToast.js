import { reactive } from 'vue';

let seed = 0;
export const toasts = reactive([]);

/**
 * 导出一个名为 useToast 的自定义钩子函数
 * 该函数用于显示和管理提示消息(toast)
 */
export function useToast() {
  function show(message, type = 'success', duration = 2200) {
    const id = ++seed;
    toasts.push({ id, message, type });
    setTimeout(() => {
      const idx = toasts.findIndex((t) => t.id === id);
      if (idx > -1) toasts.splice(idx, 1);
    }, duration);
  }
  return { show };
}
