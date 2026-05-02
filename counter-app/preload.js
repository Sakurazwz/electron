// ============================================================
// Electron 预加载脚本
// 文件路径: counter-app/preload.js
// ============================================================
//
// 预加载脚本的作用：
// - 在渲染进程加载页面之前执行
// - 可以安全地暴露 API 给渲染进程
// - 绕过 contextIsolation 的限制，实现主进程和渲染进程之间的通信
//
// 注意：预加载脚本在浏览器环境中执行，但可以访问有限的 Node.js API
// ============================================================

// 引入 Electron 的预加载 API
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
  // 暴露一个发送计数器操作的方法给渲染进程
  //
  // 参数说明：
  // - operation: 操作类型，如 'increase'、'decrease'、'reset'
  //
  // 返回值：
  // - 返回一个 Promise，resolve 后得到主进程返回的结果
  //
  // 使用方式（在渲染进程中）：
  //   const result = await window.electronAPI.sendOperation('increase')
  //
  sendOperation: (operation) => {
    // ipcRenderer.invoke() 是 Electron 用于进程间通信的方法
    // - 第一个参数是 IPC 通道名称，必须与主进程中注册的处理器匹配
    // - 后续参数会被传递给主进程的处理器
    //
    // 这里我们调用主进程中注册的 'counter:operation' 处理器
    return ipcRenderer.invoke('counter:operation', operation)
  }
})

// ============================================================
// 补充说明：为什么需要预加载脚本？
// ============================================================
//
// 由于我们在 main.js 中设置了：
//   nodeIntegration: false
//   contextIsolation: true
//
// 这意味着：
// 1. 渲染进程无法直接使用 require() 访问 Node.js 模块
// 2. 渲染进程的 JavaScript 环境与预加载脚本环境隔离
//
// 预加载脚本作为两者之间的桥梁：
// - 它在渲染进程加载之前执行
// - 它可以访问 Node.js（通过 require）
// - 它使用 contextBridge 安全地暴露有限的 API
// - 渲染进程只能访问暴露的 API，无法直接访问 Node.js
//
// 这种设计大大提高了应用的安全性，防止恶意网页代码访问系统资源