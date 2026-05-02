// ============================================================
// 主进程文件 (main.js) - Electron 图片查看器
// ============================================================
// 主进程是 Electron 应用的入口点，负责：
// 1. 创建和管理浏览器窗口
// 2. 处理系统级别的操作（文件对话框、图片读取等）
// 3. 管理 IPC 通信（主进程与渲染进程之间的数据交互）
// ============================================================

const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
// ============================================================
// 增加 EXIF 解析依赖（需要安装）
// npm install exifr
// ============================================================
let exifr
try {
  exifr = require('exifr')
} catch (e) {
  console.log('exifr 未安装，EXIF 功能将不可用')
}

// 全局变量
let mainWindow

// ============================================================
// 图片列表管理（多图浏览）
// ============================================================
let imageList = []      // 当前打开的图片路径列表
let currentIndex = -1   // 当前显示的图片索引
let zoomLevel = 1       // 缩放级别
let currentRotation = 0 // 当前旋转角度

// ============================================================
// 解析图片获取详细信息
// ============================================================
async function parseImage(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // 确定 MIME 类型
    let mimeType = 'image/jpeg'
    const mimeTypes = {
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp'
    }
    if (mimeTypes[ext]) mimeType = mimeTypes[ext]

    // 转换为 Base64
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    // 获取图片尺寸
    const image = nativeImage.createFromBuffer(imageBuffer)
    const size = image.getSize()

    // 获取文件统计信息
    const stats = fs.statSync(filePath)

    // 尝试读取 EXIF 信息
    let exif = null
    if (exifr && ext !== '.svg' && ext !== '.bmp') {
      try {
        exif = await exifr.parse(filePath, {
          ifd0: true,
          ifd1: true,
          exif: true,
          gps: true,
          iptc: true
        })
      } catch (e) {
        console.log('EXIF 解析失败:', e.message)
      }
    }

    // 构建完整的图片信息对象
    return {
      path: filePath,
      name: path.basename(filePath),
      dataUrl,
      width: size.width,
      height: size.height,
      fileSize: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exif: exif || {}
    }
  } catch (error) {
    console.error('解析图片失败:', error)
    throw error
  }
}

// ============================================================
// 加载特定索引的图片
// ============================================================
async function loadImageByIndex(index) {
  if (index < 0 || index >= imageList.length) return null

  currentIndex = index
  const filePath = imageList[currentIndex]

  // 重置变换状态
  zoomLevel = 1
  currentRotation = 0

  const imageInfo = await parseImage(filePath)
  imageInfo.index = currentIndex
  imageInfo.total = imageList.length

  return imageInfo
}

// ============================================================
// 创建浏览器窗口
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    // 窗口尺寸
    width: 1000,
    height: 700,
    // 最小尺寸限制
    minWidth: 600,
    minHeight: 400,
    // frame: false 表示使用无边框窗口
    // 这样可以自定义标题栏样式
    frame: false,
    // 窗口渲染器配置
    webPreferences: {
      // preload 脚本路径 - 用于安全地暴露 Electron API 给渲染进程
      preload: path.join(__dirname, 'preload.js'),
      // 关闭 Node.js 集成（安全考虑）
      nodeIntegration: false,
      // 启用上下文隔离（安全考虑）
      contextIsolation: true
    },
    // 窗口图标
    icon: path.join(__dirname, 'assets/icon.png')
  })

  // 加载渲染进程的 HTML 文件
  mainWindow.loadFile('renderer/index.html')

  // 开发时可以取消下面的注释来打开开发者工具
  // mainWindow.webContents.openDevTools()
}

// ============================================================
// IPC 通信处理 - 图片相关操作
// ============================================================

// 处理打开图片请求
ipcMain.handle('image:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    // 修改：允许选择多个文件
    properties: ['openFile', 'multiSelections']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  // 保存所有选中的图片路径
  imageList = result.filePaths
  currentIndex = 0
  zoomLevel = 1
  currentRotation = 0

  // 加载并解析第一张图片
  return await loadImageByIndex(0)
})

// 切换到下一张图片
ipcMain.handle('image:next', async () => {
  if (imageList.length === 0 || currentIndex >= imageList.length - 1) {
    return null
  }
  return await loadImageByIndex(currentIndex + 1)
})

// 切换到上一张图片
ipcMain.handle('image:prev', async () => {
  if (imageList.length === 0 || currentIndex <= 0) {
    return null
  }
  return await loadImageByIndex(currentIndex - 1)
})

// 获取当前图片列表信息
ipcMain.handle('image:getListInfo', () => {
  return {
    total: imageList.length,
    current: currentIndex,
    currentPath: imageList[currentIndex] || null
  }
})

// 处理拖放打开图片
ipcMain.handle('image:openDropped', async (event, filePaths) => {
  if (!filePaths || filePaths.length === 0) return null

  // 过滤有效的图片文件
  const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
  imageList = filePaths.filter(p => {
    const ext = path.extname(p).toLowerCase()
    return validExts.includes(ext) && fs.existsSync(p)
  })

  if (imageList.length === 0) return null

  currentIndex = 0
  zoomLevel = 1
  currentRotation = 0

  return await loadImageByIndex(0)
})

