import { isUrgencyIntent, isUnknownCommercialIntent } from "./safety";
import { openaiReply } from "./openai-brain";
import { scriptedReply } from "./scripted-brain";
import type { BrainResult, ChatMessage, ConversationState } from "./types";

export async function runBrain(input: {
  text: string;
  history: ChatMessage[];
  state: ConversationState;
}): Promise<BrainResult> {
  const n = input.text;

  // Demo script paths must always be deterministic, even if a key is present.
  if (isUrgencyIntent(n) || isUnknownCommercialIntent(n)) {
    return scriptedReply({ text: input.text, state: input.state });
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiReply(input);
    } catch {
      return scriptedReply({ text: input.text, state: input.state });
    }
  }

  return scriptedReply({ text: input.text, state: input.state });
}
