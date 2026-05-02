/**
 * ============================================================
 * 渲染进程 JavaScript (renderer.js) - Electron 图片查看器（增强版）
 * ============================================================
 * 渲染进程运行在浏览器环境中，负责：
 * 1. 处理用户交互（按钮点击、键盘快捷键、鼠标滚轮、拖放等）
 * 2. 管理 UI 状态和更新（显示/隐藏元素、更新文本等）
 * 3. 通过 electronAPI 调用主进程提供的功能
 * 4. 图片编辑功能（裁剪、滤镜、幻灯片播放）
 */

// ============================================================
// DOM 元素引用
// ============================================================

// ----- 标题栏 -----
const appTitle = document.getElementById('appTitle')
const minimizeBtn = document.getElementById('minimizeBtn')
const maximizeBtn = document.getElementById('maximizeBtn')
const closeBtn = document.getElementById('closeBtn')

// ----- 工具栏 -----
const openBtn = document.getElementById('openBtn')
const navControls = document.getElementById('navControls')
const navCounter = document.getElementById('navCounter')
const prevBtn = document.getElementById('prevBtn')
const nextBtn = document.getElementById('nextBtn')
const imageControls = document.getElementById('imageControls')
const advancedControls = document.getElementById('advancedControls')
const zoomInBtn = document.getElementById('zoomInBtn')
const zoomOutBtn = document.getElementById('zoomOutBtn')
const fitBtn = document.getElementById('fitBtn')
const actualSizeBtn = document.getElementById('actualSizeBtn')
const rotateLeftBtn = document.getElementById('rotateLeftBtn')
const rotateRightBtn = document.getElementById('rotateRightBtn')
const slideshowBtn = document.getElementById('slideshowBtn')
const infoBtn = document.getElementById('infoBtn')
const cropBtn = document.getElementById('cropBtn')
const filterBtn = document.getElementById('filterBtn')
const zoomLevelDisplay = document.getElementById('zoomLevel')

// ----- 幻灯片控制 -----
const slideshowBar = document.getElementById('slideshowBar')
const slideshowDelay = document.getElementById('slideshowDelay')
const delayValue = document.getElementById('delayValue')
const stopSlideshowBtn = document.getElementById('stopSlideshowBtn')

// ----- 图片显示 -----
const imageArea = document.getElementById('imageArea')
const placeholder = document.getElementById('placeholder')
const imageContainer = document.getElementById('imageContainer')
const imageWrapper = document.getElementById('imageWrapper')
const imagePreview = document.getElementById('imagePreview')
const navArrowLeft = document.getElementById('navArrowLeft')
const navArrowRight = document.getElementById('navArrowRight')

// ----- 信息面板 -----
const infoPanel = document.getElementById('infoPanel')
const closeInfoBtn = document.getElementById('closeInfoBtn')
const infoName = document.getElementById('infoName')
const infoFormat = document.getElementById('infoFormat')
const infoDimensions = document.getElementById('infoDimensions')
const infoFileSize = document.getElementById('infoFileSize')
const infoCreated = document.getElementById('infoCreated')
const infoModified = document.getElementById('infoModified')
const exifSection = document.getElementById('exifSection')
const infoCamera = document.getElementById('infoCamera')
const infoLens = document.getElementById('infoLens')
const infoAperture = document.getElementById('infoAperture')
const infoShutter = document.getElementById('infoShutter')
const infoISO = document.getElementById('infoISO')
const infoFocal = document.getElementById('infoFocal')
const infoDate = document.getElementById('infoDate')
const infoGPS = document.getElementById('infoGPS')

// ----- 滤镜面板 -----
const filterPanel = document.getElementById('filterPanel')
const closeFilterBtn = document.getElementById('closeFilterBtn')
const filterOptions = document.querySelectorAll('.filter-option')

// ----- 裁剪相关 -----
const cropOverlay = document.getElementById('cropOverlay')
const cropControls = document.getElementById('cropControls')
const confirmCropBtn = document.getElementById('confirmCropBtn')
const cancelCropBtn = document.getElementById('cancelCropBtn')

