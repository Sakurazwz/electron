// ============================================================
// Electron 图片查看器 - 渲染进程 JavaScript 文件
// 文件路径: image-viewer/renderer/renderer.js
// ============================================================
//
// 渲染进程运行在 Chromium 浏览器环境中
// 每个 Electron 窗口对应一个渲染进程
// 渲染进程默认无法直接访问 Node.js API，需要通过预加载脚本暴露的 API 与主进程通信
// ============================================================

// ============================================================
// 1. 获取 DOM 元素
// ============================================================
//
// 在页面加载完成后，获取需要操作的 HTML 元素
// 这些元素通过 id 属性与 HTML 中的元素对应
//

// 标题栏相关元素
const appTitle = document.getElementById('appTitle')  // 应用标题
const minimizeBtn = document.getElementById('minimizeBtn')  // 最小化按钮
const maximizeBtn = document.getElementById('maximizeBtn')  // 最大化按钮
const closeBtn = document.getElementById('closeBtn')  // 关闭按钮

// 工具栏相关元素
const openBtn = document.getElementById('openBtn')  // 打开按钮
const imageControls = document.getElementById('imageControls')  // 图片控制按钮组
const zoomInBtn = document.getElementById('zoomInBtn')  // 放大按钮
const zoomOutBtn = document.getElementById('zoomOutBtn')  // 缩小按钮
const fitBtn = document.getElementById('fitBtn')  // 适应窗口按钮
const actualSizeBtn = document.getElementById('actualSizeBtn')  // 原始大小按钮
const rotateLeftBtn = document.getElementById('rotateLeftBtn')  // 左转按钮
const rotateRightBtn = document.getElementById('rotateRightBtn')  // 右转按钮
const zoomLevel = document.getElementById('zoomLevel')  // 缩放级别显示

// 图片显示相关元素
const imageContainer = document.getElementById('imageContainer')  // 图片容器
const placeholder = document.getElementById('placeholder')  // 占位符
const imageWrapper = document.getElementById('imageWrapper')  // 图片包装器
const imagePreview = document.getElementById('imagePreview')  // 图片预览元素

// 状态栏相关元素
const imageName = document.getElementById('imageName')  // 图片名称
const imageSize = document.getElementById('imageSize')  // 图片大小
const imageDimensions = document.getElementById('imageDimensions')  // 图片尺寸

// ============================================================
// 2. 状态管理
// ============================================================

// 当前缩放级别（1 = 100%）
let currentZoom = 1

// 当前旋转角度（单位：度）
let currentRotation = 0

// 图片原始尺寸（用于计算适应窗口的缩放比例）
let originalWidth = 0
let originalHeight = 0

// 当前图片数据对象
let imageData = null

// ============================================================
// 3. 功能函数
// ============================================================

/**
 * 更新图片显示
 * 根据当前缩放级别和旋转角度更新图片的 CSS transform 属性
 * 同时更新状态栏中的缩放级别显示
 */
