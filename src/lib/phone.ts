// src/lib/phone.ts
//
// Affichage des numéros de téléphone français (17/10/2026) — « +33 1 23 45 67 89 » — défini UNE fois
// pour toutes les apps AMANA. Équivalent côté TypeScript de Amana\Shared\Support\PhoneFr::formater()
// (amana_shared) : mêmes règles, mêmes résultats.
//
// Affichage SEULEMENT : la valeur stockée / saisie n'est jamais modifiée, et un numéro qui n'est pas
// un numéro français valide (étranger, incomplet) est renvoyé tel quel — on ne masque aucune donnée.

/**
 * « 0123456789 », « +33 1 23 45 67 89 », « 0033 1.23.45.67.89 »… → « +33 1 23 45 67 89 ».
 * Renvoie `""` pour une valeur vide ou absente, pour qu'un `{{ }}` ne rende pas « null ».
 */
export function formaterTelephoneFr(telephone: string | null | undefined): string {
  if (telephone == null || telephone.trim() === "") return "";

  let chiffres = telephone.replace(/\D/g, "");

  // Normalise vers 9 chiffres significatifs (sans le 0 ni l'indicatif 33 / 0033).
  if (chiffres.startsWith("0033") && chiffres.length === 13) chiffres = chiffres.slice(4);
  else if (chiffres.startsWith("33") && chiffres.length === 11) chiffres = chiffres.slice(2);
  else if (chiffres.startsWith("0") && chiffres.length === 10) chiffres = chiffres.slice(1);

  // Un numéro français ne commence jamais par 0 une fois l'indicatif retiré.
  if (chiffres.length !== 9 || chiffres.startsWith("0")) return telephone;

  const groupes = [chiffres.slice(0, 1)];
  for (let i = 1; i < 9; i += 2) groupes.push(chiffres.slice(i, i + 2));

  return `+33 ${groupes.join(" ")}`;
}

/**
 * Valeur d'un lien `tel:` : « +33123456789 » pour un numéro français reconnu, sinon les chiffres saisis
 * (avec leur « + » éventuel). Le texte affiché passe par formaterTelephoneFr() ; le href reste sans
 * espace pour que tous les composeurs le comprennent. `null` si rien de composable.
 */
export function lienTelephone(telephone: string | null | undefined): string | null {
  if (telephone == null || telephone.trim() === "") return null;

  const formate = formaterTelephoneFr(telephone);
  if (formate.startsWith("+33 ")) return `+33${formate.slice(4).replace(/\D/g, "")}`;

  const brut = telephone.replace(/[^\d+]/g, "");
  return brut === "" ? null : brut;
}
