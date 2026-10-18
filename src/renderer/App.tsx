import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type {
  AppSettings, AppSnapshot, ApprovalInput, ConflictAlert, Decision, MonitorStatus, SourceDocument,
} from '../shared/contracts';

type Page = 'activity' | 'decisions' | 'settings';
type IconName = Page | 'play' | 'pause' | 'refresh' | 'plus' | 'close' | 'arrow' | 'download';
type RunCommand = (key: string, command: () => Promise<AppSnapshot | void>, message?: string) => Promise<boolean>;

const pages: Array<{ id: Page; label: string }> = [
  { id: 'activity', label: 'Activité' },
  { id: 'decisions', label: 'Décisions' },
  { id: 'settings', label: 'Réglages' },
];
const iconPaths: Record<IconName, string> = {
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  decisions: 'M7 3h10l3 3v15H4V3h3m1 5h8M8 12h8m-8 4h5',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  play: 'm8 4 12 8-12 8V4Z',
  pause: 'M8 5v14M16 5v14',
  refresh: 'M20 10a8 8 0 1 0-2 8M20 4v6h-6',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
};
const monitorLabels: Record<MonitorStatus['state'], string> = {
  stopped: 'En pause', watching: 'Surveillance active', checking: 'Analyse en cours',
  no_data: 'Aucune capture disponible', clear: 'Aucun conflit détecté',
  conflict: 'Conflit possible', error: 'Analyse interrompue',
};

