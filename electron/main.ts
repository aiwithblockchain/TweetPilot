import * as electron from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocalBridgeClient } from '../src/adapters/localBridge/index.js';

const { app, BrowserWindow, shell, ipcMain } = electron;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0d1117',
    title: 'TweetPilot',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// LocalBridge IPC handlers
// Note: LocalBridge client will be imported dynamically to avoid ESM issues
let localBridgeClient: LocalBridgeClient | null = null;

async function getLocalBridgeClient(): Promise<LocalBridgeClient> {
  if (!localBridgeClient) {
    const { LocalBridgeClient: Client } = await import('../src/adapters/localBridge/index.js');
    localBridgeClient = new Client();
  }
  return localBridgeClient;
}

// Cleanup on app quit
app.on('will-quit', () => {
  localBridgeClient = null;
});

// Structured error wrapper for IPC
interface IPCError {
  success: false;
  error: string;
  stack?: string;
}

interface IPCSuccess<T> {
  success: true;
  data: T;
}

type IPCResult<T> = IPCSuccess<T> | IPCError;

function wrapIPCError(error: unknown): IPCError {
  if (error instanceof Error) {
    return { success: false, error: error.message, stack: error.stack };
  }
  return { success: false, error: String(error) };
}

function wrapIPCSuccess<T>(data: T): IPCSuccess<T> {
  return { success: true, data };
}

ipcMain.handle('localBridge:getInstances', async () => {
  try {
    const client = await getLocalBridgeClient();
    const result = await client.getInstances();
    return wrapIPCSuccess(result);
  } catch (error) {
    console.error('LocalBridge getInstances error:', error);
    return wrapIPCError(error);
  }
});

ipcMain.handle('localBridge:getTabStatus', async (_event, instanceId?: string) => {
  if (instanceId !== undefined && typeof instanceId !== 'string') {
    return wrapIPCError(new Error('Invalid instanceId: must be a string'));
  }

  try {
    const client = await getLocalBridgeClient();
    const result = await client.getTabStatus(instanceId);
    return wrapIPCSuccess(result);
  } catch (error) {
    console.error('LocalBridge getTabStatus error:', error);
    return wrapIPCError(error);
  }
});

ipcMain.handle('localBridge:getTweet', async (_event, tweetId: string, tabId?: number) => {
  if (!tweetId || typeof tweetId !== 'string') {
    return wrapIPCError(new Error('Invalid tweetId: must be a non-empty string'));
  }
  if (tabId !== undefined && typeof tabId !== 'number') {
    return wrapIPCError(new Error('Invalid tabId: must be a number'));
  }

  try {
    const client = await getLocalBridgeClient();
    const result = await client.getTweet(tweetId, tabId);
    return wrapIPCSuccess(result);
  } catch (error) {
    console.error('LocalBridge getTweet error:', error);
    return wrapIPCError(error);
  }
});

ipcMain.handle('localBridge:getTweetReplies', async (_event, tweetId: string, options?: { cursor?: string; tabId?: number }) => {
  if (!tweetId || typeof tweetId !== 'string') {
    return wrapIPCError(new Error('Invalid tweetId: must be a non-empty string'));
  }
  if (options?.cursor !== undefined && typeof options.cursor !== 'string') {
    return wrapIPCError(new Error('Invalid cursor: must be a string'));
  }
  if (options?.tabId !== undefined && typeof options.tabId !== 'number') {
    return wrapIPCError(new Error('Invalid tabId: must be a number'));
  }

  try {
    const client = await getLocalBridgeClient();
    const result = await client.getTweetReplies(tweetId, options);
    return wrapIPCSuccess(result);
  } catch (error) {
    console.error('LocalBridge getTweetReplies error:', error);
    return wrapIPCError(error);
  }
});
