<!--
  src/components/SelectMenu.vue

  Menu déroulant « à choisir parmi quelques options » (10/10/2026) — complète SearchableSelect,
  pensé pour de longues listes interrogeables, par un sélecteur court et soigné : trois à une
  dizaine d'options, chacune avec une pastille (emoji ou point de couleur), un libellé et une
  description facultative. Remplace le <select> natif, impossible à styler, sans casser les
  conventions de l'app : jetons de couleur (surface/ink/accent), mode sombre, RTL, tactile.

  Utilisation :

    <SelectMenu
      v-model="form.type"
      :options="[
        { value: 'zakat_el_fitr', label: 'Zakat el-fitr', description: 'Distribution de fin de Ramadan', icon: '🌙', tone: 'emerald' },
        { value: 'don_ponctuel', label: 'Don ponctuel', icon: '🎁', tone: 'violet' },
      ]"
      placeholder="Choisir un type…"
      input-id="campagne-type"
    />

  Générique (V) : `v-model` garde le type exact des valeurs (ex. une union de littéraux), sans
  conversion côté appelant.

  Accessibilité : motif « combobox + listbox » (role, aria-expanded, aria-activedescendant),
  navigation complète au clavier (↑ ↓ Début Fin Entrée Espace Échap, saisie de la première lettre).
  Le panneau est téléporté dans <body> (jamais rogné par un conteneur à overflow) et s'ouvre
  vers le haut quand il manque de place en dessous.
-->
<script setup lang="ts" generic="V extends string = string">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";

export type SelectMenuTone =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "stone";

export interface SelectMenuOption<T extends string = string> {
  value: T;
  label: string;
  /** Ligne secondaire sous le libellé (dans la liste uniquement). */
  description?: string;
  /** Emoji ou court texte affiché dans une pastille ronde colorée. */
  icon?: string;
  /** Couleur de la pastille (ou du point, sans `icon`). Sans `tone` : neutre. */
  tone?: SelectMenuTone;
  disabled?: boolean;
}

