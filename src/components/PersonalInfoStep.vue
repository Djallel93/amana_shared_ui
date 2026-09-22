<!-- src/components/PersonalInfoStep.vue -->
<!--
    Bloc "informations personnelles" (nom/prénom/téléphone/email) commun
    aux formulaires publics multi-étapes AMANA — extrait le 24/08/2026
    depuis amana_web_familles/resources/js/components/intake/IntakeForm.vue
    (étape "identite"), pour être réutilisé par le formulaire de
    candidature bénévole et toute future app publique.

    Pas de dictionnaire i18n interne à ce composant : contrairement aux
    apps consommatrices (qui codent leur DICT en dur), ce package n'a pas
    encore de mécanisme i18n partagé — tous les libellés sont donc reçus
    en props (voir `labels`). Charge à l'app appelante de fournir les
    traductions fr/ar/en, comme elle le fait déjà pour ses propres étapes.

    Usage :
        <PersonalInfoStep v-model="form" :labels="t" :errors="errors" />
    où `form` expose au minimum { nom, prenom, telephone, email } et,
    optionnellement, `telephone_bis` (masqué si `showTelephoneBis` est
    false ou si `labels.telephoneBis` est absent).
-->
<script setup lang="ts">
import { computed } from "vue";

export interface PersonalInfoValue {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  telephone_bis?: string;
}

export interface PersonalInfoLabels {
  nom: string;
  prenom: string;
  telephone: string;
  telephoneHint?: string;
  telephoneBis?: string;
  email: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: PersonalInfoValue;
    labels: PersonalInfoLabels;
    errors?: Record<string, string>;
    showTelephoneBis?: boolean;
  }>(),
  {
    errors: () => ({}),
    showTelephoneBis: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: PersonalInfoValue];
}>();

function update<K extends keyof PersonalInfoValue>(
  field: K,
  value: PersonalInfoValue[K],
): void {
  emit("update:modelValue", { ...props.modelValue, [field]: value });
}

const afficherTelephoneBis = computed(
  () => props.showTelephoneBis && !!props.labels.telephoneBis,
);
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-semibold text-ink mb-1"
        >{{ labels.nom }} *</label
      >
      <input
        :value="modelValue.nom"
        @input="update('nom', ($event.target as HTMLInputElement).value)"
        type="text"
        class="w-full px-3 py-2.5 border border-ink-faint rounded-md text-[14px] bg-surface-2 outline-none focus:border-accent"
      />
      <span v-if="errors.nom" class="text-[11px] text-rose-600">{{
        errors.nom
      }}</span>
    </div>

    <div>
      <label class="block text-xs font-semibold text-ink mb-1"
        >{{ labels.prenom }} *</label
      >
      <input
        :value="modelValue.prenom"
        @input="update('prenom', ($event.target as HTMLInputElement).value)"
        type="text"
        class="w-full px-3 py-2.5 border border-ink-faint rounded-md text-[14px] bg-surface-2 outline-none focus:border-accent"
      />
      <span v-if="errors.prenom" class="text-[11px] text-rose-600">{{
        errors.prenom
      }}</span>
    </div>

    <div>
      <label class="block text-xs font-semibold text-ink mb-1"
        >{{ labels.telephone }} *</label
      >
      <input
        :value="modelValue.telephone"
        @input="update('telephone', ($event.target as HTMLInputElement).value)"
        type="tel"
        placeholder="0123456789"
        class="w-full px-3 py-2.5 border border-ink-faint rounded-md text-[14px] bg-surface-2 outline-none focus:border-accent"
      />
      <p v-if="labels.telephoneHint" class="text-[11px] text-ink-faint mt-1">
        {{ labels.telephoneHint }}
      </p>
      <span v-if="errors.telephone" class="block text-[11px] text-rose-600">{{
        errors.telephone
      }}</span>
    </div>

    <div v-if="afficherTelephoneBis">
      <label class="block text-xs font-semibold text-ink mb-1">{{
        labels.telephoneBis
      }}</label>
      <input
        :value="modelValue.telephone_bis ?? ''"
        @input="
          update('telephone_bis', ($event.target as HTMLInputElement).value)
        "
        type="tel"
        placeholder="0123456789"
        class="w-full px-3 py-2.5 border border-ink-faint rounded-md text-[14px] bg-surface-2 outline-none focus:border-accent"
      />
      <span
        v-if="errors.telephone_bis"
        class="block text-[11px] text-rose-600"
        >{{ errors.telephone_bis }}</span
      >
    </div>

    <div>
      <label class="block text-xs font-semibold text-ink mb-1"
        >{{ labels.email }} *</label
      >
      <input
        :value="modelValue.email"
        @input="update('email', ($event.target as HTMLInputElement).value)"
        type="email"
        class="w-full px-3 py-2.5 border border-ink-faint rounded-md text-[14px] bg-surface-2 outline-none focus:border-accent"
      />
      <span v-if="errors.email" class="text-[11px] text-rose-600">{{
        errors.email
      }}</span>
    </div>
  </div>
</template>
