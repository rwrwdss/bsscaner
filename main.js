const { app, BrowserWindow, Tray, Menu, Notification, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// КРИТИЧНО: Устанавливаем метаданные ДО создания окна
app.setName('BSscaner');
app.setAppUserModelId('com.bsscaner.app');

// Устанавливаем версию приложения
app.setVersion('1.0.0');

// Получаем путь для сохранения пользовательских данных
const userDataPath = app.getPath('userData');
const appDataPath = path.join(userDataPath, 'bsscaner_data');

// Создаем директорию для данных приложения
if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
    console.log('📁 Created app data directory:', appDataPath);
}

console.log('📁 App data path:', appDataPath);

// Принудительно устанавливаем метаданные для macOS
if (process.platform === 'darwin') {
  const iconPath = path.join(__dirname, 'img', 'bslogo.png');
  console.log('🔍 Setting dock icon:', iconPath);
  try {
    app.dock.setIcon(iconPath);
  } catch (error) {
    console.log('⚠️ Dock icon setting failed:', error.message);
  }
}

// Устанавливаем информацию о приложении для About диалога
if (process.platform === 'darwin') {
  app.setAboutPanelOptions({
    applicationName: 'BSscaner',
    applicationVersion: '1.0.0',
    version: '1.0.0',
    copyright: '© 2025 BSscaner',
    credits: 'Bluesky Social Scanner & Post Generator',
    website: 'https://github.com/bsscaner',
    iconPath: path.join(__dirname, 'img', 'bslogo.png')
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    maxWidth: 1200,
    minHeight: 600,
    maxHeight: 900,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'dark',
    backgroundColor: '#1E1E1E',
    icon: path.join(__dirname, 'img', 'bslogo.png'),
    show: false, // Не показываем окно сразу
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Устанавливаем заголовок окна
  mainWindow.setTitle('BSscaner');
  
  // Экспортируем API уведомлений и файлового хранилища в рендерер
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        const { ipcRenderer } = require('electron');
        window.electronAPI = {
          showNotification: function(title, body) {
            ipcRenderer.send('show-notification', title, body);
          },
          saveUserData: async function(dataType, data) {
            return await ipcRenderer.invoke('save-user-data', dataType, data);
          },
          loadUserData: async function(dataType) {
            return await ipcRenderer.invoke('load-user-data', dataType);
          },
          getAppDataPath: async function() {
            return await ipcRenderer.invoke('get-app-data-path');
          }
        };
      })();
    `);
  });
  
  // Обработчик уведомлений в main process
  ipcMain.on('show-notification', (event, title, body) => {
    // Устанавливаем правильное имя приложения для уведомлений
    app.setAppUserModelId('com.bsscaner.app');
    
    const iconPath = path.join(__dirname, 'img', 'bsnotiff.png');
    
    const notification = new Notification({
      title: title,
      body: body,
      icon: iconPath,
      hasReply: false,
      urgency: 'normal',
      timeoutType: 'never',
      silent: false
    });
    
    notification.on('click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
    
    notification.show();
  });
  
  // Показываем окно когда оно готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Принудительно обновляем метаданные после создания окна
    if (process.platform === 'darwin') {
      try {
        app.dock.setIcon(path.join(__dirname, 'img', 'bslogo.png'));
        console.log('✅ Dock icon updated after window creation');
      } catch (error) {
        console.log('⚠️ Dock icon update failed:', error.message);
      }
    }
  });
  
  // Настраиваем меню для macOS
  if (process.platform === 'darwin') {
    createMacMenu();
  } else {
    // Отключаем меню для других платформ
    mainWindow.setMenuBarVisibility(false);
  }
  
  // Создаем трей
  createTray(mainWindow);
}

function createTray(mainWindow) {
  const iconPath = path.join(__dirname, 'img', 'bslogo.png');
  console.log('🔍 Tray icon path:', iconPath);
  
  let tray;
  try {
    tray = new Tray(iconPath);
  } catch (error) {
    console.log('⚠️ Tray icon load failed:', error.message);
    // Fallback to a valid icon
    tray = new Tray(path.join(__dirname, 'img', 'bsnotiff.png'));
  }
  
  // Принудительно устанавливаем tooltip
  tray.setToolTip('BSscaner - Bluesky Social Scanner');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать BSscaner',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Скрыть',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Клик по трею показывает/скрывает окно
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  return tray;
}

function createMacMenu() {
  const template = [
    {
      label: 'BSscaner',
      submenu: [
        {
          label: 'О программе BSscaner',
          click: () => {
            app.showAboutPanel();
          }
        },
        { type: 'separator' },
        {
          label: 'Службы',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Скрыть BSscaner',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Скрыть остальные',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Показать все',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { label: 'Отменить', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Повторить', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Вырезать', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Копировать', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Вставить', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Выделить все', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Перезагрузить', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Принудительная перезагрузка', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Инструменты разработчика', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Реальный размер', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Увеличить', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Уменьшить', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Полноэкранный режим', accelerator: 'Ctrl+Cmd+F', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Окно',
      submenu: [
        { label: 'Свернуть', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Закрыть', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе BSscaner',
          click: () => {
            app.showAboutPanel();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Регистрируем обработчики IPC один раз, до создания окна
ipcMain.handle('save-user-data', (event, dataType, data) => {
  try {
    const filePath = path.join(appDataPath, `${dataType}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Saved user data: ${dataType}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error saving ${dataType}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-user-data', (event, dataType) => {
  try {
    const filePath = path.join(appDataPath, `${dataType}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      console.log(`📂 Loaded user data: ${dataType}`);
      return { success: true, data: JSON.parse(data) };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error(`❌ Error loading ${dataType}:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-data-path', () => {
  return appDataPath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // На macOS приложения обычно остаются активными даже когда все окна закрыты
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // На macOS пересоздаем окно когда иконка в доке кликнута и других окон нет
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Предотвращаем выход приложения при закрытии окна (для трея)
app.on('before-quit', (event) => {
  // Можно добавить логику для подтверждения выхода
});
