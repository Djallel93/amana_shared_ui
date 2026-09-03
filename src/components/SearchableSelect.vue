<!--
    src/components/SearchableSelect.vue

    Promu depuis amana_web_planning/resources/js/components/shared/SearchableSelect.vue
    le 04/09/2026 (voir roadmap mobile §4.3 / step 7). Ce composant y servait
    uniquement à choisir un ou plusieurs calendriers Google Calendar — les
    props apiUrl/modelValue/multiple étaient déjà génériques, mais la forme
    de la réponse API ({ calendars: [...] }) et plusieurs textes affichés
    ("Sélectionner un calendrier…", "Rechercher un calendrier…", "Aucun
    calendrier disponible", le message d'erreur réseau) étaient en dur,
    spécifiques à ce cas d'usage. Généralisé ici via itemsResponseKey +
    des props de texte, TOUTES avec une valeur par défaut identique au
    comportement d'origine — un appelant qui ne passe aucune de ces
    nouvelles props se comporte exactement comme avant (voir
    amana_web_planning, qui repointe simplement son import sur ce fichier
    sans changer aucun prop existant).
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

export interface SearchableSelectItem {
  id: string;
  name: string;
}

// ── Props ─────────────────────────────────────────────────────────────────
// modelValue :
//   - mode simple  (multiple=false) → string ('' si rien sélectionné)
//   - mode multiple (multiple=true) → string[] ([] si rien sélectionné)
// Le composant garde un seul fichier pour les deux modes plutôt que d'en
// dupliquer un — la logique de fetch/cache/positionnement du dropdown est
// strictement identique, seule la sélection change.
const props = withDefaults(
  defineProps<{
    apiUrl: string;
    modelValue: string | string[];
    placeholder?: string;
    inputName?: string;
    inputId?: string;
    multiple?: boolean;
    /** Clé du tableau d'éléments dans la réponse JSON de apiUrl, ex. { calendars: [...] } → 'calendars'. */
    itemsResponseKey?: string;
    /** Placeholder du champ de recherche dans le dropdown. */
    searchPlaceholder?: string;
    /** Message affiché si le fetch échoue (réseau/serveur). */
    errorMessage?: string;
    /** Message affiché quand la liste chargée est vide (avant filtrage). */
    emptyMessage?: string;
  }>(),
  {
    placeholder: "Sélectionner un calendrier…",
    inputName: "",
    inputId: "",
    multiple: false,
    itemsResponseKey: "calendars",
    searchPlaceholder: "Rechercher un calendrier…",
    errorMessage: "Impossible de contacter le service.",
    emptyMessage: "Aucun élément disponible",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | string[]];
}>();

// ── État local ────────────────────────────────────────────────────────────
const isOpen = ref(false);
const query = ref("");
const items = ref<SearchableSelectItem[]>([]);
const loading = ref(false);
const fetchError = ref("");

// Ref sur le bouton déclencheur — nécessaire pour calculer la position
// du dropdown via getBoundingClientRect() une fois qu'il est téléporté dans body.
const triggerRef = ref<HTMLButtonElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const wrapperRef = ref<HTMLDivElement | null>(null);

// ── Position du dropdown (calculée depuis le bouton trigger) ──────────────
// Le dropdown est dans <Teleport to="body">, donc "position: absolute" ne
// peut plus se baser sur un ancêtre positionné — il faut des coordonnées
// viewport explicites (position: fixed + top/left calculés).
//
// Pourquoi fixed et pas absolute depuis body ?
// "absolute depuis body" serait affecté par le scroll de la page (le dropdown
// resterait à sa position initiale quand on scrolle). "fixed" est ancré au
// viewport — on recalcule top/left depuis getBoundingClientRect() qui retourne
// des coordonnées viewport, et le dropdown suit visuellement le bouton.
const dropdownStyle = ref({
  position: "fixed" as const,
  top: "0px",
  left: "0px",
  width: "0px",
  zIndex: "9999",
});

function updateDropdownPosition(): void {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: "9999",
  };
}

// ── Cache module-level partagé entre toutes les instances ─────────────────
// Clé de cache = apiUrl + itemsResponseKey : deux appelants pointant sur la
// même apiUrl mais lisant une clé de réponse différente ne doivent pas se
// marcher dessus (cas hypothétique, aucun usage actuel n'en a besoin, mais
// coûte rien à éviter).
const _cache = new Map<string, SearchableSelectItem[]>();
const _inflight = new Map<string, Promise<SearchableSelectItem[]>>();

function cacheKey(): string {
  return `${props.apiUrl}::${props.itemsResponseKey}`;
}

// ── Helpers de lecture du modelValue selon le mode ─────────────────────────
const selectedValues = computed((): string[] => {
  if (!props.multiple) return [];
  return Array.isArray(props.modelValue) ? props.modelValue : [];
});

const selectedLabel = computed((): string => {
  if (props.multiple) return ""; // non utilisé en mode multiple (chips à la place)
  if (typeof props.modelValue !== "string" || !props.modelValue) return "";
  return labelFor(props.modelValue);
});

