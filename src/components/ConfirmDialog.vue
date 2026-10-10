<!-- resources/js/components/shared/ConfirmDialog.vue -->
<!--
    Boîte de confirmation stylée, en remplacement de confirm() natif.

    Monté UNE SEULE FOIS dans le layout principal (voir app.ts,
    #vue-confirm-dialog), piloté depuis n'importe quel composant via
    useConfirm().ask({ message, danger }) — voir ce composable pour le détail
    du fonctionnement asynchrone (Promise<boolean>).

    v1.8.0 (03/10/2026) : récapitulatif optionnel `details` (liste
    libellé/valeur sous le message) pour les confirmations qui résument ce
    qu'on s'apprête à créer ; la boîte s'élargit (max-w-md au lieu de
    max-w-sm) uniquement quand un récapitulatif est présent — sans lui, rendu
    strictement identique à avant.
-->
<script setup lang="ts">
import { useConfirm } from "../composables/useConfirm";
import Modal from "./Modal.vue";

const { state, respond } = useConfirm();
</script>

<template>
  <Modal
    :open="state.open"
    elevated
    :max-width="state.details.length > 0 ? 'max-w-md' : 'max-w-sm'"
    @close="respond(false)"
  >
    <template #header>
      <span v-if="state.danger" class="text-lg leading-none">⚠️</span>
      <h2 class="font-heading text-[15px] font-semibold text-ink">
        {{ state.title }}
      </h2>
    </template>

    <p class="text-[13.5px] text-ink-light leading-relaxed">
      {{ state.message }}
    </p>

    <dl
      v-if="state.details.length > 0"
      class="mt-3 divide-y divide-surface-3 rounded-lg border border-surface-border bg-surface-2 text-[13px]"
    >
      <div
        v-for="(ligne, index) in state.details"
        :key="index"
        class="flex items-start justify-between gap-4 px-3 py-2"
      >
        <dt class="shrink-0 text-ink-muted">{{ ligne.label }}</dt>
        <dd class="text-right font-medium text-ink whitespace-pre-line break-words">
          {{ ligne.value }}
        </dd>
      </div>
    </dl>

    <template #footer>
      <button
        type="button"
        @click="respond(false)"
        class="px-3.5 py-2 text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-3 rounded-lg transition-colors bg-transparent border-0 cursor-pointer min-h-[44px]"
      >
        {{ state.cancelLabel }}
      </button>
      <button
        type="button"
        @click="respond(true)"
        class="px-3.5 py-2 text-[13px] font-bold text-white rounded-lg transition-colors border-0 cursor-pointer min-h-[44px]"
        :class="
          state.danger
            ? 'bg-rose-600 hover:bg-rose-700'
            : 'bg-accent hover:bg-accent-dark'
        "
      >
        {{ state.confirmLabel }}
      </button>
    </template>
  </Modal>
</template>
