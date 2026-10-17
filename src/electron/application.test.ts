import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ScreenpipeRuntime } from '../runtime/screenpipe.js';
import type { AnalysisResult, ConflictAlert, ConnectionInfo } from '../shared/contracts.js';
import { CompanyBuddyApplication } from './application.js';

function deferred<T>(): PromiseWithResolvers<T> {
  return Promise.withResolvers<T>();
}

const connected: ConnectionInfo = {
  reachable: true, captureStatus: 'ok', cliPath: '',
  presets: [{ id: 'minimax', name: 'MiniMax', model: 'MiniMax-M3' }], error: null,
};

async function createApplication(notify: (alert: ConflictAlert) => Promise<void> | void = () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'companybuddy-application-'));
  const runtime = new ScreenpipeRuntime(directory);
  runtime.discover = async () => connected;
  runtime.extract = async () => [{
    title: 'Maintenir V1', description: 'Garder V1 actif.', scope: 'API',
    dateConstraints: '', sourceQuote: 'Garder V1 actif.',
  }];
  const app = new CompanyBuddyApplication(directory, runtime, () => {}, notify);
  await app.initialize();
  return { app, runtime, directory };
}

async function approveSource(app: CompanyBuddyApplication) {
  const imported = await app.importSource({ name: 'notes.md', text: 'Garder V1 actif.' });
  const candidate = imported.decisions.at(-1);
  assert.ok(candidate);
  await app.approve({
    id: candidate.id, title: candidate.title, description: candidate.description,
    scope: candidate.scope, dateConstraints: candidate.dateConstraints,
    sourceQuote: candidate.sourceQuote, approvedBy: 'Alex',
  });
  return candidate.id;
}

function conflict(decisionId: string): AnalysisResult {
  return {
    status: 'conflict', frameCount: 1,
    conflicts: [{
      decisionId, frameId: 0, observedText: 'Désactiver V1.', explanation: 'V1 doit rester actif.',
      appName: 'Editor', windowName: 'plan.md', capturedAt: '2026-10-17T12:00:00.000Z',
    }],
  };
}

test('restoring IPv6 loopback settings keeps approved decisions available', async t => {
  const { app, runtime, directory } = await createApplication();
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  await approveSource(app);
  await app.saveSettings({ ...app.getState().settings, apiUrl: 'http://[::1]:3030' });
  const restored = new CompanyBuddyApplication(directory, runtime, () => {}, () => {});
  await restored.initialize();
  assert.equal(restored.getState().settings.apiUrl, 'http://[::1]:3030');
  assert.deepEqual(restored.getState().decisions, app.getState().decisions);
  assert.deepEqual(restored.getState().sources, app.getState().sources);
});

test('an async notification can save settings without deadlocking the application', { timeout: 3000 }, async t => {
  let app!: CompanyBuddyApplication;
  const fixture = await createApplication(async () => {
    await app.saveSettings({ ...app.getState().settings, targetApp: 'Editor' });
  });
  app = fixture.app;
  t.after(async () => { app.stop(); await rm(fixture.directory, { recursive: true, force: true }); });
  const decisionId = await approveSource(app);
  fixture.runtime.analyse = async () => conflict(decisionId);
  await app.start();
  await app.checkNow();
  assert.equal(app.getState().settings.targetApp, 'Editor');
  assert.equal(app.getState().monitor.state, 'stopped');
  const restored = new CompanyBuddyApplication(fixture.directory, fixture.runtime, () => {}, () => {});
  await restored.initialize();
  assert.equal(restored.getState().settings.targetApp, 'Editor');
  assert.equal(restored.getState().alerts.length, 1);
});

test('saving settings discards discovery results for the previous connection', async t => {
  const { app, runtime, directory } = await createApplication();
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  const discovery = deferred<ConnectionInfo>();
  runtime.discover = () => discovery.promise;
  const checking = app.checkConnection();
  await app.saveSettings({ ...app.getState().settings, presetId: 'other' });
  discovery.resolve(connected);
  await checking;
  assert.equal(app.getState().settings.presetId, 'other');
  assert.equal(app.getState().connection.reachable, false);
  assert.deepEqual(app.getState().connection.presets, []);
});

test('stop cancels startup even while discovery is still pending', async t => {
  const { app, runtime, directory } = await createApplication();
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  await approveSource(app);
  const discovery = deferred<ConnectionInfo>();
  const discovering = deferred<void>();
  runtime.discover = () => { discovering.resolve(); return discovery.promise; };
  const starting = app.start();
  await discovering.promise;
  app.stop();
  discovery.resolve(connected);
  await starting;
  assert.equal(app.getState().monitor.state, 'stopped');
  assert.equal(app.getState().monitor.sessionId, null);
});

