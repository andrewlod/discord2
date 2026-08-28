import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen, Menu, Tray, nativeImage } from 'electron';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const RENDERER_DIR = join(__dirname, '../renderer');
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

// Serve the built renderer over http://127.0.0.1 so ES modules load without
// the file:// CORS restriction that blocks <script type="module"> from file://.
function startRendererServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = normalize(join(RENDERER_DIR, urlPath));
        if (!filePath.startsWith(RENDERER_DIR)) {
          res.statusCode = 403;
          return res.end('Forbidden');
        }
        if (urlPath === '/' || urlPath === '') {
          filePath = join(RENDERER_DIR, 'index.html');
        }
        if (!existsSync(filePath)) {
          filePath = extname(filePath) === '' ? join(RENDERER_DIR, 'index.html') : filePath;
        }
        const data = await readFile(filePath);
        const mime = MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(data);
      } catch {
        res.statusCode = 404;
        res.end('Not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function createWindow() {
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
    const url = await startRendererServer();
    mainWindow.loadURL(url);
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
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(source => {
    let thumbnail = '';
    try {
      thumbnail = source.thumbnail?.toDataURL() || '';
    } catch {
      thumbnail = '';
    }
    return {
      id: source.id,
      name: source.name,
      thumbnail,
      displayId: source.display_id,
    };
  });
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