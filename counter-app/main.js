// ============================================================
// Electron 计数器应用 - 主进程入口文件
// 文件路径: counter-app/main.js
// ============================================================

// 引入 Electron 的核心模块
// - app: 控制应用程序的生命周期
// - BrowserWindow: 创建和管理浏览器窗口
// - ipcMain: 处理主进程与渲染进程之间的 IPC 通信
const { app, BrowserWindow, ipcMain } = require('electron')

// 引入 Node.js 的 path 模块，用于处理文件路径
const path = require('path')

// 保存主窗口的引用
// 注意：如果不保存引用，窗口对象会被垃圾回收，导致窗口意外关闭
let mainWindow = null

// ============================================================
// 创建浏览器窗口的函数
// ============================================================
function createWindow() {
  // 创建新窗口，配置窗口属性
  mainWindow = new BrowserWindow({
    width: 400,        // 窗口宽度（像素）
    height: 300,       // 窗口高度（像素）

    // webPreferences: 配置网页相关的选项（安全相关）
    webPreferences: {
      // preload: 指定预加载脚本的路径
      // 预加载脚本在渲染进程加载之前执行，可以安全地暴露 API 给渲染进程
      preload: path.join(__dirname, 'preload.js'),

      // nodeIntegration: 是否允许渲染进程使用 Node.js
      // false: 禁用（推荐），提高安全性，防止渲染进程直接访问 Node.js API
      nodeIntegration: false,

      // contextIsolation: 是否启用上下文隔离
      // true: 启用（推荐），防止渲染进程修改预加载脚本暴露的 API
      contextIsolation: true
    }
  })

  // 加载渲染进程的文件（index.html）
  // 注意：路径相对于项目根目录，不需要加 renderer/ 前缀
  // 因为我们已经将 renderer 目录作为相对路径的一部分
  mainWindow.loadFile('renderer/index.html')

  // 开发时自动打开开发者工具（DevTools）
  // 生产环境可以删除这行，或者使用条件判断
  mainWindow.webContents.openDevTools()
}

// ============================================================
// 应用程序生命周期事件处理
// ============================================================

// Electron 初始化完成后执行
// app.whenReady() 返回一个 Promise，当 Electron 准备就绪时 resolved
app.whenReady().then(() => {
  // 创建主窗口
  createWindow()

  // macOS 特殊处理：点击 Dock 图标时重新创建窗口
  // 在 macOS 上，应用程序通常在 Dock 中有一个图标
  // 点击图标时，如果没有窗口存在，应该重新创建一个
  app.on('activate', () => {
    // 检查是否没有任何窗口存在
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用程序
// 注意：在 macOS 上，应用程序通常在菜单栏运行，而不是 Dock
// 所以在 macOS 上，点击关闭按钮只是关闭窗口，不会退出应用
app.on('window-all-closed', () => {
  // 检查平台是否为 macOS
  // darwin 是 macOS 的操作系统名称
  if (process.platform !== 'darwin') {
    // 非 macOS 平台：退出应用程序
    app.quit()
  }
})

// ============================================================
// IPC 通信处理
// ============================================================
//
// IPC (Inter-Process Communication，进程间通信) 机制允许主进程和渲染进程交换数据
//
// 通信模式：
// 1. 渲染进程 -> 主进程：使用 ipcRenderer.invoke() 发送请求
// 2. 主进程 -> 渲染进程：使用 ipcMain.handle() 接收请求并返回响应
//

// 注册一个 IPC 处理器，用于处理渲染进程发来的计数器操作请求
//
// 参数说明：
// - 'counter:operation': IPC 通道名称，用于标识这个特定的通信通道
// - event: 事件对象，包含发送方的信息
// - operation: 从渲染进程传来的操作类型（如 'increase', 'decrease', 'reset'）
ipcMain.handle('counter:operation', (event, operation) => {
  // event 是事件对象，operation 是渲染进程传来的参数

  // 在主进程的控制台打印日志（可以在 DevTools 中查看）
  console.log(`Received operation: ${operation}`)

  // 返回一个结果对象给渲染进程
  // 无论操作是什么，我们只返回成功状态，因为这只是一个演示
  return { success: true, operation }
})

// ============================================================
// 代码说明：
// ============================================================
//
// 1. 主进程 (main.js) 是 Electron 应用的入口点
//    - 它运行在 Node.js 环境中
//    - 可以访问所有 Node.js API
//    - 负责管理应用程序的生命周期和窗口
//
// 2. BrowserWindow 用于创建应用窗口
//    - 每个窗口对应一个渲染进程
//    - webPreferences 用于配置窗口的安全选项
//
// 3. IPC 通信是主进程和渲染进程之间交换数据的主要方式
//    - 使用 ipcMain.handle() 在主进程中注册处理器
//    - 使用 ipcRenderer.invoke() 在渲染进程中发送请求
//    - 这种模式是双向的，支持请求-响应
//
// 4. 安全最佳实践：
//    - nodeIntegration: false - 禁用渲染进程直接使用 Node.js
//    - contextIsolation: true - 启用上下文隔离
//    - 使用 preload 脚本安全地暴露 API
//