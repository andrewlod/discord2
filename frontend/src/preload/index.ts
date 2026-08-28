import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  dialog: {
    selectFiles: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('dialog:selectFiles', filters),
  },
  screen: {
    getSources: (types?: ('window' | 'screen')[]) => ipcRenderer.invoke('screen:getSources', types),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  auth: {
    storeToken: (token: string) => ipcRenderer.invoke('auth:storeToken', token),
    getToken: () => ipcRenderer.invoke('auth:getToken'),
    clearToken: () => ipcRenderer.invoke('auth:clearToken'),
  },
});

declare global {
  interface Window {
    api: {
      dialog: {
        selectFiles: (filters?: Electron.FileFilter[]) => Promise<string[]>;
      };
      screen: {
        getSources: (types?: ('window' | 'screen')[]) => Promise<Array<{ id: string; name: string; thumbnail: string; displayId: string }>>;
      };
      app: {
        getVersion: () => Promise<string>;
      };
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      auth: {
        storeToken: (token: string) => Promise<boolean>;
        getToken: () => Promise<string | null>;
        clearToken: () => Promise<boolean>;
      };
    };
  }
}