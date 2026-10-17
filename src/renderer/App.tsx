import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type {
  AppSettings, AppSnapshot, ApprovalInput, ConflictAlert, Decision, MonitorStatus, SourceDocument,
} from '../shared/contracts';

type Page = 'decisions' | 'monitor' | 'alerts' | 'settings';
type RunCommand = (key: string, command: () => Promise<AppSnapshot | void>, message?: string) => Promise<boolean>;

const pages: Array<{ id: Page; label: string; hint: string }> = [
  { id: 'decisions', label: 'Décisions', hint: 'Sources et approbations' },
  { id: 'monitor', label: 'Surveillance', hint: 'Votre session de travail' },
  { id: 'alerts', label: 'Alertes', hint: 'Conflits possibles' },
  { id: 'settings', label: 'Réglages', hint: 'Connexion et capture' },
];
const monitorLabels: Record<MonitorStatus['state'], string> = {
  stopped: 'À l’arrêt', watching: 'Surveillance active', checking: 'Analyse en cours',
  no_data: 'Aucune capture correspondante', clear: 'Aucun conflit détecté',
  conflict: 'Conflit possible détecté', error: 'Erreur de surveillance',
};

function date(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">—</span><h3>{title}</h3><div>{children}</div></div>;
}

function SourceContext({ source, busy, run }: { source: SourceDocument; busy: boolean; run: RunCommand }) {
  return <details className="source-context">
    <summary>Source : {source.name}</summary>
    <div className="source-body">
      <div className="inline-header"><span className="muted">Importée le {date(source.importedAt)}</span>
        <button className="button small secondary" disabled={busy} onClick={() => void run('source', () => window.companyBuddy.openSource(source.id))}>Ouvrir la source</button>
      </div>
      <pre className="source-text">{source.text}</pre>
      {source.actions.length > 0 && <section className="source-actions" aria-label="Actions attribuées dans la source">
        <h4>Actions attribuées — contexte de la source</h4>
        <p className="muted">Ces actions ne sont pas des décisions à surveiller.</p>
        <ul>{source.actions.map((action, index) => <li key={`${index}-${action.assignee}`}><strong>{action.assignee}</strong><span>{action.task}</span></li>)}</ul>
      </section>}
    </div>
  </details>;
}

