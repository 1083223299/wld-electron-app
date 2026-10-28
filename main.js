const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

/* ================= 文件日志（electron-log） =================
 * 打包后 console 在终端看不到，统一重定向到 userData/logs/ 目录
 * - main.log     主进程全部日志
 * 排查问题时：设置 → 打开日志目录，或直接看 %AppData%/未来电竞管理系统/logs/
 */
const log = require('electron-log');
log.transports.file.level = 'info';          // 文件记录 info 及以上
log.transports.file.maxSize = 10 * 1024 * 1024; // 单文件最大 10MB，超出自动滚动
log.transports.file.fileName = 'main.log';
// 把 console.log/info/warn/error 全部代理到 electron-log，业务代码无需改动
Object.assign(console, log.functions);

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL; // 获取开发服务器URL

/** 以 --hidden 启动（开机自启）：不显示主窗口，静默驻留托盘 */
const HIDDEN_LAUNCH = process.argv.includes('--hidden');

let mainWindow = null;
let tray = null;

/* ================= Windows 任务栏：设置 AppUserModelID，让右键/任务栏显示应用名而非 "Electron" ================= */
if (process.platform === 'win32') {
  // 必须与 package.json → build.appId 保持一致；
  // 不设的话 Windows 会把开发模式下的进程归到 "Electron" 名下，任务栏右键显示 Electron
  app.setAppUserModelId('com.myapp.desktop');
}

/* ================= 应用设置（开机自启 / 自动更新 等偏好持久化） ================= */
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const WIN_STATE_FILE = path.join(app.getPath('userData'), 'win-state.json'); // 窗口位置/大小记忆

let settings = {
  autoLaunch: true, // 开机自动启动（默认开启）
  autoUpdate: true, // 自动更新（默认开启，可在设置面板关闭）
};

/** 读取窗口上次位置/大小（用于启动恢复） */
function readWinState() {
  try {
    const raw = fs.readFileSync(WIN_STATE_FILE, 'utf-8');
    const s = JSON.parse(raw);
    if (s && typeof s.width === 'number' && typeof s.height === 'number') return s;
  } catch {}
  return null;
}

/** 保存窗口位置/大小到本地（resize/move/close 时调用） */
function saveWinState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(WIN_STATE_FILE, JSON.stringify({
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    }));
  } catch (e) {
    console.warn('[win-state] 保存窗口状态失败:', e.message);
  }
}

/** 读取本地设置；文件不存在视为首次启动，写入默认值 */
function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      settings = {
        autoLaunch: saved.autoLaunch !== undefined ? !!saved.autoLaunch : true,
        autoUpdate: saved.autoUpdate !== undefined ? !!saved.autoUpdate : true,
      };
    }
  } catch {
    /* 文件不存在或损坏：使用默认设置 */
  }
  return settings;
}

/** 写入设置（局部合并） */
function writeSettings(patch) {
  settings = Object.assign({}, settings, patch);
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('[settings] 保存设置失败:', e.message);
  }
  return settings;
}

/** 应用开机自启设置（Windows/macOS；Linux 无系统级 API，仅持久化偏好） */
function applyAutoLaunch(enable) {
  try {
    if (process.platform === 'win32') {
      const opts = { openAtLogin: enable, args: ['--hidden'] };
      if (!app.isPackaged) {
        // 开发模式：注册 electron 可执行文件 + 应用路径，避免开机启动后无窗口
        opts.path = process.execPath;
        opts.args = ['--hidden', app.getAppPath()];
      }
      app.setLoginItemSettings(opts);
    } else if (process.platform === 'darwin') {
      app.setLoginItemSettings({ openAtLogin: enable, openAsHidden: true });
    }
  } catch (e) {
    console.error('[settings] 设置开机自启失败:', e.message);
  }
}

/** 首次启动初始化：应用默认设置（开机自启默认开启） */
function initSettings() {
  readSettings();
  if (!fs.existsSync(SETTINGS_FILE)) {
    writeSettings(settings);
    applyAutoLaunch(true);
  } else {
    applyAutoLaunch(settings.autoLaunch);
  }
}

/* ================= 自动更新（electron-updater） ================= */
let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  console.warn('[updater] electron-updater 未安装，自动更新功能不可用:', e.message);
}

let updateStatus = 'idle'; // idle | checking | available | downloading | downloaded | not-available | error | dev | disabled
let updateVersion = null; // 可更新的目标版本
let updateError = null; // 最近一次更新错误信息
let updateProgress = null; // 下载进度 0-100

/** 向渲染进程推送更新状态（设置面板展示） */
function pushUpdateStatus(status, version, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:update-status', {
      status,
      version: version || null,
      extra: extra || null,
    });
  }
}

/** 当前设置+更新状态快照（settings:get-state 返回） */
function getSettingsState() {
  return {
    version: app.getVersion(),
    autoLaunch: !!settings.autoLaunch,
    autoUpdate: !!settings.autoUpdate,
    updateStatus,
    updateVersion,
    updateError,
    updateProgress,
    isPackaged: app.isPackaged,
    updateReady: !!autoUpdater && app.isPackaged,
  };
}