// ----- 状态栏 -----
const imageName = document.getElementById('imageName')
const imageSize = document.getElementById('imageSize')
const imageDimensions = document.getElementById('imageDimensions')
const imageZoom = document.getElementById('imageZoom')

// ============================================================
// 应用状态变量
// ============================================================

let imageData = null              // 当前显示的图片数据
let currentZoom = 1               // 当前缩放比例
let currentRotation = 0           // 当前旋转角度
let originalWidth = 0             // 图片原始宽度
let originalHeight = 0            // 图片原始高度
let totalImages = 0               // 图片总数
let currentIndex = -1             // 当前图片索引
let isSlideshowRunning = false      // 幻灯片是否运行中
let isCropMode = false              // 是否在裁剪模式
let currentFilter = 'none'          // 当前滤镜

// ============================================================
// 工具函数
// ============================================================

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

/**
 * 计算适应窗口的缩放比例
 */
function calculateFitZoom() {
  if (!originalWidth || !originalHeight) return 1

  const containerRect = imageContainer.getBoundingClientRect()
  const padding = 40

  const availableWidth = containerRect.width - padding
  const availableHeight = containerRect.height - padding

  const scaleX = availableWidth / originalWidth
  const scaleY = availableHeight / originalHeight

  return Math.min(scaleX, scaleY, 1)
}

/**
 * 更新图片显示（缩放 + 旋转 + 滤镜）
 */