test('a late model result preserves approvals acknowledged during the analysis', async t => {
  const { app, runtime, directory } = await createApplication();
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  const decisionId = await approveSource(app);
  const pending = await app.importSource({ name: 'other.md', text: 'Garder V1 actif.' });
  const candidate = pending.decisions.at(-1);
  assert.ok(candidate);
  const analysis = deferred<AnalysisResult>();
  const analysing = deferred<void>();
  runtime.analyse = () => { analysing.resolve(); return analysis.promise; };
  await app.start();
  const checking = app.checkNow();
  await analysing.promise;
  await app.approve({
    id: candidate.id, title: candidate.title, description: candidate.description,
    scope: candidate.scope, dateConstraints: candidate.dateConstraints,
    sourceQuote: candidate.sourceQuote, approvedBy: 'Sam',
  });
  analysis.resolve(conflict(decisionId));
  await checking;
  app.stop();
  const restored = new CompanyBuddyApplication(directory, runtime, () => {}, () => {});
  await restored.initialize();
  assert.equal(restored.getState().decisions.find(item => item.id === candidate.id)?.approvedBy, 'Sam');
  assert.equal(restored.getState().alerts.length, 1);
  assert.equal(restored.getState().monitor.state, 'stopped');
});

test('notification failure surfaces without starving other decisions or retrying the same window', async t => {
  const delivered: string[] = [];
  const { app, runtime, directory } = await createApplication(async alert => {
    delivered.push(alert.decisionId);
    if (delivered.length === 1) throw new Error('Bannières indisponibles.');
  });
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  const first = await approveSource(app);
  const second = await approveSource(app);
  runtime.analyse = async () => ({
    status: 'conflict', frameCount: 1,
    conflicts: [...conflict(first).conflicts, ...conflict(second).conflicts],
  });
  await app.start();
  await app.checkNow();
  assert.deepEqual(delivered, [first, second]);
  assert.equal(app.getState().monitor.state, 'error');
  assert.ok(app.getState().monitor.error);
  await app.checkNow();
  assert.deepEqual(delivered, [first, second]);
  assert.equal(app.getState().alerts.length, 2);
});

test('stop suppresses an in-flight result, while a new session can notify once again', async t => {
  const notifications: ConflictAlert[] = [];
  const { app, runtime, directory } = await createApplication(alert => { notifications.push(alert); });
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  const decisionId = await approveSource(app);
  const analysis = deferred<AnalysisResult>();
  const analysing = deferred<void>();
  runtime.analyse = () => { analysing.resolve(); return analysis.promise; };
  await app.start();
  const checking = app.checkNow();
  await analysing.promise;
  app.stop();
  analysis.resolve(conflict(decisionId));
  await checking;
  assert.equal(app.getState().alerts.length, 0);
  assert.equal(notifications.length, 0);
  assert.equal(app.getState().monitor.state, 'stopped');

  runtime.analyse = async () => conflict(decisionId);
  await app.start();
  await app.checkNow();
  await app.checkNow();
  assert.equal(notifications.length, 1);
  const firstSession = notifications[0]?.sessionId;
  app.stop();
  await app.start();
  await app.checkNow();
  assert.equal(notifications.length, 2);
  assert.notEqual(notifications[1]?.sessionId, firstSession);
});

test('restarting during an old analysis checks the new session as soon as the old run finishes', { timeout: 3000 }, async t => {
  const { app, runtime, directory } = await createApplication();
  t.after(async () => { app.stop(); await rm(directory, { recursive: true, force: true }); });
  const decisionId = await approveSource(app);
  const previous = deferred<AnalysisResult>();
  const firstStarted = deferred<void>();
  const secondStarted = deferred<void>();
  let first = true;
  runtime.analyse = () => {
    if (first) {
      first = false;
      firstStarted.resolve();
      return previous.promise;
    }
    secondStarted.resolve();
    return Promise.resolve({ status: 'clear', frameCount: 1, conflicts: [] });
  };
  await app.start();
  const checking = app.checkNow();
  await firstStarted.promise;
  app.stop();
  await app.start();
  previous.resolve(conflict(decisionId));
  await checking;
  await secondStarted.promise;
  app.stop();
  assert.equal(app.getState().alerts.length, 0);
});