/** 更新源：优先取环境变量 UPDATE_SERVER_URL，否则用打包时写入的 publish 配置 */
function configureUpdateFeed() {
  if (!autoUpdater) return;
  const url = process.env.UPDATE_SERVER_URL;
  if (url) {
    autoUpdater.setFeedURL({ provider: 'generic', url });
    console.log('[updater] 使用环境变量更新源:', url);
  }
}

/** 注册 autoUpdater 事件 → 推送状态到渲染进程 */
function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = false; // 不自动下载：发现新版本后弹窗询问，用户确认才下载
  autoUpdater.autoInstallOnAppQuit = true; // 已下载的更新在退出时自动安装

  autoUpdater.on('checking-for-update', () => {
    updateStatus = 'checking';
    pushUpdateStatus('checking');
  });
  autoUpdater.on('update-available', (info) => {
    updateStatus = 'available';
    updateVersion = info && info.version;
    updateError = null;
    pushUpdateStatus('available', updateVersion);
  });
  autoUpdater.on('update-not-available', () => {
    updateStatus = 'not-available';
    updateError = null;
    pushUpdateStatus('not-available');
  });
  autoUpdater.on('download-progress', (p) => {
    updateStatus = 'downloading';
    updateProgress = p && p.percent;
    pushUpdateStatus('downloading', updateVersion, { percent: updateProgress });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateStatus = 'downloaded';
    updateVersion = info && info.version;
    updateProgress = 100;
    pushUpdateStatus('downloaded', updateVersion);
  });
  autoUpdater.on('error', (err) => {
    updateStatus = 'error';
    updateError = String((err && err.message) || err);
    pushUpdateStatus('error', null, updateError);
  });
}

/** 启动后延迟自动检查更新（仅打包版 + 自动更新开启时） */
function scheduleAutoCheck() {
  if (!app.isPackaged || !autoUpdater || !settings.autoUpdate) return;
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => {
      updateStatus = 'error';
      updateError = String((e && e.message) || e);
      pushUpdateStatus('error', null, updateError);
    });
  }, 10 * 1000);
}

/** 设置相关 IPC：get-state / 开关 / 检查更新 / 下载 / 安装 */
function setupSettingsBridge() {
  ipcMain.handle('settings:get-state', () => getSettingsState());

  ipcMain.handle('settings:set-auto-launch', (_event, enable) => {
    const enabled = !!enable;
    writeSettings({ autoLaunch: enabled });
    applyAutoLaunch(enabled);
    return getSettingsState();
  });

  ipcMain.handle('settings:set-auto-update', (_event, enable) => {
    const enabled = !!enable;
    writeSettings({ autoUpdate: enabled });
    if (autoUpdater) autoUpdater.autoDownload = enabled;
    return getSettingsState();
  });

  ipcMain.handle('settings:check-update', async () => {
    // if (!app.isPackaged) {
    //   updateStatus = 'dev';
    //   updateError = '开发模式不支持检查更新，请使用打包后的版本测试';
    //   pushUpdateStatus('dev', null, updateError);
    //   return getSettingsState();
    // }
    if (!autoUpdater) {
      updateStatus = 'disabled';
      updateError = '自动更新组件未安装（electron-updater）';
      pushUpdateStatus('disabled', null, updateError);
      return getSettingsState();
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      updateStatus = 'error';
      updateError = String((e && e.message) || e);
      pushUpdateStatus('error', null, updateError);
    }
    return getSettingsState();
  });

  ipcMain.handle('settings:download-update', async () => {
    if (autoUpdater && updateStatus === 'available') {
      try {
        await autoUpdater.downloadUpdate();
      } catch (e) {
        updateStatus = 'error';
        updateError = String((e && e.message) || e);
        pushUpdateStatus('error', null, updateError);
      }
    }
    return getSettingsState();
  });

  ipcMain.handle('settings:quit-and-install', () => {
    if (autoUpdater && updateStatus === 'downloaded') {
      autoUpdater.quitAndInstall(false, true);
    }
    return getSettingsState();
  });
}

/* ================= 托盘图标：角标气泡 + 整体闪动（系统通知提醒） ================= */
const NORMAL_TRAY_ICON = path.join(__dirname, 'src', 'assets', 'images', 'logo16.png'); // 正常托盘图标
const FLASH_TRAY_ICON = path.join(__dirname, 'src', 'assets', 'images', ''); // 闪动变体（整体发光，微信式闪动）
// const ALERT_TRAY_ICON = path.join(__dirname, 'src', 'assets', 'images', 'tray-alert.png'); // 兜底提醒图标（红点）
let normalTrayImage = null; // 正常图标缓存
let flashTrayImage = null; // 闪动变体缓存
let alertTrayImage = null; // 兜底提醒图标缓存
let trayBadgeImage = null; // 带红色数字气泡角标的图标（渲染进程 Canvas 生成）
let trayUnread = 0; // 当前未读数（托盘角标显示）
let trayFlashTimer = null; // 闪烁定时器

/** 当前应展示的托盘图标：有未读角标优先用角标图标，否则正常图标 */
function currentTrayImage() {
  if (trayBadgeImage) return trayBadgeImage;
  return normalTrayImage || nativeImage.createFromPath(NORMAL_TRAY_ICON);
}

