// src/index.ts
//
// Point d'entrée unique du package @amana/shared-ui.
// Chaque app importe depuis ici plutôt que des chemins de fichiers directs,
// pour que la surface publique du package reste stable même si l'arborescence
// interne change.

export { default as Toast } from "./components/Toast.vue";
export { default as ConfirmDialog } from "./components/ConfirmDialog.vue";
export { default as MobileSidebar } from "./components/MobileSidebar.vue";
export { default as OfflineBanner } from "./components/OfflineBanner.vue";
export { default as UrgentAlertBar } from "./components/UrgentAlertBar.vue";
export { default as NotificationBell } from "./components/NotificationBell.vue";
export {
  useNotifications,
  configureNotifications,
} from "./composables/useNotifications";
export type { AmanaNotification } from "./composables/useNotifications";
export { default as Modal } from "./components/Modal.vue";
export { default as PersonalInfoStep } from "./components/PersonalInfoStep.vue";
export type {
  PersonalInfoValue,
  PersonalInfoLabels,
} from "./components/PersonalInfoStep.vue";
// Promu depuis amana_web_planning le 04/09/2026 (roadmap mobile §4.3/step 7) —
// voir le commentaire en tête du fichier pour ce qui a été généralisé.
export { default as SearchableSelect } from "./components/SearchableSelect.vue";
export type { SearchableSelectItem } from "./components/SearchableSelect.vue";

export { useToast } from "./composables/useToast";
export { useConfirm } from "./composables/useConfirm";
export { useModal } from "./composables/useModal";
export { useTopStackOffset } from "./composables/useTopStackOffset";

export {
  getCurrentTheme,
  applyTheme,
  toggleTheme,
  registerThemeToggle,
} from "./lib/theme";
export type { Theme } from "./lib/theme";
export * from "./lib/confirmForms";
