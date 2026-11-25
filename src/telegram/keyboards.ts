/**
 * Inline Keyboard của Telegram.
 * Callback data của Telegram tối đa 64 byte nên model có ID quá dài
 * sẽ bị bỏ khỏi bàn phím (vẫn hiển thị trong danh sách /models).
 */
import type { XingchiModel } from "../ai/xingchi";

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export const MAX_CALLBACK_DATA_BYTES = 64;

/** Một nút cho mỗi model (tối đa 30 model để tránh vượt giới hạn Telegram). */
export function modelKeyboard(models: XingchiModel[]): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (const model of models.slice(0, 30)) {
    const callbackData = `model:${model.id}`;
    if (new TextEncoder().encode(callbackData).length > MAX_CALLBACK_DATA_BYTES) {
      continue;
    }
    rows.push([{ text: model.id, callback_data: callbackData }]);
  }
  return { inline_keyboard: rows };
}
