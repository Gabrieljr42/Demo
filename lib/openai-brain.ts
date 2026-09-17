import { getClinic } from "./clinic";
import { upcomingSlots } from "./slots";
import type { BrainResult, ChatMessage, Clinic, ConversationState, StaffEvent } from "./types";
import { scriptedReply } from "./scripted-brain";

function staffId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildSystemPrompt(clinic: Clinic, slots: ReturnType<typeof upcomingSlots>): string {
  const prices = clinic.services
    .map((s) =>
      s.canDisclosePrice && s.priceLabel
        ? `- ${s.name}: ${s.priceLabel} (autorizado)`
        : `- ${s.name}: NÃO divulgar preço numérico`,
    )
    .join("\n");

  return `Você é ${clinic.persona.name}, ${clinic.persona.role} da ${clinic.name} (${clinic.city}/${clinic.state}).
Tom: ${clinic.persona.tone}. Responda em português do Brasil, curto (WhatsApp), sem jargão.

BASE DA CLÍNICA (única fonte de verdade):
${JSON.stringify(
    {
      hours: clinic.hours,
      address: clinic.address,
      contact: clinic.contact,
      insurance: clinic.insurance,
      firstVisit: clinic.firstVisit,
      cancelPolicy: clinic.cancelPolicy,
      services: clinic.services,
    },
    null,
    2,
  )}

PREÇOS:
${prices}

HORÁRIOS LIVRES PARA OFERECER (2 a 3):
${slots.map((s, i) => `${i + 1}) ${s.label} [${s.id}]`).join("\n")}

REGRAS INQUEBRÁVEIS:
1. Nunca invente preço, desconto, parcelamento ou condição que não esteja na base.
2. Nunca faça diagnóstico, não sugira doença, medicamento ou tratamento clínico.
3. Se não souber: admita e ofereça recado / retorno humano. Frase: "${clinic.safety.handoffPhrase}"
4. Urgência (dor forte, trauma, sangramento, inchaço, febre): oriente pronto-socorro/PA, dê ${clinic.contact.urgencyPhone}, ofereça encaixe, SEM diagnosticar.
5. Implante, sedação, 24x, cheque: não estão autorizados — não chute.
6. Quando a pessoa quiser agendar, ofereça os horários numerados acima, peça nome e telefone com DDD, depois confirme.
7. Não finja ser WhatsApp Business oficial; você é o cérebro da Clara em demonstração.

Quando o agendamento estiver completo, termine a resposta com um bloco JSON (sozinho, última linha) neste formato:
<!--BOOKING{"name":"...","phone":"...","slotId":"..."}-->
Quando for recado/handoff:
<!--HANDOFF{"name":"...","phone":"...","reason":"..."}-->
Quando for urgência:
<!--URGENCY{"notes":"..."}-->
Se nada disso se aplicar, não emita esses marcadores.`;
}

function parseMarker(reply: string, kind: "BOOKING" | "HANDOFF" | "URGENCY"): Record<string, string> | null {
  const re = new RegExp(`<!--${kind}(\\s*\\{[\\s\\S]*?\\})\\s*-->`);
  const m = reply.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, string>;
  } catch {
    return null;
  }
}

function stripMarkers(reply: string) {
  return reply.replace(/<!--(BOOKING|HANDOFF|URGENCY)[\s\S]*?-->/g, "").trim();
}

export async function openaiReply(input: {
  text: string;
  history: ChatMessage[];
  state: ConversationState;
  clinic?: Clinic;
}): Promise<BrainResult> {
  const clinic = input.clinic ?? getClinic();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return scriptedReply({ text: input.text, state: input.state, clinic });
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  const slots = upcomingSlots(clinic.slotTemplate.offerCount, clinic);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: "system", content: buildSystemPrompt(clinic, slots) },
      ...input.history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.text },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  if (!raw) {
    return scriptedReply({ text: input.text, state: input.state, clinic });
  }

  const booking = parseMarker(raw, "BOOKING");
  const handoff = parseMarker(raw, "HANDOFF");
  const urgency = parseMarker(raw, "URGENCY");
  const reply = stripMarkers(raw);
  let staffEvent: StaffEvent | undefined;
  let next = { ...input.state, lastIntent: "openai" };

  if (booking) {
    const slot = slots.find((s) => s.id === booking.slotId) ?? slots[0];
    staffEvent = {
      id: staffId("apt"),
      type: "booking",
      createdAt: new Date().toISOString(),
      summary: `Novo agendamento — ${booking.name} · ${slot?.label ?? ""}`,
      patientName: booking.name,
      patientPhone: booking.phone,
      slotLabel: slot?.label,
    };
    next = {
      ...next,
      phase: "confirmed",
      selectedSlot: slot ?? null,
      patientName: booking.name ?? null,
      patientPhone: booking.phone ?? null,
    };
  } else if (handoff) {
    staffEvent = {
      id: staffId("note"),
      type: "handoff",
      createdAt: new Date().toISOString(),
      summary: `Recado para a equipe — ${handoff.name || "paciente"}`,
      patientName: handoff.name,
      patientPhone: handoff.phone,
      notes: handoff.reason,
    };
  } else if (urgency) {
    staffEvent = {
      id: staffId("urg"),
      type: "urgency",
      createdAt: new Date().toISOString(),
      summary: "Alerta de urgência — paciente relatou dor / emergência",
      notes: urgency.notes || input.text,
    };
  }

  return {
    reply,
    state: next,
    suggestions: next.phase === "confirmed"
      ? ["Onde fica a clínica?", "O que levar na primeira consulta?"]
      : ["Quero agendar", "Quanto fica uma avaliação / limpeza?"],
    appointment: staffEvent?.type === "booking" ? staffEvent : undefined,
    staffEvent,
    mode: "openai",
  };
}
