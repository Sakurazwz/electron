// ============================================================
// Electron 图片查看器 - 预加载脚本
// 文件路径: image-viewer/preload.js
// ============================================================
//
// 预加载脚本的作用：
// - 在渲染进程加载页面之前执行
// - 可以安全地暴露 API 给渲染进程
// - 绕过 contextIsolation 的限制，实现主进程和渲染进程之间的通信
//
// 注意：预加载脚本在浏览器环境中执行，但可以访问有限的 Node.js API
// ============================================================

// ============================================================
// 引入 Electron 的预加载 API
// ============================================================
// - contextBridge: 用于安全地向渲染进程的 window 对象暴露 API
// - ipcRenderer: 用于向主进程发送 IPC 消息
const { contextBridge, ipcRenderer } = require('electron')

// ============================================================
// 使用 contextBridge 暴露 API
// ============================================================
//
// contextBridge.exposeInMainWorld() 方法可以在渲染进程的 window 对象上
// 添加属性，从而安全地暴露主进程的 API 给渲染进程
//
// 参数说明：
// - 'electronAPI': 在渲染进程中访问的属性名
//   渲染进程可以通过 window.electronAPI 访问
// - 对象: 要暴露的方法和属性
//
contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================
  // 图片操作 API
  // ============================================================

  /**
   * 打开图片文件
   * 使用原生对话框让用户选择图片
   * @returns {Promise<Object|null>} 图片信息对象，包含路径、名称、Base64数据、尺寸
   */
  openImage: () => ipcRenderer.invoke('image:open'),

  /**
   * 缩放图片
   * @param {string|number} direction - 'in'放大,'out'缩小 或直接传入数字
   * @returns {Promise<number>} 新的缩放级别
   */
  zoomImage: (direction) => ipcRenderer.invoke('image:zoom', direction),

  /**
   * 获取当前缩放级别
   * @returns {Promise<number>} 当前缩放级别
   */
  getZoom: () => ipcRenderer.invoke('image:getZoom'),

  /**
   * 旋转图片
   * @param {number} angle - 旋转角度
   * @returns {Promise<Object>} 旋转角度对象
   */
  rotateImage: (angle) => ipcRenderer.invoke('image:rotate', angle),

  // ============================================================
  // 窗口控制 API
  // ============================================================

  /**
   * 最小化窗口
   * 使用 send() 方法发送消息，不需要等待响应
   */
  minimizeWindow: () => ipcRenderer.send('window:minimize'),

  /**
   * 切换最大化/还原窗口
   */
  maximizeWindow: () => ipcRenderer.send('window:maximize'),

  /**
   * 关闭窗口
   */
  closeWindow: () => ipcRenderer.send('window:close'),

  /**
   * 获取窗口是否最大化
   * @returns {Promise<boolean>} 是否最大化
   */
  isMaximized: () => ipcRenderer.invoke('window:isMaximized')
})

// ============================================================
// 补充说明：IPC 通信方式
// ============================================================
//
// Electron 提供了两种 IPC 通信方式：
//
// 1. ipcRenderer.invoke() / ipcMain.handle()
//    - 请求-响应模式
//    - 渲染进程发送请求，主进程处理后返回结果
//    - 使用 async/await 处理
//    - 示例：window.electronAPI.openImage()
//
// 2. ipcRenderer.send() / ipcMain.on()
//    - 单向消息模式
//    - 渲染进程发送消息，主进程接收处理
//    - 不需要等待响应
//    - 示例：window.electronAPI.minimizeWindow()
//
// 预加载脚本作为两者之间的桥梁：
// - 它在渲染进程加载之前执行
// - 它可以访问 Node.js（通过 require）
// - 它使用 contextBridge 安全地暴露有限的 API
// - 渲染进程只能访问暴露的 API，无法直接访问 Node.js
//
// 这种设计大大提高了应用的安全性，防止恶意网页代码访问系统资源