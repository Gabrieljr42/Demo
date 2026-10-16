import { getClinic, normalizeText, serviceByKeyword } from "./clinic";
import {
  describeHours,
  matchOfferedSlot,
  tomorrowInfo,
  upcomingSlots,
} from "./slots";
import {
  initialState,
  type BrainResult,
  type Clinic,
  type ConversationState,
  type StaffEvent,
} from "./types";

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const PHONE_RE = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)(?:9\d{4}|\d{4,5})-?\d{4}/;

export function extractPhone(text: string): string | null {
  const m = text.replace(/\./g, "").match(PHONE_RE);
  return m ? m[0].trim() : null;
}

export function looksLikeName(text: string): boolean {
  const n = text.trim();
  if (n.length < 3 || n.length > 80) return false;
  if (PHONE_RE.test(n)) return false;
  if (/[?]/.test(n)) return false;
  const words = n.split(/\s+/);
  if (words.some((w) => w.length > 20)) return false;
  const blocked = [
    "quero",
    "agendar",
    "horario",
    "quanto",
    "dor",
    "implante",
    "amanha",
    "amanhã",
  ];
  const norm = normalizeText(n);
  if (blocked.some((b) => norm === b || norm.startsWith(b + " "))) return false;
  return /^[\p{L}\s'.-]+$/u.test(n);
}

function isUrgency(n: string) {
  const keys = [
    "dor forte",
    "dor demais",
    "doendo muito",
    "muita dor",
    "dor insuportavel",
    "emergencia",
    "urgencia",
    "sangrando",
    "sangramento",
    "dente quebrado",
    "quebrei o dente",
    "trauma",
    "inchaco",
    "incho",
    "inchado",
    "febre",
    "agora estou com dor",
    "estou com dor forte",
    "to com dor forte",
    "socorro",
    "nao aguento a dor",
  ];
  return keys.some((k) => n.includes(k)) || (n.includes("dor") && (n.includes("agora") || n.includes("forte")));
}

function isUnknownCommercial(n: string) {
  const flags = [
    n.includes("implante"),
    n.includes("sedac"),
    n.includes("24x") || n.includes("24 x") || n.includes("vinte e quatro"),
    n.includes("cheque"),
    n.includes("parcel") && (n.includes("24") || n.includes("cheque")),
  ];
  return flags.filter(Boolean).length >= 1 && (n.includes("implante") || n.includes("sedac") || n.includes("parcel") || n.includes("cheque") || n.includes("24x"));
}

function isHours(n: string) {
  return (
    n.includes("atendem amanha") ||
    n.includes("abre amanha") ||
    n.includes("aberto amanha") ||
    n.includes("amanha") ||
    n.includes("horario") ||
    n.includes("funcionamento") ||
    n.includes("que horas") ||
    n.includes("abrem") ||
    n.includes("funcionam") ||
    n.includes("hoje voces") ||
    (n.includes("atendem") && (n.includes("hoje") || n.includes("sabado") || n.includes("domingo") || n.includes("amanha")))
  );
}

function isPrice(n: string) {
  return (
    n.includes("quanto") ||
    n.includes("valor") ||
    n.includes("preco") ||
    n.includes("custa") ||
    n.includes("fica uma") ||
    n.includes("cobra") ||
    n.includes("tabela")
  );
}

function isSchedule(n: string) {
  return (
    n.includes("agendar") ||
    n.includes("marcar") ||
    n.includes("quero horario") ||
    n.includes("tem vaga") ||
    n.includes("encaixe") ||
    n.includes("disponivel") ||
    n.includes("quero marcar")
  );
}

function isAddress(n: string) {
  return (
    n.includes("endereco") ||
    n.includes("onde fica") ||
    n.includes("localizacao") ||
    n.includes("estacionamento") ||
    n.includes("estacionar") ||
    n.includes("como chegar")
  );
}

function isInsurance(n: string) {
  return (
    n.includes("convenio") ||
    n.includes("plano") ||
    n.includes("unimed") ||
    n.includes("amil") ||
    n.includes("bradesco") ||
    n.includes("particular") ||
    n.includes("aceita")
  );
}

function isCancel(n: string) {
  return n.includes("remarcar") || n.includes("cancelar") || n.includes("desmarcar");
}

function isFirstVisit(n: string) {
  return (
    n.includes("primeira consulta") ||
    n.includes("o que levar") ||
    n.includes("que levar") ||
    n.includes("levar na") ||
    n.includes("documentos")
  );
}

function isGreeting(n: string) {
  return /^(oi|ola|olaa|bom dia|boa tarde|boa noite|e ai|hey|hello)\b/.test(n) || n === "oi" || n === "ola";
}

function formatSlots(slots: ReturnType<typeof upcomingSlots>) {
  return slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
}

function priceReply(text: string, clinic: Clinic): string {
  const found = serviceByKeyword(text, clinic);
  const lines: string[] = [];

  if (found.length) {
    for (const s of found) {
      if (s.canDisclosePrice && s.priceLabel) {
        lines.push(`• ${s.name}: ${s.priceLabel}`);
      } else {
        lines.push(
          `• ${s.name}: o valor é informado na avaliação — eu não publico preço que a clínica não autorizou nesta base.`,
        );
      }
    }
  } else {
    const authorized = clinic.services.filter((s) => s.canDisclosePrice && s.priceLabel);
    lines.push("Posso informar só o que está liberado na nossa base:");
    for (const s of authorized) {
      lines.push(`• ${s.name}: ${s.priceLabel}`);
    }
    lines.push("Outros tratamentos dependem de avaliação. Eu não invento valor.");
  }

  return `${lines.join("\n")}\n\nQuer que eu veja horários para avaliação ou limpeza?`;
}

function hoursReply(clinic: Clinic, now?: Date): string {
  const t = tomorrowInfo(clinic, now);
  const base = describeHours(clinic);
  if (t.open) {
    return `Sim — amanhã (${t.weekday}, ${t.dateLabel}) atendemos das ${t.hours}.\n\nNosso horário: ${base}\n\nQuer que eu veja um horário pra você?`;
  }
  return `Amanhã (${t.weekday}, ${t.dateLabel}) estamos fechados.\n\nNosso horário: ${base}\n\nPosso oferecer o próximo dia com vaga, se quiser agendar.`;
}

function unknownReply(clinic: Clinic): string {
  return `${clinic.safety.handoffPhrase} Sobre implante, sedação ou parcelamento especial, a equipe confirma pessoalmente — isso não está na minha base, então eu não chuto valor nem condição.\n\nPosso deixar um recado com seu nome e telefone para a recepção retornar, ou você liga no ${clinic.contact.phone} em horário comercial. O que prefere?`;
}

function urgencyReply(clinic: Clinic): string {
  return `Sinto muito que você esteja com dor agora. Eu não faço diagnóstico por mensagem.\n\nSe a dor estiver forte, com inchaço, febre, sangramento que não para ou trauma, procure um pronto-socorro ou pronto atendimento odontológico imediatamente.\n\nTelefone de urgência da ${clinic.name}: ${clinic.contact.urgencyPhone}.\nRecepção: ${clinic.contact.phone}.\n\nSe preferir, posso tentar um encaixe na primeira vaga da agenda. Quer que eu veja os horários?`;
}

function offerSlots(state: ConversationState, clinic: Clinic, now?: Date, lead = "Encontrei estes horários:") {
  const slots = upcomingSlots(clinic.slotTemplate.offerCount, clinic, now);
  return {
    reply: `${lead}\n\n${formatSlots(slots)}\n\nQual fica melhor pra você? Pode responder 1, 2 ou 3.`,
    state: {
      ...state,
      phase: "offering_slots" as const,
      offeredSlots: slots,
      lastIntent: "schedule",
    },
    suggestions: slots.map((s, i) => `${i + 1}) ${s.label}`),
  };
}

function completeBooking(state: ConversationState, clinic: Clinic): BrainResult {
  const slot = state.selectedSlot;
  const appointment: StaffEvent = {
    id: id("apt"),
    type: "booking",
    createdAt: new Date().toISOString(),
    summary: `Novo agendamento — ${state.patientName} · ${slot?.label ?? "horário"}`,
    patientName: state.patientName,
    patientPhone: state.patientPhone,
    slotLabel: slot?.label,
    notes: "Agendado pela Clara (demo)",
  };
  return {
    reply: `Pronto, ${state.patientName}! ✅\n\nReservei ${slot?.label} na ${clinic.name}.\nVou avisar a equipe agora mesmo.\n\nChegue ${clinic.firstVisit.arriveMinutesEarly} min antes. Endereço: ${clinic.address.street}, ${clinic.address.neighborhood}.\n\nSe precisar remarcar: ${clinic.cancelPolicy}`,
    state: {
      ...state,
      phase: "confirmed",
      lastIntent: "booking_done",
      pendingHandoffReason: null,
    },
    suggestions: ["Onde fica a clínica?", "O que levar na primeira consulta?", "Nova pergunta"],
    appointment,
    staffEvent: appointment,
    mode: "scripted",
  };
}

export function scriptedReply(input: {
  text: string;
  state?: ConversationState;
  clinic?: Clinic;
  now?: Date;
}): BrainResult {
  const clinic = input.clinic ?? getClinic();
  const state = input.state ?? initialState();
  const text = input.text.trim();
  const n = normalizeText(text);

  const finish = (
    reply: string,
    next: ConversationState,
    suggestions: string[],
    extra?: Partial<BrainResult>,
  ): BrainResult => ({
    reply,
    state: next,
    suggestions,
    mode: "scripted",
    ...extra,
  });

  if (isUrgency(n)) {
    const event: StaffEvent = {
      id: id("urg"),
      type: "urgency",
      createdAt: new Date().toISOString(),
      summary: "Alerta de urgência — paciente relatou dor forte / emergência",
      notes: text,
    };
    return finish(urgencyReply(clinic), { ...state, lastIntent: "urgency", phase: "idle" }, [
      "Quero um encaixe",
      "Qual o telefone de urgência?",
    ], { staffEvent: event });
  }

  if (state.phase === "awaiting_name") {
    const phone = extractPhone(text);
    if (phone && looksLikeName(text.replace(phone, "").trim())) {
      const name = text.replace(phone, "").replace(/[,\-]/g, " ").trim();
      return completeBooking(
        { ...state, patientName: name, patientPhone: phone },
        clinic,
      );
    }
    if (looksLikeName(text) && !isSchedule(n) && !isPrice(n)) {
      return finish(
        `Obrigada, ${text.trim()}! Qual seu WhatsApp com DDD para confirmarmos?`,
        { ...state, patientName: text.trim(), phase: "awaiting_phone" },
        ["(31) 98888-0000"],
      );
    }
  }

  if (state.phase === "awaiting_phone") {
    const phone = extractPhone(text);
    if (phone) {
      return completeBooking({ ...state, patientPhone: phone }, clinic);
    }
    return finish(
      `Não consegui ler o telefone. Manda com DDD, por exemplo ${clinic.contact.urgencyPhone}.`,
      state,
      [clinic.contact.urgencyPhone],
    );
  }

  if (state.phase === "awaiting_handoff_contact") {
    const phone = extractPhone(text);
    const name = looksLikeName(text.replace(phone ?? "", "").trim())
      ? text.replace(phone ?? "", "").replace(/[,\-]/g, " ").trim()
      : text.trim();
    const event: StaffEvent = {
      id: id("note"),
      type: "handoff",
      createdAt: new Date().toISOString(),
      summary: `Recado para a equipe — ${name || "paciente"}`,
      patientName: name || null,
      patientPhone: phone,
      notes: state.pendingHandoffReason ?? text,
    };
    return finish(
      `Recado anotado. A recepção retorna em horário comercial no ${clinic.contact.phone}. Obrigada pela paciência — prefiro admitir o que eu não sei do que inventar e te passar informação errada.`,
      { ...initialState(), lastIntent: "handoff_done" },
      ["Quero agendar uma avaliação", "Qual o horário de vocês?"],
      { staffEvent: event },
    );
  }

  if (state.phase === "offering_slots") {
    const picked = matchOfferedSlot(text, state.offeredSlots);
    if (picked) {
      return finish(
        `Perfeito, ${picked.label}. Como posso te chamar? (nome completo)`,
        {
          ...state,
          selectedSlot: picked,
          phase: "awaiting_name",
          lastIntent: "slot_picked",
        },
        ["Maria Silva"],
      );
    }
    if (isSchedule(n) || n.includes("outro") || n.includes("mais horario")) {
      const offered = offerSlots(state, clinic, input.now, "Claro, olha outras opções:");
      return finish(offered.reply, offered.state, offered.suggestions);
    }
    if (!isPrice(n) && !isHours(n) && !isAddress(n) && !isUnknownCommercial(n) && !isInsurance(n)) {
      return finish(
        `Não identifiquei o horário. Responda 1, 2 ou 3:\n\n${formatSlots(state.offeredSlots)}`,
        state,
        state.offeredSlots.map((s, i) => `${i + 1}) ${s.label}`),
      );
    }
  }

  if (n.includes("encaixe") || (state.lastIntent === "urgency" && isSchedule(n))) {
    const offered = offerSlots(state, clinic, input.now, "Vou priorizar o encaixe mais próximo:");
    return finish(offered.reply, offered.state, offered.suggestions);
  }

  if (isUnknownCommercial(n)) {
    return finish(unknownReply(clinic), {
      ...state,
      phase: "awaiting_handoff_contact",
      pendingHandoffReason: text,
      lastIntent: "unknown",
    }, ["Deixar recado", "Ligar na recepção"]);
  }

  if (n.includes("deixar recado") || n.includes("deixe um recado") || n.includes("recado")) {
    return finish(
      "Pode mandar seu nome e telefone com DDD que eu deixo o recado para a recepção retornar.",
      { ...state, phase: "awaiting_handoff_contact", lastIntent: "handoff" },
      ["Ana Souza (31) 99999-1111"],
    );
  }

  if (isPrice(n)) {
    return finish(priceReply(text, clinic), { ...state, lastIntent: "price", phase: state.phase === "offering_slots" ? state.phase : "idle" }, [
      "Quero agendar",
      "O que levar na primeira consulta?",
    ]);
  }

  if (isSchedule(n)) {
    const offered = offerSlots(state, clinic, input.now);
    return finish(offered.reply, offered.state, offered.suggestions);
  }

  if (isHours(n)) {
    return finish(hoursReply(clinic, input.now), { ...state, lastIntent: "hours" }, [
      "Quero agendar",
      "Quanto fica uma avaliação / limpeza?",
    ]);
  }

  if (isAddress(n)) {
    const a = clinic.address;
    return finish(
      `Ficamos na ${a.street} — ${a.neighborhood}, ${a.city}/${a.state}. CEP ${a.zip}.\n${a.access}\n\nEstacionamento: ${a.parking}`,
      { ...state, lastIntent: "address" },
      ["Quero agendar", "Qual o horário?"],
    );
  }

  if (isInsurance(n)) {
    return finish(
      `Atendemos particular${clinic.insurance.plans.length ? ` e convênios: ${clinic.insurance.plans.join(", ")}` : "."}\n${clinic.insurance.notes}`,
      { ...state, lastIntent: "insurance" },
      ["Quero agendar", "Quanto fica uma avaliação?"],
    );
  }

  if (isCancel(n)) {
    return finish(clinic.cancelPolicy, { ...state, lastIntent: "cancel" }, [
      "Quero remarcar",
      "Telefone da recepção",
    ]);
  }

  if (isFirstVisit(n)) {
    return finish(
      `Na primeira consulta, chegue ${clinic.firstVisit.arriveMinutesEarly} minutos antes e leve:\n${clinic.firstVisit.bring.map((b) => `• ${b}`).join("\n")}`,
      { ...state, lastIntent: "first_visit" },
      ["Quero agendar", "Onde fica a clínica?"],
    );
  }

  if (n.includes("servico") || n.includes("o que voces fazem") || n.includes("tratamentos")) {
    const list = clinic.services.map((s) => `• ${s.name}`).join("\n");
    return finish(
      `Na ${clinic.name} os principais serviços desta base são:\n${list}\n\nPreço eu só informo quando está autorizado.`,
      { ...state, lastIntent: "services" },
      ["Quanto fica uma avaliação / limpeza?", "Quero agendar"],
    );
  }

  if (n.includes("telefone") || n.includes("whatsapp da clinica") || n.includes("ligar")) {
    return finish(
      `Recepção: ${clinic.contact.phone}\nUrgência: ${clinic.contact.urgencyPhone}`,
      { ...state, lastIntent: "phone" },
      ["Quero agendar"],
    );
  }

  if (isGreeting(n) || n.length < 4) {
    return finish(
      `Oi! Pode mandar horário, avaliação/limpeza (só o preço autorizado) ou agendamento — o que você precisa?`,
      { ...state, lastIntent: "greeting" },
      ["Oi, vocês atendem amanhã?", "Quanto fica uma avaliação / limpeza?", "Quero agendar"],
    );
  }

  return finish(
    `Não tenho essa informação na base da clínica, então não vou inventar. ${clinic.safety.handoffPhrase}\n\nPosso ajudar com horário, endereço, convênios, avaliação/limpeza ou agendamento — ou deixo um recado para a equipe.`,
    { ...state, lastIntent: "fallback", phase: "awaiting_handoff_contact", pendingHandoffReason: text },
    ["Deixar recado", "Quero agendar", "Qual o horário?"],
  );
}

export const WELCOME_SUGGESTIONS = [
  "Oi, vocês atendem amanhã?",
  "Quanto fica uma avaliação / limpeza?",
  "Quero agendar",
];
