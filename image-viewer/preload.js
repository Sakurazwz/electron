/**
 * ============================================================
 * 预加载脚本 (preload.js) - Electron 图片查看器
 * ============================================================
 * 预加载脚本是主进程和渲染进程之间的桥梁
 * 它在渲染进程上下文中执行，但可以访问 Node.js 和 Electron API
 * 通过 contextBridge 安全地暴露特定 API 给渲染进程使用
 * ============================================================
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * ============================================================
 * 通过 contextBridge 暴露 API 给渲染进程
 * ============================================================
 * contextBridge.exposeInMainWorld 将对象注入到浏览器的 window 对象上
 * 这样渲染进程就可以通过 window.electronAPI 访问这些方法
 */
contextBridge.exposeInMainWorld('electronAPI', {

  // ============================================================
  // 图片文件操作
  // ============================================================

  /**
   * 打开图片文件
   * 支持选择多个文件
   * @returns {Promise<Object|null>} 返回第一张图片的详细信息（包括 EXIF、文件统计等）或 null
   */
  openImage: () => ipcRenderer.invoke('image:open'),

  /**
   * 通过拖放打开图片文件
   * @param {string[]} filePaths - 图片文件路径数组
   * @returns {Promise<Object|null>} 返回第一张图片的详细信息
   */
  openDroppedImages: (filePaths) => ipcRenderer.invoke('image:openDropped', filePaths),

  /**
   * 切换到下一张图片
   * @returns {Promise<Object|null>} 返回下一张图片的详细信息
   */
  nextImage: () => ipcRenderer.invoke('image:next'),

  /**
   * 切换到上一张图片
   * @returns {Promise<Object|null>} 返回上一张图片的详细信息
   */
  prevImage: () => ipcRenderer.invoke('image:prev'),

  /**
   * 获取当前图片列表信息
   * @returns {Promise<Object>} 返回 { total, current, currentPath }
   */
  getImageListInfo: () => ipcRenderer.invoke('image:getListInfo'),

  // ============================================================
  // 图片缩放和变换
  // ============================================================

  /**
   * 缩放图片
   * @param {string|number} direction - 缩放方向：'in'(放大)、'out'(缩小)或具体数值
   * @returns {Promise<number>} 返回新的缩放比例
   */
  zoomImage: (direction) => ipcRenderer.invoke('image:zoom', direction),

  /**
   * 获取当前缩放比例
   * @returns {Promise<number>} 返回当前缩放比例（1 = 100%）
   */
  getZoom: () => ipcRenderer.invoke('image:getZoom'),

  /**
   * 旋转图片
   * @param {number} angle - 旋转角度（90 为顺时针，-90 为逆时针）
   * @returns {Promise<Object>} 返回 { angle: 新的角度 }
   */
  rotateImage: (angle) => ipcRenderer.invoke('image:rotate', angle),

  /**
   * 获取当前旋转角度
   * @returns {Promise<number>} 返回当前旋转角度
   */
  getRotation: () => ipcRenderer.invoke('image:getRotation'),

  // ============================================================
  // 幻灯片模式
  // ============================================================

  /**
   * 开始幻灯片播放
   * @param {number} delay - 每张图片显示时间（毫秒），默认 3000ms
   * @returns {Promise<Object>} 返回 { started, delay }
   */
  startSlideshow: (delay) => ipcRenderer.invoke('slideshow:start', delay),

  /**
   * 停止幻灯片播放
   * @returns {Promise<Object>} 返回 { stopped }
   */
  stopSlideshow: () => ipcRenderer.invoke('slideshow:stop'),

  /**
   * 获取幻灯片状态
   * @returns {Promise<Object>} 返回 { isRunning, delay, currentIndex, total }
   */
  getSlideshowStatus: () => ipcRenderer.invoke('slideshow:status'),

  /**
   * 监听幻灯片图片切换事件
   * @param {function} callback - 回调函数，接收新的图片数据
   */
  onSlideshowChange: (callback) => {
    // 移除之前的监听器避免重复
    ipcRenderer.removeAllListeners('slideshow:imageChanged')
    // 添加新的监听器
    ipcRenderer.on('slideshow:imageChanged', (event, imageData) => callback(imageData))
  },

  // ============================================================
  // 图片编辑
  // ============================================================

  /**
   * 裁剪图片
   * @param {Object} cropData - 裁剪区域数据
   *   - x, y: 裁剪区域左上角坐标
   *   - width, height: 裁剪区域宽高
   *   - originalWidth, originalHeight: 显示尺寸（用于缩放计算）
   * @returns {Promise<Object>} 返回 { dataUrl, width, height }
   */
  cropImage: (cropData) => ipcRenderer.invoke('image:crop', cropData),

  /**
   * 保存图片到文件系统
   * @param {Object} data - 图片数据
   *   - dataUrl: Base64 编码的图片数据
   * @returns {Promise<Object>} 返回 { saved, path?, error? }
   */
  saveImage: (data) => ipcRenderer.invoke('image:save', data),

  // ============================================================
  // 窗口控制
  // ============================================================

  /**
   * 最小化窗口（单向通信，不需要等待返回）
   */
  minimizeWindow: () => ipcRenderer.send('window:minimize'),

  /**
   * 最大化/取消最大化窗口（单向通信）
   */
  maximizeWindow: () => ipcRenderer.send('window:maximize'),

  /**
   * 关闭窗口（单向通信）
   */
  closeWindow: () => ipcRenderer.send('window:close'),

  /**
   * 查询窗口是否处于最大化状态
   * @returns {Promise<boolean>} 返回是否已最大化
   */
  isMaximized: () => ipcRenderer.invoke('window:isMaximized')
})
