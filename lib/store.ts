import type { StaffEvent } from "./types";

const g = globalThis as typeof globalThis & { __claraEvents?: StaffEvent[] };

if (!g.__claraEvents) g.__claraEvents = [];

export function listEvents(): StaffEvent[] {
  return [...(g.__claraEvents ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addEvent(event: StaffEvent): StaffEvent {
  g.__claraEvents = [event, ...(g.__claraEvents ?? []).filter((e) => e.id !== event.id)];
  return event;
}

export function clearEvents() {
  g.__claraEvents = [];
}
