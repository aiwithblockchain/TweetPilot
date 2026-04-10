import * as electron from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
let localBridgeClient: any = null;

async function getLocalBridgeClient() {
  if (!localBridgeClient) {
    const { LocalBridgeClient } = await import('../src/adapters/localBridge/index.js');
    localBridgeClient = new LocalBridgeClient();
  }
  return localBridgeClient;
}

ipcMain.handle('localBridge:getInstances', async () => {
  try {
    const client = await getLocalBridgeClient();
    return await client.getInstances();
  } catch (error) {
    console.error('LocalBridge getInstances error:', error);
    throw error;
  }
});

ipcMain.handle('localBridge:getTabStatus', async (_event, instanceId?: string) => {
  try {
    const client = await getLocalBridgeClient();
    return await client.getTabStatus(instanceId);
  } catch (error) {
    console.error('LocalBridge getTabStatus error:', error);
    throw error;
  }
});

ipcMain.handle('localBridge:getTweet', async (_event, tweetId: string, tabId?: number) => {
  try {
    const client = await getLocalBridgeClient();
    return await client.getTweet(tweetId, tabId);
  } catch (error) {
    console.error('LocalBridge getTweet error:', error);
    throw error;
  }
});

ipcMain.handle('localBridge:getTweetReplies', async (_event, tweetId: string, options?: { cursor?: string; tabId?: number }) => {
  try {
    const client = await getLocalBridgeClient();
    return await client.getTweetReplies(tweetId, options);
  } catch (error) {
    console.error('LocalBridge getTweetReplies error:', error);
    throw error;
  }
});
