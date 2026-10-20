import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import router from './router';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

/* ================= 主题预加载 =================
 * 挂载前先读取本地记忆的主题并写入 <html data-theme>，
 * 避免启动瞬间闪烁默认主题。
 * 与 stores/theme.js 的持久化键保持一致；「跟随系统」时按系统明暗落位；
 * 首次运行（无记忆）默认跟随系统。
 */
try {
  const raw = localStorage.getItem('futurecave-theme');
  let saved = null;
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name) saved = parsed;
  }
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let themeId;
  if (saved) {
    if (saved.name === SYSTEM_THEME) {
      const baseTheme = saved.base ? themes.find((t) => t.id === saved.base) : null;
      themeId = dark ? 'nightgold' : baseTheme && baseTheme.mode === 'light' ? saved.base : 'aurora';
    } else {
      themeId = saved.name;
    }
  } else {
    // 首次运行：默认跟随系统
    themeId = dark ? 'nightgold' : 'aurora';
  }
  document.documentElement.setAttribute('data-theme', themeId);
} catch {
  /* 本地数据损坏时忽略，走默认主题 */
}

import 'element-plus/dist/index.css';
import './assets/styles/base.css';
import './assets/styles/common.css';
import './assets/styles/layout.css';
import './assets/styles/list-page.css';
import './assets/styles/element-ui.css';
import './theme/theme.css';
import { themes } from './theme/themes';
import { SYSTEM_THEME } from './stores/theme';

import SvgIcon from './components/SvgIcon/index.vue';
import { registerIcons } from './icons';

registerIcons();

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

// 初始化主题 Store（state 初始化时会自行从 localStorage 恢复记忆的主题）
import { useThemeStore } from './stores/theme';
useThemeStore(pinia).init();

createApp(App)
  .component('SvgIcon', SvgIcon)
  .use(pinia)
  .use(router)
  .use(ElementPlus, { locale: zhCn })
  .mount('#app');
