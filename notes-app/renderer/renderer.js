// 渲柘进程 JavaScript
// 处理用户界面交互和与主进程的通信

// ========== DOM元素获取 ==========
const editor = document.getElementById('editor')          // 文本编辑器区域
const newBtn = document.getElementById('newBtn')          // 新建按钮
const openBtn = document.getElementById('openBtn')          // 打开按钮
const saveBtn = document.getElementById('saveBtn')        // 保存按钮
const statusText = document.getElementById('statusText')  // 状态显示文字
const charCount = document.getElementById('charCount')      // 字符数统计
const lineCount = document.getElementById('lineCount')      // 行数统计

// ========== 状态栏更新 ==========

/**
 * 更新状态栏信息
 * 计算并显示当前字符数和行数
 */
function updateStatusBar() {
  const text = editor.value
  charCount.textContent = `字符数: ${text.length}`
  lineCount.textContent = `行数: ${text.split('\n').length}`
}

/**
 * 显示临时状态消息
 * @param {string} message - 要显示的消息文字
 * @param {number} duration - 显示时间(毫秒)，默认2秒后恢复为"就绪"
 */
function showStatus(message, duration = 2000) {
  statusText.textContent = message
  if (duration > 0) {
    setTimeout(() => {
      statusText.textContent = '就绪'
    }, duration)
  }
}

// ========== 编辑器事件绑定 ==========

/**
 * 编辑器输入事件
 * 当用户输入内容时：
 * 1. 更新状态栏的字符数和行数
 * 2. 通过IPC通知主进程文档已修改
 */
editor.addEventListener('input', () => {
  updateStatusBar()
  // 通知主进程文档已修改（主进程会在标题前添加*号）
  window.electronAPI.markModified()
})

// ========== 工具栏按钮事件 ==========

/**
 * 新建按钮点击事件
 * 注意：实际的新建操作由主进程菜单处理
 * 这里仅作为工具栏按钮的交互演示
 */
newBtn.addEventListener('click', () => {
  // 校验当前内容是否为空
  if (editor.value && !confirm('确定要新建文件吗？当前内容将丢失。')) {
    return
  }
  editor.value = ''
  updateStatusBar()
  showStatus('已新建文件')
})

/**
 * 打开按钮点击事件
 * 提示用户使用菜单或快捷键打开文件
 */
openBtn.addEventListener('click', () => {
  showStatus('请使用菜单 文件 > 打开...')
})

/**
 * 保存按钮点击事件
 * 提示用户使用菜单或快捷键保存文件
 */
saveBtn.addEventListener('click', () => {
  showStatus('请使用菜单 文件 > 保存...')
})

// ========== 主进程消息监听 ==========

/**
 * 监听主进程发来的文件打开事件
 * 当用户通过菜单打开文件时，主进程会发送此消息
 * @param {Object} data - 包含content（文件内容）和filePath（文件路径）
 */
window.electronAPI.onFileOpened((data) => {
  editor.value = data.content    // 将文件内容填入编辑器
  updateStatusBar()              // 更新状态栏
  showStatus(`已打开: ${data.filePath}`)
})

/**
 * 监听主进程发来的新建文件事件
 * 当用户通过菜单新建文件时，主进程会发送此消息
 */
window.electronAPI.onNewFile(() => {
  editor.value = ''              // 清空编辑器
  updateStatusBar()              // 更新状态栏
  showStatus('已新建文件')
})

// ========== 键盘快捷键 ==========

/**
 * 键盘事件监听
 * Ctrl+S 保存由主进程菜单处理，这里只显示提示
 */
document.addEventListener('keydown', (e) => {
  // Ctrl+S 保存快捷键
  if (e.ctrlKey && e.key === 's') {
    showStatus('保存中...')
  }
})

// ========== 初始化 ==========
// 页面加载完成后，更新一次状态栏
updateStatusBar()