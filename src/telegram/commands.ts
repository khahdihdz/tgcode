/**
 * Xử lý các lệnh Telegram: /start /help /chat /model /models /reset /new
 * /status /id /about. Giao diện tiếng Việt, dùng parse_mode=HTML với
 * nội dung động đã được escape.
 */
import type { Env } from "../env";
import { getIntEnv, DEFAULT_RATE_LIMIT_PER_MINUTE } from "../env";
import type { XingchiClient } from "../ai/xingchi";
import type { ModelCache } from "../ai/models";
import type { HistoryStore } from "../storage";
import { TelegramApi, escapeHtml, splitTelegramMessage } from "../utils/telegram";
import { modelKeyboard } from "./keyboards";

export const BOT_VERSION = "1.0.0";
export const BOT_NAME = "Xingchi Telegram AI Bot";

export interface CommandContext {
  env: Env;
  telegram: TelegramApi;
  xingchi: XingchiClient;
  store: HistoryStore;
  models: ModelCache;
}

export function startMessage(): string {
  return [
    "👋 <b>Xin chào! Tôi là Xingchi AI Bot.</b>",
    "",
    "Tôi trò chuyện với bạn bằng AI (XingchiAPI).",
    "Hãy chọn model rồi gửi tin nhắn cho tôi.",
    "",
    "Lệnh thường dùng:",
    "/model — chọn model AI",
    "/models — xem danh sách model",
    "/reset — xóa lịch sử trò chuyện",
    "/help — hướng dẫn đầy đủ",
  ].join("\n");
}

export function helpMessage(currentModel: string): string {
  return [
    "📖 <b>Hướng dẫn sử dụng</b>",
    "",
    "<b>Trò chuyện:</b> chỉ cần gửi tin nhắn văn bản, tôi sẽ trả lời bằng AI.",
    "Bạn có thể trả lời (reply) một tin nhắn của tôi để tiếp tục mạch trò chuyện.",
    "",
    "<b>Lệnh:</b>",
    "/start — bắt đầu và giới thiệu bot",
    "/help — hướng dẫn này",
    "/chat — bắt đầu cuộc trò chuyện",
    "/model — chọn model AI",
    "/models — xem danh sách model khả dụng",
    "/reset — xóa lịch sử trò chuyện hiện tại",
    "/new — tạo cuộc trò chuyện mới",
    "/status — kiểm tra trạng thái bot và API",
    "/id — xem Telegram ID của bạn",
    "/about — thông tin về bot",
    "",
    `Model đang dùng: ${
      currentModel
        ? `<code>${escapeHtml(currentModel)}</code>`
        : "chưa chọn — dùng /model để chọn"
    }`,
    "",
    "Lưu ý: bot chỉ hỗ trợ tin nhắn văn bản.",
  ].join("\n");
}

export function aboutMessage(): string {
  return [
    "ℹ️ <b>Về bot</b>",
    "",
    `<b>${escapeHtml(BOT_NAME)}</b> v${BOT_VERSION}`,
    "Telegram AI Bot chạy trên Cloudflare Workers.",
    "AI: XingchiAPI (OpenAI-compatible Chat Completions).",
    "Mã nguồn mở — xem README.md trong repository để biết cách tự triển khai.",
  ].join("\n");
}

async function sendLong(
  telegram: TelegramApi,
  chatId: number,
  text: string,
): Promise<void> {
  for (const chunk of splitTelegramMessage(text)) {
    await telegram.sendMessage(chatId, chunk, { parseMode: "HTML" });
  }
}

async function currentModelOf(ctx: CommandContext, chatId: number): Promise<string> {
  const selected = await ctx.store.getModel(chatId);
  if (selected) return selected;
  const fallback = ctx.env.DEFAULT_MODEL?.trim();
  return fallback ?? "";
}

