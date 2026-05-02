// ============================================================
// Electron 图片查看器 - 主进程入口文件
// 文件路径: image-viewer/main.js
// ============================================================
//
// 本文件是 Electron 应用的主进程入口点
// 主进程运行在 Node.js 环境中，可以访问所有 Node.js API
// 负责管理应用程序的生命周期、窗口、文件操作等
// ============================================================

// ============================================================
// 引入 Electron 核心模块
// ============================================================
// - app: 控制应用程序的生命周期（启动、退出等）
// - BrowserWindow: 创建和管理浏览器窗口
// - ipcMain: 处理主进程与渲染进程之间的 IPC 通信
// - dialog: 原生对话框（文件选择框、消息框等）
// - nativeImage: 用于处理图片（读取尺寸、转换等）
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')

// 引入 Node.js 的 path 模块，用于处理文件路径
const path = require('path')

// 引入 Node.js 的 fs 模块，用于读取文件
const fs = require('fs')

// ============================================================
// 全局变量
// ============================================================

// 保存主窗口的引用
// 注意：如果不保存引用，窗口对象会被垃圾回收，导致窗口意外关闭
let mainWindow = null

// 当前打开的图片路径
let currentImagePath = null

// 当前缩放级别（默认为 1，即 100%）
// 范围：0.1 到 5，即 10% 到 500%
let zoomLevel = 1

// ============================================================
// 创建浏览器窗口函数
// ============================================================
function createWindow() {
  // 创建新窗口，配置窗口属性
  mainWindow = new BrowserWindow({
    width: 1000,        // 窗口宽度（像素）
    height: 700,       // 窗口高度（像素）

    // 最小窗口尺寸限制，防止窗口过小影响使用
    minWidth: 600,    // 最小宽度
    minHeight: 400,   // 最小高度

    // frame: false 表示使用无边框窗口
    // 这样可以自定义标题栏，实现类似原生应用的体验
    frame: false,

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
    },

    // 设置窗口图标（可选，如果没有图标文件可以删除这行）
    // icon: path.join(__dirname, 'assets/icon.png')
  })

  // 加载渲染进程的 HTML 文件
  // 路径相对于项目根目录
  mainWindow.loadFile('renderer/index.html')

  // 开发时自动打开开发者工具（DevTools）
  // 生产环境可以删除这行
  mainWindow.webContents.openDevTools()
}

// ============================================================
// IPC 通信处理 - 图片操作
// ============================================================
//
// IPC (Inter-Process Communication，进程间通信) 机制允许主进程和渲染进程交换数据
// 使用 ipcMain.handle() 在主进程中注册处理器
// 使用 ipcRenderer.invoke() 在渲染进程中发送请求
// ============================================================

/**
 * 打开图片文件
 * 使用原生对话框让用户选择图片，然后读取并返回给渲染进程
 */
