import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDeps, handleUpdate, resetBotState } from "../src/telegram/webhook";
import type { BotDeps } from "../src/telegram/webhook";
import {
  makeEnv,
  makeMockFetch,
  telegramSendMessageTexts,
  telegramSendMessageBodies,
  xingchiChatBodies,
  type MockFetch,
} from "./helpers";

async function sendText(
  deps: BotDeps,
  updateId: number,
  text: string,
  userId = 111,
  chatId = 111,
): Promise<void> {
  await handleUpdate(deps, {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: userId },
      chat: { id: chatId },
      text,
    },
  });
}

async function sendCallback(
  deps: BotDeps,
  updateId: number,
  data: string,
  userId = 111,
  chatId = 111,
): Promise<void> {
  await handleUpdate(deps, {
    update_id: updateId,
    callback_query: {
      id: `cq-${updateId}`,
      from: { id: userId },
      data,
      message: {
        message_id: 1,
        from: { id: userId },
        chat: { id: chatId },
      },
    },
  });
}

async function sendNonText(deps: BotDeps, updateId: number): Promise<void> {
  await handleUpdate(deps, {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 111 },
      chat: { id: 111 },
      // Không có text — vd: sticker/ảnh.
    },
  });
}

describe("commands", () => {
  let mock: MockFetch;
  let deps: BotDeps;

  beforeEach(() => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("/start giới thiệu bot", async () => {
    await sendText(deps, 1, "/start");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("Xin chào"))).toBe(true);
  });

  it("/help hiển thị hướng dẫn và model hiện tại", async () => {
    await sendText(deps, 1, "/help");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("Hướng dẫn"))).toBe(true);
    expect(texts.some((t) => t.includes("test-model-a"))).toBe(true);
  });

  it("/model hiển thị Inline Keyboard với đúng model ID từ API", async () => {
    await sendText(deps, 1, "/model");
    const bodies = telegramSendMessageBodies(mock.calls);
    expect(bodies).toHaveLength(1);
    const markup = bodies[0]?.reply_markup as {
      inline_keyboard: { text: string; callback_data: string }[][];
    };
    expect(markup.inline_keyboard[0]?.[0]?.callback_data).toBe("model:test-model-a");
    expect(markup.inline_keyboard[1]?.[0]?.callback_data).toBe("model:test-model-b");
  });

  it("/models liệt kê đúng model ID do API trả về, không tự tạo tên", async () => {
    await sendText(deps, 1, "/models");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("test-model-a"))).toBe(true);
    expect(texts.some((t) => t.includes("test-model-b"))).toBe(true);
  });

  it("/id hiển thị Telegram user ID", async () => {
    await sendText(deps, 1, "/id", 4242, 4242);
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("4242"))).toBe(true);
  });

  it("/about hiển thị phiên bản", async () => {
    await sendText(deps, 1, "/about");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("1.0.0"))).toBe(true);
  });

  it("/status báo API hoạt động và số model", async () => {
    await sendText(deps, 1, "/status");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("hoạt động"))).toBe(true);
    expect(texts.some((t) => t.includes("2 model"))).toBe(true);
  });

  it("lệnh không xác định được báo lại lịch sự", async () => {
    await sendText(deps, 1, "/khong-ton-tai");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("không xác định"))).toBe(true);
  });

  it("/new xóa lịch sử và chào cuộc trò chuyện mới", async () => {
    await sendText(deps, 1, "xin chào");
    await sendText(deps, 2, "/new");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("cuộc trò chuyện mới"))).toBe(true);
  });
});

describe("chọn model qua callback", () => {
  let mock: MockFetch;
  let deps: BotDeps;

  beforeEach(() => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chọn model hợp lệ -> xác nhận và dùng model đó khi trò chuyện", async () => {
    await sendCallback(deps, 1, "model:test-model-b");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("Đã chọn model"))).toBe(true);
    await sendText(deps, 2, "xin chào");
    const chatBodies = xingchiChatBodies(mock.calls);
    expect(chatBodies).toHaveLength(1);
    expect(chatBodies[0]?.model).toBe("test-model-b");
  });

  it("chọn model không tồn tại -> thông báo không khả dụng", async () => {
    await sendCallback(deps, 1, "model:model-khong-ton-tai");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("không còn khả dụng"))).toBe(true);
    expect(xingchiChatBodies(mock.calls)).toHaveLength(0);
  });
});

describe("trò chuyện AI", () => {
  let mock: MockFetch;
  let deps: BotDeps;

  beforeEach(() => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tin nhắn thường được gửi tới AI và trả lời lại cho user", async () => {
    await sendText(deps, 1, "xin chào");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("câu trả lời kiểm thử"))).toBe(true);
    // sendChatAction "typing" đã được gọi trước khi gọi AI.
    expect(mock.calls.some((c) => c.url.includes("/sendChatAction"))).toBe(true);
  });

  it("chưa chọn model và không có DEFAULT_MODEL -> nhắc chọn model", async () => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv({ DEFAULT_MODEL: "" }));
    await sendText(deps, 1, "xin chào");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("/model"))).toBe(true);
    expect(xingchiChatBodies(mock.calls)).toHaveLength(0);
  });

  it("tin nhắn rỗng được báo lại, không gọi AI", async () => {
    await sendText(deps, 1, "   ");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("chưa nhập nội dung"))).toBe(true);
    expect(xingchiChatBodies(mock.calls)).toHaveLength(0);
  });

  it("tin nhắn quá dài được từ chối, không gọi AI", async () => {
    await sendText(deps, 1, "x".repeat(8001));
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("quá dài"))).toBe(true);
    expect(xingchiChatBodies(mock.calls)).toHaveLength(0);
  });

  it("update không phải tin nhắn văn bản được báo lại lịch sự", async () => {
    await sendNonText(deps, 1);
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("chỉ hỗ trợ tin nhắn văn bản"))).toBe(true);
  });

  it("lỗi API 401 -> thông báo thân thiện, không lộ chi tiết kỹ thuật", async () => {
    resetBotState();
    mock = makeMockFetch({ chatStatus: 401 });
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv());
    await sendText(deps, 1, "xin chào");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("API key"))).toBe(true);
    expect(texts.some((t) => t.includes("401"))).toBe(false);
  });

  it("lỗi API 429 -> thông báo quá tải/hết quota", async () => {
    resetBotState();
    mock = makeMockFetch({ chatStatus: 429 });
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv());
    await sendText(deps, 1, "xin chào");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("quá tải") || t.includes("quota"))).toBe(true);
  });

  it("rate limit: tin nhắn thứ 3 trong 1 phút bị chặn", async () => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
    deps = createDeps(makeEnv({ RATE_LIMIT_PER_MINUTE: "2" }));
    await sendText(deps, 1, "một");
    await sendText(deps, 2, "hai");
    await sendText(deps, 3, "ba");
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.some((t) => t.includes("quá nhanh"))).toBe(true);
    expect(xingchiChatBodies(mock.calls)).toHaveLength(2);
  });
});
