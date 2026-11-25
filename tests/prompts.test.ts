import { describe, it, expect } from "vitest";
import { DEFAULT_SYSTEM_PROMPT, buildChatMessages } from "../src/ai/prompts";

describe("buildChatMessages", () => {
  it("đặt system prompt lên đầu, rồi lịch sử, rồi tin nhắn mới", () => {
    const messages = buildChatMessages(DEFAULT_SYSTEM_PROMPT, [
      { role: "user", content: "chào" },
      { role: "assistant", content: "xin chào" },
    ], "bạn khỏe không?");
    expect(messages).toEqual([
      { role: "system", content: DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: "chào" },
      { role: "assistant", content: "xin chào" },
      { role: "user", content: "bạn khỏe không?" },
    ]);
  });

  it("system prompt mặc định là tiếng Việt", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("tiếng Việt");
  });
});
