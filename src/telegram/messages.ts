/**
 * Xử lý tin nhắn văn bản thường: gửi tới XingchiAPI và trả lời người dùng.
 * - Hiển thị trạng thái "đang nhập" (sendChatAction).
 * - Duy trì lịch sử trong giới hạn cấu hình.
 * - Câu trả lời của AI được escape HTML rồi mới gửi với parse_mode=HTML,
 *   và được chia nhỏ theo giới hạn 4096 ký tự của Telegram.
 * - Lỗi API được chuyển thành thông báo tiếng Việt dễ hiểu, không lộ
 *   chi tiết kỹ thuật hay secrets.
 */
import type { CommandContext } from "./commands";
import { DEFAULT_SYSTEM_PROMPT, buildChatMessages } from "../ai/prompts";
import { XingchiApiError } from "../ai/xingchi";
import { escapeHtml, splitTelegramMessage } from "../utils/telegram";
import {
  getIntEnv,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_USER_MESSAGE_CHARS,
} from "../env";

export function aiErrorToUserMessage(error: unknown): string {
  if (error instanceof XingchiApiError) {
    switch (error.code) {
      case "INVALID_API_KEY":
        return "API key của AI đã hết hạn hoặc không hợp lệ. Vui lòng báo quản trị viên kiểm tra lại.";
      case "RATE_LIMITED":
        return "AI đang quá tải hoặc đã hết quota. Vui lòng thử lại sau ít phút.";
      case "TIMEOUT":
        return "AI phản hồi quá chậm. Vui lòng thử lại.";
      case "NOT_FOUND":
        return "Model đã chọn không còn khả dụng. Hãy dùng /model để chọn model khác.";
      case "SERVER_ERROR":
        return "Máy chủ AI tạm thời gặp sự cố. Vui lòng thử lại sau.";
      case "NETWORK_ERROR":
        return "Không thể kết nối tới máy chủ AI. Vui lòng thử lại sau.";
      default:
        return "AI tạm thời không trả lời được. Vui lòng thử lại sau.";
    }
  }
  return "Đã xảy ra lỗi khi xử lý tin nhắn. Vui lòng thử lại sau.";
}

export async function handleTextMessage(
  ctx: CommandContext,
  chatId: number,
  _userId: number,
  text: string,
  replyToMessageId?: number,
): Promise<void> {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    await ctx.telegram.sendMessage(
      chatId,
      "Bạn chưa nhập nội dung. Hãy gửi một tin nhắn để trò chuyện với AI.",
    );
    return;
  }

  if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
    await ctx.telegram.sendMessage(
      chatId,
      `Tin nhắn quá dài (tối đa ${MAX_USER_MESSAGE_CHARS} ký tự). Vui lòng rút gọn rồi gửi lại.`,
    );
    return;
  }

  const selectedModel = await ctx.store.getModel(chatId);
  const configuredDefault = ctx.env.DEFAULT_MODEL?.trim();
  const model = selectedModel ?? (configuredDefault ? configuredDefault : null);
  if (!model) {
    await ctx.telegram.sendMessage(
      chatId,
      "Bạn chưa chọn model AI. Hãy dùng lệnh /model để chọn model trước khi trò chuyện.",
    );
    return;
  }

  await ctx.telegram.sendChatAction(chatId, "typing");

  const history = await ctx.store.getHistory(chatId);
  const messages = buildChatMessages(DEFAULT_SYSTEM_PROMPT, history, trimmed);
  const maxTokens = getIntEnv(ctx.env.MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS);

  try {
    const reply = await ctx.xingchi.chatCompletion(model, messages, maxTokens);
    await ctx.store.append(chatId, { role: "user", content: trimmed });
    await ctx.store.append(chatId, { role: "assistant", content: reply });
    const chunks = splitTelegramMessage(escapeHtml(reply));
    for (const chunk of chunks) {
      await ctx.telegram.sendMessage(chatId, chunk, {
        parseMode: "HTML",
        replyToMessageId,
      });
    }
  } catch (error) {
    await ctx.telegram.sendMessage(chatId, aiErrorToUserMessage(error), {
      replyToMessageId,
    });
  }
}
