const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs').promises

// 全局变量
let mainWindow          // 主窗口实例
let currentFilePath = null  // 当前打开的文件路径（未命名时为null）
let isModified = false      // 标记文档是否被修改过

/**
 * 创建浏览器窗口
 * 设置窗口大小、标题、预加载脚本等属性
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // 预加载脚本路径 - 用于主渲染进程通信
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,      // 禁用Node.js集成（安全考虑）
      contextIsolation: true        // 启用上下文隔离（安全考虑）
    },
    frame: true,                   // 使用原生标题栏
    title: '简单笔记'               // 窗口默认标题
  })

  // 加载渲染进程的HTML文件
  mainWindow.loadFile('renderer/index.html')

  // 创建应用菜单
  createMenu()

  // 开发时可取消下方注释来打开开发者工具
  // mainWindow.webContents.openDevTools()

  /**
   * 窗口关闭事件处理
   * 用于检查是否有未保存的修改，提示用户保存
   */
  mainWindow.on('close', async (event) => {
    if (isModified) {
      event.preventDefault()  // 阻止窗口关闭

      // 显示警告对话框，询问用户是否保存
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,    // 默认选中"保存"
        cancelId: 2,     // 按Esc键选择"取消"
        title: '未保存的修改',
        message: '文档有未保存的修改，是否保存？'
      })

      if (result.response === 0) {
        // 用户选择"保存"
        const saved = await saveFile()
        if (saved) {
          mainWindow.destroy()  // 保存成功后强制关闭窗口
        }
      } else if (result.response === 1) {
        // 用户选择"不保存"
        mainWindow.destroy()
      }
      // 选择"取消"则不做任何操作，窗口保持打开
    }
  })
}

/**
 * 创建应用菜单
 * 定义文件、编辑、帮助等菜单项
 */
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',  // 键盘快捷键
          click: () => newFile()
        },
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile()
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveFile()
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => saveFileAs()
        },
        { type: 'separator' },  // 分隔线
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },    // 使用内置撤销功能
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },     // 使用内置剪切功能
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '简单笔记 v1.0.0',
              detail: '一个基于 Electron 的简单笔记应用\n教程示例项目'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/**
 * 新建文件
 * 如果当前文档有未保存的修改，先提示用户保存
 */
async function newFile() {
  if (isModified) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      title: '未保存的修改',
      message: '当前文档有未保存的修改，是否保存？'
    })

    if (result.response === 0) {
      await saveFile()
    } else if (result.response === 2) {
      return  // 取消操作，不执行新建
    }
  }

  // 重置状态
  currentFilePath = null
  isModified = false
  mainWindow.setTitle('简单笔记 - 未命名')
  // 通知渲染进程清空编辑器
  mainWindow.webContents.send('file:new')
}

/**
 * 打开文件
 * 先检查未保存的修改，然后显示文件选择对话框
 */
async function openFile() {
  // 检查是否有未保存的修改
  if (isModified) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      title: '未保存的修改',
      message: '当前文档有未保存的修改，是否保存？'
    })

    if (result.response === 0) {
      await saveFile()
    } else if (result.response === 2) {
      return  // 取消操作
    }
  }

  // 显示打开文件对话框
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文件',
    filters: [
      { name: '文本文件', extensions: ['txt', 'md'] },  // 文本和Markdown文件
      { name: '所有文件', extensions: ['*'] }           // 所有文件
    ],
    properties: ['openFile']  // 只允许选择单个文件
  })

  if (result.canceled || result.filePaths.length === 0) {
    return  // 用户取消
  }

  const filePath = result.filePaths[0]

  try {
    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8')
    currentFilePath = filePath
    isModified = false
    mainWindow.setTitle(`简单笔记 - ${path.basename(filePath)}`)
    // 发送文件内容给渲柘进程
    mainWindow.webContents.send('file:opened', { content, filePath })
  } catch (error) {
    dialog.showErrorBox('打开文件失败', error.message)
  }
}

/**
 * 保存文件
 * 如果当前没有打开的文件路径（新文件），则调用另存为
 */
async function saveFile() {
  if (!currentFilePath) {
    return await saveFileAs()  // 未命名文件，调用另存为
  }

  try {
    // 从渲染进程获取编辑器内容
    const content = await mainWindow.webContents.executeJavaScript('document.getElementById("editor").value')
    await fs.writeFile(currentFilePath, content, 'utf-8')
    isModified = false
    mainWindow.setTitle(`简单笔记 - ${path.basename(currentFilePath)}`)

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '保存成功',
      message: '文件已保存'
    })

    return true
  } catch (error) {
    dialog.showErrorBox('保存失败', error.message)
    return false
  }
}

/**
 * 另存为
 * 显示保存对话框，允许用户选择保存位置和文件名
 */
async function saveFileAs() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存文件',
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    defaultPath: currentFilePath || '未命名.txt'  // 默认文件名
  })

  if (result.canceled || !result.filePath) {
    return false  // 用户取消
  }

  try {
    const content = await mainWindow.webContents.executeJavaScript('document.getElementById("editor").value')
    await fs.writeFile(result.filePath, content, 'utf-8')
    currentFilePath = result.filePath
    isModified = false
    mainWindow.setTitle(`简单笔记 - ${path.basename(result.filePath)}`)

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '保存成功',
      message: `文件已保存至：${result.filePath}`
    })

    return true
  } catch (error) {
    dialog.showErrorBox('保存失败', error.message)
    return false
  }
}

// ========== 应用启动 ==========

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
  createWindow()

  // macOS专有：当点击dock图标时重新打开窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ========== IPC 通信处理 ==========

/**
 * 监听渲柘进程的文档修改事件
 * 当用户编辑内容时触发，标记文档为已修改状态
 */
ipcMain.on('document:modified', () => {
  isModified = true
  const title = mainWindow.getTitle()
  // 在标题前添加星号表示未保存
  if (!title.startsWith('*')) {
    mainWindow.setTitle('*' + title)
  }
})

/**
 * 处理获取当前文件路径请求
 * 返回当前打开的文件路径（可供invoke/handle模式）
 */
ipcMain.handle('file:getCurrentPath', () => {
  return currentFilePath
})