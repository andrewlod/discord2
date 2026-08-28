import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen, Menu, Tray, nativeImage } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#202225',
      symbolColor: '#dcddde',
      height: 32,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    icon: join(__dirname, '../../public/icon.png'),
    show: false,
    backgroundColor: '#202225',
  });

  if (isDev) {
    const win = mainWindow;
    if (win) {
      const attemptLoad = (attempt: number) => {
        win.webContents
          .loadURL(VITE_DEV_SERVER_URL)
          .catch(() => {
            if (attempt < 10) {
              setTimeout(() => attemptLoad(attempt + 1), 500);
            }
          });
      };
      attemptLoad(0);
      win.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createTray();
}

function createTray() {
  const icon = nativeImage.createFromPath(join(__dirname, '../../public/icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Discord 2',
      click: () => mainWindow?.show(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Discord 2');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

ipcMain.handle('dialog:selectFiles', async (_event, filters: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters,
  });
  return result.filePaths;
});

ipcMain.handle('screen:getSources', async (_event, types?: ('window' | 'screen')[]) => {
  const sources = await desktopCapturer.getSources({
    types: types || ['window', 'screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    displayId: source.display_id,
  }));
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.handle('auth:storeToken', async (_event, token: string) => {
  // In production, use safeStorage or keychain
  return true;
});

ipcMain.handle('auth:getToken', async () => {
  // In production, retrieve from safeStorage
  return null;
});

ipcMain.handle('auth:clearToken', async () => {
  // In production, clear from safeStorage
  return true;
});