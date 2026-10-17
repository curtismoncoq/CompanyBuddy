import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, CompanyBuddyApi } from '../shared/contracts.js';

const api: CompanyBuddyApi = {
  getState: () => ipcRenderer.invoke('companybuddy:get-state'),
  importSource: input => ipcRenderer.invoke('companybuddy:import-source', input),
  approveDecision: input => ipcRenderer.invoke('companybuddy:approve', input),
  exportApproved: () => ipcRenderer.invoke('companybuddy:export-approved'),
  importApproved: input => ipcRenderer.invoke('companybuddy:import-approved', input),
  saveSettings: settings => ipcRenderer.invoke('companybuddy:save-settings', settings),
  checkConnection: () => ipcRenderer.invoke('companybuddy:check-connection'),
  testNotification: () => ipcRenderer.invoke('companybuddy:test-notification'),
  startMonitoring: () => ipcRenderer.invoke('companybuddy:start'),
  stopMonitoring: () => ipcRenderer.invoke('companybuddy:stop'),
  checkNow: () => ipcRenderer.invoke('companybuddy:check-now'),
  openSource: sourceId => ipcRenderer.invoke('companybuddy:open-source', sourceId),
  openCapture: frameId => ipcRenderer.invoke('companybuddy:open-capture', frameId),
  onState: listener => {
    const handler = (_event: Electron.IpcRendererEvent, state: AppSnapshot) => listener(state);
    ipcRenderer.on('companybuddy:state', handler);
    return () => ipcRenderer.removeListener('companybuddy:state', handler);
  },
  onOpenAlert: listener => {
    const handler = (_event: Electron.IpcRendererEvent, alertId: string) => listener(alertId);
    ipcRenderer.on('companybuddy:open-alert', handler);
    return () => ipcRenderer.removeListener('companybuddy:open-alert', handler);
  },
};

contextBridge.exposeInMainWorld('companyBuddy', api);
