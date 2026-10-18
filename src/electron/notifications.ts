import { Notification } from 'electron';

export interface DesktopNotification {
  id: string;
  title: string;
  body: string;
  onClick: () => void;
}

export class DesktopNotifications {
  private readonly active = new Map<string, Notification>();

  show(request: DesktopNotification): Promise<void> {
    if (!Notification.isSupported()) {
      throw new Error('Les notifications ne sont pas disponibles sur ce système. Les rappels restent dans Alertes.');
    }
    const notification = new Notification({ title: request.title, body: request.body, silent: false });
    const { promise, resolve: shown, reject } = Promise.withResolvers<void>();
    const timeout = setTimeout(() => {
      this.active.delete(request.id);
      reject(new Error('Le système n’a pas confirmé la notification. Autorisez DecisionDrift dans Réglages Système → Notifications.'));
    }, 10_000);
    this.active.set(request.id, notification);
    notification.once('show', () => { clearTimeout(timeout); shown(); });
    notification.on('click', request.onClick);
    notification.once('close', () => this.active.delete(request.id));
    notification.once('failed', (_event, error) => {
      clearTimeout(timeout);
      this.active.delete(request.id);
      reject(new Error(`Notification non délivrée : ${error}. Vérifiez les notifications de DecisionDrift dans les réglages système.`));
    });
    try { notification.show(); }
    catch (error) {
      clearTimeout(timeout);
      this.active.delete(request.id);
      reject(error instanceof Error ? error : new Error('Impossible d’afficher la notification.'));
    }
    return promise;
  }
}
