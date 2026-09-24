// src/composables/useTopStackOffset.ts
//
// NotificationBell.vue est positionné en fixed top-3 right-4, calé sur
// l'hypothèse qu'il n'y a jamais rien d'autre dans le coin supérieur droit.
// Deux choses viennent contredire ça :
//   1. La topbar mobile (sm:hidden, sidebar.blade.php) — 56px de haut
//      (--topbar, voir h-topbar/top-topbar/max-sm:pt-topbar déjà utilisés
//      ailleurs dans l'app), avec le bouton hamburger dans son coin droit :
//      sur mobile, top-3 place la cloche EN PLEIN dessus.
//   2. OfflineBanner.vue et UrgentAlertBar.vue — deux bandeaux fixed top-0
//      inset-x-0 indépendants, montés/démontés via v-if, qui peuvent
//      apparaître par-dessus tout, topbar comprise (z-index 500/600 contre
//      300 pour la topbar, 400 pour la cloche).
//
// Les trois composants sont montés séparément (mountIfPresent, voir app.ts)
// sans état Vue partagé entre eux — pas de store commun pour l'instant pour
// une seule valeur dérivée. Solution: NotificationBell mesure directement
// le DOM (topbar mobile en constante, bandeaux via ResizeObserver puisque
// UrgentAlertBar empile un nombre variable d'alertes) plutôt que d'introduire
// un store partagé pour ce seul besoin.
import { onMounted, onUnmounted, ref } from "vue";

// Doit rester synchronisé avec la constante --topbar (56px, custom.css,
// classes h-topbar/top-topbar/max-sm:pt-topbar) : une valeur fixe, pas un
// clamp() comme --sidebar-width, donc pas besoin de la mesurer en JS.
const MOBILE_TOPBAR_HEIGHT_PX = 56;
// Même seuil que le breakpoint sm de Tailwind, réutilisé tel quel par
// MobileSidebar.vue (isMobile()) pour la même distinction mobile/desktop.
const MOBILE_BREAKPOINT_PX = 640;
// Cloche montée elle-même avec un décalage de 12px (top-3) — conservé comme
// marge de base sur laquelle s'empile le reste.
const BASE_OFFSET_PX = 12;

// Bannières à surveiller, par id DOM. Ajoutées ici au fil de leur création
// (voir OfflineBanner.vue / UrgentAlertBar.vue, id="offlineBanner"/
// id="urgentAlertBar") plutôt que par une classe commune, pour ne pas
// risquer de capter un futur élément sans rapport qui partagerait la classe.
const BANNER_IDS = ["offlineBanner", "urgentAlertBar"];

export function useTopStackOffset() {
  const topPx = ref(BASE_OFFSET_PX);

  function isMobile(): boolean {
    return window.innerWidth < MOBILE_BREAKPOINT_PX;
  }

  function recompute(): void {
    const bannersHeight = BANNER_IDS.reduce((total, id) => {
      const el = document.getElementById(id);
      return el ? total + el.getBoundingClientRect().height : total;
    }, 0);
    const topbarHeight = isMobile() ? MOBILE_TOPBAR_HEIGHT_PX : 0;
    topPx.value = BASE_OFFSET_PX + topbarHeight + bannersHeight;
  }

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let rafId: number | null = null;

  // Un seul recompute par frame même si plusieurs mutations/redimensionnements
  // arrivent d'un coup (le MutationObserver sur document.body peut être bavard
  // sur une page par ailleurs très dynamique).
  function scheduleRecompute(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      recompute();
    });
  }

  // Les bandeaux vont/viennent via v-if : ResizeObserver ne peut observer que
  // ce qui existe déjà, d'où ce ré-abonnement à chaque mutation du DOM pour
  // capter leur apparition (et laisser l'observer se détacher tout seul à
  // leur suppression).
  function resubscribeToBanners(): void {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(scheduleRecompute);
    for (const id of BANNER_IDS) {
      const el = document.getElementById(id);
      if (el) resizeObserver.observe(el);
    }
    scheduleRecompute();
  }

  onMounted(() => {
    resubscribeToBanners();
    mutationObserver = new MutationObserver(resubscribeToBanners);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleRecompute);
  });

  onUnmounted(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    window.removeEventListener("resize", scheduleRecompute);
  });

  return { topPx };
}
