import { vi } from "vitest";
import type { Env } from "../src/env";

// Các giá trị GIẢ chỉ dùng trong test — không phải secret thật.
export const FAKE_TELEGRAM_TOKEN = "FAKE_TELEGRAM_TOKEN_FOR_TESTS_ONLY";
export const FAKE_WEBHOOK_SECRET = "FAKE_WEBHOOK_SECRET_FOR_TESTS_ONLY";
export const FAKE_XINGCHI_KEY = "FAKE_XINGCHI_KEY_FOR_TESTS_ONLY";

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    TELEGRAM_BOT_TOKEN: FAKE_TELEGRAM_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: FAKE_WEBHOOK_SECRET,
    XINGCHI_API_KEY: FAKE_XINGCHI_KEY,
    DEFAULT_MODEL: "test-model-a",
    MAX_OUTPUT_TOKENS: "256",
    MAX_HISTORY_MESSAGES: "10",
    RATE_LIMIT_PER_MINUTE: "20",
    ...overrides,
  };
}

export interface MockFetchOptions {
  models?: { id: string }[];
  modelsStatus?: number;
  chatContent?: string;
  chatStatus?: number;
}

export interface FetchCall {
  url: string;
  init?: RequestInit;
}

export interface MockFetch {
  fetchMock: ReturnType<typeof vi.fn>;
  calls: FetchCall[];
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function makeMockFetch(options: MockFetchOptions = {}): MockFetch {
  const calls: FetchCall[] = [];
  const models = options.models ?? [{ id: "test-model-a" }, { id: "test-model-b" }];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);
    calls.push({ url: urlStr, init });
    if (urlStr.includes("api.telegram.org")) {
      return jsonResponse(200, { ok: true, result: {} });
    }
    if (urlStr.endsWith("/models")) {
      const status = options.modelsStatus ?? 200;
      if (status !== 200) return new Response("error", { status });
      return jsonResponse(200, { object: "list", data: models });
    }
    if (urlStr.endsWith("/chat/completions")) {
      const status = options.chatStatus ?? 200;
      if (status !== 200) return new Response("error", { status });
      return jsonResponse(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content:
                options.chatContent ?? "Xin chào, đây là câu trả lời kiểm thử.",
            },
          },
        ],
      });
    }
    return new Response("Not Found", { status: 404 });
  });
  return { fetchMock, calls };
}

/** Các body JSON đã gửi tới Telegram sendMessage. */
export function telegramSendMessageBodies(
  calls: FetchCall[],
): Record<string, unknown>[] {
  return calls
    .filter((c) => c.url.includes("/sendMessage"))
    .map((c) => JSON.parse(String(c.init?.body ?? "{}")) as Record<string, unknown>);
}

export function telegramSendMessageTexts(calls: FetchCall[]): string[] {
  return telegramSendMessageBodies(calls).map((b) => String(b.text ?? ""));
}

/** Các body JSON đã gửi tới XingchiAPI /chat/completions. */
export function xingchiChatBodies(calls: FetchCall[]): Record<string, unknown>[] {
  return calls
    .filter((c) => c.url.includes("/chat/completions"))
    .map((c) => JSON.parse(String(c.init?.body ?? "{}")) as Record<string, unknown>);
}