function updateImageDisplay() {
  if (!imageData) return

  const filterStr = currentFilter === 'none' ? '' : ` ${currentFilter}`
  imagePreview.style.transform = `scale(${currentZoom}) rotate(${currentRotation}deg)`
  imagePreview.style.filter = filterStr

  zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`
  imageZoom.textContent = `${Math.round(currentZoom * 100)}%`
}

/**
 * 更新导航按钮状态
 */
function updateNavButtons() {
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < totalImages - 1

  prevBtn.disabled = !hasPrev
  nextBtn.disabled = !hasNext
  navArrowLeft.style.display = hasPrev ? 'flex' : 'none'
  navArrowRight.style.display = hasNext ? 'flex' : 'none'

  if (totalImages > 0) {
    navCounter.textContent = `${currentIndex + 1} / ${totalImages}`
    navControls.style.display = 'flex'
  }
}

/**
 * 更新图片信息面板
 */
function updateInfoPanel() {
  if (!imageData) return

  infoName.textContent = imageData.name || '-'
  infoFormat.textContent = imageData.name ?
    imageData.name.split('.').pop().toUpperCase() : '-'
  infoDimensions.textContent = `${originalWidth} x ${originalHeight}`
  infoFileSize.textContent = formatFileSize(imageData.fileSize || 0)
  infoCreated.textContent = formatDate(imageData.created)
  infoModified.textContent = formatDate(imageData.modified)

  // 更新 EXIF 信息
  if (imageData.exif && Object.keys(imageData.exif).length > 0) {
    exifSection.style.display = 'block'
    const e = imageData.exif

    infoCamera.textContent = e.Make && e.Model ?
      `${e.Make} ${e.Model}` : (e.Model || '-')
    infoLens.textContent = e.LensModel || e.Lens || '-'
    infoAperture.textContent = e.FNumber ? `f/${e.FNumber}` : '-'
    infoShutter.textContent = e.ExposureTime ?
      e.ExposureTime < 1 ? `1/${Math.round(1/e.ExposureTime)}s` : `${e.ExposureTime}s` : '-'
    infoISO.textContent = e.ISO || e.ISOSpeedRatings || '-'
    infoFocal.textContent = e.FocalLength ?
      `${Math.round(e.FocalLength)}mm` : '-'
    infoDate.textContent = e.DateTimeOriginal ||
      (e.CreateDate ? formatDate(e.CreateDate) : '-')

    if (e.latitude && e.longitude) {
      infoGPS.textContent = `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}`
    } else {
      infoGPS.textContent = '-'
    }
  } else {
    exifSection.style.display = 'none'
  }
}

/**
 * 显示图片
 */
async function displayImage(data) {
  if (!data) return

  imageData = data
  currentIndex = data.index || 0
  totalImages = data.total || 1
  originalWidth = data.width
  originalHeight = data.height
  currentZoom = 1
  currentRotation = 0

  imagePreview.src = data.dataUrl

  // 更新状态栏
  imageName.textContent = data.name
  imageDimensions.textContent = `${data.width} x ${data.height}`
  imageSize.textContent = formatFileSize(data.fileSize || 0)

  // 更新窗口标题
  appTitle.textContent = `图片查看器 - ${data.name}`

  // 显示控件
  placeholder.style.display = 'none'
  imageContainer.style.display = 'flex'
  imageControls.style.display = 'flex'
  advancedControls.style.display = 'flex'

  // 更新导航和信息面板
  updateNavButtons()
  updateInfoPanel()

  // 自动适应窗口
  setTimeout(() => {
    currentZoom = calculateFitZoom()
    updateImageDisplay()
  }, 50)
}

// ============================================================
// 图片操作函数
// ============================================================

/**
 * 打开图片
 */
async function openImage() {
  const result = await window.electronAPI.openImage()
  if (result) {
    await displayImage(result)
  }
}

/**
 * 下一张图片
 */
async function nextImage() {
  if (isSlideshowRunning) return
  const result = await window.electronAPI.nextImage()
  if (result) {
    await displayImage(result)
  }
}

/**
 * 上一张图片
 */
async function prevImage() {
  if (isSlideshowRunning) return
  const result = await window.electronAPI.prevImage()
  if (result) {
    await displayImage(result)
  }
}

/**
 * 缩放图片
 */
async function zoom(direction) {
  if (!imageData || isSlideshowRunning) return

  currentZoom = await window.electronAPI.zoomImage(direction)
  updateImageDisplay()
}

/**
 * 适应窗口
 */
async function fitToWindow() {
  if (!imageData || isSlideshowRunning) return

  currentZoom = calculateFitZoom()
  currentZoom = await window.electronAPI.zoomImage(currentZoom)
  updateImageDisplay()
}

/**
 * 实际大小
 */
async function actualSize() {
  if (!imageData || isSlideshowRunning) return

  currentZoom = await window.electronAPI.zoomImage(1)
  updateImageDisplay()
}

/**
 * 旋转图片
 */
async function rotate(angle) {
  if (!imageData || isSlideshowRunning) return

  const result = await window.electronAPI.rotateImage(angle)
  currentRotation = result.angle
  updateImageDisplay()
}

// ============================================================
// 幻灯片功能
// ============================================================

/**
 * 开始幻灯片
 */
async function startSlideshow() {
  if (totalImages <= 1 || isSlideshowRunning) return

  const delay = parseInt(slideshowDelay.value, 10)
  isSlideshowRunning = true

  slideshowBar.style.display = 'flex'
  slideshowBtn.classList.add('active')

  // 等待幻灯片切换事件
  window.electronAPI.onSlideshowChange((newImageData) => {
    if (newImageData) {
      displayImage(newImageData)
    }
  })

  await window.electronAPI.startSlideshow(delay)
}

/**
 * 停止幻灯片
 */
async function stopSlideshow() {
  isSlideshowRunning = false

  slideshowBar.style.display = 'none'
  slideshowBtn.classList.remove('active')

  await window.electronAPI.stopSlideshow()
}

// ============================================================
// 滤镜功能
// ============================================================

/**
 * 显示滤镜面板
 */
function showFilterPanel() {
  if (!imageData) return
  filterPanel.style.display = 'block'
}

/**
 * 隐藏滤镜面板
 */
function hideFilterPanel() {
  filterPanel.style.display = 'none'
}

/**
 * 应用滤镜
 */
function applyFilter(filterValue) {
  if (!imageData) return

  currentFilter = filterValue
  updateImageDisplay()

  // 更新选中状态
  filterOptions.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.filter === filterValue)
  })
}

// ============================================================
// 裁剪功能（简化版）
// ============================================================

/**
 * 进入裁剪模式
 */
function enterCropMode() {
  if (!imageData || isSlideshowRunning) return

  isCropMode = true
  cropControls.style.display = 'flex'
  cropBtn.classList.add('active')

  // 进入裁剪模式时还原缩放
  actualSize()
}

/**
 * 退出裁剪模式
 */
function exitCropMode() {
  isCropMode = false
  cropControls.style.display = 'none'
  cropBtn.classList.remove('active')
  cropOverlay.style.display = 'none'
}

/**
 * 确认裁剪
 */
async function confirmCrop() {
  // 简化版：使用 HTML5 Canvas 在渲染进程完成裁剪
  if (!imageData) return

  // 创建 Canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // 计算裁剪区域（简化为正方形，中间部分）
  const cropRatio = 0.8
  const cropW = originalWidth * cropRatio
  const cropH = originalHeight * cropRatio
  const cropX = (originalWidth - cropW) / 2
  const cropY = (originalHeight - cropH) / 2

  canvas.width = cropW
  canvas.height = cropH

  // 绘制裁剪后的图片
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img,
      cropX, cropY, cropW, cropH,  // 源矩形
      0, 0, cropW, cropH            // 目标矩形
    )

    // 更新图片
    const newDataUrl = canvas.toDataURL('image/png')
    imagePreview.src = newDataUrl
    imageData.dataUrl = newDataUrl

    // 更新尺寸
    originalWidth = cropW
    originalHeight = cropH
    imageData.width = cropW
    imageData.height = cropH

    updateImageDisplay()
    updateInfoPanel()

    exitCropMode()
  }
  img.src = imageData.dataUrl
}

// ============================================================
// 信息面板功能
// ============================================================

function showInfoPanel() {
  infoPanel.style.display = 'block'
  infoBtn.classList.add('active')
}

function hideInfoPanel() {
  infoPanel.style.display = 'none'
  infoBtn.classList.remove('active')
}

function toggleInfoPanel() {
  if (infoPanel.style.display === 'none' || !infoPanel.style.display) {
    showInfoPanel()
  } else {
    hideInfoPanel()
  }
}

// ============================================================
// 拖放功能
// ============================================================

/**
 * 处理拖放进入
 */
imageArea.addEventListener('dragover', (e) => {
  e.preventDefault()
  e.stopPropagation()
  imageArea.classList.add('drag-over')
})

/**
 * 处理拖放离开
 */
imageArea.addEventListener('dragleave', (e) => {
  e.preventDefault()
  e.stopPropagation()
  imageArea.classList.remove('drag-over')
})

/**
 * 处理文件放下
 */
imageArea.addEventListener('drop', async (e) => {
  e.preventDefault()
  e.stopPropagation()
  imageArea.classList.remove('drag-over')

  const files = Array.from(e.dataTransfer.files)
  if (files.length === 0) return

  // 获取文件路径
  const filePaths = files.map(f => f.path).filter(p => p)

  if (filePaths.length > 0) {
    const result = await window.electronAPI.openDroppedImages(filePaths)
    if (result) {
      await displayImage(result)
    }
  }
})

// ============================================================
// 事件监听绑定
// ============================================================

// 标题栏
minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow())
maximizeBtn.addEventListener('click', () => window.electronAPI.maximizeWindow())
closeBtn.addEventListener('click', () => window.electronAPI.closeWindow())

// 工具栏
openBtn.addEventListener('click', openImage)
prevBtn.addEventListener('click', prevImage)
nextBtn.addEventListener('click', nextImage)
navArrowLeft.addEventListener('click', prevImage)
navArrowRight.addEventListener('click', nextImage)

zoomInBtn.addEventListener('click', () => zoom('in'))
zoomOutBtn.addEventListener('click', () => zoom('out'))
fitBtn.addEventListener('click', fitToWindow)
actualSizeBtn.addEventListener('click', actualSize)

rotateLeftBtn.addEventListener('click', () => rotate(-90))
rotateRightBtn.addEventListener('click', () => rotate(90))

slideshowBtn.addEventListener('click', () => {
  if (isSlideshowRunning) {
    stopSlideshow()
  } else {
    startSlideshow()
  }
})
stopSlideshowBtn.addEventListener('click', stopSlideshow)

// 幻灯片延迟滑块
slideshowDelay.addEventListener('input', () => {
  delayValue.textContent = (slideshowDelay.value / 1000) + 's'
})

// 信息面板
infoBtn.addEventListener('click', toggleInfoPanel)
closeInfoBtn.addEventListener('click', hideInfoPanel)

// 裁剪
cropBtn.addEventListener('click', () => {
  if (isCropMode) {
    exitCropMode()
  } else {
    enterCropMode()
  }
})
confirmCropBtn.addEventListener('click', confirmCrop)
cancelCropBtn.addEventListener('click', exitCropMode)

// 滤镜
filterBtn.addEventListener('click', () => {
  if (filterPanel.style.display === 'none' || !filterPanel.style.display) {
    showFilterPanel()
  } else {
    hideFilterPanel()
  }
})
closeFilterBtn.addEventListener('click', hideFilterPanel)

// 滤镜选项
filterOptions.forEach(option => {
  option.addEventListener('click', () => {
    applyFilter(option.dataset.filter)
  })
})

// ============================================================
// 鼠标滚轮缩放
// ============================================================
imageContainer.addEventListener('wheel', (e) => {
  if (!imageData || isSlideshowRunning) return

  e.preventDefault()

  if (e.deltaY < 0) {
    zoom('in')
  } else {
    zoom('out')
  }
})

// ============================================================
// 键盘快捷键
// ============================================================
document.addEventListener('keydown', async (e) => {
  // 快捷键不影响幻灯片的是：空格（播放/暂停）、ESC（退出）
  if (e.key === 'Escape') {
    if (isSlideshowRunning) stopSlideshow()
    if (isCropMode) exitCropMode()
    if (filterPanel.style.display !== 'none') hideFilterPanel()
    if (infoPanel.style.display !== 'none') hideInfoPanel()
    return
  }

  // 下面的快捷键在幻灯片时不可用
  if (isSlideshowRunning) {
    if (e.key === ' ') {
      e.preventDefault()
      stopSlideshow()
    }
    return
  }

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      prevImage()
      break
    case 'ArrowRight':
    case ' ':
      e.preventDefault()
      nextImage()
      break
    case 'o':
      if (e.ctrlKey) {
        e.preventDefault()
        openImage()
      }
      break
    case '=':
    case '+':
      if (e.ctrlKey) {
        e.preventDefault()
        zoom('in')
      }
      break
    case '-':
      if (e.ctrlKey) {
        e.preventDefault()
        zoom('out')
      }
      break
    case '0':
      if (e.ctrlKey) {
        e.preventDefault()
        actualSize()
      }
      break
    case 'i':
      if (e.ctrlKey) {
        e.preventDefault()
        toggleInfoPanel()
      }
      break
    case 'f':
      if (e.ctrlKey) {
        e.preventDefault()
        fitToWindow()
      }
      break
    case 'F5':
      e.preventDefault()
      startSlideshow()
      break
  }
})

// ============================================================
// 初始化
// ============================================================
console.log('图片查看器已加载完成')
console.log('快捷键：')
console.log('  Ctrl+O: 打开图片')
console.log('  ← →: 切换图片')
console.log('  Ctrl++ / Ctrl+-: 缩放')
console.log('  Ctrl+0: 原始大小')
console.log('  Ctrl+F: 适应窗口')
console.log('  Ctrl+I: 显示/隐藏信息')
console.log('  F5: 开始幻灯片')
console.log('  ESC: 关闭面板/退出幻灯片')
