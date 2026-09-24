<!-- src/components/NotificationBell.vue -->
<!--
    Cloche de notifications + badge non-lues + liste déroulante — voir
    useNotifications.ts / amana_shared/NotificationCenterService.

    Montre les alertes 'urgent' (même une fois lues — elles restent tant
    que non résolues, voir UrgentAlertBar.vue pour l'affichage prioritaire
    de celles-ci) ET les notifications 'info' des 30 derniers jours (voir
    NotificationCenterService::pourPersonne() côté PHP, qui fait déjà ce
    tri — ce composant se contente d'afficher ce qu'on lui donne).

    Monté une seule fois dans le layout principal (voir app.ts,
    #vue-notification-bell) — coin supérieur droit, décalé dynamiquement
    (voir useTopStackOffset.ts) sous la topbar mobile et sous
    UrgentAlertBar/OfflineBanner quand ils sont visibles, pour ne jamais les
    recouvrir (corrigé le 23/09/2026 — la cloche restait en fixed top-3 fixe,
    par-dessus le bouton hamburger sur mobile).
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  useNotifications,
  type AmanaNotification,
} from "../composables/useNotifications";
import { useTopStackOffset } from "../composables/useTopStackOffset";

const { notifications, marquerLue } = useNotifications();
// Décale la cloche sous la topbar mobile et sous OfflineBanner/UrgentAlertBar
// quand ils apparaissent — voir useTopStackOffset.ts pour le pourquoi (sinon
// top-3 fixe la place en plein sur le bouton hamburger mobile).
const { topPx } = useTopStackOffset();

const ouvert = ref(false);
const root = ref<HTMLElement | null>(null);

const nonLues = computed(() => notifications.value.filter((n) => !n.read_at));

function libelle(n: AmanaNotification): string {
  return (n.data.titre as string | undefined) ?? "Notification";
}

function message(n: AmanaNotification): string {
  return (n.data.message as string | undefined) ?? "";
}

function lien(n: AmanaNotification): string | undefined {
  return n.data.url as string | undefined;
}

function bascule(): void {
  ouvert.value = !ouvert.value;
}

function onClicExterieur(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) {
    ouvert.value = false;
  }
}

onMounted(() => document.addEventListener("click", onClicExterieur));
onUnmounted(() => document.removeEventListener("click", onClicExterieur));
</script>

<template>
  <div ref="root" class="fixed right-4 z-[400] transition-[top] duration-200 ease-out" :style="{ top: `${topPx}px` }">
    <button
      type="button"
      aria-label="Notifications"
      class="relative w-10 h-10 rounded-full bg-surface border border-surface-border shadow-sm flex items-center justify-center text-ink hover:bg-stone-50"
      @click="bascule"
    >
      <span aria-hidden="true">🔔</span>
      <span
        v-if="nonLues.length > 0"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-semibold flex items-center justify-center"
      >
        {{ nonLues.length > 9 ? "9+" : nonLues.length }}
      </span>
    </button>

    <div
      v-if="ouvert"
      class="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface border border-surface-border rounded-xl shadow-lg py-2"
    >
      <p
        v-if="notifications.length === 0"
        class="px-4 py-6 text-[13px] text-ink-muted text-center"
      >
        Aucune notification.
      </p>

      <a
        v-for="n in notifications"
        :key="n.id"
        :href="lien(n) ?? '#'"
        class="block px-4 py-2.5 border-b border-surface-border last:border-b-0 hover:bg-stone-50"
        :class="{ 'bg-accent/5': !n.read_at }"
        @click="!n.read_at && marquerLue(n.id)"
      >
        <p class="text-[13px] font-medium text-ink flex items-center gap-1.5">
          <span v-if="n.severity === 'urgent'" aria-hidden="true">🚨</span>
          {{ libelle(n) }}
        </p>
        <p v-if="message(n)" class="text-[12px] text-ink-muted mt-0.5">
          {{ message(n) }}
        </p>
      </a>
    </div>
  </div>
</template>
