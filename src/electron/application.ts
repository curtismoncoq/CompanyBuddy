import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { addSource, approveDecision, exportApprovedBook, importApprovedBook, restoreBook, type DecisionBook } from '../domain/decisions.js';
import type { ScreenpipeRuntime } from '../runtime/screenpipe.js';
import type { AppSettings, AppSnapshot, ApprovalInput, ConflictAlert, ConnectionInfo, MonitorStatus, SourceDocument } from '../shared/contracts.js';

const settingsSchema = z.object({
  apiUrl: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  }, 'Utilisez une adresse HTTP locale Screenpipe, sans chemin ni identifiants.'),
  cliPath: z.string().max(1000),
  presetId: z.string().trim().min(1).max(200),
  targetApp: z.string().trim().max(200),
  targetWindow: z.string().trim().max(200),
  intervalSeconds: z.number().int().min(15).max(3600),
}).strict();

const alertSchema = z.object({
  id: z.string(), sessionId: z.string(), decisionId: z.string(), frameId: z.number().int().nonnegative(),
  observedText: z.string(), explanation: z.string(), appName: z.string(), windowName: z.string(),
  capturedAt: z.string(), decisionTitle: z.string(), decisionQuote: z.string(), sourceName: z.string(),
  sourceId: z.string(), createdAt: z.string(),
}).strict();

const initialSettings: AppSettings = {
  apiUrl: 'http://localhost:3030', cliPath: '', presetId: 'minimax',
  targetApp: '', targetWindow: '', intervalSeconds: 30,
};
const stopped = (): MonitorStatus => ({
  state: 'stopped', sessionId: null, startedAt: null, lastCheckedAt: null,
  lastRunMs: null, frameCount: 0, error: null,
});
const disconnected = (): ConnectionInfo => ({
  reachable: false, captureStatus: 'Non vérifié', cliPath: '', presets: [], error: null,
});

export class DecisionDriftApplication {
  private book: DecisionBook = { sources: [], decisions: [] };
  private settings: AppSettings = { ...initialSettings };
  private connection = disconnected();
  private monitor = stopped();
  private alerts: ConflictAlert[] = [];
  private timer: NodeJS.Timeout | undefined;
  private busy = false;
  private seen = new Set<string>();
  private rangeEnd: number | null = null;
  private mutations: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private readonly statePath: string;

