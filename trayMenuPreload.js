const { contextBridge, ipcRenderer } = require('electron');

// 托盘右键菜单桥接：点击菜单项 / 点击外部关闭
contextBridge.exposeInMainWorld('trayMenuBridge', {
  click: (action) => ipcRenderer.send('tray-menu:click', action),
  close: () => ipcRenderer.send('tray-menu:close'),
});
