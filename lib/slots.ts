import { getClinic } from "./clinic";
import type { Clinic, Slot } from "./types";

const WEEKDAYS_PT = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

export function clinicNow(clinic: Clinic = getClinic(), now?: Date): Date {
  if (now) return now;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clinic.hours.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return new Date(
    `${grab("year")}-${grab("month")}-${grab("day")}T${grab("hour")}:${grab("minute")}:${grab("second")}`,
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

function dayHours(clinic: Clinic, day: Date) {
  const wd = day.getDay();
  if (clinic.hours.weekdays.days.includes(wd)) return clinic.hours.weekdays;
  if (clinic.hours.saturday.days.includes(wd)) return clinic.hours.saturday;
  return null;
}

function timesForDay(clinic: Clinic, day: Date): string[] {
  const wd = day.getDay();
  if (clinic.hours.weekdays.days.includes(wd)) return clinic.slotTemplate.weekdayTimes;
  if (clinic.hours.saturday.days.includes(wd)) return clinic.slotTemplate.saturdayTimes;
  return [];
}

export function isOpenOn(clinic: Clinic, day: Date): boolean {
  return dayHours(clinic, day) !== null;
}

export function describeHours(clinic: Clinic = getClinic()): string {
  return `Segunda a sexta, ${clinic.hours.weekdays.start} às ${clinic.hours.weekdays.end}. Sábado, ${clinic.hours.saturday.start} às ${clinic.hours.saturday.end}. Domingo fechado.`;
}

export function describeDayHours(clinic: Clinic, day: Date): string | null {
  const hours = dayHours(clinic, day);
  if (!hours) return null;
  return `${hours.start} às ${hours.end}`;
}

export function formatSlot(dt: Date): Slot {
  const weekday = WEEKDAYS_PT[dt.getDay()];
  const dateLabel = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`;
  const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const weekdayLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return {
    id: `${ymd(dt)}T${time}`,
    iso: dt.toISOString(),
    time,
    weekdayLabel,
    label: `${weekdayLabel} ${dateLabel} às ${time}`,
  };
}

export function upcomingSlots(
  count = 3,
  clinic: Clinic = getClinic(),
  now?: Date,
): Slot[] {
  const origin = clinicNow(clinic, now);
  const slots: Slot[] = [];
  for (let offset = 0; offset < 21 && slots.length < count; offset++) {
    const day = new Date(origin);
    day.setDate(origin.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    for (const t of timesForDay(clinic, day)) {
      const dt = atTime(day, t);
      if (dt.getTime() <= origin.getTime() + 30 * 60 * 1000) continue;
      slots.push(formatSlot(dt));
      if (slots.length >= count) break;
    }
  }
  return slots;
}

export function tomorrowInfo(clinic: Clinic = getClinic(), now?: Date) {
  const origin = clinicNow(clinic, now);
  const tomorrow = new Date(origin);
  tomorrow.setDate(origin.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  const open = isOpenOn(clinic, tomorrow);
  const weekday = WEEKDAYS_PT[tomorrow.getDay()];
  return {
    open,
    weekday,
    hours: describeDayHours(clinic, tomorrow),
    dateLabel: `${pad(tomorrow.getDate())}/${pad(tomorrow.getMonth() + 1)}`,
  };
}

export function matchOfferedSlot(text: string, slots: Slot[]): Slot | null {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!slots.length) return null;

  const ordinals: Record<string, number> = {
    "1": 0,
    "1o": 0,
    primeiro: 0,
    primeira: 0,
    "2": 1,
    "2o": 1,
    segundo: 1,
    segunda: 1,
    "3": 2,
    "3o": 2,
    terceiro: 2,
    terceira: 2,
  };

  if (/^(o )?primeiro( horario)?$/.test(n) || n === "1" || n === "opcao 1") {
    return slots[0] ?? null;
  }

  for (const [key, idx] of Object.entries(ordinals)) {
    if (n === key || n.includes(`opcao ${key}`) || n.includes(`horario ${key}`)) {
      return slots[idx] ?? null;
    }
  }

  if (n.includes("primeiro") || n.includes("o 1") || /^1\b/.test(n)) return slots[0] ?? null;
  if (n.includes("segundo") || n.includes("o 2") || /^2\b/.test(n)) return slots[1] ?? null;
  if (n.includes("terceiro") || n.includes("o 3") || /^3\b/.test(n)) return slots[2] ?? null;

  for (const slot of slots) {
    const time = slot.time;
    const compact = time.replace(":", "");
    if (n.includes(time) || n.includes(compact) || n.includes(time.replace(":", "h"))) {
      return slot;
    }
    const datePart = slot.label.split(" às ")[0]?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (datePart && n.includes(datePart)) return slot;
  }

  return null;
}