// Classes écrites en toutes lettres : Tailwind ne détecte pas les noms construits dynamiquement
// (« bg-${tone}-50 »), mais scanne ce fichier grâce au glob node_modules/@amana/shared-ui/src.
const TONES: Record<SelectMenuTone, { chip: string; dot: string }> = {
  sky: {
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  rose: {
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  teal: {
    chip: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  stone: {
    chip: "bg-stone-100 text-stone-600 dark:bg-stone-500/20 dark:text-stone-300",
    dot: "bg-stone-400",
  },
};

const props = withDefaults(
  defineProps<{
    /** Valeur sélectionnée ; `null` (ou chaîne vide) = aucune. */
    modelValue: V | null;
    options: SelectMenuOption<V>[];
    placeholder?: string;
    /** `id` posé sur le bouton — pour un <label for="…">. */
    inputId?: string;
    /** Si renseigné, un <input type="hidden"> porte la valeur (formulaires classiques). */
    inputName?: string;
    disabled?: boolean;
    /** Bordure rouge (erreur de validation côté appelant). */
    invalid?: boolean;
    /** Affiche une ligne « Effacer la sélection » dans la liste. */
    clearable?: boolean;
    /** Champ de recherche dans le panneau (utile au-delà d'une huitaine d'options). */
    searchable?: boolean;
    searchPlaceholder?: string;
    emptyMessage?: string;
    clearLabel?: string;
    ariaLabel?: string;
    size?: "md" | "lg";
  }>(),
  {
    placeholder: "Sélectionner…",
    inputId: "",
    inputName: "",
    disabled: false,
    invalid: false,
    clearable: false,
    searchable: false,
    searchPlaceholder: "Rechercher…",
    emptyMessage: "Aucun résultat",
    clearLabel: "Effacer la sélection",
    ariaLabel: "",
    size: "md",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: V | null];
}>();

// Identifiant unique par instance pour relier le bouton, la liste et les options (aria-*).
let _instances = 0;
const uid = `selectmenu-${++_instances}-${Math.random().toString(36).slice(2, 7)}`;
const listId = `${uid}-list`;
const optionDomId = (i: number): string => `${uid}-opt-${i}`;

// ── État ────────────────────────────────────────────────────────────────────
const isOpen = ref(false);
const query = ref("");
const activeIndex = ref(-1);

const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);

const panelStyle = ref<Record<string, string>>({});

const selectedOption = computed<SelectMenuOption<V> | null>(
  () => props.options.find((o) => o.value === props.modelValue) ?? null,
);

/** Minuscules sans accents : recherche et saisie rapide tolérantes. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const visibleOptions = computed<SelectMenuOption<V>[]>(() => {
  const q = normalize(query.value).trim();
  if (!props.searchable || !q) return props.options;
  return props.options.filter(
    (o) =>
      normalize(o.label).includes(q) ||
      normalize(o.description ?? "").includes(q),
  );
});

// Ligne « Effacer la sélection » : hors de la liste, donc sans effet sur les index des options.
const showClear = computed(
  () => props.clearable && selectedOption.value !== null,
);

function toneOf(option: SelectMenuOption<V>): { chip: string; dot: string } {
  return TONES[option.tone ?? "stone"];
}

// ── Position du panneau ──────────────────────────────────────────────────────
const PANEL_MAX = 300; // px — hauteur maximale de la liste
const GAP = 6;
const EDGE = 12;

function updatePanelPosition(): void {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - EDGE;
  const above = rect.top - EDGE;
  // Ouvre vers le haut seulement s'il manque de la place en dessous ET qu'il y en a plus au-dessus.
  const openUp = below < Math.min(PANEL_MAX, 220) && above > below;
  const room = Math.max(140, Math.min(PANEL_MAX, openUp ? above : below));

  panelStyle.value = {
    position: "fixed",
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${room}px`,
    zIndex: "9999",
    ...(openUp
      ? { bottom: `${window.innerHeight - rect.top + GAP}px` }
      : { top: `${rect.bottom + GAP}px` }),
  };
}

// ── Ouverture / fermeture ────────────────────────────────────────────────────
function firstEnabledFrom(start: number, step: 1 | -1): number {
  const list = visibleOptions.value;
  for (let i = start; i >= 0 && i < list.length; i += step) {
    if (!list[i].disabled) return i;
  }
  return -1;
}

async function open(): Promise<void> {
  if (isOpen.value || props.disabled) return;
  updatePanelPosition();
  query.value = "";
  isOpen.value = true;
  const selectedIndex = visibleOptions.value.findIndex(
    (o) => o.value === props.modelValue && !o.disabled,
  );
  activeIndex.value =
    selectedIndex >= 0 ? selectedIndex : firstEnabledFrom(0, 1);
  await nextTick();
  if (props.searchable) searchRef.value?.focus();
  scrollActiveIntoView();
}

function close(refocus = false): void {
  if (!isOpen.value) return;
  isOpen.value = false;
  query.value = "";
  if (refocus) triggerRef.value?.focus();
}

function toggle(): void {
  if (isOpen.value) close();
  else void open();
}

function choose(option: SelectMenuOption<V>): void {
  if (option.disabled) return;
  emit("update:modelValue", option.value);
  close(true);
}

function clear(): void {
  emit("update:modelValue", null);
  close(true);
}

function scrollActiveIntoView(): void {
  void nextTick(() => {
    document
      .getElementById(optionDomId(activeIndex.value))
      ?.scrollIntoView?.({ block: "nearest" });
  });
}

function move(step: 1 | -1): void {
  const list = visibleOptions.value;
  if (!list.length) return;
  const start = activeIndex.value < 0 ? (step === 1 ? 0 : list.length - 1) : activeIndex.value + step;
  const next = firstEnabledFrom(start, step);
  if (next >= 0) {
    activeIndex.value = next;
    scrollActiveIntoView();
  }
}

// Saisie rapide (sans champ de recherche) : taper « d » saute à la première option qui commence par « d ».
let typeBuffer = "";
let typeTimer: ReturnType<typeof setTimeout> | undefined;

function typeAhead(char: string): void {
  typeBuffer += normalize(char);
  clearTimeout(typeTimer);
  typeTimer = setTimeout(() => (typeBuffer = ""), 600);
  const index = visibleOptions.value.findIndex(
    (o) => !o.disabled && normalize(o.label).startsWith(typeBuffer),
  );
  if (index >= 0) {
    activeIndex.value = index;
    scrollActiveIntoView();
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (props.disabled) return;

  if (!isOpen.value) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      void open();
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      move(1);
      break;
    case "ArrowUp":
      e.preventDefault();
      move(-1);
      break;
    case "Home":
      e.preventDefault();
      activeIndex.value = firstEnabledFrom(0, 1);
      scrollActiveIntoView();
      break;
    case "End":
      e.preventDefault();
      activeIndex.value = firstEnabledFrom(visibleOptions.value.length - 1, -1);
      scrollActiveIntoView();
      break;
    case "Enter": {
      e.preventDefault();
      const option = visibleOptions.value[activeIndex.value];
      if (option) choose(option);
      break;
    }
    case " ":
      // Dans le champ de recherche, l'espace reste une espace.
      if (!props.searchable) {
        e.preventDefault();
        const option = visibleOptions.value[activeIndex.value];
        if (option) choose(option);
      }
      break;
    case "Escape":
      e.preventDefault();
      close(true);
      break;
    case "Tab":
      close();
      break;
    default:
      if (!props.searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeAhead(e.key);
      }
  }
}

// La recherche change la liste : l'option active repart sur la première option sélectionnable.
watch(query, () => {
  activeIndex.value = firstEnabledFrom(0, 1);
});

// ── Fermeture par clic extérieur / défilement ────────────────────────────────
function onPointerDown(e: PointerEvent): void {
  if (!isOpen.value) return;
  const target = e.target as Node;
  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) return;
  close();
}

function onScrollOrResize(e: Event): void {
  if (!isOpen.value) return;
  // Le défilement DE LA LISTE ne doit ni fermer ni déplacer le panneau.
  if (e.target instanceof Node && panelRef.value?.contains(e.target)) return;
  updatePanelPosition();
}

onMounted(() => {
  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointerDown, true);
  window.removeEventListener("scroll", onScrollOrResize, true);
  window.removeEventListener("resize", onScrollOrResize);
  clearTimeout(typeTimer);
});
</script>

<template>
  <div class="relative w-full">
    <input
      v-if="inputName"
      type="hidden"
      :name="inputName"
      :value="modelValue ?? ''"
    />

    <!-- Bouton déclencheur -->
    <button
      :id="inputId || undefined"
      ref="triggerRef"
      type="button"
      role="combobox"
      :disabled="disabled"
      :aria-label="ariaLabel || undefined"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-controls="isOpen ? listId : undefined"
      :aria-activedescendant="isOpen && activeIndex >= 0 ? optionDomId(activeIndex) : undefined"
      :aria-invalid="invalid || undefined"
      class="btn-touch group flex w-full items-center gap-3 rounded-xl border-[1.5px] bg-surface text-start font-body transition-all duration-150 motion-reduce:transition-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      :class="[
        size === 'lg' ? 'px-3.5 py-3 text-[14px]' : 'px-3 py-2.5 text-[13.5px]',
        invalid
          ? 'border-rose-400 focus-visible:shadow-[0_0_0_3px_rgba(244,63,94,0.2)]'
          : isOpen
            ? 'border-accent shadow-glow'
            : 'border-surface-border hover:border-accent/60 focus-visible:border-accent focus-visible:shadow-glow',
      ]"
      @click="toggle"
      @keydown="onKeydown"
    >
      <template v-if="selectedOption">
        <slot name="selected" :option="selectedOption">
          <span
            v-if="selectedOption.icon"
            class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px] leading-none"
            :class="toneOf(selectedOption).chip"
            aria-hidden="true"
            >{{ selectedOption.icon }}</span
          >
          <span
            v-else-if="selectedOption.tone"
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :class="toneOf(selectedOption).dot"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate font-medium text-ink">{{
            selectedOption.label
          }}</span>
        </slot>
      </template>
      <span v-else class="min-w-0 flex-1 truncate text-ink-muted">{{
        placeholder
      }}</span>

      <svg
        class="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 motion-reduce:transition-none"
        :class="isOpen ? 'rotate-180 text-accent' : 'group-hover:text-ink'"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5.5 7.75 10 12.25l4.5-4.5" />
      </svg>
    </button>

    <!-- Panneau (dans <body> : jamais rogné par un parent à overflow) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      >
        <div
          v-if="isOpen"
          ref="panelRef"
          :style="panelStyle"
          class="flex flex-col overflow-hidden rounded-xl border border-surface-border bg-surface font-body shadow-lg ring-1 ring-black/5 dark:ring-white/5"
        >
          <div
            v-if="searchable"
            class="border-b border-surface-border p-2"
          >
            <input
              ref="searchRef"
              v-model="query"
              type="text"
              role="searchbox"
              autocomplete="off"
              :placeholder="searchPlaceholder"
              :aria-controls="listId"
              class="w-full rounded-lg border border-surface-border bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:shadow-glow"
              @keydown="onKeydown"
            />
          </div>

          <ul
            :id="listId"
            role="listbox"
            :aria-label="ariaLabel || placeholder"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
          >
            <li
              v-for="(option, index) in visibleOptions"
              :id="optionDomId(index)"
              :key="option.value"
              role="option"
              :aria-selected="option.value === modelValue"
              :aria-disabled="option.disabled || undefined"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-100"
              :class="[
                option.disabled ? 'cursor-not-allowed opacity-45' : '',
                option.value === modelValue
                  ? index === activeIndex
                    ? 'bg-accent/15 dark:bg-accent/30'
                    : 'bg-accent/10 dark:bg-accent/20'
                  : index === activeIndex && !option.disabled
                    ? 'bg-surface-3'
                    : '',
              ]"
              @mouseenter="!option.disabled && (activeIndex = index)"
              @click="choose(option)"
            >
              <slot
                name="option"
                :option="option"
                :selected="option.value === modelValue"
                :active="index === activeIndex"
              >
                <span
                  v-if="option.icon"
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] leading-none"
                  :class="toneOf(option).chip"
                  aria-hidden="true"
                  >{{ option.icon }}</span
                >
                <span
                  v-else-if="option.tone"
                  class="mx-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  :class="toneOf(option).dot"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-[13.5px]"
                    :class="
                      option.value === modelValue
                        ? 'font-semibold text-accent'
                        : 'font-medium text-ink'
                    "
                    >{{ option.label }}</span
                  >
                  <span
                    v-if="option.description"
                    class="mt-0.5 block text-[12px] leading-snug text-ink-muted"
                    >{{ option.description }}</span
                  >
                </span>
              </slot>
              <svg
                v-if="option.value === modelValue"
                class="h-4 w-4 shrink-0 text-accent"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4.5 10.5 3.5 3.5 7.5-8" />
              </svg>
            </li>

            <li
              v-if="!visibleOptions.length"
              class="px-3 py-4 text-center text-[13px] text-ink-muted"
              role="presentation"
            >
              {{ emptyMessage }}
            </li>
          </ul>

          <button
            v-if="showClear"
            type="button"
            class="border-t border-surface-border px-3 py-2 text-start text-[12.5px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            @click="clear"
          >
            {{ clearLabel }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
