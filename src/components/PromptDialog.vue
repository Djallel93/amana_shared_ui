<!-- src/components/PromptDialog.vue -->
<!--
    Boîte de saisie stylée, en remplacement de prompt() natif.

    Monté UNE SEULE FOIS (voir lib/dialogs.ts, registerDialogs()), piloté
    depuis n'importe où via usePrompt().ask({ ... }) ou window.amanaPrompt().
    Résout à la chaîne saisie, ou à null si l'utilisateur annule / ferme
    (Escape, clic sur le fond) — voir usePrompt.ts.
-->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { usePrompt } from "../composables/usePrompt";
import Modal from "./Modal.vue";

const { state, respond } = usePrompt();
const fieldRef = ref<HTMLTextAreaElement | HTMLInputElement | null>(null);

const canSubmit = computed(
  () => !state.value.required || state.value.value.trim() !== "",
);

function submit(): void {
  if (!canSubmit.value) return;
  respond(state.value.value.trim());
}

// Focus sur le champ à l'ouverture.
watch(
  () => state.value.open,
  async (isOpen) => {
    if (!isOpen) return;
    await nextTick();
    setTimeout(() => fieldRef.value?.focus(), 80);
  },
);

// Entrée valide un champ mono-ligne ; Ctrl/Cmd+Entrée valide une zone de texte.
function onKeydown(e: KeyboardEvent): void {
  if (e.key !== "Enter") return;
  if (state.value.multiline && !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  submit();
}
</script>

<template>
  <Modal :open="state.open" max-width="max-w-md" @close="respond(null)">
    <template #header>
      <h2 class="font-heading text-[15px] font-semibold text-ink">
        {{ state.title }}
      </h2>
    </template>

    <p
      v-if="state.message"
      class="text-[13.5px] text-ink-light leading-relaxed mb-3"
    >
      {{ state.message }}
    </p>

    <label class="block">
      <span
        v-if="state.label"
        class="block text-[12px] font-medium text-ink-muted mb-1"
        >{{ state.label }}</span
      >
      <textarea
        v-if="state.multiline"
        ref="fieldRef"
        v-model="state.value"
        rows="4"
        :placeholder="state.placeholder"
        :maxlength="state.maxLength ?? undefined"
        class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-accent resize-y"
        @keydown="onKeydown"
      />
      <input
        v-else
        ref="fieldRef"
        v-model="state.value"
        type="text"
        :placeholder="state.placeholder"
        :maxlength="state.maxLength ?? undefined"
        class="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-accent min-h-[2.5rem]"
        @keydown="onKeydown"
      />
    </label>

    <template #footer>
      <button
        type="button"
        @click="respond(null)"
        class="px-3.5 py-2 text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-3 rounded-lg transition-colors bg-transparent border-0 cursor-pointer min-h-[44px]"
      >
        {{ state.cancelLabel }}
      </button>
      <button
        type="button"
        :disabled="!canSubmit"
        @click="submit"
        class="px-3.5 py-2 text-[13px] font-bold text-white rounded-lg transition-colors border-0 cursor-pointer min-h-[44px] bg-accent hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ state.confirmLabel }}
      </button>
    </template>
  </Modal>
</template>