function Candidate({ decision, source, busy, run }: { decision: Decision; source?: SourceDocument; busy: boolean; run: RunCommand }) {
  const [draft, setDraft] = useState<ApprovalInput>({
    id: decision.id, title: decision.title, description: decision.description, scope: decision.scope,
    dateConstraints: decision.dateConstraints, sourceQuote: decision.sourceQuote, approvedBy: '',
  });
  function field(name: keyof ApprovalInput, value: string) { setDraft(current => ({ ...current, [name]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(`approve-${decision.id}`, () => window.companyBuddy.approveDecision({ ...draft, approvedBy: draft.approvedBy.trim() }), 'Décision approuvée. Elle peut maintenant être partagée et utilisée pour la surveillance.');
  }
  return <article className="card candidate-card">
    <div className="card-top"><span className="badge amber">À examiner</span><span className="muted">{source?.name ?? 'Source introuvable'}</span></div>
    <form onSubmit={event => void submit(event)}>
      <fieldset disabled={busy}>
        <label>Titre de la décision<input required value={draft.title} onChange={event => field('title', event.target.value)} /></label>
        <label>Décision<textarea required rows={3} value={draft.description} onChange={event => field('description', event.target.value)} /></label>
        <div className="form-grid">
          <label>Périmètre d’application<textarea rows={3} value={draft.scope} onChange={event => field('scope', event.target.value)} /></label>
          <label>Contraintes de date<textarea rows={3} value={draft.dateConstraints} onChange={event => field('dateConstraints', event.target.value)} placeholder="Uniquement les dates indiquées par la source" /></label>
        </div>
        <label>Passage justificatif de la source<textarea required rows={3} className="quote-input" value={draft.sourceQuote} onChange={event => field('sourceQuote', event.target.value)} /></label>
        <div className="approval-row"><label>Personne qui approuve<input required value={draft.approvedBy} onChange={event => field('approvedBy', event.target.value)} placeholder="Prénom et nom" autoComplete="name" /></label>
          <button className="button primary" disabled={!draft.approvedBy.trim() || !draft.title.trim() || !draft.description.trim() || !draft.sourceQuote.trim()} type="submit">Approuver cette décision</button>
        </div>
        <p className="form-help">Cette approbation est explicite. Les noms cités dans la source ne constituent pas une approbation dans CompanyBuddy.</p>
      </fieldset>
    </form>
    {source && <SourceContext source={source} busy={busy} run={run} />}
  </article>;
}

function ApprovedCard({ decision, source, busy, run }: { decision: Decision; source?: SourceDocument; busy: boolean; run: RunCommand }) {
  return <article className="card approved-card">
    <div className="card-top"><span className="badge green">Approuvée</span><span className="muted">{source?.name ?? 'Source introuvable'}</span></div>
    <h3>{decision.title}</h3><p className="preserve">{decision.description}</p>
    <dl className="decision-meta"><div><dt>Périmètre</dt><dd>{decision.scope || 'Non précisé dans la source'}</dd></div><div><dt>Contraintes de date</dt><dd>{decision.dateConstraints || 'Non précisées dans la source'}</dd></div></dl>
    <blockquote>{decision.sourceQuote}</blockquote>
    <p className="approval-stamp">Approuvée par <strong>{decision.approvedBy}</strong> · {date(decision.approvedAt)}</p>
    {source && <SourceContext source={source} busy={busy} run={run} />}
  </article>;
}

function Decisions({ snapshot, busy, run, notice }: { snapshot: AppSnapshot; busy: boolean; run: RunCommand; notice: (message: string) => void }) {
  const [sourceName, setSourceName] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [section, setSection] = useState<'approved' | 'candidates' | 'sources'>('approved');
  const sourceFile = useRef<HTMLInputElement>(null);
  const approvedFile = useRef<HTMLInputElement>(null);
  const approved = snapshot.decisions.filter(item => item.approvedAt && item.approvedBy);
  const candidates = snapshot.decisions.filter(item => !item.approvedAt || !item.approvedBy);
  async function importSourceFile(file: File) {
    const ok = await run('import-source', async () => window.companyBuddy.importSource({ name: file.name, text: await file.text() }), 'Source importée. Examinez les décisions candidates avant de les approuver.');
    if (ok) setSection('candidates');
  }
  async function importPortableFile(file: File) {
    const ok = await run('import-approved', async () => window.companyBuddy.importApproved({ text: await file.text() }), 'Fichier approuvé importé. Les approbations et leurs sources sont conservées.');
    if (ok) setSection('approved');
  }
  async function importPaste(event: FormEvent) {
    event.preventDefault();
    const ok = await run('import-source', () => window.companyBuddy.importSource({ name: sourceName.trim(), text: sourceText }), 'Source importée. Examinez les décisions candidates avant de les approuver.');
    if (ok) { setSourceName(''); setSourceText(''); setSection('candidates'); }
  }
  return <>
    <header className="page-heading"><div><p className="eyebrow">Le contexte, avant les rappels</p><h1>Le carnet de décisions</h1><p>Une source, une revue humaine, puis des décisions prêtes à partager.</p></div>
      <button className="button primary" disabled={busy || approved.length === 0} onClick={() => void run('export', async () => {
        const result = await window.companyBuddy.exportApproved();
        if (result.filePath) notice(`Fichier approuvé enregistré : ${result.filePath}`);
      })}>Exporter les décisions approuvées</button>
    </header>
    <div className="import-grid">
      <section className="card import-card"><span className="step-label">01 · Responsable des décisions</span><h2>Importer une source</h2>
        <p className="muted">Compte rendu JSON, Markdown ou texte. L’extraction utilise le modèle configuré dans Screenpipe.</p>
        <input className="file-input" ref={sourceFile} type="file" accept=".json,.md,.markdown,.txt,text/plain,text/markdown,application/json" aria-label="Choisir une source JSON, Markdown ou texte" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importSourceFile(file);
        }} />
        <button className="button secondary" disabled={busy} onClick={() => sourceFile.current?.click()}>Choisir un fichier source</button>
        <details className="paste-details"><summary>Ou coller des notes</summary><form onSubmit={event => void importPaste(event)}><fieldset disabled={busy}>
          <label>Nom de la source<input required value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Nom du compte rendu" /></label>
          <label>Texte de la source<textarea required rows={5} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Collez ici le contenu original…" /></label>
          <button className="button primary" type="submit" disabled={!sourceName.trim() || !sourceText.trim()}>Extraire les décisions candidates</button>
        </fieldset></form></details>
      </section>
      <section className="card import-card portable-card"><span className="step-label">02 · Destinataire du carnet</span><h2>Recevoir des décisions approuvées</h2>
        <p className="muted">Importez le fichier JSON exporté par le responsable. Il contient les décisions, les approbations et les passages sources.</p>
        <input className="file-input" ref={approvedFile} type="file" accept=".json,application/json" aria-label="Choisir un fichier de décisions approuvées" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importPortableFile(file);
        }} />
        <button className="button secondary" disabled={busy} onClick={() => approvedFile.current?.click()}>Importer un fichier approuvé</button>
        <p className="form-help">Un compte rendu brut n’est pas un fichier approuvé. Utilisez l’import de source à gauche pour le faire examiner.</p>
      </section>
    </div>
    <div className="section-tabs" role="group" aria-label="Vue du carnet">
      <button aria-pressed={section === 'approved'} onClick={() => setSection('approved')}>Approuvées <span>{approved.length}</span></button>
      <button aria-pressed={section === 'candidates'} onClick={() => setSection('candidates')}>À examiner <span>{candidates.length}</span></button>
      <button aria-pressed={section === 'sources'} onClick={() => setSection('sources')}>Sources et actions <span>{snapshot.sources.length}</span></button>
    </div>
    {section === 'approved' && (approved.length ? <div className="card-stack">{approved.map(decision => <ApprovedCard key={decision.id} decision={decision} source={snapshot.sources.find(source => source.id === decision.sourceId)} busy={busy} run={run} />)}</div> : <Empty title="Aucune décision approuvée pour le moment"><p>Importez une source et approuvez ses décisions, ou recevez un fichier déjà approuvé.</p><p>Pour la démonstration, choisissez manuellement <code>examples/scenario1.json</code> comme fichier source.</p></Empty>)}
    {section === 'candidates' && (candidates.length ? <><p className="section-note">Relisez le passage original et corrigez le périmètre ou les dates si nécessaire. Seules les décisions approuvées seront surveillées.</p><div className="card-stack">{candidates.map(decision => <Candidate key={decision.id} decision={decision} source={snapshot.sources.find(source => source.id === decision.sourceId)} busy={busy} run={run} />)}</div></> : <Empty title="Aucune décision en attente"><p>Importez un compte rendu pour extraire de nouvelles décisions candidates.</p></Empty>)}
    {section === 'sources' && (snapshot.sources.length ? <div className="card-stack">{snapshot.sources.map(source => <article className="card" key={source.id}><h3>{source.name}</h3><p className="muted">{snapshot.decisions.filter(decision => decision.sourceId === source.id).length} décision(s) · {source.actions.length} action(s) attribuée(s)</p><SourceContext source={source} busy={busy} run={run} /></article>)}</div> : <Empty title="Vos sources restent accessibles ici"><p>Les textes originaux et les actions attribuées sont conservés séparément des décisions.</p></Empty>)}
  </>;
}