export async function handleCommand(
  ctx: CommandContext,
  chatId: number,
  userId: number,
  command: string,
  _args: string,
): Promise<void> {
  switch (command) {
    case "start": {
      await ctx.telegram.sendMessage(chatId, startMessage(), {
        parseMode: "HTML",
      });
      return;
    }
    case "help": {
      const current = await currentModelOf(ctx, chatId);
      await ctx.telegram.sendMessage(chatId, helpMessage(current), {
        parseMode: "HTML",
      });
      return;
    }
    case "chat": {
      const current = await currentModelOf(ctx, chatId);
      await ctx.telegram.sendMessage(
        chatId,
        current
          ? `💬 Hãy gửi tin nhắn cho tôi. Tôi đang dùng model <code>${escapeHtml(
              current,
            )}</code>.`
          : "💬 Hãy chọn model trước bằng lệnh /model, rồi gửi tin nhắn cho tôi.",
        { parseMode: "HTML" },
      );
      return;
    }
    case "model": {
      try {
        const models = await ctx.models.getModels();
        if (models.length === 0) {
          await ctx.telegram.sendMessage(
            chatId,
            "Hiện chưa lấy được danh sách model. Vui lòng thử lại sau.",
          );
          return;
        }
        const current = await currentModelOf(ctx, chatId);
        await ctx.telegram.sendMessage(
          chatId,
          `🤖 <b>Chọn model AI</b>\n\nModel hiện tại: ${
            current
              ? `<code>${escapeHtml(current)}</code>`
              : "chưa chọn"
          }\n\nNhấn vào model bên dưới để chọn.`,
          { parseMode: "HTML", replyMarkup: modelKeyboard(models) },
        );
      } catch {
        await ctx.telegram.sendMessage(
          chatId,
          "Không lấy được danh sách model lúc này. Vui lòng thử lại sau.",
        );
      }
      return;
    }
    case "models": {
      try {
        const models = await ctx.models.getModels();
        if (models.length === 0) {
          await ctx.telegram.sendMessage(
            chatId,
            "Hiện chưa lấy được danh sách model. Vui lòng thử lại sau.",
          );
          return;
        }
        // Chỉ hiển thị đúng model ID mà nhà cung cấp trả về.
        const shown = models.slice(0, 50);
        const lines = shown.map((m) => `• <code>${escapeHtml(m.id)}</code>`);
        const extra =
          models.length > shown.length
            ? `\n... và ${models.length - shown.length} model khác.`
            : "";
        await sendLong(
          ctx.telegram,
          chatId,
          `📋 <b>Danh sách model khả dụng (${models.length})</b>\n\n${lines.join(
            "\n",
          )}${extra}\n\nDùng /model để chọn model.`,
        );
      } catch {
        await ctx.telegram.sendMessage(
          chatId,
          "Không lấy được danh sách model lúc này. Vui lòng thử lại sau.",
        );
      }
      return;
    }
    case "reset":
    case "new": {
      await ctx.store.clear(chatId);
      await ctx.telegram.sendMessage(
        chatId,
        command === "new"
          ? "🆕 Đã tạo cuộc trò chuyện mới. Hãy gửi tin nhắn để bắt đầu."
          : "🗑️ Đã xóa lịch sử trò chuyện hiện tại.",
      );
      return;
    }
    case "status": {
      const current = await currentModelOf(ctx, chatId);
      const historyCount = await ctx.store.historyCount(chatId);
      let apiLine = "API: không kết nối được lúc này";
      try {
        const models = await ctx.models.getModels();
        apiLine = `API: hoạt động (${models.length} model khả dụng)`;
      } catch {
        // Giữ nguyên thông báo lỗi chung, không lộ chi tiết kỹ thuật.
      }
      const text = [
        "📊 <b>Trạng thái bot</b>",
        "",
        `Bot: ${escapeHtml(BOT_NAME)} v${BOT_VERSION}`,
        apiLine,
        `Model đang dùng: ${
          current
            ? `<code>${escapeHtml(current)}</code>`
            : "chưa chọn — dùng /model để chọn"
        }`,
        `Lịch sử hiện tại: ${historyCount} tin nhắn`,
        `Giới hạn: ${getIntEnv(
          ctx.env.RATE_LIMIT_PER_MINUTE,
          DEFAULT_RATE_LIMIT_PER_MINUTE,
        )} tin nhắn/phút/người dùng`,
      ].join("\n");
      await ctx.telegram.sendMessage(chatId, text, { parseMode: "HTML" });
      return;
    }
    case "id": {
      await ctx.telegram.sendMessage(
        chatId,
        `🆔 Telegram ID của bạn là: <code>${userId}</code>`,
        { parseMode: "HTML" },
      );
      return;
    }
    case "about": {
      await ctx.telegram.sendMessage(chatId, aboutMessage(), {
        parseMode: "HTML",
      });
      return;
    }
    default: {
      await ctx.telegram.sendMessage(
        chatId,
        "Lệnh không xác định. Gõ /help để xem danh sách lệnh.",
      );
      return;
    }
  }
}
