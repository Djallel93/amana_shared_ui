<!-- src/components/UrgentAlertBar.vue -->
<!--
    Bandeau rouge plein écran pour les notifications severity='urgent'
    non résolues (voir amana_shared/NotificationCenterService et
    Amana\Shared\Models\Notification côté PHP) — ajouté le 03/09/2026 à
    la demande explicite : "Since they need immediate action, ... a top
    bar (red and scary) appears on these kind of events not just a small
    red dot that might be missed" (contexte : incidents de tournée
    livraison — bénévole absent, capacité, livraison ignorée).

    Différence clé avec NotificationBell.vue : ce bandeau suit l'état
    RÉSOLU, pas LU. Une alerte urgente reste affichée tant que
    l'entité qu'elle décrit n'a pas été traitée (ex: incident résolu
    côté tableau de bord), même si quelqu'un l'a déjà vue — lu ≠ traité,
    contrairement à la cloche où lu suffit à faire disparaître l'item de
    la liste "non lues".

    Monté une seule fois dans le layout principal (voir app.ts,
    #vue-urgent-alert-bar), au-dessus d'OfflineBanner.vue en z-index —
    une urgence opérationnelle passe avant un simple avertissement réseau.

    Empile plusieurs alertes urgentes simultanées (ex: deux incidents sur
    deux tournées différentes) sous forme de liste compacte plutôt que de
    n'en montrer qu'une seule à la fois et masquer les autres — l'objectif
    étant justement qu'aucune ne passe inaperçue.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useNotifications } from "../composables/useNotifications";

const { notifications } = useNotifications();

const urgentesNonResolues = computed(() =>
  notifications.value.filter((n) => n.severity === "urgent" && !n.resolved_at),
);

function libelle(n: (typeof notifications.value)[number]): string {
  const titre = (n.data.titre as string | undefined) ?? "Alerte";
  const message = (n.data.message as string | undefined) ?? "";
  return message ? `${titre} — ${message}` : titre;
}

function lien(n: (typeof notifications.value)[number]): string | undefined {
  return n.data.url as string | undefined;
}
</script>

<template>
  <div
    v-if="urgentesNonResolues.length > 0"
    role="alert"
    aria-live="assertive"
    class="fixed top-0 inset-x-0 z-[600] bg-rose-600 text-white shadow-md"
  >
    <ul class="max-w-5xl mx-auto divide-y divide-rose-500/50">
      <li
        v-for="n in urgentesNonResolues"
        :key="n.id"
        class="flex items-center justify-between gap-3 px-4 py-2 text-[13px] font-semibold"
      >
        <span class="flex items-center gap-2">
          <span aria-hidden="true">🚨</span>
          {{ libelle(n) }}
        </span>
        <a
          v-if="lien(n)"
          :href="lien(n)"
          class="shrink-0 underline decoration-white/60 hover:decoration-white text-[12.5px] font-medium"
        >
          Voir
        </a>
      </li>
    </ul>
  </div>
</template>
