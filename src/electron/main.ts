import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { CompanyBuddyApplication } from './application.js';
import { ScreenpipeRuntime } from '../runtime/screenpipe.js';
import { DesktopNotifications } from './notifications.js';
import type { AppSettings, AppSnapshot, ConflictAlert } from '../shared/contracts.js';

const here = dirname(fileURLToPath(import.meta.url));
app.setName('CompanyBuddy');
if (process.platform === 'win32') app.setAppUserModelId('com.companybuddy.desktop');
if (process.env.COMPANYBUDDY_USER_DATA_DIR) app.setPath('userData', process.env.COMPANYBUDDY_USER_DATA_DIR);

let window: BrowserWindow | null = null;
let application: CompanyBuddyApplication;
let quitting = false;
let pendingAlert: string | null = null;
const notifications = new DesktopNotifications();

function showWindow(): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  app.focus({ steal: true });
}

function openAlert(alertId: string): void {
  pendingAlert = alertId;
  showWindow();
  if (window && !window.webContents.isLoading()) {
    window.webContents.send('companybuddy:open-alert', pendingAlert);
    pendingAlert = null;
  }
}

function deliverAlert(alert: ConflictAlert): Promise<void> {
  if (application.getState().monitor.sessionId !== alert.sessionId) return Promise.resolve();
  return notifications.show({
    id: alert.id,
    title: 'CompanyBuddy',
    body: 'Une décision récente pourrait concerner votre travail. Cliquez pour voir les éléments justificatifs.',
    onClick: () => openAlert(alert.id),
  });
}

function registerHandlers(): void {
  const handle = (channel: string, callback: (...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
        throw new Error('Origine de commande non autorisée.');
      }
      return callback(...args);
    });
  };
  handle('companybuddy:get-state', () => application.getState());
  handle('companybuddy:import-source', input => application.importSource(z.object({ name: z.string().trim().min(1).max(300), text: z.string().trim().min(1).max(200_000) }).strict().parse(input)));
  handle('companybuddy:approve', input => application.approve(z.object({
    id: z.string(), approvedBy: z.string().trim().min(1).max(200), title: z.string(),
    description: z.string(), scope: z.string(), dateConstraints: z.string(), sourceQuote: z.string(),
  }).strict().parse(input)));
  handle('companybuddy:export-approved', async () => {
    const text = application.exportApproved();
    const result = await dialog.showSaveDialog(window!, {
      title: 'Partager les décisions approuvées', defaultPath: 'companybuddy-decisions.json',
      filters: [{ name: 'Décisions CompanyBuddy', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { filePath: null };
    await writeFile(result.filePath, text, { mode: 0o600 });
    return { filePath: result.filePath };
  });
  handle('companybuddy:import-approved', input => application.importApproved(z.object({ text: z.string().min(1).max(2_000_000) }).strict().parse(input).text));
  handle('companybuddy:save-settings', input => application.saveSettings(input as AppSettings));
  handle('companybuddy:check-connection', () => application.checkConnection());
  handle('companybuddy:test-notification', () => notifications.show({
    id: `test-${randomUUID()}`,
    title: 'CompanyBuddy',
    body: 'Les notifications fonctionnent. Cliquez pour ouvrir CompanyBuddy.',
    onClick: showWindow,
  }));
  handle('companybuddy:start', () => application.start());
  handle('companybuddy:stop', () => application.stop());
  handle('companybuddy:check-now', () => application.checkNow());
  handle('companybuddy:open-source', async input => {
    const source = application.source(z.string().parse(input));
    const directory = join(app.getPath('userData'), 'source-view');
    await mkdir(directory, { recursive: true });
    const safeName = basename(source.name).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 100) || 'source';
    const path = join(directory, `${randomUUID()}-${safeName}.txt`);
    await writeFile(path, source.text, { mode: 0o600 });
    const error = await shell.openPath(path);
    if (error) throw new Error(`Impossible d’ouvrir la source : ${error}`);
  });
  handle('companybuddy:open-capture', async input => {
    const frameId = z.number().int().nonnegative().parse(input);
    await shell.openExternal(`screenpipe://frame/${frameId}`);
  });
}

async function launch(): Promise<void> {
  nativeTheme.themeSource = 'dark';
  const directory = app.getPath('userData');
  // Screenpipe starts its agent with `env node`; Finder has no shell Node path.
  const runtime = new ScreenpipeRuntime(join(directory, 'runtime'), {
    ...process.env,
    PATH: [join(process.resourcesPath, 'node-bin'), process.env.PATH].filter(Boolean).join(delimiter),
  });
  application = new CompanyBuddyApplication(directory, runtime, (state: AppSnapshot) => {
    if (window && !window.isDestroyed()) window.webContents.send('companybuddy:state', state);
  }, deliverAlert);
  await application.initialize();
  registerHandlers();
  window = new BrowserWindow({
    title: 'CompanyBuddy', width: 1120, height: 780, minWidth: 900, minHeight: 640,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 17 },
    transparent: process.platform === 'darwin',
    backgroundColor: process.platform === 'darwin' ? '#00000000' : '#0a0a0a',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: 'active', show: false,
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('did-finish-load', () => {
    if (pendingAlert) {
      window!.webContents.send('companybuddy:open-alert', pendingAlert);
      pendingAlert = null;
    }
  });
  window.on('close', event => {
    if (!quitting) { event.preventDefault(); window!.hide(); }
  });
  window.once('ready-to-show', () => {
    showWindow();
    console.log('CompanyBuddy ready');
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'CompanyBuddy', submenu: [
      { label: 'Afficher CompanyBuddy', click: showWindow },
      { label: 'Mettre en pause la surveillance', click: () => application.stop() },
      { type: 'separator' }, { role: 'quit', label: 'Quitter CompanyBuddy' },
    ] },
    { label: 'Édition', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Fenêtre', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { label: 'Afficher', click: showWindow }] },
  ]));
  await window.loadFile(join(here, '../../dist/index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  app.on('window-all-closed', () => { /* The local monitor lives independently of its window. */ });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    void (async () => {
      try { await application?.dispose(); }
      catch (error) { console.error('Arrêt de CompanyBuddy incomplet.', error instanceof Error ? error.message : 'Erreur inconnue'); }
      app.exit(0);
    })();
  });
  void app.whenReady().then(launch).catch(async error => {
    dialog.showErrorBox('CompanyBuddy ne peut pas démarrer', error instanceof Error ? error.message : String(error));
    quitting = true;
    app.exit(1);
  });
}
