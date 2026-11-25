/**
 * System prompt mặc định (tiếng Việt) và hàm dựng messages cho Chat Completions.
 */
import type { ChatMessageInput } from "./xingchi";
import type { ChatMessage } from "../storage";

export const DEFAULT_SYSTEM_PROMPT =
  "Bạn là trợ lý AI thân thiện, trả lời bằng tiếng Việt trừ khi người dùng " +
  "yêu cầu ngôn ngữ khác. Trả lời ngắn gọn, rõ ràng, đúng trọng tâm. " +
  "Không bịa đặt thông tin; nếu không chắc, hãy nói rõ là bạn không chắc.";

/** messages = [system, ...lịch sử, user mới]. Lịch sử đã được giới hạn ở tầng storage. */
export function buildChatMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userText: string,
): ChatMessageInput[] {
  const messages: ChatMessageInput[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: userText });
  return messages;
}
