import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, DecisionDriftApi } from '../shared/contracts.js';

const api: DecisionDriftApi = {
  getState: () => ipcRenderer.invoke('decisiondrift:get-state'),
  importSource: input => ipcRenderer.invoke('decisiondrift:import-source', input),
  approveDecision: input => ipcRenderer.invoke('decisiondrift:approve', input),
  exportApproved: () => ipcRenderer.invoke('decisiondrift:export-approved'),
  importApproved: input => ipcRenderer.invoke('decisiondrift:import-approved', input),
  saveSettings: settings => ipcRenderer.invoke('decisiondrift:save-settings', settings),
  checkConnection: () => ipcRenderer.invoke('decisiondrift:check-connection'),
  testNotification: () => ipcRenderer.invoke('decisiondrift:test-notification'),
  startMonitoring: () => ipcRenderer.invoke('decisiondrift:start'),
  stopMonitoring: () => ipcRenderer.invoke('decisiondrift:stop'),
  checkNow: () => ipcRenderer.invoke('decisiondrift:check-now'),
  openSource: sourceId => ipcRenderer.invoke('decisiondrift:open-source', sourceId),
  openCapture: frameId => ipcRenderer.invoke('decisiondrift:open-capture', frameId),
  onState: listener => {
    const handler = (_event: Electron.IpcRendererEvent, state: AppSnapshot) => listener(state);
    ipcRenderer.on('decisiondrift:state', handler);
    return () => ipcRenderer.removeListener('decisiondrift:state', handler);
  },
  onOpenAlert: listener => {
    const handler = (_event: Electron.IpcRendererEvent, alertId: string) => listener(alertId);
    ipcRenderer.on('decisiondrift:open-alert', handler);
    return () => ipcRenderer.removeListener('decisiondrift:open-alert', handler);
  },
};

contextBridge.exposeInMainWorld('decisionDrift', api);