/**
 * Résout un ID vers son nom d'affichage à partir de la liste chargée depuis
 * l'API. Tant que la liste n'est pas encore chargée (ou si l'ID sélectionné
 * n'y figure plus), on retombe sur l'ID brut plutôt que d'afficher un champ
 * vide.
 */
function labelFor(id: string): string {
  return items.value.find((c) => c.id === id)?.name ?? id;
}

function isSelected(item: SearchableSelectItem): boolean {
  return props.multiple
    ? selectedValues.value.includes(item.id)
    : item.id === props.modelValue;
}

const filteredItems = computed(() => {
  const q = query.value.toLowerCase().trim();
  if (!q) return items.value;
  return items.value.filter((c) => c.name.toLowerCase().includes(q));
});

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchItems(): Promise<void> {
  const key = cacheKey();
  if (_cache.has(key)) {
    items.value = _cache.get(key)!;
    return;
  }
  if (_inflight.has(key)) {
    items.value = await _inflight.get(key)!;
    return;
  }

  loading.value = true;
  fetchError.value = "";

  const promise = fetch(props.apiUrl, {
    headers: {
      Accept: "application/json",
      "X-CSRF-TOKEN":
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
          ?.content ?? "",
      "X-Requested-With": "XMLHttpRequest",
    },
  })
    .then((r) => r.json())
    .then((data: Record<string, unknown> & { erreur?: string }) => {
      const result =
        (data[props.itemsResponseKey] as SearchableSelectItem[] | undefined) ??
        [];
      _cache.set(key, result);
      if (data.erreur) fetchError.value = String(data.erreur);
      return result;
    })
    .catch(() => {
      fetchError.value = props.errorMessage;
      return [] as SearchableSelectItem[];
    })
    .finally(() => {
      _inflight.delete(key);
      loading.value = false;
    });

  _inflight.set(key, promise);
  items.value = await promise;
}

// ── Ouvrir / fermer ────────────────────────────────────────────────────────
async function open(): Promise<void> {
  if (isOpen.value) return;
  // Calculer la position AVANT d'ouvrir, pendant que le trigger est en place.
  updateDropdownPosition();
  isOpen.value = true;
  query.value = "";
  if (!items.value.length) await fetchItems();
  await nextTick();
  searchInputRef.value?.focus();
}

function close(): void {
  isOpen.value = false;
  query.value = "";
}

function toggle(): void {
  isOpen.value ? close() : open();
}

/**
 * Sélectionne (ou bascule, en mode multiple) un élément.
 * Mode simple  : émet la valeur et ferme le dropdown (comportement d'origine).
 * Mode multiple : bascule l'entrée dans le tableau, ne ferme PAS le dropdown
 *                 (l'utilisateur peut cocher plusieurs éléments d'affilée).
 */
function select(item: SearchableSelectItem): void {
  if (!props.multiple) {
    emit("update:modelValue", item.id);
    close();
    return;
  }

  const current = selectedValues.value;
  const next = current.includes(item.id)
    ? current.filter((v) => v !== item.id)
    : [...current, item.id];
  emit("update:modelValue", next);
}

function removeChip(value: string): void {
  emit(
    "update:modelValue",
    selectedValues.value.filter((v) => v !== value),
  );
}

function clear(): void {
  emit("update:modelValue", props.multiple ? [] : "");
  if (!props.multiple) close();
}

// ── Fermeture par clic extérieur ───────────────────────────────────────────
// Le dropdown est dans <body> via Teleport — wrapperRef (le composant racine)
// et le dropdown lui-même sont deux sous-arbres DOM distincts. On doit
// vérifier les deux pour ne pas fermer quand on clique à l'intérieur du dropdown.
const dropdownRef = ref<HTMLDivElement | null>(null);

function onDocClick(e: MouseEvent): void {
  const target = e.target as Node;
  if (wrapperRef.value?.contains(target) || dropdownRef.value?.contains(target))
    return;
  close();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") close();
}

// Recalcule la position si la page défile ou si la fenêtre est redimensionnée
// pendant que le dropdown est ouvert — pour qu'il reste aligné sur le trigger.
function onScrollOrResize(): void {
  if (isOpen.value) updateDropdownPosition();
}

onMounted(() => {
  document.addEventListener("click", onDocClick, true); // capture phase pour fiabilité
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
  fetchItems(); // pré-chargement en arrière-plan
});

onUnmounted(() => {
  document.removeEventListener("click", onDocClick, true);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", onScrollOrResize, true);
  window.removeEventListener("resize", onScrollOrResize);
});
</script>

