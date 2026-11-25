import { describe, it, expect, vi } from "vitest";
import { XingchiClient, XingchiApiError } from "../src/ai/xingchi";

const FAKE_KEY = "FAKE_XINGCHI_KEY_FOR_TESTS_ONLY";

function mockFetchWith(status: number, body: unknown) {
  return vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("XingchiClient.listModels", () => {
  it("trả về danh sách model từ API", async () => {
    const fetchMock = mockFetchWith(200, {
      object: "list",
      data: [{ id: "model-a" }, { id: "model-b" }],
    });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    const models = await client.listModels();
    expect(models.map((m) => m.id)).toEqual(["model-a", "model-b"]);
  });

  it("gửi Authorization: Bearer và gọi đúng endpoint /v1/models", async () => {
    const fetchMock = mockFetchWith(200, { data: [] });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    await client.listModels();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xingchiapi.com/v1/models");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${FAKE_KEY}`,
    );
  });

  it("lọc bỏ model không có id hợp lệ", async () => {
    const fetchMock = mockFetchWith(200, {
      data: [{ id: "model-a" }, { id: "" }, { object: "model" }],
    });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    const models = await client.listModels();
    expect(models.map((m) => m.id)).toEqual(["model-a"]);
  });

  it("ném MALFORMED_RESPONSE khi body sai định dạng", async () => {
    const fetchMock = mockFetchWith(200, { data: "không phải mảng" });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    await expect(client.listModels()).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });
});

describe("XingchiClient.chatCompletion", () => {
  it("trả về nội dung câu trả lời của AI", async () => {
    const fetchMock = mockFetchWith(200, {
      choices: [{ message: { role: "assistant", content: "Xin chào!" } }],
    });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    const reply = await client.chatCompletion("model-a", [
      { role: "user", content: "Chào bạn" },
    ], 256);
    expect(reply).toBe("Xin chào!");
  });

  it("chỉ gửi các tham số đã xác minh: model, messages, max_tokens", async () => {
    const fetchMock = mockFetchWith(200, {
      choices: [{ message: { role: "assistant", content: "ok" } }],
    });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    await client.chatCompletion("model-a", [{ role: "user", content: "hi" }], 128);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xingchiapi.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model"]);
    expect(body.max_tokens).toBe(128);
  });

  it("ném MALFORMED_RESPONSE khi không có choices", async () => {
    const fetchMock = mockFetchWith(200, { choices: [] });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    await expect(
      client.chatCompletion("model-a", [{ role: "user", content: "hi" }], 128),
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

describe("XingchiClient — xử lý lỗi HTTP", () => {
  it.each([
    [401, "INVALID_API_KEY"],
    [403, "FORBIDDEN"],
    [429, "RATE_LIMITED"],
    [404, "NOT_FOUND"],
    [500, "SERVER_ERROR"],
    [502, "SERVER_ERROR"],
  ])("HTTP %s -> mã lỗi %s", async (status, code) => {
    const fetchMock = mockFetchWith(status, { error: "something" });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    const error = await client
      .listModels()
      .then(() => null)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(XingchiApiError);
    expect((error as XingchiApiError).code).toBe(code);
    expect((error as XingchiApiError).status).toBe(status);
  });

  it("thông điệp lỗi không chứa API key", async () => {
    const fetchMock = mockFetchWith(401, { error: "invalid key" });
    const client = new XingchiClient(FAKE_KEY, fetchMock);
    const error = await client
      .listModels()
      .then(() => null)
      .catch((e: unknown) => e);
    expect((error as Error).message).not.toContain(FAKE_KEY);
  });

  it("timeout -> mã lỗi TIMEOUT", async () => {
    const hangingFetch = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const client = new XingchiClient(FAKE_KEY, hangingFetch, 50);
    await expect(client.listModels()).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("lỗi mạng -> mã lỗi NETWORK_ERROR", async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;
    const client = new XingchiClient(FAKE_KEY, failingFetch);
    await expect(client.listModels()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});
