export interface SourceDocument {
  id: string;
  name: string;
  text: string;
  importedAt: string;
  actions: Array<{ task: string; assignee: string }>;
}

export interface ExtractedDecision {
  title: string;
  description: string;
  scope: string;
  dateConstraints: string;
  sourceQuote: string;
}

export interface Decision extends ExtractedDecision {
  id: string;
  sourceId: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface AppSettings {
  apiUrl: string;
  cliPath: string;
  presetId: string;
  targetApp: string;
  targetWindow: string;
  intervalSeconds: number;
}

export interface ConnectionInfo {
  reachable: boolean;
  captureStatus: string;
  cliPath: string;
  presets: Array<{ id: string; name: string; model: string }>;
  error: string | null;
}

export interface DetectedConflict {
  decisionId: string;
  frameId: number;
  observedText: string;
  explanation: string;
  appName: string;
  windowName: string;
  capturedAt: string;
}

export interface AnalysisResult {
  status: 'no_data' | 'clear' | 'conflict';
  frameCount: number;
  conflicts: DetectedConflict[];
}

export interface ConflictAlert extends DetectedConflict {
  id: string;
  sessionId: string;
  decisionTitle: string;
  decisionQuote: string;
  sourceName: string;
  sourceId: string;
  createdAt: string;
}

export interface MonitorStatus {
  state: 'stopped' | 'watching' | 'checking' | 'no_data' | 'clear' | 'conflict' | 'error';
  sessionId: string | null;
  startedAt: string | null;
  lastCheckedAt: string | null;
  lastRunMs: number | null;
  frameCount: number;
  error: string | null;
}

export interface AppSnapshot {
  sources: SourceDocument[];
  decisions: Decision[];
  settings: AppSettings;
  connection: ConnectionInfo;
  monitor: MonitorStatus;
  alerts: ConflictAlert[];
}

export interface ApprovalInput extends ExtractedDecision {
  id: string;
  approvedBy: string;
}

export interface DecisionDriftApi {
  getState(): Promise<AppSnapshot>;
  importSource(input: { name: string; text: string }): Promise<AppSnapshot>;
  approveDecision(input: ApprovalInput): Promise<AppSnapshot>;
  exportApproved(): Promise<{ filePath: string | null }>;
  importApproved(input: { text: string }): Promise<AppSnapshot>;
  saveSettings(settings: AppSettings): Promise<AppSnapshot>;
  checkConnection(): Promise<AppSnapshot>;
  testNotification(): Promise<void>;
  startMonitoring(): Promise<AppSnapshot>;
  stopMonitoring(): Promise<AppSnapshot>;
  checkNow(): Promise<AppSnapshot>;
  openSource(sourceId: string): Promise<void>;
  openCapture(frameId: number): Promise<void>;
  onState(listener: (state: AppSnapshot) => void): () => void;
  onOpenAlert(listener: (alertId: string) => void): () => void;
}

declare global {
  interface Window {
    decisionDrift: DecisionDriftApi;
  }
}
