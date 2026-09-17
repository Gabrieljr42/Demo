export type Service = {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  durationMinutes: number;
  canDisclosePrice: boolean;
  priceLabel: string | null;
};

export type Clinic = {
  id: string;
  name: string;
  city: string;
  state: string;
  persona: { name: string; role: string; tone: string };
  contact: {
    phone: string;
    urgencyPhone: string;
    email: string;
    whatsappBusinessLater: boolean;
  };
  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    parking: string;
    access: string;
  };
  hours: {
    timezone: string;
    weekdays: { days: number[]; start: string; end: string };
    saturday: { days: number[]; start: string; end: string };
    sundayClosed: boolean;
    notes: string;
  };
  insurance: { private: boolean; plans: string[]; notes: string };
  firstVisit: { bring: string[]; arriveMinutesEarly: number };
  cancelPolicy: string;
  services: Service[];
  unauthorizedTopics: string[];
  slotTemplate: {
    weekdayTimes: string[];
    saturdayTimes: string[];
    offerCount: number;
  };
  safety: {
    neverInventPrices: true;
    neverDiagnose: true;
    unknownPolicy: string;
    urgencyPolicy: string;
    handoffPhrase: string;
  };
  lgpdNote: string;
};

export type Slot = {
  id: string;
  iso: string;
  label: string;
  weekdayLabel: string;
  time: string;
};

export type ConversationPhase =
  | "idle"
  | "offering_slots"
  | "awaiting_name"
  | "awaiting_phone"
  | "awaiting_handoff_contact"
  | "confirmed";

export type ConversationState = {
  phase: ConversationPhase;
  offeredSlots: Slot[];
  selectedSlot: Slot | null;
  patientName: string | null;
  patientPhone: string | null;
  lastIntent: string | null;
  pendingHandoffReason: string | null;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type StaffEventType = "booking" | "handoff" | "urgency";

export type StaffEvent = {
  id: string;
  type: StaffEventType;
  createdAt: string;
  summary: string;
  patientName?: string | null;
  patientPhone?: string | null;
  slotLabel?: string | null;
  notes?: string | null;
};

export type BrainResult = {
  reply: string;
  state: ConversationState;
  suggestions: string[];
  appointment?: StaffEvent;
  staffEvent?: StaffEvent;
  mode: "scripted" | "openai";
};

export function initialState(): ConversationState {
  return {
    phase: "idle",
    offeredSlots: [],
    selectedSlot: null,
    patientName: null,
    patientPhone: null,
    lastIntent: null,
    pendingHandoffReason: null,
  };
}