// 图片缩放
ipcMain.handle('image:zoom', (event, direction) => {
  if (direction === 'in') {
    zoomLevel = Math.min(zoomLevel + 0.1, 5)
  } else if (direction === 'out') {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.1)
  } else if (typeof direction === 'number') {
    zoomLevel = direction
  }
  return zoomLevel
})

ipcMain.handle('image:getZoom', () => zoomLevel)

// 图片旋转
ipcMain.handle('image:rotate', (event, angle) => {
  currentRotation = (currentRotation + angle) % 360
  return { angle: currentRotation }
})

// 获取当前旋转角度
ipcMain.handle('image:getRotation', () => currentRotation)

// ============================================================
// 幻灯片模式支持
// ============================================================
let slideshowInterval = null
let slideshowDelay = 3000 // 默认 3 秒

// 开始幻灯片
ipcMain.handle('slideshow:start', async (event, delay) => {
  // 如果已有正在运行的幻灯片，先停止
  if (slideshowInterval) {
    clearInterval(slideshowInterval)
    slideshowInterval = null
  }

  // 设置新的延迟（如果提供了）
  if (delay && delay >= 1000) {
    slideshowDelay = delay
  }

  // 立即切换到下一张（第一次）
  if (currentIndex < imageList.length - 1) {
    const nextImage = await loadImageByIndex(currentIndex + 1)
    mainWindow.webContents.send('slideshow:imageChanged', nextImage)
  }

  // 启动定时器
  slideshowInterval = setInterval(async () => {
    if (currentIndex >= imageList.length - 1) {
      // 到达末尾，重新从头开始
      const firstImage = await loadImageByIndex(0)
      mainWindow.webContents.send('slideshow:imageChanged', firstImage)
    } else {
      const nextImage = await loadImageByIndex(currentIndex + 1)
      mainWindow.webContents.send('slideshow:imageChanged', nextImage)
    }
  }, slideshowDelay)

  return { started: true, delay: slideshowDelay }
})

// 停止幻灯片
ipcMain.handle('slideshow:stop', () => {
  if (slideshowInterval) {
    clearInterval(slideshowInterval)
    slideshowInterval = null
    return { stopped: true }
  }
  return { stopped: false }
})

// 获取幻灯片状态
ipcMain.handle('slideshow:status', () => {
  return {
    isRunning: !!slideshowInterval,
    delay: slideshowDelay,
    currentIndex,
    total: imageList.length
  }
})

// ============================================================
// 图片编辑功能 - 裁剪（简化版，实际在渲染进程处理）
// ============================================================
ipcMain.handle('image:crop', async (event, cropData) => {
  if (!imageList[currentIndex]) return null

  try {
    const filePath = imageList[currentIndex]
    const imageBuffer = fs.readFileSync(filePath)
    const image = nativeImage.createFromBuffer(imageBuffer)

    // 获取原始图片尺寸
    const originalSize = image.getSize()

    // 计算实际裁剪坐标（考虑缩放比例）
    const scaleX = originalSize.width / cropData.originalWidth
    const scaleY = originalSize.height / cropData.originalHeight

    const cropRect = {
      x: Math.round(cropData.x * scaleX),
      y: Math.round(cropData.y * scaleY),
      width: Math.round(cropData.width * scaleX),
      height: Math.round(cropData.height * scaleY)
    }

    // 使用 nativeImage.crop() 方法裁剪图片
    const cropped = image.crop(cropRect)

    // 返回裁剪后的数据
    const croppedBuffer = cropped.toPNG()
    const croppedBase64 = croppedBuffer.toString('base64')

    return {
      dataUrl: `data:image/png;base64,${croppedBase64}`,
      width: cropRect.width,
      height: cropRect.height
    }
  } catch (error) {
    console.error('裁剪失败:', error)
    throw error
  }
})

// ============================================================
// 图片保存
// ============================================================
ipcMain.handle('image:save', async (event, data) => {
  // 保存编辑后的图片
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存图片',
    defaultPath: `edited_${path.basename(imageList[currentIndex] || 'image.png')}`,
    filters: [
      { name: 'PNG', extensions: ['png'] },
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (result.canceled) return { saved: false }

  try {
    // data.dataUrl 是 Base64 格式的图片
    const base64Data = data.dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(result.filePath, buffer)
    return { saved: true, path: result.filePath }
  } catch (error) {
    console.error('保存失败:', error)
    return { saved: false, error: error.message }
  }
})

// ============================================================
// IPC 通信处理 - 窗口控制
// ============================================================

// 最小化窗口
// 使用 ipcMain.on 因为这是单向通信（send/on 模式），不需要返回结果
ipcMain.on('window:minimize', () => {
  mainWindow.minimize()
})

// 最大化/取消最大化窗口
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    // 如果已经最大化，则取消最大化
    mainWindow.unmaximize()
  } else {
    // 否则执行最大化
    mainWindow.maximize()
  }
})

// 关闭窗口
ipcMain.on('window:close', () => {
  mainWindow.close()
})

// 获取窗口是否处于最大化状态
// 使用 handle 因为需要返回状态给渲染进程
ipcMain.handle('window:isMaximized', () => {
  return mainWindow.isMaximized()
})

// ============================================================
// 应用生命周期管理
// ============================================================

// 应用就绪时创建窗口
app.whenReady().then(() => {
  createWindow()

  // macOS 特殊处理：当点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（Windows/Linux）
// macOS 通常保持应用在后台运行（除非按下 Cmd+Q）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
