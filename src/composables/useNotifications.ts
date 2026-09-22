// src/composables/useNotifications.ts
//
// Composable partagé du centre de notifications (voir
// amana_shared/NotificationCenterService côté PHP) — utilisé par
// NotificationBell.vue et UrgentAlertBar.vue. Polling plutôt que
// websockets : ce stack n'a ni Echo ni Pusher configuré nulle part (voir
// le prompt du 03/09/2026), polling reste cohérent avec le reste de
// l'app plutôt que d'introduire une dépendance temps-réel pour cette
// seule fonctionnalité.
//
// État partagé au niveau module (mêmes principes que useToast.ts) : les
// deux composants qui consomment ce composable (cloche + bandeau) doivent
// voir exactement le même état, pas deux copies qui pourraient diverger
// (ex: une notification marquée lue dans la cloche doit disparaître du
// compteur partout).

import { ref, onMounted, onUnmounted } from "vue";

export interface AmanaNotification {
  id: string;
  type: string;
  severity: "info" | "urgent";
  data: Record<string, unknown>;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

let basePath = "/notifications";
let pollMs = 20000;

/**
 * À appeler une fois par app consommatrice (voir app.ts), avant de
 * monter NotificationBell/UrgentAlertBar — configure l'URL de base des
 * routes exposées par Amana\Shared\Http\Controllers\NotificationsController
 * (chaque app les enregistre à son propre préfixe/middleware auth).
 */
export function configureNotifications(options: {
  basePath?: string;
  pollMs?: number;
}): void {
  if (options.basePath) basePath = options.basePath;
  if (options.pollMs) pollMs = options.pollMs;
}

const notifications = ref<AmanaNotification[]>([]);
let pollHandle: ReturnType<typeof setInterval> | undefined;
let subscriberCount = 0;

function csrfToken(): string {
  return (
    document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute("content") ?? ""
  );
}

async function fetchNotifications(): Promise<void> {
  try {
    const res = await fetch(basePath, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const payload = await res.json();
    notifications.value = payload.notifications ?? [];
  } catch {
    // Silencieux — un couac réseau transitoire n'a pas besoin de remonter
    // une erreur visible, le prochain tick de polling réessaiera.
  }
}

async function marquerLue(id: string): Promise<void> {
  const notif = notifications.value.find((n) => n.id === id);
  if (notif) notif.read_at = new Date().toISOString();

  try {
    await fetch(`${basePath}/${id}/lue`, {
      method: "POST",
      headers: { "X-CSRF-TOKEN": csrfToken(), Accept: "application/json" },
    });
  } catch {
    // Optimiste : si l'appel échoue, la prochaine réconciliation par
    // polling remettra l'état correct — pas la peine de faire un
    // rollback manuel pour un simple accusé de lecture.
  }
}

/**
 * @param options.poll false pour désactiver le polling depuis cette
 *   instance (les deux composants du package l'activent par défaut ;
 *   utile si une app veut lire l'état sans doubler le polling).
 */
export function useNotifications(options: { poll?: boolean } = {}) {
  const poll = options.poll ?? true;

  onMounted(() => {
    fetchNotifications();

    if (poll) {
      subscriberCount++;
      if (!pollHandle) {
        pollHandle = setInterval(fetchNotifications, pollMs);
      }
    }
  });

  onUnmounted(() => {
    if (poll) {
      subscriberCount--;
      if (subscriberCount <= 0 && pollHandle) {
        clearInterval(pollHandle);
        pollHandle = undefined;
      }
    }
  });

  return { notifications, marquerLue, refresh: fetchNotifications };
}
