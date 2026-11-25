/**
 * Phân tích và điều phối Telegram Update nhận từ webhook.
 * Không dùng long polling.
 */
import type { Env } from "../env";
import { getIntEnv, isUserAllowed, DEFAULT_RATE_LIMIT_PER_MINUTE } from "../env";
import { TelegramApi, escapeHtml } from "../utils/telegram";
import { XingchiClient } from "../ai/xingchi";
import { ModelCache } from "../ai/models";
import type { HistoryStore } from "../storage";
import { createHistoryStore } from "../storage";
import { RateLimiter, UpdateDedupe } from "../security/rate-limit";
import { handleCommand, type CommandContext } from "./commands";
import { handleTextMessage } from "./messages";

export interface TelegramUser {
  id: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  reply_to_message?: { message_id: number };
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface BotDeps extends CommandContext {
  limiter: RateLimiter;
  dedupe: UpdateDedupe;
}

/**
 * Trạng thái dùng chung trong một isolate: rate limiter, dedupe,
 * history store và model cache. Workers tái sử dụng isolate giữa các
 * request nên trạng thái này có tác dụng thực tế; nhưng không đảm bảo
 * bền vững giữa các isolate — xem ghi chú trong src/storage.ts.
 */
let sharedDeps: BotDeps | null = null;

export function createDeps(env: Env): BotDeps {
  if (sharedDeps) {
    sharedDeps.env = env;
    sharedDeps.limiter.setLimit(
      getIntEnv(env.RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE),
    );
    return sharedDeps;
  }
  const telegram = new TelegramApi(env.TELEGRAM_BOT_TOKEN);
  const xingchi = new XingchiClient(env.XINGCHI_API_KEY);
  const store: HistoryStore = createHistoryStore(env);
  sharedDeps = {
    env,
    telegram,
    xingchi,
    store,
    models: new ModelCache(xingchi),
    limiter: new RateLimiter(
      getIntEnv(env.RATE_LIMIT_PER_MINUTE, DEFAULT_RATE_LIMIT_PER_MINUTE),
    ),
    dedupe: new UpdateDedupe(),
  };
  return sharedDeps;
}

/** Chỉ dùng trong test để reset trạng thái dùng chung giữa các test case. */
export function resetBotState(): void {
  sharedDeps = null;
}

function parseCommand(text: string): { command: string; args: string } | null {
  if (!text.startsWith("/")) return null;
  const firstSpace = text.indexOf(" ");
  const raw = firstSpace === -1 ? text.slice(1) : text.slice(1, firstSpace);
  // Bỏ hậu tố @BotUsername nếu có (vd: /start@XingchiBot).
  const command = raw.split("@")[0]?.toLowerCase() ?? "";
  const args = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
  return { command, args };
}

/** Kiểm tra cấu trúc tối thiểu của Telegram Update. */
export function isValidUpdate(value: unknown): value is TelegramUpdate {
  if (!value || typeof value !== "object") return false;
  const updateId = (value as { update_id?: unknown }).update_id;
  return typeof updateId === "number" && Number.isFinite(updateId);
}

export async function handleUpdate(
  deps: BotDeps,
  update: TelegramUpdate,
): Promise<void> {
  // Chống gửi trùng update.
  if (deps.dedupe.isDuplicate(update.update_id)) return;

  if (update.callback_query) {
    const cq = update.callback_query;
    if (!isUserAllowed(deps.env, cq.from.id)) {
      await deps.telegram.answerCallbackQuery(
        cq.id,
        "Bạn không có quyền sử dụng bot này.",
      );
      return;
    }
    if (!deps.limiter.allow(cq.from.id)) {
      await deps.telegram.answerCallbackQuery(
        cq.id,
        "Bạn gửi quá nhanh. Vui lòng thử lại sau.",
      );
      return;
    }
    const chatId = cq.message?.chat.id;
    if (chatId === undefined) return;
    await handleCallbackQuery(deps, cq, chatId);
    return;
  }

  const message = update.message;
  if (!message) return;

  if (typeof message.text !== "string") {
    // Update không phải tin nhắn văn bản (sticker, ảnh, file...).
    await deps.telegram.sendMessage(
      message.chat.id,
      "Bot hiện chỉ hỗ trợ tin nhắn văn bản. Hãy gửi chữ để trò chuyện với AI.",
    );
    return;
  }

  const userId = message.from?.id;
  if (userId === undefined) return;

  if (!isUserAllowed(deps.env, userId)) {
    await deps.telegram.sendMessage(
      message.chat.id,
      "Xin lỗi, bạn không có quyền sử dụng bot này.",
    );
    return;
  }

  if (!deps.limiter.allow(userId)) {
    await deps.telegram.sendMessage(
      message.chat.id,
      "Bạn đang gửi quá nhanh. Vui lòng chờ một lát rồi thử lại.",
    );
    return;
  }

  const parsed = parseCommand(message.text.trim());
  if (parsed) {
    await handleCommand(deps, message.chat.id, userId, parsed.command, parsed.args);
    return;
  }

  await handleTextMessage(
    deps,
    message.chat.id,
    userId,
    message.text,
    message.reply_to_message?.message_id,
  );
}

async function handleCallbackQuery(
  deps: BotDeps,
  cq: TelegramCallbackQuery,
  chatId: number,
): Promise<void> {
  const data = cq.data ?? "";
  if (!data.startsWith("model:")) {
    await deps.telegram.answerCallbackQuery(cq.id, "Lựa chọn không hợp lệ.");
    return;
  }
  const modelId = data.slice("model:".length);
  if (modelId.length === 0) {
    await deps.telegram.answerCallbackQuery(cq.id, "Model không hợp lệ.");
    return;
  }
  try {
    const valid = await deps.models.isValidModel(modelId);
    if (!valid) {
      await deps.telegram.answerCallbackQuery(cq.id, "Model này không khả dụng.");
      await deps.telegram.sendMessage(
        chatId,
        `Model <code>${escapeHtml(modelId)}</code> không còn khả dụng. Hãy dùng /model để chọn model khác.`,
        { parseMode: "HTML" },
      );
      return;
    }
    await deps.store.setModel(chatId, modelId);
    await deps.telegram.answerCallbackQuery(cq.id, `Đã chọn model: ${modelId}`);
    await deps.telegram.sendMessage(
      chatId,
      `✅ Đã chọn model <code>${escapeHtml(modelId)}</code>. Hãy gửi tin nhắn để bắt đầu trò chuyện.`,
      { parseMode: "HTML" },
    );
  } catch {
    await deps.telegram.answerCallbackQuery(
      cq.id,
      "Không thể kiểm tra model lúc này.",
    );
  }
}