function Monitor({ snapshot, busy, stopping, run, navigate }: { snapshot: AppSnapshot; busy: boolean; stopping: boolean; run: RunCommand; navigate: (page: Page) => void }) {
  const { monitor, settings } = snapshot;
  const approvedCount = snapshot.decisions.filter(item => item.approvedAt && item.approvedBy).length;
  const active = monitor.sessionId !== null;
  const checking = monitor.state === 'checking';
  return <>
    <header className="page-heading"><div><p className="eyebrow">Vous gardez la main</p><h1>Surveiller votre travail</h1><p>Repérer un conflit possible avec une décision, sans interrompre le reste.</p></div><span className={`status-pill ${active ? 'live' : ''}`}><span className="status-dot" />{active ? 'Session active' : 'Session arrêtée'}</span></header>
    <section className={`card monitor-card state-${monitor.state}`}>
      <div className="monitor-status"><span className={`status-symbol ${checking ? 'spinning' : ''}`} aria-hidden="true">{checking ? '◌' : monitor.state === 'conflict' ? '!' : '·'}</span><div><p className="eyebrow">État réel de l’analyse</p><h2 aria-live="polite">{monitorLabels[monitor.state]}</h2><p className="muted">{monitor.state === 'stopped' ? 'Démarrez une session lorsque vous êtes prêt.' : monitor.state === 'no_data' ? 'Aucune image récente ne correspond à l’application et au titre configurés. Vérifiez votre éditeur et Screenpipe.' : monitor.state === 'clear' ? 'Les captures analysées n’indiquent pas de conflit avec les décisions approuvées.' : monitor.state === 'checking' ? 'Screenpipe analyse les captures correspondantes avec le preset choisi.' : monitor.state === 'conflict' ? 'Consultez les passages observés et leur source dans les alertes.' : monitor.state === 'error' ? 'La surveillance a rencontré une erreur. Consultez le détail ci-dessous et vos réglages.' : 'Les vérifications suivantes sont gérées en arrière-plan par CompanyBuddy.'}</p></div></div>
      {monitor.error && <div className="inline-error" role="alert">{monitor.error}</div>}
      <div className="monitor-controls"><button className="button primary" disabled={busy || active || approvedCount === 0} onClick={() => void run('start', () => window.companyBuddy.startMonitoring())}>Démarrer la surveillance</button><button className="button secondary" disabled={stopping || !active} onClick={() => void run('stop', () => window.companyBuddy.stopMonitoring())}>Arrêter la surveillance</button><button className="button secondary" disabled={busy || checking || !active || approvedCount === 0} onClick={() => void run('check', () => window.companyBuddy.checkNow())}>Vérifier maintenant</button>{monitor.state === 'conflict' && <button className="button text-button" onClick={() => navigate('alerts')}>Voir les preuves →</button>}</div>
      {approvedCount === 0 && <p className="gate-note">Importez ou approuvez au moins une décision avant de lancer une analyse. <button className="inline-button" onClick={() => navigate('decisions')}>Ouvrir le carnet</button></p>}
      <dl className="monitor-stats"><div><dt>Dernière vérification</dt><dd>{date(monitor.lastCheckedAt)}</dd></div><div><dt>Durée de la dernière analyse</dt><dd>{monitor.lastRunMs === null ? '—' : `${(monitor.lastRunMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`}</dd></div><div><dt>Images de la dernière analyse</dt><dd>{monitor.frameCount}</dd></div><div><dt>Début de session</dt><dd>{date(monitor.startedAt)}</dd></div></dl>
    </section>
    <div className="monitor-bottom-grid"><section className="card"><div className="inline-header"><h2>Le contexte observé</h2><button className="button small secondary" onClick={() => navigate('settings')}>Modifier</button></div><dl className="settings-summary"><div><dt>Application</dt><dd>{settings.targetApp || 'Non configurée'}</dd></div><div><dt>Titre de fenêtre contenant</dt><dd>{settings.targetWindow || 'Non configuré'}</dd></div><div><dt>Intervalle</dt><dd>{settings.intervalSeconds} secondes</dd></div><div><dt>Décisions approuvées</dt><dd>{approvedCount}</dd></div><div><dt>Preset Screenpipe</dt><dd>{snapshot.connection.presets.find(preset => preset.id === settings.presetId)?.name ?? (settings.presetId || 'Non configuré')}</dd></div></dl></section>
      <section className="card privacy-note"><span className="step-label">Une surveillance que vous contrôlez</span><h2>Un rappel, pas un jugement</h2><p>Les alertes sont privées à cette installation. Aucun tableau de suivi destiné à un responsable, aucune modification automatique de vos documents.</p><p>Un même conflit sur un document ne déclenche qu’une notification par session. Une nouvelle session permet de nouveaux rappels.</p><p><strong>Arrêter CompanyBuddy ne coupe pas la capture indépendante de Screenpipe.</strong> Pour arrêter l’enregistrement, utilisez les commandes de Screenpipe.</p><p className="muted">Les extraits sont traités par le modèle externe du preset configuré.</p></section></div>
  </>;
}

