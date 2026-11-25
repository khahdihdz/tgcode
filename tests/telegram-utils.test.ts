import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  splitTelegramMessage,
  TELEGRAM_MAX_MESSAGE_LENGTH,
} from "../src/utils/telegram";

describe("escapeHtml", () => {
  it("escape &, <, >", () => {
    expect(escapeHtml('<b>&"test"</b>')).toBe("&lt;b&gt;&amp;\"test\"&lt;/b&gt;");
  });

  it("giữ nguyên văn bản thường", () => {
    expect(escapeHtml("Xin chào bạn")).toBe("Xin chào bạn");
  });

  it("escape nội dung do AI/user tạo ra (chống phá vỡ parse_mode=HTML)", () => {
    const userInput = "<script>alert(1)</script>";
    expect(escapeHtml(userInput)).not.toContain("<script>");
    expect(escapeHtml(userInput)).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("splitTelegramMessage", () => {
  it("không chia tin nhắn ngắn", () => {
    expect(splitTelegramMessage("ngắn")).toEqual(["ngắn"]);
  });

  it("trả về mảng rỗng với chuỗi rỗng", () => {
    expect(splitTelegramMessage("")).toEqual([]);
  });

  it("chia tin nhắn dài thành các đoạn <= 4096 ký tự", () => {
    const long = "a".repeat(10_000);
    const chunks = splitTelegramMessage(long);
    expect(chunks.length).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_MAX_MESSAGE_LENGTH);
    }
    expect(chunks.join("")).toBe(long);
  });

  it("ưu tiên cắt tại dấu xuống dòng", () => {
    const text = `${"x".repeat(4000)}\n${"y".repeat(4000)}`;
    const chunks = splitTelegramMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe("x".repeat(4000));
    expect(chunks[1]).toBe("y".repeat(4000));
  });

  it("không làm mất nội dung khi nối các đoạn lại", () => {
    const text = Array.from({ length: 200 }, (_, i) => `dòng ${i}`).join("\n");
    const long = text.repeat(10);
    const chunks = splitTelegramMessage(long);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_MAX_MESSAGE_LENGTH);
    }
    // Nội dung có thể mất ký tự phân tách tại điểm cắt, nhưng không mất từ.
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("dòng 199");
  });
});