<template>
  <div ref="wrapperRef" class="relative w-full">
    <!--
            Inputs cachés pour soumission du form Blade.
            Mode simple   : un seul input, valeur = la chaîne sélectionnée.
            Mode multiple : un input par valeur sélectionnée, name="xxx[]"
                            pour que Laravel les reçoive comme un tableau —
                            même convention que des checkboxes natives.
        -->
    <template v-if="inputName">
      <input
        v-if="!multiple"
        type="hidden"
        :name="inputName"
        :id="inputId || undefined"
        :value="modelValue"
      />
      <template v-else>
        <input
          v-for="val in selectedValues"
          :key="val"
          type="hidden"
          :name="`${inputName}[]`"
          :value="val"
        />
      </template>
    </template>

    <!-- Bouton déclencheur -->
    <button
      ref="triggerRef"
      type="button"
      class="btn-touch flex items-center justify-between gap-2 w-full px-3 py-2.5 border-[1.5px] rounded-lg bg-surface font-body text-[13.5px] cursor-pointer text-left transition-colors"
      :class="
        isOpen
          ? 'border-accent shadow-glow'
          : 'border-ink-faint hover:border-accent'
      "
      @click="toggle"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
    >
      <!-- Mode multiple : chips des éléments sélectionnés -->
      <span v-if="multiple" class="flex-1 flex flex-wrap gap-1.5 min-h-[20px]">
        <span v-if="!selectedValues.length" class="text-ink-muted">{{
          placeholder
        }}</span>
        <span
          v-for="val in selectedValues"
          :key="val"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-sky-50 text-accent"
        >
          {{ labelFor(val) }}
          <span
            role="button"
            aria-label="Retirer"
            class="cursor-pointer opacity-60 hover:opacity-100 leading-none"
            @click.stop="removeChip(val)"
            >×</span
          >
        </span>
      </span>

      <!-- Mode simple : libellé unique (comportement d'origine) -->
      <span
        v-else
        class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
        :class="selectedLabel ? 'text-ink' : 'text-ink-muted'"
      >
        {{ selectedLabel || placeholder }}
      </span>

      <span
        class="flex-shrink-0 text-[10px] text-ink-muted transition-transform duration-150"
        :class="isOpen ? 'rotate-180' : ''"
        >▼</span
      >
    </button>

    <!--
            <Teleport to="body"> : le dropdown est rendu directement dans <body>,
            hors de tout ancêtre avec overflow:hidden. C'est la seule solution
            fiable quand le déclencheur est imbriqué dans une card overflow-hidden.

            La position est calculée dynamiquement via getBoundingClientRect()
            sur le bouton trigger (voir updateDropdownPosition()), et appliquée
            via :style sur le div du dropdown — coordonnées viewport (position: fixed).
        -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          :style="dropdownStyle"
          class="bg-surface border-[1.5px] border-ink-faint rounded-lg shadow-lg overflow-hidden"
          role="listbox"
          :aria-multiselectable="multiple"
        >
          <!-- Champ recherche -->
          <div class="px-2.5 pt-2.5 pb-1.5 border-b border-surface-3">
            <input
              ref="searchInputRef"
              v-model="query"
              type="text"
              :placeholder="searchPlaceholder"
              autocomplete="off"
              class="w-full px-2.5 py-1.5 border-[1.5px] border-ink-faint rounded-lg text-[13px] font-body text-ink bg-surface-2 outline-none transition-colors focus:border-accent focus:shadow-glow"
            />
          </div>

          <!-- Liste -->
          <div class="max-h-[240px] overflow-y-auto py-1">
            <div
              v-if="loading"
              class="flex items-center justify-center gap-2 py-4 text-[13px] text-ink-muted"
            >
              <span class="animate-spin">⏳</span> Chargement…
            </div>

            <div
              v-else-if="fetchError && !items.length"
              class="px-4 py-3 text-[12.5px] text-rose-700 bg-rose-50 border-t border-rose-200"
            >
              ⚠️ {{ fetchError }}
            </div>

            <div
              v-else-if="!filteredItems.length"
              class="py-4 px-4 text-center text-[13px] text-ink-muted"
            >
              <template v-if="query"
                >Aucun résultat pour « {{ query }} »</template
              >
              <template v-else>{{ emptyMessage }}</template>
            </div>

            <div
              v-for="item in filteredItems"
              :key="item.id"
              role="option"
              :aria-selected="isSelected(item)"
              class="flex items-center gap-2 px-3.5 py-2.5 text-[13.5px] text-ink cursor-pointer transition-colors overflow-hidden text-ellipsis whitespace-nowrap"
              :class="
                isSelected(item)
                  ? 'bg-sky-50 text-accent font-semibold'
                  : 'hover:bg-surface-2'
              "
              @click="select(item)"
            >
              <span
                v-if="multiple"
                class="flex-shrink-0 w-4 h-4 rounded border-[1.5px] flex items-center justify-center text-[10px]"
                :class="
                  isSelected(item)
                    ? 'bg-accent border-accent text-white'
                    : 'border-ink-faint'
                "
              >
                <span v-if="isSelected(item)">✓</span>
              </span>
              <span
                class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                >{{ item.name }}</span
              >
            </div>
          </div>

          <!-- Effacer -->
          <div class="px-3.5 py-2 border-t border-surface-3">
            <button
              type="button"
              class="text-[12px] text-ink-muted hover:text-rose-600 bg-transparent border-0 cursor-pointer p-0 underline font-body transition-colors"
              @click="clear"
            >
              ✕ Effacer la sélection
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
</style>