function Icon({ name }: { name: IconName }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

function date(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">[ · ]</span><h3>{title}</h3>{children && <div>{children}</div>}</div>;
}

function SourceContext({ source, busy, run }: { source: SourceDocument; busy: boolean; run: RunCommand }) {
  return <details className="source-context">
    <summary>{source.actions.length > 0 ? 'Source et actions' : 'Source originale'}</summary>
    <div className="details-body">
      <div className="inline-header"><span className="muted">Importée le {date(source.importedAt)}</span>
        <button className="button small" disabled={busy} onClick={() => void run('source', () => window.decisionDrift.openSource(source.id))}>Ouvrir la source <Icon name="arrow" /></button>
      </div>
      <pre className="source-text">{source.text}</pre>
      {source.actions.length > 0 && <section className="source-actions" aria-label="Actions attribuées dans la source">
        <h4>Actions attribuées <span className="muted">· contexte, non surveillées</span></h4>
        <ul>{source.actions.map((action, index) => <li key={`${index}-${action.assignee}`}><strong>{action.assignee}</strong><span>{action.task}</span></li>)}</ul>
      </section>}
    </div>
  </details>;
}

function DecisionDetails({ decision }: { decision: Decision }) {
  return <dl className="decision-meta">
    {decision.scope && <div><dt>Périmètre</dt><dd>{decision.scope}</dd></div>}
    {decision.dateConstraints && <div><dt>Dates</dt><dd>{decision.dateConstraints}</dd></div>}
    <div><dt>Approbation</dt><dd>{decision.approvedBy} · {date(decision.approvedAt)}</dd></div>
  </dl>;
}

function Candidate({ decision, source, busy, run }: { decision: Decision; source?: SourceDocument; busy: boolean; run: RunCommand }) {
  const [draft, setDraft] = useState<ApprovalInput>({
    id: decision.id, title: decision.title, description: decision.description, scope: decision.scope,
    dateConstraints: decision.dateConstraints, sourceQuote: decision.sourceQuote, approvedBy: '',
  });
  function field(name: keyof ApprovalInput, value: string) { setDraft(current => ({ ...current, [name]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(`approve-${decision.id}`, () => window.decisionDrift.approveDecision({ ...draft, approvedBy: draft.approvedBy.trim() }));
  }
  return <article className="card candidate-card">
    <div className="card-top"><span className="badge">À examiner</span><span className="muted truncate">{source?.name ?? 'Source introuvable'}</span></div>
    <form onSubmit={event => void submit(event)}><fieldset disabled={busy}>
      <label>Titre<input required value={draft.title} onChange={event => field('title', event.target.value)} /></label>
      <label>Décision<textarea required rows={3} value={draft.description} onChange={event => field('description', event.target.value)} /></label>
      <label>Passage source<textarea required rows={3} className="quote-input" value={draft.sourceQuote} onChange={event => field('sourceQuote', event.target.value)} /></label>
      <details className="review-details"><summary>Périmètre et dates</summary><div className="details-body form-grid">
        <label>Périmètre<textarea rows={3} value={draft.scope} onChange={event => field('scope', event.target.value)} /></label>
        <label>Contraintes de date<textarea rows={3} value={draft.dateConstraints} onChange={event => field('dateConstraints', event.target.value)} placeholder="Uniquement celles de la source" /></label>
      </div></details>
      <div className="approval-row"><label>Votre nom<input required value={draft.approvedBy} onChange={event => field('approvedBy', event.target.value)} autoComplete="name" /></label>
        <button className="button primary" disabled={!source || !draft.approvedBy.trim() || !draft.title.trim() || !draft.description.trim() || !draft.sourceQuote.trim()} type="submit">Approuver</button>
      </div>
    </fieldset></form>
    {source && <SourceContext source={source} busy={busy} run={run} />}
  </article>;
}

function ApprovedCard({ decision, source, busy, run }: { decision: Decision; source?: SourceDocument; busy: boolean; run: RunCommand }) {
  return <article className="card approved-card">
    <div className="card-top"><span className="badge">Approuvée</span><span className="muted truncate">{source?.name ?? 'Source introuvable'}</span></div>
    <h3>{decision.title}</h3><p className="preserve">{decision.description}</p>
    <details className="review-details"><summary>Justificatif et approbation</summary><div className="details-body"><blockquote>{decision.sourceQuote}</blockquote><DecisionDetails decision={decision} /></div></details>
    {source && <SourceContext source={source} busy={busy} run={run} />}
  </article>;
}

function Decisions({ snapshot, busy, run, notice, error }: { snapshot: AppSnapshot; busy: boolean; run: RunCommand; notice: (message: string) => void; error: string | null }) {
  const [sourceName, setSourceName] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [section, setSection] = useState<'approved' | 'candidates' | 'sources'>('approved');
  const [importOpen, setImportOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const sourceFile = useRef<HTMLInputElement>(null);
  const approvedFile = useRef<HTMLInputElement>(null);
  const approved = snapshot.decisions.filter(item => item.approvedAt && item.approvedBy);
  const candidates = snapshot.decisions.filter(item => !item.approvedAt || !item.approvedBy);

  useEffect(() => {
    if (importOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!importOpen && dialog.current?.open) dialog.current.close();
  }, [importOpen]);

  async function importSourceFile(file: File) {
    const ok = await run('import-source', async () => window.decisionDrift.importSource({ name: file.name, text: await file.text() }));
    if (ok) { setSection('candidates'); setImportOpen(false); }
  }
  async function importPortableFile(file: File) {
    const ok = await run('import-approved', async () => window.decisionDrift.importApproved({ text: await file.text() }));
    if (ok) { setSection('approved'); setImportOpen(false); }
  }
  async function importPaste(event: FormEvent) {
    event.preventDefault();
    const ok = await run('import-source', () => window.decisionDrift.importSource({ name: sourceName.trim(), text: sourceText }));
    if (ok) { setSourceName(''); setSourceText(''); setSection('candidates'); setImportOpen(false); }
  }
  return <>
    <header className="page-heading"><h1>Décisions</h1><div className="button-group">
      <button className="button" disabled={busy || approved.length === 0} onClick={() => void run('export', async () => {
        const result = await window.decisionDrift.exportApproved();
        if (result.filePath) notice(`Enregistré : ${result.filePath}`);
      })}><Icon name="download" />Exporter</button>
      <button className="button primary" disabled={busy} onClick={() => setImportOpen(true)}><Icon name="plus" />Importer</button>
    </div></header>
    <div className="section-tabs" role="group" aria-label="Vue des décisions">
      <button aria-pressed={section === 'approved'} onClick={() => setSection('approved')}>Approuvées <span>{approved.length}</span></button>
      <button aria-pressed={section === 'candidates'} onClick={() => setSection('candidates')}>À examiner <span>{candidates.length}</span></button>
      <button aria-pressed={section === 'sources'} onClick={() => setSection('sources')}>Sources <span>{snapshot.sources.length}</span></button>
    </div>
    <div hidden={section !== 'approved'}>{approved.length ? <div className="card-stack">{approved.map(decision => <ApprovedCard key={decision.id} decision={decision} source={snapshot.sources.find(source => source.id === decision.sourceId)} busy={busy} run={run} />)}</div> : <Empty title="Aucune décision approuvée"><p>Importez une source à examiner ou un fichier déjà approuvé.</p><button className="button" disabled={busy} onClick={() => setImportOpen(true)}>Importer</button></Empty>}</div>
    <div hidden={section !== 'candidates'}>{candidates.length ? <div className="card-stack">{candidates.map(decision => <Candidate key={decision.id} decision={decision} source={snapshot.sources.find(source => source.id === decision.sourceId)} busy={busy} run={run} />)}</div> : <Empty title="Aucune décision à examiner" />}</div>
    <div hidden={section !== 'sources'}>{snapshot.sources.length ? <div className="card-stack">{snapshot.sources.map(source => <article className="card source-card" key={source.id}><div className="inline-header"><h3>{source.name}</h3><span className="muted">{snapshot.decisions.filter(decision => decision.sourceId === source.id).length} décisions · {source.actions.length} actions</span></div><SourceContext source={source} busy={busy} run={run} /></article>)}</div> : <Empty title="Aucune source importée" />}</div>
    <dialog ref={dialog} className="import-dialog" aria-labelledby="import-title" onClose={() => setImportOpen(false)} onCancel={() => setImportOpen(false)}>
      <div className="dialog-heading"><h2 id="import-title">Importer</h2><button className="icon-button" aria-label="Fermer l’import" onClick={() => setImportOpen(false)}><Icon name="close" /></button></div>
      <div className="dialog-content">
        {error && <div className="feedback error-feedback" role="alert"><p>{error}</p></div>}
        <div className="import-file-row"><div><h3>Source à examiner</h3><p className="muted">JSON, Markdown ou texte. Approbation manuelle.</p></div><button className="button" disabled={busy} onClick={() => sourceFile.current?.click()}>Choisir un fichier</button></div>
        <input className="file-input" ref={sourceFile} type="file" accept=".json,.md,.markdown,.txt,text/plain,text/markdown,application/json" aria-label="Choisir une source" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importSourceFile(file);
        }} />
        <details className="paste-details"><summary>Coller des notes</summary><form onSubmit={event => void importPaste(event)}><fieldset disabled={busy}>
          <label>Nom de la source<input required value={sourceName} onChange={event => setSourceName(event.target.value)} /></label>
          <label>Notes originales<textarea required rows={6} value={sourceText} onChange={event => setSourceText(event.target.value)} /></label>
          <button className="button primary" type="submit" disabled={!sourceName.trim() || !sourceText.trim()}>Extraire les décisions</button>
        </fieldset></form></details>
        <div className="import-file-row portable-import"><div><h3>Fichier approuvé</h3><p className="muted">Export DecisionDrift, approbations conservées.</p></div><button className="button" disabled={busy} onClick={() => approvedFile.current?.click()}>Choisir un fichier</button></div>
        <input className="file-input" ref={approvedFile} type="file" accept=".json,application/json" aria-label="Choisir un fichier approuvé" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importPortableFile(file);
        }} />
        {busy && <p className="form-help" role="status">Import et extraction en cours…</p>}
      </div>
    </dialog>
  </>;
}

function AlertEvidence({ alert, snapshot, busy, run, focus, focusRequest }: { alert: ConflictAlert; snapshot: AppSnapshot; busy: boolean; run: RunCommand; focus: boolean; focusRequest: number }) {
  const focusRef = useRef<HTMLElement>(null);
  useEffect(() => { if (focus) focusRef.current?.focus(); }, [alert.id, focus, focusRequest]);
  const decision = snapshot.decisions.find(item => item.id === alert.decisionId);
  return <article className="card evidence-card" ref={focusRef} tabIndex={-1} aria-labelledby="evidence-title">
    <div className="card-top"><span className="badge amber">Conflit possible</span><span className="muted">{date(alert.capturedAt)}</span></div>
    <h2 id="evidence-title">{alert.decisionTitle}</h2>
    <section className="evidence-section"><h3>Passage observé</h3><blockquote className="observed-quote">{alert.observedText}</blockquote>
      <p className="capture-context">{alert.appName}{alert.windowName && <> · {alert.windowName}</>}</p>
      <button className="button small" disabled={busy} onClick={() => void run('capture', () => window.decisionDrift.openCapture(alert.frameId))}>Ouvrir la capture <Icon name="arrow" /></button>
    </section>
    <section className="evidence-section"><h3>Pourquoi ce rappel</h3><p className="preserve">{alert.explanation}</p></section>
    <section className="evidence-section"><h3>Décision de référence</h3><blockquote>{alert.decisionQuote}</blockquote>
      <button className="button small" disabled={busy} onClick={() => void run('source', () => window.decisionDrift.openSource(alert.sourceId))}><span className="truncate">{alert.sourceName}</span><Icon name="arrow" /></button>
      {decision && <details className="review-details"><summary>Périmètre et approbation</summary><div className="details-body"><p className="preserve">{decision.description}</p><DecisionDetails decision={decision} /></div></details>}
    </section>
  </article>;
}

function Activity({ snapshot, selectedId, select, busy, stopping, run, navigate, visible, focusRequest }: {
  snapshot: AppSnapshot; selectedId: string | null; select: (id: string) => void;
  busy: boolean; stopping: boolean; run: RunCommand; navigate: (page: Page) => void; visible: boolean; focusRequest: number;
}) {
  const { monitor, settings } = snapshot;
  const approvedCount = snapshot.decisions.filter(item => item.approvedAt && item.approvedBy).length;
  const active = monitor.sessionId !== null;
  const checking = monitor.state === 'checking';
  const sorted = [...snapshot.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = selectedId ? sorted.find(alert => alert.id === selectedId) : sorted[0];
  return <>
    <header className="page-heading"><h1>Activité</h1><span className="muted">{approvedCount} {approvedCount === 1 ? 'décision approuvée' : 'décisions approuvées'}</span></header>
    <section className={`card monitor-card state-${monitor.state}`} aria-label="Surveillance">
      <div className="monitor-main"><div className="monitor-status"><span className={`status-dot ${checking ? 'analyzing' : ''}`} aria-hidden="true" /><h2 aria-live="polite">{monitorLabels[monitor.state]}</h2></div>
        <div className="button-group">{active ? <button className="button" disabled={stopping} onClick={() => void run('stop', () => window.decisionDrift.stopMonitoring())}><Icon name="pause" />{stopping ? 'Pause…' : 'Pause'}</button> : <button className="button primary" disabled={busy || approvedCount === 0} onClick={() => void run('start', () => window.decisionDrift.startMonitoring())}><Icon name="play" />Démarrer</button>}
          <button className="button" disabled={busy || checking || !active || approvedCount === 0} onClick={() => void run('check', () => window.decisionDrift.checkNow())}><Icon name="refresh" />Vérifier</button>
        </div>
      </div>
      <div className="monitor-scope"><button className="scope-button" onClick={() => navigate('settings')}>{settings.targetApp || 'Toutes les applications'}<span> / </span>{settings.targetWindow || 'Tous les titres'}<Icon name="arrow" /></button><span className="muted">{monitor.lastCheckedAt ? `Vérifié le ${date(monitor.lastCheckedAt)}` : 'Pas encore vérifié'}</span></div>
      {monitor.error && <div className="inline-error" role="alert">{monitor.error}</div>}
      {monitor.state === 'no_data' && <p className="form-help">Aucune capture récente dans cette portée. Vérifiez Screenpipe et les filtres.</p>}
      {approvedCount === 0 && <p className="gate-note"><button className="inline-button" onClick={() => navigate('decisions')}>Ajouter des décisions approuvées</button> pour démarrer.</p>}
      <details className="monitor-details"><summary>Détails de la session</summary><div className="details-body"><dl className="monitor-stats">
        <div><dt>Début</dt><dd>{date(monitor.startedAt)}</dd></div><div><dt>Dernière analyse</dt><dd>{monitor.lastRunMs === null ? '—' : `${(monitor.lastRunMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`}</dd></div><div><dt>Captures analysées</dt><dd>{monitor.frameCount}</dd></div><div><dt>Intervalle</dt><dd>{settings.intervalSeconds} s</dd></div>
      </dl><p className="form-help">Pause arrête les analyses DecisionDrift, pas la capture Screenpipe. Un rappel par conflit et document, par session. Les extraits sont traités par le modèle du preset.</p></div></details>
    </section>
    <div className="section-heading"><h2>Alertes</h2><span className="count-label">{sorted.length}</span></div>
    {sorted.length > 0 ? <div className="alerts-layout"><nav className="alert-list" aria-label="Historique des alertes">{sorted.map(alert => <button key={alert.id} className={`alert-list-item ${selected?.id === alert.id ? 'selected' : ''}`} aria-current={selected?.id === alert.id ? 'true' : undefined} onClick={() => select(alert.id)}><span className="alert-list-date">{date(alert.capturedAt)}</span><strong>{alert.decisionTitle}</strong><span className="alert-preview">{alert.observedText}</span><span className="alert-list-window">{alert.appName}</span></button>)}</nav>
      {selected ? <AlertEvidence key={selected.id} alert={selected} snapshot={snapshot} busy={busy} run={run} focus={visible && selectedId !== null} focusRequest={focusRequest} /> : <Empty title="Alerte indisponible"><p>Sélectionnez une autre alerte ou <button className="inline-button" disabled={busy} onClick={() => void run('reload', () => window.decisionDrift.getState())}>actualisez</button>.</p></Empty>}
    </div> : <Empty title={selectedId ? 'Alerte indisponible' : 'Aucune alerte'}><p>{selectedId ? 'Le rappel demandé ne figure pas dans l’historique chargé.' : 'Les conflits possibles apparaîtront ici avec leurs preuves.'}</p>{selectedId && <button className="button" disabled={busy} onClick={() => void run('reload', () => window.decisionDrift.getState())}>Actualiser</button>}</Empty>}
  </>;
}

function Settings({ snapshot, busy, run }: { snapshot: AppSnapshot; busy: boolean; run: RunCommand }) {
  const [draft, setDraft] = useState<AppSettings>(snapshot.settings);
  const [interval, setInterval] = useState(String(snapshot.settings.intervalSeconds));
  const [baseline, setBaseline] = useState(JSON.stringify(snapshot.settings));
  const field = (name: keyof AppSettings, value: string) => setDraft(current => ({ ...current, [name]: value }));
  const validInterval = Number.isInteger(Number(interval)) && Number(interval) >= 15 && Number(interval) <= 3600;
  const dirty = JSON.stringify({ ...draft, intervalSeconds: Number(interval) }) !== JSON.stringify(snapshot.settings);
  const externalChange = baseline !== JSON.stringify(snapshot.settings);
  const selectedMissing = draft.presetId && !snapshot.connection.presets.some(preset => preset.id === draft.presetId);
  function reset() { setDraft(snapshot.settings); setInterval(String(snapshot.settings.intervalSeconds)); setBaseline(JSON.stringify(snapshot.settings)); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!validInterval) return;
    const settings: AppSettings = { ...draft, apiUrl: draft.apiUrl.trim(), cliPath: draft.cliPath.trim(), targetApp: draft.targetApp.trim(), targetWindow: draft.targetWindow.trim(), intervalSeconds: Number(interval) };
    const ok = await run('settings', () => window.decisionDrift.saveSettings(settings));
    if (ok) { setDraft(settings); setInterval(String(settings.intervalSeconds)); setBaseline(JSON.stringify(settings)); }
  }
  return <>
    <header className="page-heading"><h1>Réglages</h1></header>
    <div className="settings-layout"><form className="card settings-form" onSubmit={event => void save(event)}><fieldset disabled={busy}>
      <h2>Screenpipe</h2>
      <label>API locale<input type="url" required value={draft.apiUrl} onChange={event => field('apiUrl', event.target.value)} spellCheck={false} /></label>
      <label>Preset<select required value={draft.presetId} onChange={event => field('presetId', event.target.value)}><option value="">Choisir un preset</option>{selectedMissing && <option value={draft.presetId}>{draft.presetId} — à vérifier</option>}{snapshot.connection.presets.map(preset => <option value={preset.id} key={preset.id}>{preset.name} · {preset.model}</option>)}</select></label>
      <p className="form-help">Modèle et identifiants se règlent dans Screenpipe.</p>
      <div className="form-divider" /><h2>Surveillance</h2>
      <p className="form-help scope-help">Sans filtre : toutes les applications capturées et tous les titres, hors DecisionDrift.</p>
      <div className="form-grid"><label>Application <span className="optional">facultatif</span><input value={draft.targetApp} onChange={event => field('targetApp', event.target.value)} placeholder="Toutes les applications" /></label><label>Titre contenant <span className="optional">facultatif</span><input value={draft.targetWindow} onChange={event => field('targetWindow', event.target.value)} placeholder="Tous les titres" /></label></div>
      <label className="interval-field">Intervalle (secondes)<input type="number" required min={15} max={3600} step={1} value={interval} onChange={event => setInterval(event.target.value)} inputMode="numeric" /></label>
      <details className="review-details"><summary>Avancé</summary><div className="details-body"><label>Chemin du CLI <span className="optional">facultatif</span><input value={draft.cliPath} onChange={event => field('cliPath', event.target.value)} spellCheck={false} placeholder="Détection automatique" /></label></div></details>
      {externalChange && <p className="form-help">Les réglages enregistrés ont changé. Votre saisie est conservée.</p>}
      <div className="settings-actions"><button className="button primary" type="submit" disabled={!validInterval || !dirty}>Enregistrer</button><button className="button" type="button" disabled={!dirty && !externalChange} onClick={reset}>Annuler</button><span className="muted">{dirty ? 'Non enregistré' : 'Enregistré'}</span></div>
    </fieldset></form>
      <aside className="card connection-card"><div className="inline-header"><h2>Connexion</h2><span className="status-dot" aria-hidden="true" /></div>
        <dl className="connection-summary"><div><dt>API</dt><dd>{snapshot.connection.reachable ? 'Joignable' : 'Non joignable ou non vérifiée'}</dd></div><div><dt>Capture</dt><dd>{snapshot.connection.captureStatus || 'Non vérifiée'}</dd></div></dl>
        {snapshot.connection.error && <div className="inline-error" role="alert">{snapshot.connection.error}</div>}
        <div className="connection-actions"><button className="button" disabled={busy || dirty} onClick={() => void run('connection', () => window.decisionDrift.checkConnection())}><Icon name="refresh" />Vérifier la connexion</button><button className="button" disabled={busy} onClick={() => void run('notification', () => window.decisionDrift.testNotification(), 'Notification de test envoyée à macOS.')}>Tester la notification</button></div>
        {dirty && <p className="form-help">Enregistrez avant de vérifier la connexion.</p>}
        <details className="review-details"><summary>Diagnostic</summary><div className="details-body"><dl className="connection-summary"><div><dt>CLI</dt><dd className="path-text">{snapshot.connection.cliPath || 'Non détecté'}</dd></div><div><dt>Presets disponibles</dt><dd>{snapshot.connection.presets.length}</dd></div></dl></div></details>
      </aside>
    </div>
  </>;
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [page, setPage] = useState<Page>('activity');
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [alertFocusRequest, setAlertFocusRequest] = useState(0);
  const stateEvents = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    let loadSequence = 0;
    if (!window.decisionDrift) {
      setError('Ouvrez DecisionDrift depuis son application de bureau.');
      return () => { mounted.current = false; };
    }
    const refresh = () => {
      const version = stateEvents.current;
      const request = ++loadSequence;
      void window.decisionDrift.getState().then(next => {
        if (alive && request === loadSequence && version === stateEvents.current) setSnapshot(next);
      }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : String(cause)); });
    };
    const unsubscribeState = window.decisionDrift.onState(next => {
      stateEvents.current += 1;
      if (alive) setSnapshot(next);
    });
    const unsubscribeAlert = window.decisionDrift.onOpenAlert(id => {
      if (!alive) return;
      document.querySelector<HTMLDialogElement>('dialog[open]')?.close();
      setSelectedAlert(id);
      setAlertFocusRequest(current => current + 1);
      setPage('activity');
      refresh();
    });
    refresh();
    return () => { alive = false; mounted.current = false; unsubscribeState(); unsubscribeAlert(); };
  }, []);

  const run: RunCommand = async (key, command, success) => {
    if (busyRef.current.has(key) || (busyRef.current.size > 0 && key !== 'stop')) return false;
    busyRef.current.add(key);
    const version = stateEvents.current;
    setBusy(key); setError(null); setMessage(null);
    try {
      const next = await command();
      if (mounted.current) { if (next && version === stateEvents.current) setSnapshot(next); if (success) setMessage(success); }
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      busyRef.current.delete(key);
      if (mounted.current) setBusy(Array.from(busyRef.current).pop() ?? null);
    }
  };
  const analyzing = snapshot?.monitor.state === 'checking';
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <div className="window-chrome" aria-hidden="true" />
    <aside className="sidebar"><div className="brand"><span className="brand-mark" aria-hidden="true">d<span>d</span></span><strong>DecisionDrift</strong></div>
      <nav className="main-nav" aria-label="Navigation principale">{pages.map(item => <button key={item.id} aria-current={page === item.id ? 'page' : undefined} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><Icon name={item.id} /><span>{item.label}</span>{item.id === 'activity' && Boolean(snapshot?.alerts.length) && <span className="nav-count">{snapshot?.alerts.length}</span>}</button>)}</nav>
      <div className="sidebar-footer"><span className={`status-dot ${analyzing ? 'analyzing' : ''}`} /><span>{snapshot ? monitorLabels[snapshot.monitor.state] : 'Chargement…'}</span></div>
    </aside>
    <main className="main-content" id="main-content" tabIndex={-1}><div className="workspace">
      {error && <div className="feedback error-feedback" role="alert"><p>{error}</p><button className="icon-button" aria-label="Fermer l’erreur" onClick={() => setError(null)}><Icon name="close" /></button></div>}
      {message && <div className="feedback" role="status"><p>{message}</p><button className="icon-button" aria-label="Fermer le message" onClick={() => setMessage(null)}><Icon name="close" /></button></div>}
      {busy && <div className="working-feedback" role="status">{busy === 'import-source' ? 'Extraction en cours…' : busy === 'connection' ? 'Vérification de Screenpipe…' : busy === 'stop' ? 'Mise en pause…' : 'En cours…'}</div>}
      {!snapshot ? <Empty title={error ? 'Chargement impossible' : 'Ouverture…'}>{error && window.decisionDrift && <button className="button" disabled={busy !== null} onClick={() => void run('reload', () => window.decisionDrift.getState())}>Réessayer</button>}</Empty> : <>
        <section hidden={page !== 'activity'} aria-label="Activité"><Activity snapshot={snapshot} selectedId={selectedAlert} select={setSelectedAlert} busy={busy !== null} stopping={busy === 'stop'} run={run} navigate={setPage} visible={page === 'activity'} focusRequest={alertFocusRequest} /></section>
        <section hidden={page !== 'decisions'} aria-label="Décisions"><Decisions snapshot={snapshot} busy={busy !== null} run={run} notice={setMessage} error={error} /></section>
        <section hidden={page !== 'settings'} aria-label="Réglages"><Settings snapshot={snapshot} busy={busy !== null} run={run} /></section>
      </>}
    </div></main>
  </div>;
}
