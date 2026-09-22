// resources/js/composables/useToast.ts
//
// Composable Vue pour les notifications toast.

import { ref } from "vue";

// ── Types ─────────────────────────────────────────────────────────────────
// En TS, "type" définit la forme d'un objet.
// 'success' | 'error' est un "union type" : la valeur ne peut être que l'un
// des deux strings exacts. TS refusera 'warning' ou 'ok' à la compilation.

export type ToastType = "success" | "error" | "warning";

export interface Toast {
  id: number; // identifiant unique pour que Vue gère le DOM proprement (key)
  message: string;
  type: ToastType;
}

// ── État partagé (module-level) ───────────────────────────────────────────
// ref<Toast[]>([]) : un tableau réactif de Toast, initialement vide.
// Le générique <Toast[]> dit à TS : "ce ref contient un tableau de Toast".
// Sans lui, TS inférerait ref<never[]> et ne laisserait rien pousser dedans.
let nextId = 0;
const toasts = ref<Toast[]>([]);

// ── Composable ────────────────────────────────────────────────────────────
export function useToast() {
  function show(
    message: string,
    type: ToastType = "success",
    duration = 4000,
  ): void {
    const id = nextId++;
    toasts.value.push({ id, message, type });

    // Retrait automatique après `duration` ms.
    setTimeout(() => {
      // Array.filter retourne un nouveau tableau sans l'élément supprimé.
      // Vue détecte le remplacement de .value et met à jour le DOM.
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, duration);
  }

  // Raccourcis pratiques — pas obligatoires, mais évitent d'écrire le type partout.
  const success = (message: string) => show(message, "success");
  const error = (message: string) => show(message, "error");
  // "warning" : action acceptée mais avec une nuance à signaler (ex. Bilan
  // enregistré comme "pas de cours" — distinct d'un vrai 0, voir
  // BilanView.vue) — pas une erreur (l'enregistrement a réussi), mais pas
  // un succès silencieux non plus.
  const warning = (message: string) => show(message, "warning", 6000);

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  // On expose `toasts` en lecture pour que Toast.vue puisse le lire,
  // mais on ne laisse pas l'extérieur pousser dedans directement —
  // tout passe par show() / dismiss().
  return { toasts, show, success, error, warning, dismiss };
}
