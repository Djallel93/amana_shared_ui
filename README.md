# @amana/shared-ui

Composants Vue 3, composables et préréglage Tailwind partagés entre
toutes les apps AMANA (planning, familles, ...). Package privé,
distribué en **source** (pas de build) — chaque app le compile via son
propre Vite/plugin Vue, exactement comme n'importe quel autre paquet.

## Installation

### package.json (dépôt privé)

```json
{
    "dependencies": {
        "@amana/shared-ui": "git+https://github.com/Djallel93/amana_shared_ui.git#v1.0.0"
    }
}
```

En local, pointer vers le dossier frère à la place :

```json
{
    "dependencies": {
        "@amana/shared-ui": "file:../amana_shared_ui"
    }
}
```

Authentification (dépôt privé) : voir `docs/composer-auth.md` du dépôt
principal — même principe côté npm avec un token GitHub dans
`~/.npmrc` en local, secret `NPM_TOKEN`/`NODE_AUTH_TOKEN` en CI, ou plus
simplement un token embarqué dans l'URL git (`https://<token>@github.com/...`)
lu depuis un secret au moment du `npm install` en CI.

### Tailwind

```js
// tailwind.config.js
import amanaPreset from '@amana/shared-ui/tailwind-preset';

export default {
    presets: [amanaPreset],
    darkMode: 'class',
    content: [
        './resources/views/**/*.blade.php',
        './resources/js/**/*.{js,ts,vue}',
        './node_modules/@amana/shared-ui/src/**/*.{js,ts,vue}',
    ],
    plugins: [require('@tailwindcss/forms')],
};
```

### CSS

```css
/* resources/css/app.css — AVANT les directives Tailwind */
@import "@amana/shared-ui/styles/amana-shared.css";
@import "./custom.css"; /* résiduel propre à l'app, si besoin */

@tailwind base;
@tailwind components;
@tailwind utilities;
```

### JS — montage des composants

```ts
// resources/js/app.ts
import { createApp } from 'vue';
import { Toast, ConfirmDialog, MobileSidebar, OfflineBanner, registerThemeToggle, registerDialogs } from '@amana/shared-ui';

registerThemeToggle();
registerDialogs(); // PromptDialog + window.amanaPrompt/amanaToast (pages Blade)

if (document.getElementById('vue-toast')) createApp(Toast).mount('#vue-toast');
if (document.getElementById('vue-confirm-dialog')) createApp(ConfirmDialog).mount('#vue-confirm-dialog');
if (document.getElementById('vue-mobile-sidebar')) createApp(MobileSidebar).mount('#vue-mobile-sidebar');
if (document.getElementById('vue-offline-banner')) createApp(OfflineBanner).mount('#vue-offline-banner');
```

## Contenu

- `Toast`, `ConfirmDialog`, `Modal`, `MobileSidebar`, `OfflineBanner` —
  composants Vue, identiques à ceux déjà utilisés par amana_web_planning
  et amana_web_familles (la version fusionnée reprend le fix `bg-ink`
  introduit côté familles pour Toast.vue).
- `PromptDialog` + `usePrompt()` — remplace `prompt()` natif : résout à la
  chaîne saisie, ou à `null` si l'utilisateur annule (Annuler, Escape, clic
  sur le fond). Un appelant ne doit **jamais** traiter `null` comme un champ
  vide validé (`if (notes === null) return;`).
- `SearchableSelect` — accepte aussi une liste statique (`:items`, auquel cas
  `api-url` n'est plus requis — optionnel depuis v1.9.0) et un
  mode de recherche `match-mode="word-prefix"` (chaque mot du libellé est
  comparé par le début : « A » → prénom ou nom commençant par A).
- `useToast`, `useConfirm`, `usePrompt`, `useModal` — composables associés.
  `useConfirm().ask({ message, details: [{ label, value }] })` (v1.8.0) affiche en plus un
  récapitulatif libellé/valeur sous le message — pour les confirmations qui résument ce qu'on
  s'apprête à créer ; sans `details`, rendu inchangé.
- `lib/theme.ts`, `lib/confirmForms.ts` — bascule clair/sombre et pont
  `data-confirm` → `useConfirm()` pour les formulaires classiques.
- `lib/dialogs.ts` — `registerDialogs()` monte `PromptDialog` et expose
  `window.amanaPrompt()` / `window.amanaToast()` (avec `window.amanaConfirm()`
  de `confirmForms.ts`) pour le JS inline des pages Blade : remplace
  `prompt()`, `confirm()` et `alert()` natifs sans point de montage dédié.
- `tailwind-preset.js` — couleurs, typographie, ombres, radius.
- `styles/amana-shared.css` — jetons de couleur clair/sombre + styles
  résiduels du shell (sidebar, hamburger, flash, scrollbar).

## Ce qui n'est PAS ici

Tout ce qui est propre au métier d'une app reste dans l'app : composants
métier (`FamillesStatistiques.vue`, `ActiviteStatistiques.vue`...), et le
CSS résiduel propre à son domaine (chips de tâches planning, etc.).
