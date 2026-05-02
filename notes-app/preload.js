const { contextBridge, ipcRenderer } = require('electron')

/**
 * 预加载脚本
 * 作为主进程和渲染进程之间的桥梁，安全地暴露Electron API
 * 使用contextBridge确保上下文隔离，防止渲染进程直接访问Node.js API
 */

// 通过contextBridge向渲染进程的window对象暴露API
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 标记文档为已修改
   * 渲染进程调用此函数通知主进程内容已更改
   */
  markModified: () => ipcRenderer.send('document:modified'),

  /**
   * 获取当前文件路径
   * 返回Promise，解析为当前打开的文件路径
   */
  getCurrentPath: () => ipcRenderer.invoke('file:getCurrentPath'),

  /**
   * 监听文件打开事件
   * @param {Function} callback - 接收打开文件数据的回调函数
   * 当主进程打开文件后，会触发此事件
   */
  onFileOpened: (callback) => {
    ipcRenderer.on('file:opened', (event, data) => callback(data))
  },

  /**
   * 监听新建文件事件
   * @param {Function} callback - 新建文件后的回调函数
   * 当主进程创建新文件后，会触发此事件
   */
  onNewFile: (callback) => {
    ipcRenderer.on('file:new', () => callback())
  }
})