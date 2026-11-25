/**
 * Entry point của Cloudflare Worker — Telegram webhook.
 * Không dùng long polling.
 *
 * - Chỉ chấp nhận HTTP POST.
 * - Xác thực webhook bằng header X-Telegram-Bot-Api-Secret-Token.
 * - Giới hạn kích thước body 1 MB.
 * - Kiểm tra cấu trúc Telegram Update.
 * - Luôn trả 200 sau khi xử lý (kể cả khi handler lỗi) để Telegram
 *   không gửi lại update liên tục; lỗi chỉ ghi log phía server,
 *   không lộ chi tiết cho client.
 */
import type { Env } from "./env";
import { MAX_BODY_BYTES } from "./env";
import { verifyWebhookSecret } from "./security/auth";
import { createDeps, handleUpdate, isValidUpdate } from "./telegram/webhook";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!verifyWebhookSecret(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES) {
      return new Response("Payload Too Large", { status: 413 });
    }

    let update: unknown;
    try {
      update = JSON.parse(bodyText);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    if (!isValidUpdate(update)) {
      return new Response("Bad Request", { status: 400 });
    }

    try {
      await handleUpdate(createDeps(env), update);
    } catch (error) {
      // Chỉ log message ngắn gọn, không log body/update hay secrets.
      console.error(
        "handleUpdate failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
    return new Response("OK", { status: 200 });
  },
};
