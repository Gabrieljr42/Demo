import { NextResponse } from "next/server";
import { runBrain } from "@/lib/brain";
import { addEvent } from "@/lib/store";
import { initialState, type ChatMessage, type ConversationState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      history?: ChatMessage[];
      state?: ConversationState;
    };
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    }
    const result = await runBrain({
      text,
      history: body.history ?? [],
      state: body.state ?? initialState(),
    });
    if (result.staffEvent) addEvent(result.staffEvent);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Falha ao responder." }, { status: 500 });
  }
}
