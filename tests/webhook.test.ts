import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "../src/index";
import { resetBotState } from "../src/telegram/webhook";
import {
  makeEnv,
  makeMockFetch,
  telegramSendMessageTexts,
  FAKE_WEBHOOK_SECRET,
} from "./helpers";

function makeUpdate(updateId: number, text: string, userId = 111, chatId = 111) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: userId },
      chat: { id: chatId },
      text,
    },
  };
}

function postRequest(
  body: string,
  secret: string | null = FAKE_WEBHOOK_SECRET,
  method = "POST",
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret !== null) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;
  return new Request("https://example.workers.dev/", {
    method,
    headers,
    body: method === "POST" ? body : undefined,
  });
}

describe("Worker fetch handler — webhook", () => {
  let mock: ReturnType<typeof makeMockFetch>;

  beforeEach(() => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("từ chối phương thức không phải POST (405)", async () => {
    const res = await worker.fetch(postRequest("", FAKE_WEBHOOK_SECRET, "GET"), makeEnv());
    expect(res.status).toBe(405);
  });

  it("từ chối khi thiếu secret header (401)", async () => {
    const res = await worker.fetch(
      postRequest(JSON.stringify(makeUpdate(1, "/start")), null),
      makeEnv(),
    );
    expect(res.status).toBe(401);
    expect(mock.calls).toHaveLength(0);
  });

  it("từ chối khi secret sai (401)", async () => {
    const res = await worker.fetch(
      postRequest(JSON.stringify(makeUpdate(1, "/start")), "sai-secret"),
      makeEnv(),
    );
    expect(res.status).toBe(401);
    expect(mock.calls).toHaveLength(0);
  });

  it("từ chối JSON sai định dạng (400)", async () => {
    const res = await worker.fetch(postRequest("{khong-phai-json"), makeEnv());
    expect(res.status).toBe(400);
  });

  it("từ chối update thiếu update_id (400)", async () => {
    const res = await worker.fetch(postRequest(JSON.stringify({})), makeEnv());
    expect(res.status).toBe(400);
  });

  it("từ chối body vượt 1 MB (413)", async () => {
    const big = JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 111 },
        chat: { id: 111 },
        text: "x".repeat(2_000_000),
      },
    });
    const res = await worker.fetch(postRequest(big), makeEnv());
    expect(res.status).toBe(413);
  });

  it("xử lý /start và trả 200", async () => {
    const res = await worker.fetch(
      postRequest(JSON.stringify(makeUpdate(1, "/start"))),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("Xin chào"))).toBe(true);
  });

  it("chống gửi trùng update: cùng update_id chỉ xử lý một lần", async () => {
    const env = makeEnv();
    const body = JSON.stringify(makeUpdate(7, "/start"));
    await worker.fetch(postRequest(body), env);
    await worker.fetch(postRequest(body), env);
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.filter((t) => t.includes("Xin chào"))).toHaveLength(1);
  });

  it("từ chối người dùng không nằm trong ALLOWED_USER_IDS", async () => {
    const env = makeEnv({ ALLOWED_USER_IDS: "999" });
    const res = await worker.fetch(
      postRequest(JSON.stringify(makeUpdate(1, "/start", 111, 111))),
      env,
    );
    expect(res.status).toBe(200);
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("không có quyền"))).toBe(true);
  });

  it("cho phép người dùng nằm trong ALLOWED_USER_IDS", async () => {
    const env = makeEnv({ ALLOWED_USER_IDS: "111,222" });
    await worker.fetch(
      postRequest(JSON.stringify(makeUpdate(1, "/start", 111, 111))),
      env,
    );
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("Xin chào"))).toBe(true);
  });

  it("/reset xóa lịch sử: /status sau đó báo 0 tin nhắn", async () => {
    const env = makeEnv();
    await worker.fetch(postRequest(JSON.stringify(makeUpdate(1, "xin chào"))), env);
    await worker.fetch(postRequest(JSON.stringify(makeUpdate(2, "/reset"))), env);
    await worker.fetch(postRequest(JSON.stringify(makeUpdate(3, "/status"))), env);
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("0 tin nhắn"))).toBe(true);
  });
});
