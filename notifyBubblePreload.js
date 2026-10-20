const { contextBridge, ipcRenderer } = require('electron');

// 系统消息冒泡小窗的桥接：一键关闭 / 行内跳转
contextBridge.exposeInMainWorld('bubbleBridge', {
  close: () => ipcRenderer.send('notify:bubble-close'),
  jump: (id) => ipcRenderer.send('notify:bubble-jump', id),
});
