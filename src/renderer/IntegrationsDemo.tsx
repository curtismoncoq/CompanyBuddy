import { useState } from 'react';

const providers = [
  { id: 'plaud', name: 'PLAUD', mark: 'P', description: 'Enregistrements et transcriptions' },
  { id: 'granola', name: 'Granola', mark: 'G', description: 'Notes de réunion' },
  { id: 'otter', name: 'Otter.ai', mark: 'O', description: 'Transcriptions de réunion' },
];

export function IntegrationsDemo() {
  const [connected, setConnected] = useState<string[]>([]);

  function toggle(id: string) {
    setConnected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  return <>
    <header className="page-heading"><h1>Intégrations</h1><span className="badge">Démo</span></header>
    <p className="muted integration-intro">Connexions simulées. Aucune synchronisation réelle.</p>
    <div className="card integration-list">
      {providers.map(provider => {
        const active = connected.includes(provider.id);
        return <section className="integration-row" key={provider.id} aria-labelledby={`integration-${provider.id}`}>
          <span className="integration-mark" aria-hidden="true">{provider.mark}</span>
          <div className="integration-provider"><h2 id={`integration-${provider.id}`}>{provider.name}</h2><p className="muted">{provider.description}</p></div>
          <div className="integration-actions">
            <span className={`integration-status ${active ? 'connected' : ''}`} role="status">{active ? 'Connecté · démo' : 'Non connecté'}</span>
            <button className="button" aria-label={`${active ? 'Déconnecter' : 'Connecter'} ${provider.name} (démo)`} aria-pressed={active} onClick={() => toggle(provider.id)}>{active ? 'Déconnecter' : 'Connecter'}</button>
          </div>
        </section>;
      })}
    </div>
  </>;
}
