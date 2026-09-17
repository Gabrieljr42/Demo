import clinicJson from "../data/clinic.json";
import type { Clinic } from "./types";

export function getClinic(): Clinic {
  return clinicJson as Clinic;
}

export function authorizedPriceLines(clinic: Clinic = getClinic()): string[] {
  return clinic.services
    .filter((s) => s.canDisclosePrice && s.priceLabel)
    .map((s) => `${s.name}: ${s.priceLabel}`);
}

export function serviceByKeyword(text: string, clinic: Clinic = getClinic()) {
  const n = normalizeText(text);
  return clinic.services.filter((s) => {
    const names = [s.name, s.id, ...s.keywords].map(normalizeText);
    return names.some((k) => k.length > 2 && n.includes(k));
  });
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
