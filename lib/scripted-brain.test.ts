import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scriptedReply } from "./scripted-brain";
import { initialState } from "./types";

const NOW = new Date("2026-09-17T22:05:00"); // quinta, 22h — recepção fechada

describe("demo scripted paths", () => {
  it("happy path: amanhã + preço autorizado + agendar 3 slots + nome + telefone", () => {
    let state = initialState();

    const hours = scriptedReply({
      text: "Oi, vocês atendem amanhã?",
      state,
      now: NOW,
    });
    assert.match(hours.reply.toLowerCase(), /amanh/);
    assert.match(hours.reply, /08:00/);
    assert.doesNotMatch(hours.reply, /R\$\s*99999/);
    state = hours.state;

    const price = scriptedReply({
      text: "Quanto fica uma avaliação / limpeza?",
      state,
      now: NOW,
    });
    assert.match(price.reply, /R\$ 120/);
    assert.match(price.reply, /R\$ 220/);
    assert.doesNotMatch(price.reply.toLowerCase(), /implante/);
    state = price.state;

    const sched = scriptedReply({ text: "Quero agendar", state, now: NOW });
    assert.equal(sched.state.phase, "offering_slots");
    assert.equal(sched.state.offeredSlots.length, 3);
    assert.match(sched.reply, /1\)/);
    assert.match(sched.reply, /2\)/);
    assert.match(sched.reply, /3\)/);
    state = sched.state;

    const pick = scriptedReply({ text: "1", state, now: NOW });
    assert.equal(pick.state.phase, "awaiting_name");
    assert.ok(pick.state.selectedSlot);
    state = pick.state;

    const name = scriptedReply({ text: "Maria Silva", state, now: NOW });
    assert.equal(name.state.phase, "awaiting_phone");
    state = name.state;

    const done = scriptedReply({ text: "(31) 98888-7766", state, now: NOW });
    assert.equal(done.state.phase, "confirmed");
    assert.ok(done.appointment);
    assert.equal(done.appointment?.type, "booking");
    assert.equal(done.appointment?.patientName, "Maria Silva");
    assert.match(done.reply, /Reservei|Pronto/);
    assert.match(done.reply, /equipe/i);
  });

  it("não-sei: implante + sedação + 24x no cheque — não inventa preço", () => {
    const res = scriptedReply({
      text: "Vocês fazem implante com sedação e parcelam em 24x no cheque?",
      state: initialState(),
      now: NOW,
    });
    assert.equal(res.state.lastIntent, "unknown");
    assert.doesNotMatch(res.reply, /R\$/);
    assert.match(res.reply.toLowerCase(), /não invento|nao invento|não chuto|nao chuto|não esteja na nossa base|nao esteja na nossa base/);
    assert.match(res.reply.toLowerCase(), /equipe|recepção|recepcao/);
  });

  it("saudação curta: 'Oi' não repete o pitch completo de recepcionista", () => {
    const res = scriptedReply({
      text: "Oi",
      state: initialState(),
      now: NOW,
    });
    assert.equal(res.state.lastIntent, "greeting");
    assert.doesNotMatch(res.reply.toLowerCase(), /recepcionista/);
    assert.match(res.reply.toLowerCase(), /oi/);
    assert.match(res.reply.toLowerCase(), /horário|horario|agendamento|avalia/);
  });

  it("urgência: dor forte — sem diagnóstico, com pronto-socorro e telefone", () => {
    const res = scriptedReply({
      text: "Estou com dor forte agora.",
      state: initialState(),
      now: NOW,
    });
    assert.equal(res.staffEvent?.type, "urgency");
    assert.match(res.reply.toLowerCase(), /pronto-socorro|pronto atendimento/);
    assert.match(res.reply, /98888-2200/);
    assert.match(res.reply.toLowerCase(), /n[aã]o fa[cç]o diagn[oó]stico/);
    assert.doesNotMatch(res.reply.toLowerCase(), /abscesso|canal|infec[cç][aã]o pulpar|provavelmente é/);
    assert.match(res.reply.toLowerCase(), /encaixe|vaga/);
  });
});
