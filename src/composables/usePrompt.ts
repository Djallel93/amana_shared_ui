// src/composables/usePrompt.ts
//
// Composable pour une boîte de saisie stylée, en remplacement de prompt()
// natif du navigateur. Même pattern « état partagé au niveau module » que
// useConfirm.ts / useToast.ts : un seul <PromptDialog> monté une fois (voir
// lib/dialogs.ts, registerDialogs()) peut être piloté depuis n'importe quel
// composant via usePrompt().ask(...), ou depuis une page Blade via
// window.amanaPrompt(...).
//
// Contrairement à prompt() natif (synchrone), ask() est asynchrone : il
// résout à
//   - string  : texte saisi (peut être '' si le champ est optionnel) ;
//   - null    : annulation (bouton Annuler, Escape, clic sur le fond).
//
// IMPORTANT : null ≠ ''. Annuler ne doit JAMAIS être traité comme une
// validation avec un champ vide — c'était le bug de
// `prompt('...') || ''` qui envoyait quand même la requête après un clic
// extérieur.

import { ref } from "vue";

export interface PromptOptions {
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true : le bouton de validation reste inactif tant que le champ est vide. */
  required?: boolean;
  /** false : champ sur une seule ligne (défaut : zone de texte multi-lignes). */
  multiline?: boolean;
  maxLength?: number;
}

interface PromptState {
  open: boolean;
  title: string;
  message: string;
  label: string;
  placeholder: string;
  value: string;
  confirmLabel: string;
  cancelLabel: string;
  required: boolean;
  multiline: boolean;
  maxLength: number | null;
}

const state = ref<PromptState>({
  open: false,
  title: "",
  message: "",
  label: "",
  placeholder: "",
  value: "",
  confirmLabel: "Valider",
  cancelLabel: "Annuler",
  required: false,
  multiline: true,
  maxLength: null,
});

// Une seule saisie peut être ouverte à la fois — resolver courant.
let resolver: ((value: string | null) => void) | null = null;

export function usePrompt() {
  function ask(options: PromptOptions = {}): Promise<string | null> {
    // Une saisie précédente encore en attente est résolue à null plutôt que
    // laissée bloquée indéfiniment.
    resolver?.(null);

    state.value = {
      open: true,
      title: options.title ?? "Précisions",
      message: options.message ?? "",
      label: options.label ?? "",
      placeholder: options.placeholder ?? "",
      value: options.initialValue ?? "",
      confirmLabel: options.confirmLabel ?? "Valider",
      cancelLabel: options.cancelLabel ?? "Annuler",
      required: options.required ?? false,
      multiline: options.multiline ?? true,
      maxLength: options.maxLength ?? null,
    };

    return new Promise<string | null>((resolve) => {
      resolver = resolve;
    });
  }

  /** Appelé par PromptDialog.vue : valeur saisie, ou null si annulé. */
  function respond(value: string | null): void {
    state.value.open = false;
    resolver?.(value);
    resolver = null;
  }

  return { state, ask, respond };
}