/** 当前 tooltip：有未读时带数量 */
function currentTrayToolTip() {
  return trayUnread > 0 ? `${trayUnread} 条未读通知` : '未来电竞管理后台';
}

/** 停止托盘闪烁，恢复静态图标（有未读则保留角标气泡） */
function stopTrayFlash() {
  if (!tray) return;
  if (trayFlashTimer) {
    clearInterval(trayFlashTimer);
    trayFlashTimer = null;
  }
  tray.setImage(currentTrayImage());
  tray.setToolTip(currentTrayToolTip());
}

/**
 * 启动托盘闪烁：「正常图标 ↔ 白底卡片变体」每 500ms 切换一次（微信式整体闪动）
 * - 不自动停止：持续闪动，直到被查看/处理（窗口显示或聚焦、进入系统通知页、全部已读）
 * - 每次 setImage 后同步 setToolTip，强制 Windows 托盘重绘（规避图标不刷新问题）
 */
function startTrayFlash() {
  if (!tray) return;
  normalTrayImage = normalTrayImage || nativeImage.createFromPath(NORMAL_TRAY_ICON);
  flashTrayImage = flashTrayImage || nativeImage.createFromPath(FLASH_TRAY_ICON);
  alertTrayImage = alertTrayImage || nativeImage.createFromPath(NORMAL_TRAY_ICON);

  if (!trayFlashTimer) {
    let showFlash = false;
    trayFlashTimer = setInterval(() => {
      showFlash = !showFlash;
      // 整体闪动：正常 logo ↔ 白底卡片变体（托盘图标本体在切换，非遮罩）
      tray.setImage(showFlash ? flashTrayImage : normalTrayImage);
      // tooltip 同步切换，强制刷新托盘图标
      tray.setToolTip(
        showFlash
          ? (trayUnread > 0 ? `有新的系统通知（${trayUnread} 条未读）` : '有新的系统通知')
          : currentTrayToolTip()
      );
    }, 500);
  }
}

/* ================= 托盘右键菜单（自绘深色毛玻璃风格，替代系统原生菜单） ================= */
let trayMenu = null;

