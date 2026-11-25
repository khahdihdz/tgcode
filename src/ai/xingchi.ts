/**
 * Client gọi XingchiAPI — OpenAI-compatible Chat Completions.
 *
 * Base URL: https://api.xingchiapi.com/v1
 * - GET  /v1/models           (danh sách model)
 * - POST /v1/chat/completions (trò chuyện)
 * Auth: Authorization: Bearer <XINGCHI_API_KEY>
 *
 * ĐÃ XÁC MINH (2026-11-26, không cần key): GET /v1/models khi không có key
 * trả về HTTP 401 {"code":"API_KEY_REQUIRED", ...} — endpoint tồn tại và
 * yêu cầu Bearer auth. Việc liệt kê model thực tế và chat thành công
 * CHƯA được xác minh vì cần XINGCHI_API_KEY thật.
 *
 * Tham số gửi đi: CHỈ model, messages, max_tokens — là các tham số chuẩn
 * của OpenAI Chat Completions. KHÔNG gửi temperature / stream vì chưa xác
 * minh được mọi model của XingchiAPI đều hỗ trợ chúng, và streaming chưa
 * được kiểm chứng với luồng chỉnh sửa tin nhắn Telegram.
 *
 * API key KHÔNG BAO GIỜ được ghi log hay đưa vào thông điệp lỗi.
 */

export const XINGCHI_BASE_URL = "https://api.xingchiapi.com/v1";
export const XINGCHI_TIMEOUT_MS = 30_000;

export interface XingchiModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ModelsResponse {
  data: XingchiModel[];
  object?: string;
}

export class XingchiApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "XingchiApiError";
  }
}

function mapStatusToError(status: number): XingchiApiError {
  switch (status) {
    case 401:
      return new XingchiApiError(
        401,
        "INVALID_API_KEY",
        "API key không hợp lệ hoặc đã hết hạn.",
      );
    case 403:
      return new XingchiApiError(
        403,
        "FORBIDDEN",
        "API key không có quyền truy cập tài nguyên này.",
      );
    case 429:
      return new XingchiApiError(
        429,
        "RATE_LIMITED",
        "API đã vượt giới hạn tần suất hoặc hết quota.",
      );
    case 404:
      return new XingchiApiError(
        404,
        "NOT_FOUND",
        "Model hoặc endpoint không tồn tại.",
      );
    default:
      if (status >= 500) {
        return new XingchiApiError(
          status,
          "SERVER_ERROR",
          "Máy chủ AI tạm thời lỗi.",
        );
      }
      return new XingchiApiError(status, "API_ERROR", "AI API trả về lỗi.");
  }
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new XingchiApiError(
        0,
        "TIMEOUT",
        "Yêu cầu tới AI API đã quá thời gian chờ.",
      );
    }
    throw new XingchiApiError(
      0,
      "NETWORK_ERROR",
      "Không thể kết nối tới AI API.",
    );
  } finally {
    clearTimeout(timer);
  }
}

export class XingchiClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs: number = XINGCHI_TIMEOUT_MS,
  ) {}

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /** Lấy danh sách model trực tiếp từ /v1/models. Không hardcode model. */
  async listModels(): Promise<XingchiModel[]> {
    const res = await fetchWithTimeout(
      this.fetchFn,
      `${XINGCHI_BASE_URL}/models`,
      { method: "GET", headers: this.authHeaders() },
      this.timeoutMs,
    );
    if (!res.ok) throw mapStatusToError(res.status);
    const body = (await res.json()) as unknown;
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as ModelsResponse).data)
    ) {
      throw new XingchiApiError(
        0,
        "MALFORMED_RESPONSE",
        "Phản hồi danh sách model không đúng định dạng.",
      );
    }
    return (body as ModelsResponse).data.filter(
      (m) => m && typeof m.id === "string" && m.id.length > 0,
    );
  }

  /** Gửi hội thoại tới /v1/chat/completions (không stream). */
  async chatCompletion(
    model: string,
    messages: ChatMessageInput[],
    maxTokens: number,
  ): Promise<string> {
    const res = await fetchWithTimeout(
      this.fetchFn,
      `${XINGCHI_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: this.authHeaders(),
        // Chỉ gửi các tham số đã xác minh tương thích (xem ghi chú đầu file).
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      },
      this.timeoutMs,
    );
    if (!res.ok) throw mapStatusToError(res.status);
    const body = (await res.json()) as unknown;
    const content = extractContent(body);
    if (content === null) {
      throw new XingchiApiError(
        0,
        "MALFORMED_RESPONSE",
        "Phản hồi AI không đúng định dạng.",
      );
    }
    return content;
  }
}

function extractContent(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) return null;
  return content;
}
