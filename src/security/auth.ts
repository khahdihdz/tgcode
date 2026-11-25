/**
 * Xác thực webhook Telegram bằng header `X-Telegram-Bot-Api-Secret-Token`.
 * So sánh hằng thời gian (constant-time) để tránh tấn công timing.
 */

/** So sánh hai chuỗi theo cách hằng thời gian trên bytes UTF-8. */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] as number) ^ (bBytes[i] as number);
  }
  return diff === 0;
}

/**
 * Kiểm tra secret token mà Telegram gửi kèm webhook.
 * Trả về false nếu secret chưa được cấu hình hoặc header thiếu/sai.
 */
export function verifyWebhookSecret(
  provided: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length === 0) return false;
  if (!provided || provided.length === 0) return false;
  return timingSafeEqual(provided, expected);
}
