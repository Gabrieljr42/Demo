import { NextResponse } from "next/server";
import { getClinic } from "@/lib/clinic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clinic = getClinic();
  return NextResponse.json({
    name: clinic.name,
    persona: clinic.persona,
    lgpdNote: clinic.lgpdNote,
    mode: process.env.OPENAI_API_KEY ? "openai" : "scripted",
  });
}