ipcMain.handle('image:open', async () => {
  // 显示打开文件对话框
  // 参数说明：
  // - mainWindow: 父窗口
  // - title: 对话框标题
  // - filters: 文件过滤器，只显示指定类型的文件
  // - properties: 对话框属性，openFile 表示只能选择一个文件
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [
      // 支持的图片格式
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  // 如果用户取消选择或没有选择文件，返回 null
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  // 获取选择的文件路径
  const filePath = result.filePaths[0]

  // 保存当前图片路径
  currentImagePath = filePath

  // 重置缩放级别
  zoomLevel = 1

  // 读取图片文件并转换为 Base64 格式
  try {
    // 使用 fs 模块读取图片文件
    const imageBuffer = fs.readFileSync(filePath)

    // 获取文件扩展名，用于确定 MIME 类型
    const ext = path.extname(filePath).toLowerCase()

    // 根据文件扩展名确定 MIME 类型
    // MIME 类型用于构建 data URL
    let mimeType = 'image/jpeg'  // 默认值

    switch (ext) {
      case '.png':
        mimeType = 'image/png'
        break
      case '.gif':
        mimeType = 'image/gif'
        break
      case '.webp':
        mimeType = 'image/webp'
        break
      case '.svg':
        mimeType = 'image/svg+xml'
        break
      case '.bmp':
        mimeType = 'image/bmp'
        break
      // jpg/jpeg 使用默认的 image/jpeg
    }

    // 将图片数据转换为 Base64 编码
    const base64 = imageBuffer.toString('base64')

    // 构建 data URL，格式：data:[MIME类型];base64,[数据]
    const dataUrl = `data:${mimeType};base64,${base64}`

    // 使用 nativeImage 获取图片尺寸
    const image = nativeImage.createFromBuffer(imageBuffer)
    const size = image.getSize()

    // 返回图片信息给渲染进程
    return {
      path: filePath,           // 文件完整路径
      name: path.basename(filePath),  // 文件名
      dataUrl: dataUrl,         // Base64 编码的图片数据
      width: size.width,       // 图片宽度
      height: size.height      // 图片高度
    }
  } catch (error) {
    // 错误处理：显示错误对话框
    dialog.showErrorBox('打开图片失败', error.message)
    return null
  }
})

/**
 * 缩放图片
 * @param {string} direction - 缩放方向：'in' 放大，'out' 缩小
 * @param {number} direction - 也可以直接传入数字表示缩放级别
 */
ipcMain.handle('image:zoom', (event, direction) => {
  // 根据参数类型处理
  if (direction === 'in') {
    // 放大：增加 10%，最大 500%
    zoomLevel = Math.min(zoomLevel + 0.1, 5)
  } else if (direction === 'out') {
    // 缩小：减少 10%，最小 10%
    zoomLevel = Math.max(zoomLevel - 0.1, 0.1)
  } else if (typeof direction === 'number') {
    // 直接设置缩放级别
    zoomLevel = direction
  }

  // 返回当前缩放级别
  return zoomLevel
})

/**
 * 获取当前缩放级别
 */
ipcMain.handle('image:getZoom', () => {
  return zoomLevel
})

/**
 * 旋转图片
 * @param {number} angle - 旋转角度
 */
ipcMain.handle('image:rotate', (event, angle) => {
  // 这里只是简单返回角度，实际的旋转在渲染进程中使用 CSS 实现
  return { angle }
})

// ============================================================
// IPC 通信处理 - 窗口控制
// ============================================================

/**
 * 最小化窗口
 */
ipcMain.on('window:minimize', () => {
  mainWindow.minimize()
})

/**
 * 切换最大化/还原窗口
 * 如果窗口已最大化，则还原；否则最大化
 */
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    // 还原窗口
    mainWindow.unmaximize()
  } else {
    // 最大化窗口
    mainWindow.maximize()
  }
})

/**
 * 关闭窗口
 */
ipcMain.on('window:close', () => {
  mainWindow.close()
})

/**
 * 获取窗口是否最大化
 */
ipcMain.handle('window:isMaximized', () => {
  return mainWindow.isMaximized()
})

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
// 代码结构说明
// ============================================================
//
// 1. 主进程 (main.js) 是 Electron 应用的入口点
//    - 运行在 Node.js 环境中
//    - 可以访问所有 Node.js API
//    - 负责管理应用程序的生命周期和窗口
//
// 2. BrowserWindow 用于创建应用窗口
//    - 每个窗口对应一个渲染进程
//    - frame: false 启用无边框窗口，用于自定义标题栏
//    - webPreferences 用于配置窗口的安全选项
//
// 3. IPC 通信是主进程和渲染进程之间交换数据的主要方式
//    - 使用 ipcMain.handle() 在主进程中注册处理器
//    - 使用 ipcRenderer.invoke() 在渲染进程中发送请求
//    - 支持请求-响应模式
//
// 4. 图片加载流程：
//    - 渲染进程请求打开图片
//    - 主进程显示文件选择对话框
//    - 用户选择图片后，主进程读取文件
//    - 使用 nativeImage 获取图片尺寸
//    - 将图片转换为 Base64 编码的 data URL
//    - 返回图片信息给渲染进程
//
// 5. 窗口控制：
//    - 最小化：mainWindow.minimize()
//    - 最大化：mainWindow.maximize()
//    - 还原：mainWindow.unmaximize()
//    - 关闭：mainWindow.close()
//    - 查询状态：mainWindow.isMaximized()
//
// 6. 安全最佳实践：
//    - nodeIntegration: false - 禁用渲染进程直接使用 Node.js
//    - contextIsolation: true - 启用上下文隔离
//    - 使用 preload 脚本安全地暴露 API