/** 生成托盘右键菜单 HTML */
function trayMenuHtml() {
  const isVisible = mainWindow && mainWindow.isVisible();
  const version = app.getVersion();
  // 读取 logo32.png 转 base64，供 data URL 页面内嵌显示
  let logoSrc = '';
  try {
    const logoPath = path.join(__dirname, 'src', 'assets', 'images', 'logo32.png');
    logoSrc = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
  } catch (e) {
    console.warn('[tray-menu] 读取 logo 失败:', e.message);
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; font-family: "Microsoft YaHei", "Segoe UI", sans-serif; }
  html, body { background: transparent; overflow: hidden; }
  #menu {
    width: 220px;
    background: rgba(22, 23, 34, 0.88);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(0,0,0,0.3);
    overflow: hidden;
    animation: pop 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: none; } }

  /* 顶部应用信息 */
  .header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .header .logo {
    width: 32px; height: 32px; border-radius: 8px;
    flex-shrink: 0; object-fit: cover;
  }
  .header .info { flex: 1; min-width: 0; }
  .header .name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.95); line-height: 1.3; }
  .header .meta { font-size: 10.5px; color: rgba(255,255,255,0.4); margin-top: 2px; display: flex; align-items: center; gap: 5px; }
  .header .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; }

  /* 菜单项 */
  .items { padding: 6px; }
  .item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 8px; cursor: pointer;
    font-size: 12.5px; color: rgba(255,255,255,0.82);
    transition: background 0.1s;
  }
  .item:hover { background: rgba(255,255,255,0.09); color: #fff; }
  .item:active { background: rgba(255,255,255,0.14); }
  .item .icon { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.7; }
  .item:hover .icon { opacity: 1; }
  .item .label { flex: 1; }
  .item .shortcut { font-size: 10.5px; color: rgba(255,255,255,0.3); font-variant-numeric: tabular-nums; }

  .sep { height: 1px; background: rgba(255,255,255,0.06); margin: 6px 10px; }

  .item.danger { color: #f87171; }
  .item.danger:hover { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
  .item.danger .icon { opacity: 0.6; }
  .item.danger:hover .icon { opacity: 1; }
</style>
</head>
<body>
  <div id="menu">
    <div class="header">
      <img class="logo" src="${logoSrc}" alt="logo">
      <div class="info">
        <div class="name">未来电竞管理系统</div>
        <div class="meta"><span class="dot"></span> v${version} · 运行中</div>
      </div>
    </div>
    <div class="items">
      <div class="item" onclick="trayMenuBridge.click('${isVisible ? 'hide' : 'show'}')">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isVisible
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'}
        </svg>
        <span class="label">${isVisible ? '隐藏主界面' : '显示主界面'}</span>
      </div>
      <div class="item" onclick="trayMenuBridge.click('notify')">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="label">通知中心</span>
      </div>
      <div class="sep"></div>
      <div class="item" onclick="trayMenuBridge.click('update')">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span class="label">检查更新</span>
      </div>
      <div class="sep"></div>
      <div class="item danger" onclick="trayMenuBridge.click('quit')">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>
        <span class="label">退出</span>
      </div>
    </div>
  </div>
  <script>
    // 点击菜单外部由主进程 blur 关闭；这里阻止冒泡防止点到菜单内部触发关闭
    document.addEventListener('click', (e) => e.stopPropagation());
  </script>
</body>
</html>`;
}

/** 显示自绘托盘菜单，定位在托盘图标上方 */
function showTrayMenu(bounds) {
  const MENU_WIDTH = 220;
  const MENU_HEIGHT = 281; // 与实际内容高度匹配，避免透明区域把菜单顶高

  if (!trayMenu || trayMenu.isDestroyed()) {
    trayMenu = new BrowserWindow({
      width: MENU_WIDTH,
      height: MENU_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      webPreferences: {
        sandbox: true,
        preload: path.join(__dirname, 'trayMenuPreload.js'),
      },
    });
    trayMenu.on('blur', closeTrayMenu);       // 点击外部自动关闭
    trayMenu.on('closed', () => { trayMenu = null; });
  }

  // 计算位置：Windows 任务栏通常在底部，菜单在图标上方弹出
  const screenWidth = screen.getPrimaryDisplay().workArea.width;
  let x = bounds.x + bounds.width / 2 - MENU_WIDTH / 2;
  // 防止超出屏幕左右边缘
  x = Math.max(8, Math.min(x, screenWidth - MENU_WIDTH - 8));
  const y = bounds.y - MENU_HEIGHT + 50;

  trayMenu.setBounds({ x: Math.round(x), y: Math.round(y), width: MENU_WIDTH, height: MENU_HEIGHT });
  trayMenu.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(trayMenuHtml()));
  trayMenu.showInactive();
  trayMenu.focus(); // 聚焦后点击外部才能触发 blur 关闭
}

/** 关闭自绘托盘菜单 */
function closeTrayMenu() {
  if (trayMenu && !trayMenu.isDestroyed()) trayMenu.close();
}

/** 注册托盘菜单点击 IPC */
function setupTrayMenuBridge() {
  ipcMain.on('tray-menu:close', closeTrayMenu);

  ipcMain.on('tray-menu:click', (_event, action) => {
    closeTrayMenu();
    switch (action) {
      case 'show':
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        break;
      case 'hide':
        if (mainWindow) mainWindow.hide();
        break;
      case 'notify':
        openNotifyPage('/notify');
        break;
      case 'update':
        // 唤起主窗口 + 触发检查更新
        // 更新状态通过 settings:update-status 推给渲染进程，由全局 toast 反馈
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
        setTimeout(() => {
          // if (!app.isPackaged) {
          //   updateStatus = 'dev';
          //   updateError = '开发模式不支持检查更新，请使用打包后的版本测试';
          //   pushUpdateStatus('dev', null, updateError);
          //   return;
          // }
          if (!autoUpdater) {
            updateStatus = 'disabled';
            updateError = '自动更新组件未安装（electron-updater）';
            pushUpdateStatus('disabled', null, updateError);
            return;
          }
          if (updateStatus !== 'checking') {
            updateStatus = 'checking';
            pushUpdateStatus('checking');
            autoUpdater.checkForUpdates().catch((e) => {
              updateStatus = 'error';
              updateError = String((e && e.message) || e);
              pushUpdateStatus('error', null, updateError);
            });
          }
        }, 400);
        break;
      case 'quit':
        app.isQuitting = true;
        app.quit();
        break;
    }
  });
}

/* ================= 系统消息冒泡弹窗（右下角小窗，微信式） ================= */
let notifyBubble = null; // 冒泡小窗实例（常驻未读列表）

/** 关闭冒泡小窗（隐藏窗口，复用实例；不销毁以便随时重新弹出） */
function closeNotifyBubble() {
  if (notifyBubble && !notifyBubble.isDestroyed()) {
    notifyBubble.hide();
  }
}

/** HTML 转义，防止消息内容破坏弹窗结构 */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 生成冒泡小窗 HTML：未读消息列表（标题 / 正文 / 跳转）
 * - 常驻不自动消失；限高可滚动；头部「一键关闭」，行内「跳转」
 */
function notifyBubbleHtml(items) {
  const rows = items
    .map((it) => {
      const safeId = String(it.id || '').replace(/'/g, '');
      return `<div class="row" onclick="bubbleBridge.jump('${safeId}')">
        <div class="title-row">
          <div class="title">${escapeHtml(it.title)}</div>
          <span class="time">${escapeHtml(String(it.time || '').slice(11, 19))}</span>
        </div>
        <div class="content">${escapeHtml(it.content)}</div>
        <div class="row-foot">
          <span class="jump-desc">${escapeHtml(jumpLabelFor(it))}</span>
          <button class="jump-btn" type="button" onclick="event.stopPropagation(); bubbleBridge.jump('${safeId}')">跳转</button>
        </div>
      </div>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
  html, body { background: transparent; overflow: hidden; font-family: "Microsoft YaHei", Arial, sans-serif; }
  #wrap {
    position: fixed; inset: 0; margin: 2px;
    display: flex; flex-direction: column;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(132, 146, 176, 0.22);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(30, 41, 59, 0.24);
    overflow: hidden;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: none; } }
  .head {
    flex-shrink: 0; display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-bottom: 1px solid #eef1f6;
  }
  .head b { font-size: 13px; color: #1f2433; }
  .head .count { font-size: 12px; color: #ef4444; font-weight: 600; }
  .head .close-btn {
    margin-left: auto; border: none; cursor: pointer;
    width: 24px; height: 24px; border-radius: 8px;
    background: #f2f4f7; color: #475467; font-size: 13px; line-height: 1;
  }
  .head .close-btn:hover { background: #fee4e2; color: #d92d20; }
  .list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 8px; }
  .row { padding: 10px; border-radius: 10px; cursor: pointer; }
  .row:hover { background: #f5f3ff; }
  .row + .row { border-top: 1px dashed #f0f2f7; }
  .title-row { display: flex; align-items: center; gap: 8px; }
  .title {
    flex: 1; min-width: 0;
    font-size: 13px; font-weight: 700; color: #1f2433;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .time { flex-shrink: 0; font-size: 10.5px; color: #98a2b3; font-variant-numeric: tabular-nums; }
  .content {
    margin-top: 3px; font-size: 12px; color: #475467; line-height: 1.6; word-break: break-all;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .row-foot { margin-top: 6px; display: flex; align-items: center; gap: 8px; }
  .jump-desc { flex: 1; min-width: 0; font-size: 11.5px; color: #6a35ff; }
  .jump-btn {
    flex-shrink: 0; border: none; cursor: pointer;
    padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    background: linear-gradient(135deg, #6a35ff, #8f5eff); color: #fff;
  }
  .jump-btn:hover { filter: brightness(1.06); }
  .empty { padding: 34px 0; text-align: center; color: #98a2b3; font-size: 12px; }
</style>
</head>
<body>
  <div id="wrap">
    <div class="head">
      <b>未读消息</b>
      <span class="count">${items.length} 条</span>
      <button class="close-btn" type="button" title="一键关闭" onclick="bubbleBridge.close()">✕</button>
    </div>
    <div class="list">${rows || '<div class="empty">暂无未读消息</div>'}</div>
  </div>
</body>
</html>`;
}

/** 消息跳转目标说明文案（按类型） */
function jumpLabelFor(item) {
  if (!item) return '查看详情';
  if (isPlayerApplicationNotice(item)) return '跳转至打手审核';
  if (item.type === 'stuck') return '跳转至订单列表';
  if (item.type === 'handover') return '跳转至交接日志';
  return '查看系统通知';
}

function isPlayerApplicationNotice(item) {
  const marker = `${item.scene || ''} ${item.sceneLabel || ''} ${item.title || ''} ${item.content || ''}`;
  return /PLAYER.*(APPLICATION|APPLY|JOIN)|打手.{0,6}(入驻|申请)|入驻申请/i.test(marker);
}

/** 消息跳转路由（按类型） */
function jumpPathFor(item) {
  if (!item) return '/notify';
  if (isPlayerApplicationNotice(item)) {
    const query = new URLSearchParams();
    if (item.applicationId || item.bizKey) query.set('applicationId', item.applicationId || item.bizKey);
    if (item.playerId) query.set('playerId', item.playerId);
    if (item.playerName) query.set('name', item.playerName);
    if (item.phone) query.set('phone', item.phone);
    const suffix = query.toString();
    return `/users/player-audit${suffix ? `?${suffix}` : ''}`;
  }
  if (item.type === 'stuck') return '/orders/manage?tab=order';
  if (item.type === 'handover') return '/handover/log';
  return '/notify';
}

/** 在屏幕右下角（托盘上方）弹出系统消息冒泡小窗：常驻未读列表，手动关闭才消失 */
function showNotifyBubble() {
  if (!trayUnreadItems.length) {
    closeNotifyBubble();
    return;
  }
  const WIDTH = 360;
  const HEIGHT = 460; // 限高：内容超出时列表内部滚动
  const workArea = screen.getPrimaryDisplay().workArea;
  const x = Math.round(workArea.x + workArea.width - WIDTH - 18);
  const y = Math.round(workArea.y + workArea.height - HEIGHT - 18);

  if (!notifyBubble || notifyBubble.isDestroyed()) {
    notifyBubble = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        sandbox: true,
        preload: path.join(__dirname, 'notifyBubblePreload.js'),
      },
    });
    notifyBubble.on('closed', () => {
      notifyBubble = null;
    });
  } else {
    notifyBubble.setBounds({ x, y, width: WIDTH, height: HEIGHT });
  }

  notifyBubble.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(notifyBubbleHtml(trayUnreadItems)));
  notifyBubble.showInactive(); // 不抢焦点
}

/** 冒泡小窗已显示时刷新内容（新消息到达 / 未读变化） */
function refreshNotifyBubble() {
  if (!notifyBubble || notifyBubble.isDestroyed() || !notifyBubble.isVisible()) return;
  if (!trayUnreadItems.length) {
    closeNotifyBubble();
    return;
  }
  notifyBubble.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(notifyBubbleHtml(trayUnreadItems)));
}

/** 拉起主窗口并跳转到系统通知相关页面（跳转后收起冒泡） */
function openNotifyPage(path = '/notify') {
  closeNotifyBubble();
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('notify:open-notify', path);
    }
  }
}

/* ================= 未读列表缓存（常驻冒泡小窗数据源） ================= */
let trayUnreadItems = []; // 未读列表缓存（渲染进程上报）
const handledNotifyIds = new Set(); // 防止同一通知因重连/重复 IPC 再次打开弹窗
const MAX_HANDLED_NOTIFY_IDS = 500;
let isOnNotifyPage = false; // 渲染进程是否正停在系统通知页（在页时来消息不闪托盘，避免打扰）

function rememberNotifyId(id) {
  const key = id == null || id === '' ? '' : String(id);
  if (!key) return true;
  if (handledNotifyIds.has(key)) return false;
  handledNotifyIds.add(key);
  if (handledNotifyIds.size > MAX_HANDLED_NOTIFY_IDS) {
    handledNotifyIds.delete(handledNotifyIds.values().next().value);
  }
  return true;
}

/** 系统通知相关 IPC：托盘整体闪动 + 右下角常驻未读列表冒泡 */
function setupNotifyBridge() {
  // 渲染进程路由切换时上报当前是否在通知页
  ipcMain.on('notify:page-status', (_event, onNotifyPage) => {
    isOnNotifyPage = !!onNotifyPage;
    // 用户刚进入通知页时，停止托盘闪烁（提醒目的已达到）
    if (isOnNotifyPage) stopTrayFlash();
  });

  ipcMain.on('notify:incoming', (_event, payload = {}) => {
    // 托盘未读列表可能已被标记已读并移除；单靠当前列表无法识别之后重放的旧消息。
    // 按通知 ID 在主进程生命周期内去重，重复事件不能重新闪烁或弹出旧列表。
    if (!rememberNotifyId(payload.id)) return;

    // 是否需要闪托盘：
    // - 不在通知页 → 闪
    // - 在通知页但窗口已最小化/隐藏（人已经不在看）→ 也要闪
    // - 在通知页且窗口正常摆在眼前（正在盯着列表）→ 不闪，但冒泡和声音照常
    const windowVisible = mainWindow
      && !mainWindow.isDestroyed()
      && mainWindow.isVisible()
      && !mainWindow.isMinimized();
    if (!isOnNotifyPage || !windowVisible) {
      startTrayFlash();
    }

    // 新消息先并入未读列表缓存，冒泡立即以完整列表渲染（随后 tray-list 权威覆盖）
    if (payload.title && !trayUnreadItems.some((i) => String(i.id) === String(payload.id))) {
      trayUnreadItems = [
        {
          id: payload.id || `nt-${Date.now()}`,
          type: payload.type || 'system',
          title: payload.title,
          content: payload.body || '',
          time: payload.time || new Date().toISOString(),
          mentions: Array.isArray(payload.mentions) ? payload.mentions : [],
          scene: payload.scene || '',
          sceneLabel: payload.sceneLabel || '',
          jumpTarget: payload.jumpTarget || '',
          bizKey: payload.bizKey || '',
          applicationId: payload.applicationId || '',
          playerId: payload.playerId || '',
          playerName: payload.playerName || '',
          phone: payload.phone || '',
        },
        ...trayUnreadItems,
      ].slice(0, 50); // 最多保留 50 条，防止长期驻留内存膨胀
    }

    // 常驻未读列表冒泡：右下角弹出，不自动消失，手动关闭 / 跳转才收起
    showNotifyBubble();
  });

  // 冒泡小窗「一键关闭」
  ipcMain.on('notify:bubble-close', closeNotifyBubble);

  // 冒泡小窗点击某条「跳转」：拉起主窗口并跳转对应页面
  ipcMain.on('notify:bubble-jump', (_event, id) => {
    const item = trayUnreadItems.find((i) => String(i.id) === String(id));
    openNotifyPage(item ? jumpPathFor(item) : '/notify');
  });

  // 渲染进程主动停止闪烁（窗口聚焦 / 进入系统通知页 / 全部已读）
  ipcMain.on('notify:clear-flash', stopTrayFlash);

  // 渲染进程上报未读数与角标图标（Canvas 生成 PNG dataURL）→ 更新托盘角标气泡
  ipcMain.on('notify:tray-badge', (_event, payload = {}) => {
    const count = Number(payload.count) || 0;
    trayUnread = count;

    if (count > 0 && payload.dataUrl) {
      try {
        trayBadgeImage = nativeImage.createFromDataURL(payload.dataUrl);
      } catch (e) {
        trayBadgeImage = null;
      }
      // 未在闪烁时，直接展示带角标的静态图标
      if (!trayFlashTimer) {
        tray.setImage(currentTrayImage());
      }
      tray.setToolTip(currentTrayToolTip());
    } else {
      // 未读清零：清除角标，恢复正常图标
      trayBadgeImage = null;
      stopTrayFlash();
      tray.setImage(currentTrayImage());
      tray.setToolTip(currentTrayToolTip());
    }
  });

  // 渲染进程上报未读列表（常驻冒泡列表数据源）
  // 语义：渲染进程的「未读列表」为权威——已读的消息从冒泡消失，新消息由 notify:incoming 并入
  ipcMain.on('notify:tray-list', (_event, payload = {}) => {
    const items = Array.isArray(payload.items) ? payload.items : [];
    // 空列表且未显式 force：视为渲染进程列表尚未同步到刚推送的新消息（如离线补提醒冒泡刚弹出），
    // 保留现有冒泡，避免「弹出一闪而过」；已读/登出由 force 显式清空收起
    if (!items.length && !payload.force) return;
    trayUnreadItems = items;
    refreshNotifyBubble();
  });
}

/**
 * 创建主窗口函数
 * 用于初始化并配置应用程序的主窗口
 */
function createWindow() {
  // 恢复上次窗口位置/大小（首次启动用默认值）
  const savedState = readWinState();
  const winOptions = {
    width: 1330,
    height: 860,
    frame: false,     // 无边框窗口，使用自绘标题栏
    resizable: true,
    transparent: true, // 窗口背景透明，配合圆角使用
    backgroundColor: '#00000000',
    show: !HIDDEN_LAUNCH, // 开机自启(--hidden)时静默启动，不显示窗口
    icon: path.join(__dirname, 'src', 'assets', 'images', 'logo32.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,        // 安全：渲染进程禁用 Node
      contextIsolation: true,        // 安全：上下文隔离
      sandbox: false,                // preload 里用了 require，不能开 sandbox
      backgroundThrottling: false,   // 防止最小化后 Chromium 节流 setInterval，导致 WebSocket 心跳停发
      // 测试环境 nginx 未开放 CORS，跨域请求的 OPTIONS 预检被 403 拦截（如 wecom-options）。
      // 桌面内网工具场景下关闭 webSecurity 以绕过 CORS：仅加载受控的本地页面与公司 API，可接受。
      // 后端 nginx 开放 CORS 后应移除此项；生产/加载不可信远程内容的场景不建议开启。
      // webSecurity: false,
    },
  };
  if (savedState) {
    winOptions.x = savedState.x;
    winOptions.y = savedState.y;
    winOptions.width = savedState.width;
    winOptions.height = savedState.height;
  }
  mainWindow = new BrowserWindow(winOptions);
  if (savedState && savedState.isMaximized) mainWindow.maximize();

  // 禁用菜单栏（frame:false 下 Alt 键可能唤起菜单，强制隐藏）
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  // 最大化/还原状态变化时通知渲染进程，用于切换按钮图标
  const sendMaximizeState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-change', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', sendMaximizeState);
  mainWindow.on('unmaximize', sendMaximizeState);

  // 窗口位置/大小变化时持久化记忆
  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWinState, 300); // 防抖，拖拽过程中不频繁写盘
  };
  mainWindow.on('resize', scheduleSave);
  mainWindow.on('move', scheduleSave);

  // 禁止渲染进程通过 window.open / target=_blank 打开新窗口，统一交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 页面加载失败（白屏/断网）时记录日志，便于排查
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL) => {
    if (errorCode === -3) return; // -3 = ABORTED，正常跳转忽略
    console.error('[did-fail-load]', errorCode, errorDesc, validatedURL);
  });

  // 根据环境判断加载URL或本地文件
  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // 点关闭按钮时隐藏到托盘，而不是退出（真正退出走托盘菜单 / before-quit）
  mainWindow.on('close', (e) => {
    saveWinState();
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // F12 仅开发模式允许，打包版禁用（防止用户随意打开 DevTools）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // if (!DEV_SERVER_URL) return; // 打包版禁用 F12
    if (input.type === 'keyDown' && input.key === 'F12') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 窗口显示/聚焦时停止托盘闪烁（提醒目的已达到）
  mainWindow.on('show', stopTrayFlash);
  mainWindow.on('focus', stopTrayFlash);
}

// 自绘标题栏的窗口控制：最小化 / 最大化还原 / 关闭
function setupWindowControls() {
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.close());

  // 渲染进程启动时上报当前环境，用于验证环境是否引用正确
  ipcMain.on('app:report-env', (_event, info) => {
    console.log('[ENV] 当前环境:', info.env, `(${info.name})`);
    console.log('[ENV] 版本:', info.version);
    console.log('[ENV] API 地址:', info.baseURL);
  });

  // 一键打开日志目录（设置面板「打开日志」按钮调用）
  ipcMain.handle('app:open-logs-dir', () => {
    const dir = path.join(app.getPath('userData'), 'logs');
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      shell.openPath(dir);
      return { ok: true, dir };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // 一键打开 userData 目录（排查配置文件、settings.json）
  ipcMain.handle('app:open-userdata', () => {
    shell.openPath(app.getPath('userData'));
    return { ok: true, dir: app.getPath('userData') };
  });

  // 清除缓存（轻量版：只清 HTTP/网络请求缓存，不影响登录状态与本地数据）
  ipcMain.handle('app:clear-cache', async () => {
    try {
      const { session } = require('electron');
      const ses = mainWindow ? mainWindow.webContents.session : session.defaultSession;
      await ses.clearCache();
      log.info('[clear-cache] 缓存已清除');
      return { ok: true };
    } catch (err) {
      log.error('[clear-cache] 清除失败:', err);
      return { ok: false, message: String((err && err.message) || err) };
    }
  });

  // safeStorage 加解密（token 等敏感数据加密存储接口）
  // 用法：渲染进程 setToken 时先 encrypt 存密文，getToken 时 decrypt 还原
  ipcMain.handle('security:encrypt', (_e, plainText) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return { ok: false, reason: 'not-available' };
      const buf = safeStorage.encryptString(String(plainText ?? ''));
      return { ok: true, data: buf.toString('base64') };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  ipcMain.handle('security:decrypt', (_e, base64) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return { ok: false, reason: 'not-available' };
      const buf = Buffer.from(String(base64 ?? ''), 'base64');
      return { ok: true, data: safeStorage.decryptString(buf) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

/**
 * 切换窗口显示/隐藏状态
 * 如果窗口不存在则创建新窗口
 * 如果窗口存在则根据当前状态进行隐藏或显示并聚焦
 */
function toggleWindow() {
  // 检查主窗口是否存在，不存在则创建
  if (!mainWindow) {
    createWindow();
    return;
  }
  // 检查窗口当前是否可见
  if (mainWindow.isVisible()) {
    // 如果可见则隐藏窗口
    mainWindow.hide();
  } else {
    // 如果不可见则显示窗口并聚焦
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'src', 'assets', 'images', 'logo16.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  tray.setToolTip('未来电竞管理后台');

  // 右键弹出自绘深色毛玻璃菜单（不使用系统原生菜单）
  tray.on('right-click', (_event, bounds) => {
    showTrayMenu(bounds);
  });

  // 单击托盘图标：
  // - 正在闪动（有未读提醒）→ 显示窗口 + 跳转到系统通知页
  // - 未闪动 → 普通切换显示/隐藏
  tray.on('click', () => {
    if (trayFlashTimer) {
      // 有未读闪动：唤起窗口并直达通知页
      if (!mainWindow) { createWindow(); return; }
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('notify:open-notify', '/notify');
    } else {
      toggleWindow();
    }
  });
  // 双击托盘图标同样切换显示 / 隐藏（Windows 用户习惯）
  tray.on('double-click', () => {
    if (trayFlashTimer) {
      if (!mainWindow) { createWindow(); return; }
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('notify:open-notify', '/notify');
    } else {
      toggleWindow();
    }
  });
}

/* ================= 单实例锁：避免重复启动新窗口，已运行时直接唤起已有窗口 ================= */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 已有实例在运行，直接退出当前新进程
  app.quit();
} else {
  // 第二个实例被启动时（用户点快捷方式/任务栏图标），唤起已有窗口
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  initSettings(); // 初始化应用设置（首次运行默认开启开机自启）
  configureUpdateFeed(); // 配置更新源（环境变量优先）
  setupAutoUpdater(); // 注册自动更新事件
  scheduleAutoCheck(); // 启动后延迟自动检查更新
  setupWindowControls(); // 创建托盘
  setupNotifyBridge(); // 系统通知 IPC（托盘闪烁 / 系统弹窗）
  setupTrayMenuBridge(); // 自绘托盘右键菜单 IPC
  setupSettingsBridge(); // 设置与自动更新 IPC

  // 限制 HTTP 缓存大小（默认无上限，长期驻留会无限涨）
  try {
    const { session } = require('electron');
    session.defaultSession.setCacheSize(100 * 1024 * 1024); // 100MB
  } catch (e) {
    console.warn('[session] 设置缓存大小失败:', e.message);
  }

  createWindow(); // 创建主窗口
  createTray(); // 创建托盘

  app.on('activate', () => { // macOS中，单击Dock图标时没有其他窗口打开，则重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow(); // 当没有窗口打开时，重新创建一个窗口
  });
});

/* ================= 全局崩溃兜底 + 退出流程 ================= */
// 主进程未捕获异常：记录日志，防止进程静默闪退
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// 渲染进程崩溃/被杀时自动 reload，避免白屏卡死
app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[render-process-gone]', details && details.reason, details);
  if (mainWindow && webContents === mainWindow.webContents && !mainWindow.isDestroyed()) {
    try { mainWindow.reload(); } catch {}
  }
});

// 关键：系统关机/注销时也走真实退出流程
// 不点这步，close 事件里的 preventDefault 会拦截关机，导致电脑关不掉
app.on('before-quit', () => {
  app.isQuitting = true;
});

// 退出前清理托盘闪烁定时器，避免句柄泄漏
app.on('will-quit', () => {
  if (trayFlashTimer) {
    clearInterval(trayFlashTimer);
    trayFlashTimer = null;
  }
});

app.on('window-all-closed', () => {
  // 有托盘时保持后台运行；无托盘按平台默认退出
  if (process.platform !== 'darwin' && !tray) app.quit();
});
