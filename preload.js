const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

contextBridge.exposeInMainWorld('appInfo', {
  reportEnv: (info) => ipcRenderer.send('app:report-env', info),
  openLogsDir: () => ipcRenderer.invoke('app:open-logs-dir'),
  openUserData: () => ipcRenderer.invoke('app:open-userdata'),
  clearCache: () => ipcRenderer.invoke('app:clear-cache'),
});

// 安全桥接：safeStorage 加解密（token 等敏感数据加密存储）
contextBridge.exposeInMainWorld('securityBridge', {
  encrypt: (text) => ipcRenderer.invoke('security:encrypt', text),
  decrypt: (b64) => ipcRenderer.invoke('security:decrypt', b64),
});

contextBridge.exposeInMainWorld('appActions', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
})

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizeChange: (callback) => {
    const listener = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximize-change', listener);
    return () => ipcRenderer.removeListener('window:maximize-change', listener);
  },
});

// 系统通知桥接：渲染进程收到 WebSocket 消息后通知主进程闪托盘 / 弹系统通知 / 更新托盘角标与未读列表
contextBridge.exposeInMainWorld('notifyBridge', {
  notifyIncoming: (payload) => ipcRenderer.send('notify:incoming', payload),
  clearFlash: () => ipcRenderer.send('notify:clear-flash'),
  setTrayBadge: (payload) => ipcRenderer.send('notify:tray-badge', payload),
  setTrayList: (payload) => ipcRenderer.send('notify:tray-list', payload),
  setPageStatus: (onNotifyPage) => ipcRenderer.send('notify:page-status', onNotifyPage),
  onOpenNotify: (callback) => {
    const listener = (_event, path) => callback(path);
    ipcRenderer.on('notify:open-notify', listener);
    return () => ipcRenderer.removeListener('notify:open-notify', listener);
  },
});

// 设置桥接：开机自启 / 自动更新 / 版本信息 / 检查更新
contextBridge.exposeInMainWorld('settingsBridge', {
  getState: () => ipcRenderer.invoke('settings:get-state'),
  setAutoLaunch: (enable) => ipcRenderer.invoke('settings:set-auto-launch', enable),
  setAutoUpdate: (enable) => ipcRenderer.invoke('settings:set-auto-update', enable),
  checkUpdate: () => ipcRenderer.invoke('settings:check-update'),
  downloadUpdate: () => ipcRenderer.invoke('settings:download-update'),
  quitAndInstall: () => ipcRenderer.invoke('settings:quit-and-install'),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('settings:update-status', listener);
    return () => ipcRenderer.removeListener('settings:update-status', listener);
  },
});
