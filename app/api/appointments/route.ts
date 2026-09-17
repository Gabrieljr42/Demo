import { NextResponse } from "next/server";
import { addEvent, clearEvents, listEvents } from "@/lib/store";
import type { StaffEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: listEvents() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as StaffEvent;
  if (!body?.id || !body?.type) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }
  addEvent(body);
  return NextResponse.json({ ok: true, event: body });
}

export async function DELETE() {
  clearEvents();
  return NextResponse.json({ ok: true });
}
