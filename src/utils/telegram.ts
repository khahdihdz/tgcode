/**
 * Tiện ích giao tiếp với Telegram Bot API.
 * - Escape HTML đúng cách trước khi gửi với parse_mode=HTML.
 * - Chia tin nhắn dài theo giới hạn 4096 ký tự của Telegram.
 */

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/** Escape nội dung để gửi an toàn với parse_mode=HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Chia văn bản thành nhiều đoạn, mỗi đoạn không quá `maxLength` ký tự.
 * Ưu tiên cắt tại dấu xuống dòng, sau đó là khoảng trắng.
 */
export function splitTelegramMessage(
  text: string,
  maxLength: number = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  if (text.length === 0) return [];
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLength) {
    let cut = rest.lastIndexOf("\n", maxLength);
    if (cut <= 0) cut = rest.lastIndexOf(" ", maxLength);
    if (cut <= 0) cut = maxLength;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

export interface SendMessageOptions {
  parseMode?: "HTML";
  replyMarkup?: unknown;
  replyToMessageId?: number;
}

export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  private async callApi(method: string, body: Record<string, unknown>): Promise<void> {
    const res = await this.fetchFn(this.apiUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Không đưa body phản hồi vào lỗi: tránh rò rỉ thông tin nhạy cảm.
      throw new Error(`Telegram API error: ${res.status}`);
    }
    const data = (await res.json()) as { ok?: boolean };
    if (data && data.ok === false) {
      throw new Error("Telegram API returned ok=false");
    }
  }

  async sendMessage(
    chatId: number,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (options.parseMode) body.parse_mode = options.parseMode;
    if (options.replyMarkup !== undefined) body.reply_markup = options.replyMarkup;
    if (options.replyToMessageId !== undefined) {
      body.reply_to_message_id = options.replyToMessageId;
    }
    await this.callApi("sendMessage", body);
  }

  async sendChatAction(
    chatId: number,
    action: string = "typing",
  ): Promise<void> {
    await this.callApi("sendChatAction", { chat_id: chatId, action });
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<void> {
    const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) body.text = text;
    await this.callApi("answerCallbackQuery", body);
  }
}
