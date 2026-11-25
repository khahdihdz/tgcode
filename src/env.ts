/**
 * Kiểu dữ liệu môi trường (bindings) của Cloudflare Worker.
 *
 * Secrets (TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, XINGCHI_API_KEY)
 * KHÔNG được ghi trong file này hay wrangler.toml — chúng được cấu hình
 * bằng `wrangler secret put` hoặc GitHub Actions (xem README.md).
 * Các biến còn lại là vars thông thường, cấu hình trong wrangler.toml.
 */
export interface Env {
  /** Token của Telegram Bot (secret). */
  TELEGRAM_BOT_TOKEN: string;
  /** Secret dùng để xác thực webhook Telegram (secret). */
  TELEGRAM_WEBHOOK_SECRET: string;
  /** API key của XingchiAPI (secret). */
  XINGCHI_API_KEY: string;
  /** Model mặc định, phải là một model ID do /v1/models trả về. */
  DEFAULT_MODEL?: string;
  /** Số token tối đa cho mỗi câu trả lời của AI. */
  MAX_OUTPUT_TOKENS?: string;
  /** Số tin nhắn tối đa giữ lại trong lịch sử hội thoại mỗi chat. */
  MAX_HISTORY_MESSAGES?: string;
  /** Số tin nhắn tối đa mỗi người dùng được gửi trong một phút. */
  RATE_LIMIT_PER_MINUTE?: string;
  /** Danh sách Telegram user ID được phép dùng bot, cách nhau bằng dấu phẩy.
   *  Để trống nghĩa là cho phép mọi người dùng. */
  ALLOWED_USER_IDS?: string;
  /** (Tùy chọn) Cloudflare KV namespace để lưu lịch sử bền vững.
   *  Nếu không bind KV, lịch sử chỉ lưu trong bộ nhớ của isolate
   *  (best-effort, có thể mất khi Worker bị thu hồi). */
  HISTORY_KV?: KVNamespace;
}

/** Giới hạn kích thước body của webhook request (1 MB). */
export const MAX_BODY_BYTES = 1_048_576;
/** Độ dài tối đa của một tin nhắn người dùng gửi tới bot. */
export const MAX_USER_MESSAGE_CHARS = 8_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 1_024;
export const DEFAULT_MAX_HISTORY_MESSAGES = 20;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
/** Thời gian cache danh sách model (5 phút). */
export const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000;

export function getIntEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAllowedUserIds(env: Env): Set<number> {
  const ids = new Set<number>();
  if (!env.ALLOWED_USER_IDS) return ids;
  for (const part of env.ALLOWED_USER_IDS.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (Number.isFinite(n)) ids.add(n);
  }
  return ids;
}

/** Nếu ALLOWED_USER_IDS trống thì cho phép mọi người dùng. */
export function isUserAllowed(env: Env, userId: number): boolean {
  const allowed = getAllowedUserIds(env);
  if (allowed.size === 0) return true;
  return allowed.has(userId);
}