function AlertEvidence({ alert, snapshot, busy, run }: { alert: ConflictAlert; snapshot: AppSnapshot; busy: boolean; run: RunCommand }) {
  const focusRef = useRef<HTMLElement>(null);
  useEffect(() => { focusRef.current?.focus(); }, [alert.id]);
  const decision = snapshot.decisions.find(item => item.id === alert.decisionId);
  return <article className="card evidence-card" ref={focusRef} tabIndex={-1} aria-labelledby="evidence-title">
    <div className="card-top"><span className="badge amber">Conflit possible</span><span className="muted">{date(alert.createdAt)}</span></div>
    <h2 id="evidence-title">{alert.decisionTitle}</h2><p className="evidence-intro">Une indication à examiner dans son contexte, pas une conclusion de non-respect.</p>
    <section className="evidence-section"><h3>Ce qui a été observé</h3><blockquote className="observed-quote">{alert.observedText}</blockquote><dl className="evidence-meta"><div><dt>Application</dt><dd>{alert.appName}</dd></div><div><dt>Fenêtre</dt><dd>{alert.windowName}</dd></div><div><dt>Capture</dt><dd>{date(alert.capturedAt)}</dd></div><div><dt>Image Screenpipe</dt><dd>#{alert.frameId}</dd></div></dl><button className="button secondary" disabled={busy} onClick={() => void run('capture', () => window.companyBuddy.openCapture(alert.frameId))}>Ouvrir la capture originale</button></section>
    <section className="evidence-section"><h3>Pourquoi ce rapprochement ?</h3><p className="preserve">{alert.explanation}</p></section>
    <section className="evidence-section"><h3>Le passage de référence</h3><p className="source-name">{alert.sourceName}</p><blockquote>{alert.decisionQuote}</blockquote>{decision && <><p className="preserve">{decision.description}</p><dl className="decision-meta"><div><dt>Périmètre</dt><dd>{decision.scope || 'Non précisé dans la source'}</dd></div><div><dt>Contraintes de date</dt><dd>{decision.dateConstraints || 'Non précisées dans la source'}</dd></div></dl><p className="approval-stamp">Approuvée par {decision.approvedBy} · {date(decision.approvedAt)}</p></>}<button className="button secondary" disabled={busy} onClick={() => void run('source', () => window.companyBuddy.openSource(alert.sourceId))}>Ouvrir la source</button></section>
  </article>;
}