  constructor(
    private readonly directory: string,
    private readonly runtime: ScreenpipeRuntime,
    private readonly changed: (state: AppSnapshot) => void,
    private readonly notify: (alert: ConflictAlert) => Promise<void> | void,
  ) {
    this.statePath = join(directory, 'state.json');
  }

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    try {
      const saved: unknown = JSON.parse(await readFile(this.statePath, 'utf8'));
      const envelope = z.object({ book: z.unknown(), settings: settingsSchema, alerts: z.array(alertSchema) }).parse(saved);
      this.book = restoreBook(envelope.book);
      this.settings = envelope.settings;
      this.alerts = envelope.alerts;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw new Error('Impossible de charger les données locales. Le fichier existant a été conservé.', { cause: error });
      }
    }
  }

  getState(): AppSnapshot {
    return structuredClone({ ...this.book, settings: this.settings, connection: this.connection, monitor: this.monitor, alerts: this.alerts });
  }

  private emit(): AppSnapshot {
    const state = this.getState();
    this.changed(state);
    return state;
  }

  private async persist(book = this.book, settings = this.settings, alerts = this.alerts): Promise<void> {
    const data = JSON.stringify({ book, settings, alerts }, null, 2);
    const temporary = `${this.statePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, data, { mode: 0o600 });
    await rename(temporary, this.statePath);
  }

  private mutate(operation: () => Promise<AppSnapshot>): Promise<AppSnapshot> {
    const next = this.mutations.catch(() => undefined).then(operation);
    this.mutations = next;
    return next;
  }

  importSource(input: { name: string; text: string }): Promise<AppSnapshot> {
    return this.mutate(async () => {
      const next = await addSource(this.book, input, source => this.runtime.extract(source, this.settings));
      await this.persist(next);
      this.book = next;
      return this.emit();
    });
  }

  approve(input: ApprovalInput): Promise<AppSnapshot> {
    return this.mutate(async () => {
      const next = approveDecision(this.book, input);
      await this.persist(next);
      this.book = next;
      return this.emit();
    });
  }

  exportApproved(): string {
    return exportApprovedBook(this.book);
  }

  importApproved(text: string): Promise<AppSnapshot> {
    return this.mutate(async () => {
      const next = importApprovedBook(this.book, text);
      await this.persist(next);
      this.book = next;
      return this.emit();
    });
  }

  saveSettings(value: AppSettings): Promise<AppSnapshot> {
    return this.mutate(async () => {
      const next = settingsSchema.parse(value);
      this.stop();
      await this.persist(this.book, next);
      this.settings = next;
      this.connection = disconnected();
      return this.emit();
    });
  }

  async checkConnection(): Promise<AppSnapshot> {
    const settings = this.settings;
    const connection = await this.runtime.discover(settings);
    if (settings !== this.settings) return this.getState();
    this.connection = connection;
    return this.emit();
  }

  async start(): Promise<AppSnapshot> {
    if (this.monitor.sessionId) return this.getState();
    const generation = ++this.generation;
    await this.mutations.catch(() => undefined);
    if (generation !== this.generation) return this.getState();
    if (!this.book.decisions.some(decision => decision.approvedAt && decision.approvedBy)) {
      throw new Error('Validez ou importez au moins une décision avant de démarrer.');
    }
    // Stop invalidates startup while connection discovery is pending.
    await this.checkConnection();
    if (generation !== this.generation) return this.getState();
    if (!this.connection.reachable || this.connection.error) {
      throw new Error(this.connection.error || 'Screenpipe est inaccessible.');
    }
    if (!this.connection.presets.some(preset => preset.id === this.settings.presetId)) {
      throw new Error('Le preset choisi est absent de Screenpipe. Vérifiez les réglages.');
    }
    this.seen.clear();
    this.rangeEnd = null;
    this.monitor = { ...stopped(), state: 'watching', sessionId: randomUUID(), startedAt: new Date().toISOString() };
    this.emit();
    this.schedule(0);
    return this.getState();
  }

  stop(): AppSnapshot {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.monitor = { ...this.monitor, state: 'stopped', sessionId: null, error: null };
    return this.emit();
  }

  async checkNow(): Promise<AppSnapshot> {
    if (!this.monitor.sessionId) throw new Error('Démarrez une session de surveillance avant de lancer une analyse.');
    if (this.busy) throw new Error('Une analyse est déjà en cours.');
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.tick();
    return this.getState();
  }

  private schedule(delay: number): void {
    if (!this.monitor.sessionId) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.tick(); }, delay);
  }

  private async tick(): Promise<void> {
    const sessionId = this.monitor.sessionId;
    const startedAt = this.monitor.startedAt;
    if (!sessionId || !startedAt) return;
    if (this.busy) { this.schedule(1000); return; }
    this.busy = true;
    const started = Date.now();
    const until = Date.now();
    const since = this.rangeEnd === null ? until - 90_000 : Math.max(Date.parse(startedAt), this.rangeEnd - 10_000);
    this.monitor = { ...this.monitor, state: 'checking', error: null };
    this.emit();
    try {
      const approved = this.book.decisions.filter(decision => decision.approvedAt && decision.approvedBy);
      const result = await this.runtime.analyse(approved, this.settings, { since: new Date(since).toISOString(), until: new Date(until).toISOString() });
      if (this.monitor.sessionId !== sessionId) return;
      let notifications: ConflictAlert[] = [];
      await this.mutate(async () => {
        if (this.monitor.sessionId !== sessionId) return this.getState();
        const incoming: ConflictAlert[] = [];
        const keys = new Set<string>();
        for (const conflict of result.conflicts) {
          const decision = approved.find(item => item.id === conflict.decisionId);
          const source = decision && this.book.sources.find(item => item.id === decision.sourceId);
          if (!decision || !source) throw new Error('Le résultat ne correspond pas à une décision approuvée.');
          const key = JSON.stringify([decision.id, conflict.appName, conflict.windowName]);
          if (this.seen.has(key) || keys.has(key)) continue;
          keys.add(key);
          incoming.push({ ...conflict, id: randomUUID(), sessionId, decisionTitle: decision.title,
            decisionQuote: decision.sourceQuote, sourceId: source.id, sourceName: source.name, createdAt: new Date().toISOString() });
        }
        const nextAlerts = [...incoming, ...this.alerts];
        if (incoming.length) {
          await this.persist(this.book, this.settings, nextAlerts);
          if (this.monitor.sessionId !== sessionId) {
            await this.persist();
            return this.getState();
          }
        }
        this.alerts = nextAlerts;
        for (const key of keys) this.seen.add(key);
        this.rangeEnd = until;
        this.monitor = { ...this.monitor, state: result.status, frameCount: result.frameCount,
          lastCheckedAt: new Date().toISOString(), lastRunMs: Date.now() - started, error: null };
        this.emit();
        notifications = incoming;
        return this.getState();
      });
      let notificationError: Error | null = null;
      for (const alert of notifications) {
        if (this.monitor.sessionId !== sessionId) break;
        try {
          await this.notify(alert);
        } catch (error) {
          notificationError ??= error instanceof Error ? error : new Error('Notification impossible.');
        }
      }
      if (notificationError !== null) throw notificationError;
    } catch (error) {
      if (this.monitor.sessionId !== sessionId) return;
      this.monitor = { ...this.monitor, state: 'error', error: error instanceof Error ? error.message : 'Analyse impossible.',
        lastCheckedAt: new Date().toISOString(), lastRunMs: Date.now() - started };
      this.emit();
    } finally {
      this.busy = false;
      if (this.monitor.sessionId === sessionId) this.schedule(this.settings.intervalSeconds * 1000);
      else if (this.monitor.sessionId) this.schedule(0);
    }
  }

  source(sourceId: string): SourceDocument {
    const source = this.book.sources.find(item => item.id === sourceId);
    if (!source) throw new Error('Source introuvable.');
    return structuredClone(source);
  }

  async dispose(): Promise<void> {
    this.stop();
    await this.mutations.catch(() => undefined);
    await this.runtime.dispose();
  }
}