function updateImageDisplay() {
  // 如果没有图片数据，直接返回
  if (!imageData) return

  // 使用 CSS transform 实现缩放和旋转
  // scale(): 缩放倍数
  // rotate(): 旋转角度
  imagePreview.style.transform = `scale(${currentZoom}) rotate(${currentRotation}deg)`

  // 更新状态栏中的缩放级别显示
  // Math.round() 将小数四舍五入为整数
  zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`
}

/**
 * 计算适应窗口的缩放比例
 * 根据窗口大小和图片原始尺寸计算
 * @returns {number} 适应窗口的缩放比例
 */
function calculateFitZoom() {
  // 如果没有图片数据，返回默认值 1
  if (!imageData) return 1

  // 获取图片容器的尺寸
  const containerRect = imageContainer.getBoundingClientRect()

  // 边距：图片与容器边缘保持一定距离
  const padding = 40

  // 计算可用空间（减去边距）
  const availableWidth = containerRect.width - padding
  const availableHeight = containerRect.height - padding

  // 计算水平和垂直方向的缩放比例
  const scaleX = availableWidth / originalWidth
  const scaleY = availableHeight / originalHeight

  // 返回较小的缩放比例，确保图片完全显示
  // 同时不超过原始大小（1）
  return Math.min(scaleX, scaleY, 1)
}

/**
 * 格式化文件大小
 * 将字节数转换为人类可读的格式（B、KB、MB）
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小字符串
 */
function formatFileSize(bytes) {
  // 小于 1024 字节，显示为 B
  if (bytes < 1024) return bytes + ' B'

  // 小于 1 MB，显示为 KB（保留一位小数）
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'

  // 大于等于 1 MB，显示为 MB（保留一位小数）
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * 打开图片
 * 通过 IPC 调用主进程打开文件对话框，选择图片并加载
 */
async function openImage() {
  // ============================================================
  // IPC 通信：调用主进程的 image:open 处理器
  // ============================================================
  // window.electronAPI 是预加载脚本暴露的对象
  // openImage() 方法向主进程发送 'image:open' 请求
  // 主进程显示文件选择对话框，返回图片信息

  const result = await window.electronAPI.openImage()

  // 如果用户取消选择（result 为 null），直接返回
  if (!result) return

  // 保存图片数据
  imageData = result
  originalWidth = result.width
  originalHeight = result.height

  // 重置缩放和旋转状态
  currentZoom = 1
  currentRotation = 0

  // 设置图片元素的 src 属性
  // 使用 Base64 编码的 data URL
  imagePreview.src = result.dataUrl

  // 更新状态栏
  imageName.textContent = result.name  // 文件名
  imageDimensions.textContent = `${result.width} x ${result.height}`  // 尺寸

  // 切换显示：隐藏占位符，显示图片
  placeholder.style.display = 'none'
  imageWrapper.style.display = 'flex'
  imageControls.style.display = 'flex'

  // 更新窗口标题，显示文件名
  appTitle.textContent = `图片查看器 - ${result.name}`

  // 延迟执行适应窗口操作
  // 等待图片加载完成后再计算缩放比例
  setTimeout(() => {
    currentZoom = calculateFitZoom()
    updateImageDisplay()
  }, 100)
}

/**
 * 缩放图片
 * @param {string} direction - 缩放方向：'in' 放大，'out' 缩小
 */
async function zoom(direction) {
  // 如果没有打开图片，直接返回
  if (!imageData) return

  // 通过 IPC 调用主进程的 image:zoom 处理器
  // 返回新的缩放级别
  currentZoom = await window.electronAPI.zoomImage(direction)

  // 更新图片显示
  updateImageDisplay()
}

/**
 * 适应窗口
 * 将图片缩放到刚好适应窗口大小
 */
function fitToWindow() {
  // 如果没有打开图片，直接返回
  if (!imageData) return

  // 计算适应窗口的缩放比例
  currentZoom = calculateFitZoom()

  // 更新图片显示
  updateImageDisplay()
}

/**
 * 原始大小
 * 将图片缩放到 100%（原始大小）
 */
function actualSize() {
  // 如果没有打开图片，直接返回
  if (!imageData) return

  // 设置缩放级别为 1（100%）
  currentZoom = 1

  // 更新图片显示
  updateImageDisplay()
}

/**
 * 旋转图片
 * @param {number} angle - 旋转角度（正数顺时针，负数逆时针）
 */
function rotate(angle) {
  // 如果没有打开图片，直接返回
  if (!imageData) return

  // 更新旋转角度
  currentRotation += angle

  // 更新图片显示
  updateImageDisplay()
}

// ============================================================
// 4. 事件监听 - 窗口控制按钮
// ============================================================

/**
 * 最小化按钮点击事件
 * 调用主进程的窗口最小化功能
 */
minimizeBtn.addEventListener('click', () => {
  window.electronAPI.minimizeWindow()
})

/**
 * 最大化按钮点击事件
 * 切换窗口最大化/还原状态
 */
maximizeBtn.addEventListener('click', async () => {
  // 发送最大化/还原请求
  window.electronAPI.maximizeWindow()

  // （可选）根据窗口状态更新按钮图标
})

/**
 * 关闭按钮点击事件
 * 调用主进程关闭窗口
 */
closeBtn.addEventListener('click', () => {
  window.electronAPI.closeWindow()
})

// ============================================================
// 5. 事件监听 - 工具栏按钮
// ============================================================

// 打开图片按钮
openBtn.addEventListener('click', openImage)

// 缩小按钮
zoomOutBtn.addEventListener('click', () => zoom('out'))

// 放大按钮
zoomInBtn.addEventListener('click', () => zoom('in'))

// 适应窗口按钮
fitBtn.addEventListener('click', fitToWindow)

// 原始大小按钮
actualSizeBtn.addEventListener('click', actualSize)

// 左转按钮（逆时针旋转 90 度）
rotateLeftBtn.addEventListener('click', () => rotate(-90))

// 右转按钮（顺时针旋转 90 度）
rotateRightBtn.addEventListener('click', () => rotate(90))

// ============================================================
// 6. 事件监听 - 键盘快捷键
// ============================================================

/**
 * 键盘事件处理
 * 支持以下快捷键：
 * - Ctrl+O: 打开图片
 * - Ctrl+=/Ctrl++: 放大图片
 * - Ctrl+-: 缩小图片
 * - Ctrl+0: 原始大小
 */
document.addEventListener('keydown', async (e) => {
  // 检查是否按下了 Ctrl 键
  if (e.ctrlKey) {
    // 根据按键执行相应操作
    switch (e.key) {
      case 'o':
        // 打开图片
        e.preventDefault()  // 阻止默认行为（浏览器打开文件）
        openImage()
        break

      case '=':
      case '+':
        // 放大图片（= 和 + 键相同）
        e.preventDefault()
        zoom('in')
        break

      case '-':
        // 缩小图片
        e.preventDefault()
        zoom('out')
        break

      case '0':
        // 原始大小
        e.preventDefault()
        actualSize()
        break
    }
  }
})

// ============================================================
// 7. 事件监听 - 鼠标滚轮缩放
// ============================================================

/**
 * 鼠标滚轮缩放
 * 向上滚动放大，向下滚动缩小
 */
imageContainer.addEventListener('wheel', (e) => {
  // 如果没有打开图片，直接返回
  if (!imageData) return

  // 阻止默认的滚动行为
  e.preventDefault()

  // 根据滚轮方向判断放大或缩小
  if (e.deltaY < 0) {
    // 向上滚动（负值）：放大
    zoom('in')
  } else {
    // 向下滚动（正值）：缩小
    zoom('out')
  }
})

// ============================================================
// 8. 事件监听 - 拖放文件支持
// ============================================================
//
// 注意：这里只是简单的拖放处理
// 完整的拖放功能需要在主进程中实现
//

/**
 * dragover 事件
 * 必须阻止默认行为才能触发 drop 事件
 */
imageContainer.addEventListener('dragover', (e) => {
  e.preventDefault()
  e.stopPropagation()
})

/**
 * drop 事件
 * 处理拖放到窗口的文件
 */
imageContainer.addEventListener('drop', async (e) => {
  e.preventDefault()
  e.stopPropagation()

  // 获取拖放的文件列表
  const files = e.dataTransfer.files

  // 如果有文件
  if (files.length > 0) {
    // 这里简化处理，实际应用需要处理拖放的文件
    // 可以通过 IPC 将文件路径发送给主进程处理
    console.log('拖放了文件:', files[0].name)
  }
})

// ============================================================
// 9. 事件监听 - 图片加载完成
// ============================================================

/**
 * 图片加载完成事件
 * 计算并显示文件大小
 */
imagePreview.addEventListener('load', () => {
  // 确保有图片数据
  if (imageData && imageData.dataUrl) {
    // 计算 Base64 数据的长度（近似文件大小）
    // Base64 编码会将 3 字节转换为 4 个字符，所以 * 0.75
    const base64Length = imageData.dataUrl.length
    const sizeInBytes = Math.round(base64Length * 0.75)

    // 更新状态栏中的文件大小
    imageSize.textContent = formatFileSize(sizeInBytes)
  }
})

// ============================================================
// 渲染进程代码说明：
// ============================================================
//
// 1. 渲染进程是运行在浏览器环境中的 JavaScript
//    - 无法直接使用 Node.js API（如 require）
//    - 需要通过预加载脚本暴露的 API 与主进程通信
//
// 2. window.electronAPI 是预加载脚本暴露的对象
//    - 提供以下方法：
//      * openImage(): 打开图片文件
//      * zoomImage(): 缩放图片
//      * minimizeWindow()/maximizeWindow()/closeWindow(): 窗口控制
//    - 返回 Promise，可以使用 async/await 处理
//
// 3. IPC 通信流程：
//    - 渲染进程调用 window.electronAPI.openImage()
//    - 预加载脚本使用 ipcRenderer.invoke('image:open')
//    - 主进程通过 ipcMain.handle('image:open', handler) 处理
//    - 主进程返回结果
//    - 渲染进程接收到结果
//
// 4. 图片显示原理：
//    - 主进程将图片文件读取为 Base64 编码的 data URL
//    - 渲染进程将 data URL 设置为 img 元素的 src 属性
//    - 使用 CSS transform 实现缩放和旋转
//
// 5. 窗口控制原理：
//    - 使用无边框窗口（frame: false）
//    - 自定义标题栏和窗口控制按钮
//    - 点击按钮时通过 IPC 通知主进程执行相应操作
//    - 使用 -webkit-app-region: drag 实现窗口拖动
//
// 6. 用户交互：
//    - 按钮点击事件
//    - 键盘快捷键（Ctrl+O/Ctrl++/Ctrl+-）
//    - 鼠标滚轮缩放
//    - 拖放文件（部分实现）