function Alerts({ snapshot, selectedId, select, busy, run }: { snapshot: AppSnapshot; selectedId: string | null; select: (id: string) => void; busy: boolean; run: RunCommand }) {
  const sorted = [...snapshot.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = selectedId ? sorted.find(alert => alert.id === selectedId) : sorted[0];
  return <><header className="page-heading"><div><p className="eyebrow">Des preuves, pas des suppositions</p><h1>Vos alertes expliquées</h1><p>Le passage observé, la décision concernée et son contexte d’origine.</p></div><span className="count-label">{snapshot.alerts.length} alerte(s) conservée(s)</span></header>
    {sorted.length > 0 ? <div className="alerts-layout"><nav className="alert-list" aria-label="Historique des alertes">{sorted.map(alert => <button key={alert.id} className={`alert-list-item ${selected?.id === alert.id ? 'selected' : ''}`} aria-current={selected?.id === alert.id ? 'true' : undefined} onClick={() => select(alert.id)}><span className="alert-list-date">{date(alert.capturedAt)}</span><strong>{alert.decisionTitle}</strong><span className="alert-preview">{alert.observedText}</span><span className="alert-list-window">{alert.appName} · {alert.windowName}</span></button>)}</nav>{selected ? <AlertEvidence key={selected.id} alert={selected} snapshot={snapshot} busy={busy} run={run} /> : <Empty title="Cette alerte n’est pas disponible"><p>Le rappel demandé ne figure pas encore dans le carnet local. Sélectionnez une autre alerte dans la liste.</p></Empty>}</div> : <Empty title={selectedId ? 'Le rappel demandé n’est pas encore disponible' : 'Aucune alerte pour le moment'}><p>Les rappels apparaissent uniquement lorsqu’une analyse réelle identifie un conflit possible.</p><p>Démarrez une session dans Surveillance. Un clic sur la notification ouvre directement les preuves ici.</p></Empty>}
  </>;
}

function Settings({ snapshot, busy, run }: { snapshot: AppSnapshot; busy: boolean; run: RunCommand }) {
  const [draft, setDraft] = useState<AppSettings>(snapshot.settings);
  const [interval, setInterval] = useState(String(snapshot.settings.intervalSeconds));
  const settingsKey = JSON.stringify(snapshot.settings);
  useEffect(() => { setDraft(snapshot.settings); setInterval(String(snapshot.settings.intervalSeconds)); }, [settingsKey]);
  const field = (name: keyof AppSettings, value: string) => setDraft(current => ({ ...current, [name]: value }));
  const validInterval = Number.isInteger(Number(interval)) && Number(interval) >= 15 && Number(interval) <= 3600;
  const dirty = JSON.stringify({ ...draft, intervalSeconds: Number(interval) }) !== settingsKey;
  const selectedMissing = draft.presetId && !snapshot.connection.presets.some(preset => preset.id === draft.presetId);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!validInterval) return;
    await run('settings', () => window.companyBuddy.saveSettings({ ...draft, apiUrl: draft.apiUrl.trim(), cliPath: draft.cliPath.trim(), targetApp: draft.targetApp.trim(), targetWindow: draft.targetWindow.trim(), intervalSeconds: Number(interval) }), 'Réglages enregistrés.');
  }
  return <><header className="page-heading"><div><p className="eyebrow">Votre environnement local</p><h1>Réglages</h1><p>Connecter Screenpipe et choisir précisément la fenêtre à observer.</p></div></header>
    <div className="settings-layout"><form className="card settings-form" onSubmit={event => void save(event)}><fieldset disabled={busy}><h2>Connexion Screenpipe</h2><label>URL de l’API locale<input type="url" required value={draft.apiUrl} onChange={event => field('apiUrl', event.target.value)} spellCheck={false} placeholder="http://localhost:3030" /></label><label>Chemin du CLI Screenpipe (facultatif)<input value={draft.cliPath} onChange={event => field('cliPath', event.target.value)} spellCheck={false} placeholder="Détection automatique si ce champ est vide" /></label>
      <label>Preset du modèle<select required value={draft.presetId} onChange={event => field('presetId', event.target.value)}><option value="">Choisir un preset Screenpipe</option>{selectedMissing && <option value={draft.presetId}>{draft.presetId} — à vérifier</option>}{snapshot.connection.presets.map(preset => <option value={preset.id} key={preset.id}>{preset.name} · {preset.model}</option>)}</select></label><p className="form-help">Les presets proviennent de Screenpipe. Configurez le modèle et ses identifiants dans Screenpipe, jamais ici.</p>
      <div className="form-divider" /><h2>Fenêtre de travail</h2><label>Application cible<input required value={draft.targetApp} onChange={event => field('targetApp', event.target.value)} placeholder="TextEdit" /></label><label>Le titre de la fenêtre contient<input required value={draft.targetWindow} onChange={event => field('targetWindow', event.target.value)} placeholder="plan-migration" /></label><p className="form-help">Pour la démonstration locale, ouvrez un fichier dont le nom contient « plan-migration » dans TextEdit. Seules les captures correspondant à ces filtres sont analysées.</p><label>Intervalle entre les vérifications (secondes)<input type="number" required min={15} max={3600} step={1} value={interval} onChange={event => setInterval(event.target.value)} inputMode="numeric" /></label>
      <div className="settings-actions"><button className="button primary" type="submit" disabled={!validInterval || !dirty}>Enregistrer les réglages</button><span className="muted">{dirty ? 'Modifications non enregistrées' : 'Réglages enregistrés'}</span></div></fieldset></form>
      <aside className="card connection-card"><div className="inline-header"><h2>État de la connexion</h2><span className={`status-dot ${snapshot.connection.reachable ? 'connected' : 'disconnected'}`} aria-label={snapshot.connection.reachable ? 'API joignable' : 'API non joignable'} /></div><dl className="settings-summary"><div><dt>API Screenpipe</dt><dd>{snapshot.connection.reachable ? 'Joignable' : 'Non joignable ou non vérifiée'}</dd></div><div><dt>Capture Screenpipe</dt><dd>{snapshot.connection.captureStatus || 'Non vérifiée'}</dd></div><div><dt>CLI détecté</dt><dd className="path-text">{snapshot.connection.cliPath || 'Non détecté'}</dd></div><div><dt>Presets disponibles</dt><dd>{snapshot.connection.presets.length}</dd></div></dl>{snapshot.connection.error && <div className="inline-error" role="alert">{snapshot.connection.error}</div>}<button className="button secondary" disabled={busy || dirty} onClick={() => void run('connection', () => window.companyBuddy.checkConnection(), 'Vérification de la connexion terminée.')}>Vérifier la connexion</button><p className="form-help">{dirty ? 'Enregistrez les modifications avant de vérifier la connexion.' : 'La vérification utilise les réglages enregistrés et actualise la liste des presets.'}</p><div className="form-divider" /><h3>Avant de démarrer</h3><ol className="setup-list"><li>Lancez Screenpipe et autorisez la capture d’écran.</li><li>Vérifiez votre preset et sa connexion au modèle.</li><li>Ouvrez votre document dans l’application cible.</li><li>Importez des décisions approuvées, puis démarrez la surveillance.</li></ol><p className="muted">Les analyses utilisent un modèle externe. Aucun jeton ni clé n’est affiché dans CompanyBuddy.</p></aside>
    </div></>;
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [page, setPage] = useState<Page>('decisions');
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const stateEvents = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    if (!window.companyBuddy) {
      setError('La connexion à l’application de bureau est indisponible. Ouvrez CompanyBuddy depuis son application Electron.');
      return () => { mounted.current = false; };
    }
    const unsubscribeState = window.companyBuddy.onState(next => {
      stateEvents.current += 1;
      if (alive) setSnapshot(next);
    });
    const unsubscribeAlert = window.companyBuddy.onOpenAlert(id => {
      if (alive) { setSelectedAlert(id); setPage('alerts'); }
    });
    const version = stateEvents.current;
    window.companyBuddy.getState().then(next => {
      if (alive && version === stateEvents.current) setSnapshot(next);
    }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : String(cause)); });
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
  const approvedCount = snapshot?.decisions.filter(item => item.approvedAt && item.approvedBy).length ?? 0;
  const active = Boolean(snapshot?.monitor.sessionId);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark" aria-hidden="true">cb<span>·</span></span><div><strong>CompanyBuddy</strong><span>Le bon contexte, au bon moment.</span></div></div><p className="sidebar-label">VOTRE ESPACE LOCAL</p><nav className="main-nav" aria-label="Navigation principale">{pages.map((item, index) => <button key={item.id} aria-current={page === item.id ? 'page' : undefined} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><span className="nav-number" aria-hidden="true">0{index + 1}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span>{item.id === 'alerts' && Boolean(snapshot?.alerts.length) && <span className="nav-count">{snapshot?.alerts.length}</span>}</button>)}</nav><div className="sidebar-footer"><span className={`status-dot ${active ? 'connected' : ''}`} /><strong>{active ? 'Surveillance active' : 'Surveillance à l’arrêt'}</strong><p>{approvedCount} décision(s) approuvée(s)<br />Vos rappels restent dans votre espace.</p></div></aside>
    <main className="main-content" id="main-content"><div className="topbar"><span>Compagnon de travail personnel</span><span className="local-label"><span className="status-dot connected" />Application locale</span></div>
      <div className="workspace" aria-busy={busy !== null}>
        {error && <div className="feedback error-feedback" role="alert"><div><strong>L’action n’a pas pu aboutir</strong><p>{error}</p></div><button className="dismiss-button" aria-label="Fermer le message d’erreur" onClick={() => setError(null)}>×</button></div>}
        {message && <div className="feedback success-feedback" role="status"><p>{message}</p><button className="dismiss-button" aria-label="Fermer le message de confirmation" onClick={() => setMessage(null)}>×</button></div>}
        {busy && <div className="working-feedback" role="status"><span className="loading-dot" />{busy === 'import-source' ? 'Import et extraction réels en cours. Cela peut prendre un moment…' : busy === 'check' || busy === 'start' ? 'Commande de surveillance en cours…' : 'Opération en cours…'}</div>}
        {!snapshot ? <Empty title={error ? 'L’application n’a pas pu charger votre carnet' : 'Ouverture de votre espace…'}><p>{error ? 'Vos données ne sont pas modifiées. Vous pouvez réessayer le chargement.' : 'Chargement des décisions, des réglages et de l’historique local.'}</p>{error && window.companyBuddy && <button className="button secondary" disabled={busy !== null} onClick={() => void run('reload', () => window.companyBuddy.getState())}>Réessayer</button>}</Empty> : <>
          {page === 'decisions' && <Decisions snapshot={snapshot} busy={busy !== null} run={run} notice={setMessage} />}
          {page === 'monitor' && <Monitor snapshot={snapshot} busy={busy !== null} stopping={busy === 'stop'} run={run} navigate={setPage} />}
          {page === 'alerts' && <Alerts snapshot={snapshot} selectedId={selectedAlert} select={setSelectedAlert} busy={busy !== null} run={run} />}
          {page === 'settings' && <Settings snapshot={snapshot} busy={busy !== null} run={run} />}
        </>}
      </div>
    </main>
  </div>;
}
