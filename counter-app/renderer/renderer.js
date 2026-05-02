// ============================================================
// Electron 计数器应用 - 渲染进程 JavaScript 文件
// 文件路径: counter-app/renderer/renderer.js
// ============================================================
//
// 渲染进程运行在 Chromium 浏览器环境中
// 每个 Electron 窗口对应一个渲染进程
// 渲染进程默认无法直接访问 Node.js API，需要通过预加载脚本暴露的 API 与主进程通信
// ============================================================

// ============================================================
// 1. 状态管理
// ============================================================

// 计数器状态
// 这是一个简单的整数变量，存储当前计数值
let count = 0

// ============================================================
// 2. 获取 DOM 元素
// ============================================================
//
// 在页面加载完成后，获取需要操作的 HTML 元素
// 这些元素通过 id 属性与 HTML 中的元素对应
//

// 获取计数器显示元素（显示数字的区域）
const counterDisplay = document.getElementById('counter')

// 获取减少按钮
const decreaseBtn = document.getElementById('decreaseBtn')

// 获取重置按钮
const resetBtn = document.getElementById('resetBtn')

// 获取增加按钮
const increaseBtn = document.getElementById('increaseBtn')

// 获取状态消息元素（显示操作结果的文字）
const statusText = document.getElementById('status')

// ============================================================
// 3. 功能函数
// ============================================================

/**
 * 更新计数器显示
 * 根据当前计数值更新 DOM 元素的内容和颜色
 */
function updateDisplay() {
  // 更新显示的数字
  // textContent 属性用于获取或设置元素的文本内容
  counterDisplay.textContent = count

  // 根据数值的大小改变颜色
  if (count > 0) {
    // 正数：绿色
    counterDisplay.style.color = '#4CAF50'
  } else if (count < 0) {
    // 负数：红色
    counterDisplay.style.color = '#f44336'
  } else {
    // 零：紫色（默认色）
    counterDisplay.style.color = '#667eea'
  }
}

/**
 * 显示状态消息
 * 在页面底部显示一行提示文字，1 秒后自动消失
 * @param {string} message - 要显示的消息内容
 */
function showStatus(message) {
  // 设置状态消息的文本
  statusText.textContent = message

  // 设置定时器，1000 毫秒（1秒）后清空消息
  setTimeout(() => {
    statusText.textContent = ''
  }, 1000)
}

// ============================================================
// 4. 事件处理 - 按钮点击
// ============================================================

/**
 * 增加按钮点击事件处理
 * 点击后计数器 +1，并通过 IPC 通知主进程
 */
increaseBtn.addEventListener('click', async () => {
  // 计数器 +1
  count++

  // 更新显示
  updateDisplay()

  // ============================================================
  // IPC 通信：通知主进程
  // ============================================================
  // 使用预加载脚本暴露的 window.electronAPI.sendOperation() 方法
  // 向主进程发送 'increase' 操作请求
  //
  // async/await 语法：
  // - ipcRenderer.invoke() 返回一个 Promise
  // - 使用 await 可以等待 Promise 完成后再继续执行
  // - 使用 try/catch 可以捕获错误
  //

  try {
    // 发送操作请求到主进程
    const result = await window.electronAPI.sendOperation('increase')

    // 检查返回结果
    // result 是主进程返回的对象，包含 success 属性
    if (result.success) {
      // 显示状态消息
      showStatus('已记录：+1')
    }
  } catch (error) {
    // 错误处理
    console.error('IPC communication error:', error)
    showStatus('通信错误')
  }
})

/**
 * 减少按钮点击事件处理
 * 点击后计数器 -1，并通过 IPC 通知主进程
 */
decreaseBtn.addEventListener('click', async () => {
  // 计数器 -1
  count--

  // 更新显示
  updateDisplay()

  try {
    // 发送操作请求到主进程
    const result = await window.electronAPI.sendOperation('decrease')

    if (result.success) {
      showStatus('已记录：-1')
    }
  } catch (error) {
    console.error('IPC communication error:', error)
    showStatus('通信错误')
  }
})

/**
 * 重置按钮点击事件处理
 * 点击后计数器归零，并通过 IPC 通知主进程
 */
resetBtn.addEventListener('click', async () => {
  // 计数器归零
  count = 0

  // 更新显示
  updateDisplay()

  try {
    // 发送操作请求到主进程
    const result = await window.electronAPI.sendOperation('reset')

    if (result.success) {
      showStatus('已重置')
    }
  } catch (error) {
    console.error('IPC communication error:', error)
    showStatus('通信错误')
  }
})

// ============================================================
// 5. 初始化
// ============================================================

/**
 * 初始化显示
 * 页面加载后立即更新计数器显示
 * 确保页面显示正确的初始状态
 */
updateDisplay()

// ============================================================
// 渲染进程代码说明：
// ============================================================
//
// 1. 渲染进程是运行在浏览器环境中的 JavaScript
//    - 无法直接使用 Node.js API（如 require）
//    - 需要通过预加载脚本暴露的 API 与主进程通信
//
// 2. window.electronAPI 是预加载脚本暴露的对象
//    - sendOperation() 方法用于向主进程发送操作请求
//    - 返回一个 Promise，可以使用 async/await 处理
//
// 3. IPC 通信流程：
//    - 渲染进程调用 window.electronAPI.sendOperation('increase')
//    - 预加载脚本使用 ipcRenderer.invoke('counter:operation', 'increase')
//    - 主进程通过 ipcMain.handle('counter:operation', handler) 处理
//    - 主进程返回结果
//    - 渲染进程接收到结果
//
// 4. async/await 的使用：
//    - async function: 声明这是一个异步函数
//    - await: 等待 Promise 完成，并获取结果
//    - 必须配对使用
//
// 5. 错误处理：
//    - 使用 try/catch 捕获可能的错误
//    - 确保即使通信失败也不会导致页面崩溃