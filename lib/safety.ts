import { normalizeText } from "./clinic";

export function isUrgencyIntent(text: string): boolean {
  const n = normalizeText(text);
  return (
    n.includes("dor forte") ||
    n.includes("estou com dor forte") ||
    n.includes("doendo muito") ||
    n.includes("emergencia") ||
    n.includes("urgencia") ||
    n.includes("sangrando") ||
    (n.includes("dor") && n.includes("agora") && n.includes("forte"))
  );
}

export function isUnknownCommercialIntent(text: string): boolean {
  const n = normalizeText(text);
  return (
    (n.includes("implante") && (n.includes("sedac") || n.includes("parcel") || n.includes("24") || n.includes("cheque"))) ||
    (n.includes("implante") && n.includes("sedac")) ||
    (n.includes("parcelam") && n.includes("cheque"))
  );
}

const PRICE_RE = /r\$\s?\d/i;

export function mentionsUnauthorizedPrice(reply: string, authorizedLabels: string[]): boolean {
  if (!PRICE_RE.test(reply)) return false;
  const allowed = authorizedLabels.map((l) => l.replace(/\s/g, "").toLowerCase());
  const found = reply.match(/r\$\s?[\d.]+/gi) ?? [];
  return found.some((p) => {
    const compact = p.replace(/\s/g, "").toLowerCase();
    return !allowed.some((a) => a.includes(compact) || compact.includes(a.replace(/[^\d]/g, "")));
  });
}
