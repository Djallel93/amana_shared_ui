// resources/js/composables/useConfirm.ts
//
// Composable pour des boîtes de confirmation stylées, en remplacement de
// confirm() natif du navigateur. Pattern "état partagé au niveau module" —
// identique à useToast.ts — pour qu'un seul <ConfirmDialog> monté une fois
// dans le layout (voir app.ts, div #vue-confirm-dialog) puisse être piloté
// depuis n'importe quel composant via useConfirm().ask(...).
//
// Contrairement à confirm() natif (synchrone, bloquant), ask() est
// asynchrone : tout code appelant DOIT faire `await` dessus. Attention en
// particulier si un bouton est relié à un <form> HTML classique via un
// attribut onclick="return ..." — cet attribut attend un booléen synchrone
// et ne fonctionnera pas avec ask(). Dans ce cas, préférer
// e.preventDefault() + soumission programmatique du formulaire une fois la
// promesse résolue (voir GeneratePreview.vue, confirmRollback()).

import { ref } from "vue";

/**
 * Ligne du récapitulatif optionnel d'une confirmation (v1.8.0, 03/10/2026) —
 * libellé à gauche, valeur à droite. Sert aux confirmations qui doivent
 * RÉSUMER ce qu'on s'apprête à faire (ex. « Créer la campagne » : type,
 * dates, poids…) plutôt que d'enfiler tout dans une phrase de `message`.
 */
export interface ConfirmDetail {
  label: string;
  value: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  /**
   * Récapitulatif affiché sous le message (optionnel, rétrocompatible : sans
   * lui la boîte est identique à avant). Un `value` peut contenir des
   * retours à la ligne, conservés à l'affichage.
   */
  details?: ConfirmDetail[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style "danger" (bouton rouge, icône ⚠️) pour les suppressions/actions irréversibles. */
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  details: ConfirmDetail[];
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
}

const state = ref<ConfirmState>({
  open: false,
  title: "",
  message: "",
  details: [],
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
  danger: false,
});

// Une seule confirmation peut être ouverte à la fois — resolver courant.
let resolver: ((value: boolean) => void) | null = null;

export function useConfirm() {
  /**
   * Ouvre la boîte de confirmation et retourne une promesse résolue à
   * true (confirmé) ou false (annulé / fermé via Escape ou backdrop).
   */
  function ask(options: ConfirmOptions): Promise<boolean> {
    // Si une confirmation précédente était encore en attente (ne devrait
    // pas arriver en usage normal), on la résout à false plutôt que de
    // la laisser bloquée indéfiniment.
    resolver?.(false);

    state.value = {
      open: true,
      title:
        options.title ??
        (options.danger ? "Confirmer la suppression" : "Confirmation"),
      message: options.message,
      details: options.details ?? [],
      confirmLabel:
        options.confirmLabel ?? (options.danger ? "Supprimer" : "Confirmer"),
      cancelLabel: options.cancelLabel ?? "Annuler",
      danger: options.danger ?? false,
    };

    return new Promise<boolean>((resolve) => {
      resolver = resolve;
    });
  }

  /** Appelé par ConfirmDialog.vue quand l'utilisateur répond. */
  function respond(value: boolean): void {
    state.value.open = false;
    resolver?.(value);
    resolver = null;
  }

  return { state, ask, respond };
}
