"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { StaffEvent } from "@/lib/types";

function merge(server: StaffEvent[], local: StaffEvent[]) {
  const map = new Map<string, StaffEvent>();
  for (const e of [...local, ...server]) map.set(e.id, e);
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function loadLocal(): StaffEvent[] {
  try {
    const raw = localStorage.getItem("clara-staff-events");
    return raw ? (JSON.parse(raw) as StaffEvent[]) : [];
  } catch {
    return [];
  }
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const LABELS: Record<StaffEvent["type"], string> = {
  booking: "Agendamento",
  urgency: "Urgência",
  handoff: "Recado / handoff",
};

export default function StaffApp() {
  const [events, setEvents] = useState<StaffEvent[]>([]);

  const refresh = useCallback(async () => {
    const local = loadLocal();
    try {
      const res = await fetch("/api/appointments");
      const data = (await res.json()) as { events?: StaffEvent[] };
      setEvents(merge(data.events ?? [], local));
    } catch {
      setEvents(local);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function reset() {
    localStorage.removeItem("clara-staff-events");
    await fetch("/api/appointments", { method: "DELETE" });
    setEvents([]);
  }

  return (
    <div className="page" style={{ alignItems: "stretch" }}>
      <main className="staff-page">
        <div className="banner" style={{ maxWidth: "100%", margin: "0 0 8px" }}>
          Painel interno da <strong>Clínica Sorriso</strong> — avisos que a Clara dispara no lugar do
          grupo da equipe. No piloto isso cai no WhatsApp/e-mail/Calendar de vocês.
        </div>
        <div className="staff-top">
          <div>
            <h1>Equipe · Clínica Sorriso</h1>
            <p>Agendamentos, recados e alertas de urgência da Clara</p>
          </div>
          <div className="staff-actions">
            <Link className="btn primary" href="/">
              Abrir conversa
            </Link>
            <button className="btn quiet" type="button" onClick={() => void reset()}>
              Limpar demo
            </button>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="empty">
            Nenhum aviso ainda. Faça um agendamento no chat da Clara — o card aparece aqui.
          </div>
        ) : (
          <div className="grid">
            {events.map((e) => (
              <article key={e.id} className="card">
                <span className={`tag ${e.type}`}>{LABELS[e.type]}</span>
                <h3>{e.summary}</h3>
                {e.slotLabel ? <p>Horário: {e.slotLabel}</p> : null}
                {e.patientName ? <p>Paciente: {e.patientName}</p> : null}
                {e.patientPhone ? <p>Telefone: {e.patientPhone}</p> : null}
                {e.notes ? <p className="muted">{e.notes}</p> : null}
                <p className="muted">{formatWhen(e.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
