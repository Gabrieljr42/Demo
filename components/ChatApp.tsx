"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { initialState, type BrainResult, type ChatMessage, type ConversationState } from "@/lib/types";

type UiMessage = ChatMessage & { at: string };

const WELCOME: UiMessage = {
  role: "assistant",
  content:
    "Olá! Eu sou a Clara, recepcionista da Clínica Sorriso 😊\nPosso falar de horários, serviços autorizados e te ajudar a agendar — mesmo com a recepção fechada.\nComo posso te atender?",
  at: nowTime(),
};

function nowTime() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function persistEvent(event: NonNullable<BrainResult["staffEvent"]>) {
  try {
    const raw = localStorage.getItem("clara-staff-events");
    const prev = raw ? (JSON.parse(raw) as unknown[]) : [];
    localStorage.setItem("clara-staff-events", JSON.stringify([event, ...prev].slice(0, 50)));
  } catch {
    /* ignore */
  }
  void fetch("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}

export default function ChatApp() {
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ConversationState>(initialState());
  const [suggestions, setSuggestions] = useState([
    "Oi, vocês atendem amanhã?",
    "Quanto fica uma avaliação / limpeza?",
    "Quero agendar",
  ]);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<"scripted" | "openai">("scripted");
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void fetch("/api/clinic")
      .then((r) => r.json())
      .then((d) => {
        if (d.mode === "openai" || d.mode === "scripted") setMode(d.mode);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const history = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  );

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;
    setText("");
    setBusy(true);
    const userMsg: UiMessage = { role: "user", content: value, at: nowTime() };
    setMessages((m) => [...m, userMsg]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, history, state }),
      });
      const data = (await res.json()) as BrainResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "erro");
      setState(data.state);
      setSuggestions(data.suggestions?.length ? data.suggestions : []);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, at: nowTime() }]);
      if (data.staffEvent) {
        persistEvent(data.staffEvent);
        if (data.staffEvent.type === "booking") setToast("Aviso enviado à equipe ✓");
        if (data.staffEvent.type === "urgency") setToast("Alerta de urgência no painel da equipe");
        if (data.staffEvent.type === "handoff") setToast("Recado enviado à recepção");
        setTimeout(() => setToast(null), 3200);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Tive um solavanco técnico. Pode mandar de novo? Se persistir, use o modo roteirizado (sem chave de API).",
          at: nowTime(),
        },
      ]);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }

  function reset() {
    setMessages([WELCOME]);
    setState(initialState());
    setSuggestions([
      "Oi, vocês atendem amanhã?",
      "Quanto fica uma avaliação / limpeza?",
      "Quero agendar",
    ]);
  }

  return (
    <div className="page">
      <div className="banner">
        <strong>Demo do cérebro da Clara</strong> — no piloto isso roda no WhatsApp Business da clínica.
        Aqui é o mesmo atendimento, com honestidade: ainda não é o número oficial.{" "}
        Modo: {mode === "openai" ? "LLM (OPENAI_API_KEY)" : "roteirizado (sem chave)"}.
      </div>
      <div className="phone">
        <header className="wa-header">
          <div className="avatar" aria-hidden>
            C
          </div>
          <div className="who">
            <h1>Clara</h1>
            <p>Clínica Sorriso · online</p>
          </div>
          <div className="header-actions">
            <Link className="ghost" href="/equipe">
              Equipe
            </Link>
            <button className="ghost" type="button" onClick={reset}>
              Nova
            </button>
          </div>
        </header>
        <div className="messages" ref={scroller}>
          <div className="day-chip">Hoje · demonstração</div>
          {messages.map((m, i) => (
            <div key={i} className={`row ${m.role === "user" ? "out" : "in"}`}>
              <div className="bubble">
                {m.content}
                <div className="meta">
                  <span>{m.at}</span>
                  {m.role === "user" ? <span>✓</span> : null}
                </div>
              </div>
            </div>
          ))}
          {busy ? (
            <div className="typing" aria-label="Clara está digitando">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>
        {suggestions.length ? (
          <div className="chips">
            {suggestions.map((s) => (
              <button key={s} className="chip" type="button" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <textarea
            ref={box}
            rows={1}
            placeholder="Mensagem"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
          />
          <button className="send" type="submit" disabled={busy || !text.trim()} aria-label="Enviar">
            ➤
          </button>
        </form>
        <div className="lgpd">
          Demo: conversas podem ser processadas por IA. Não envie dados sensíveis reais.
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
