// src/lib/dialogs.ts
//
// Pont « window » vers les dialogues/toasts partagés, pour les pages Blade
// classiques dont le JS inline ne peut pas appeler directement les
// composables Vue (useConfirm/usePrompt/useToast). Remplace prompt(),
// confirm() et alert() natifs du navigateur :
//
//   const notes = await window.amanaPrompt({ title: '…', required: false });
//   if (notes === null) return;                 // annulé → ne rien faire
//   if (!(await window.amanaConfirm({ message: '…' }))) return;
//   window.amanaToast('Enregistré.', 'success');
//
// window.amanaConfirm est déjà déclaré par lib/confirmForms.ts (importé par
// registerConfirmForms()) ; on ne le redéclare pas ici.
//
// registerDialogs() monte lui-même <PromptDialog> dans un <div> ajouté à
// <body> : contrairement à Toast/ConfirmDialog, aucun point de montage
// dédié n'est requis dans le layout Blade (amana_shared), donc aucune
// modification de ce dépôt.

import { createApp } from "vue";
import PromptDialog from "../components/PromptDialog.vue";
import { usePrompt, type PromptOptions } from "../composables/usePrompt";
import { useToast, type ToastType } from "../composables/useToast";

declare global {
  interface Window {
    amanaPrompt: (options?: PromptOptions) => Promise<string | null>;
    amanaToast: (message: string, type?: ToastType) => void;
  }
}

const { ask } = usePrompt();
const toast = useToast();

window.amanaPrompt = (options) => ask(options);
window.amanaToast = (message, type = "success") => toast.show(message, type);

let mounted = false;

export function registerDialogs(): void {
  if (mounted) return;
  mounted = true;

  const host = document.createElement("div");
  host.id = "vue-prompt-dialog";
  document.body.appendChild(host);
  createApp(PromptDialog).mount(host);
}
