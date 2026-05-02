const { contextBridge } = require('electron');

// 安全地暱露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 可以在这里添加需要的 API
});
