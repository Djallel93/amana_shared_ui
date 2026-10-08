// src/lib/submitLock.ts
//
// Empêche la double soumission d'un formulaire <form> classique (double clic,
// touche Entrée répétée, réseau lent) : sans cela, chaque requête POST crée sa
// propre ligne et déclenche ses propres effets de bord (régénération du
// planning, envoi d'emails…).
//
// Usage côté Blade — opt-in explicite, formulaire par formulaire :
//   <form data-submit-lock>                          (libellé : « Envoi en cours… »)
//   <form data-submit-lock data-submit-lock-label="Génération…">
//   <form data-submit-lock data-submit-lock-timeout="60000">  (déverrouillage de sécurité, en ms)
//
// Ce que fait le verrou, une fois la soumission réellement partie :
//   - désactive tous les boutons de soumission du formulaire (libellé remplacé) ;
//   - bloque toute nouvelle soumission du même formulaire (Entrée, requestSubmit…) ;
//   - se relâche tout seul après le délai de sécurité (30 s par défaut) si la
//     page est restée là (réseau coupé, réponse sans navigation, téléchargement)
//     et à chaque retour via le cache « page précédente » du navigateur.
//
// Interaction avec confirmForms.ts (data-confirm) : le verrou écoute en phase de
// BULLE et ignore tout événement déjà annulé (preventDefault). Une boîte de
// confirmation refusée, ou une validation qui bloque l'envoi, ne verrouille donc
// jamais le formulaire — quel que soit l'ordre des register*() dans app.ts. La
// vérification « déjà verrouillé » se fait, elle, en phase de CAPTURE pour couper
// court avant toute autre écoute (dont l'ouverture d'une seconde confirmation).
//
// Ne couvre que les soumissions natives. Les appels fetch()/axios (modales Vue)
// doivent gérer leur propre état « en cours » (ex. un ref `submitting` qui
// désactive le bouton, comme EditAbsenceModal.vue côté planning).

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_LABEL = "Envoi en cours…";

interface LockState {
  controls: Array<{ el: HTMLButtonElement | HTMLInputElement; html: string; disabled: boolean }>;
  timer: number;
}

const locked = new Map<HTMLFormElement, LockState>();

function lockableForm(target: EventTarget | null): HTMLFormElement | null {
  return target instanceof HTMLFormElement && target.hasAttribute("data-submit-lock")
    ? target
    : null;
}

function submitControls(form: HTMLFormElement): Array<HTMLButtonElement | HTMLInputElement> {
  const controls = Array.from(
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]), button[type="submit"], input[type="submit"]',
    ),
  );
  // Boutons rattachés de l'extérieur via l'attribut form="id".
  if (form.id) {
    controls.push(
      ...Array.from(
        document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
          `button[form="${CSS.escape(form.id)}"], input[type="submit"][form="${CSS.escape(form.id)}"]`,
        ),
      ),
    );
  }
  return controls;
}

function unlock(form: HTMLFormElement): void {
  const state = locked.get(form);
  if (!state) return;

  window.clearTimeout(state.timer);
  for (const { el, html, disabled } of state.controls) {
    el.disabled = disabled;
    el.removeAttribute("aria-busy");
    el.style.opacity = "";
    el.style.cursor = "";
    if (el instanceof HTMLButtonElement) el.innerHTML = html;
    else el.value = html;
  }
  locked.delete(form);
}

function lock(form: HTMLFormElement): void {
  if (locked.has(form)) return;

  const label = form.dataset.submitLockLabel || DEFAULT_LABEL;
  const timeout = Number(form.dataset.submitLockTimeout) || DEFAULT_TIMEOUT_MS;

  // Les boutons ne sont désactivés qu'APRÈS l'événement : un bouton désactivé
  // pendant le submit est exclu du jeu de données envoyé, ce qui perdrait un
  // éventuel name/value du bouton cliqué.
  const state: LockState = { controls: [], timer: 0 };
  locked.set(form, state);

  window.setTimeout(() => {
    if (locked.get(form) !== state) return; // déjà relâché entre-temps

    for (const el of submitControls(form)) {
      state.controls.push({
        el,
        html: el instanceof HTMLButtonElement ? el.innerHTML : el.value,
        disabled: el.disabled,
      });
      el.disabled = true;
      el.setAttribute("aria-busy", "true");
      el.style.opacity = "0.6";
      el.style.cursor = "not-allowed";
      if (el instanceof HTMLButtonElement) el.textContent = label;
      else el.value = label;
    }
  }, 0);

  state.timer = window.setTimeout(() => unlock(form), timeout);
}

export function registerSubmitLock(): void {
  // CAPTURE : refuse une seconde soumission d'un formulaire déjà parti.
  document.addEventListener(
    "submit",
    (e) => {
      const form = lockableForm(e.target);
      if (form && locked.has(form)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  // BULLE : verrouille uniquement si la soumission n'a été annulée par personne.
  document.addEventListener("submit", (e) => {
    const form = lockableForm(e.target);
    if (form && !e.defaultPrevented) lock(form);
  });

  // Retour arrière via le bfcache : la page revient telle qu'elle était
  // (boutons grisés) sans rejouer le JS — on relâche tout.
  window.addEventListener("pageshow", (e: PageTransitionEvent) => {
    if (!e.persisted) return;
    for (const form of Array.from(locked.keys())) unlock(form);
  });
}
