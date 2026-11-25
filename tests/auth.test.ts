import { describe, it, expect } from "vitest";
import { timingSafeEqual, verifyWebhookSecret } from "../src/security/auth";

describe("timingSafeEqual", () => {
  it("trả về true với hai chuỗi giống hệt nhau", () => {
    expect(timingSafeEqual("secret-123", "secret-123")).toBe(true);
  });

  it("trả về false khi khác nhau", () => {
    expect(timingSafeEqual("secret-123", "secret-124")).toBe(false);
  });

  it("trả về false khi khác độ dài", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("trả về true với chuỗi rỗng giống nhau", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("xử lý ký tự Unicode", () => {
    expect(timingSafeEqual("bí-mật-🔑", "bí-mật-🔑")).toBe(true);
    expect(timingSafeEqual("bí-mật-🔑", "bí-mật-🔒")).toBe(false);
  });
});

describe("verifyWebhookSecret", () => {
  it("chấp nhận secret đúng", () => {
    expect(verifyWebhookSecret("my-secret", "my-secret")).toBe(true);
  });

  it("từ chối secret sai", () => {
    expect(verifyWebhookSecret("wrong", "my-secret")).toBe(false);
  });

  it("từ chối khi header thiếu", () => {
    expect(verifyWebhookSecret(null, "my-secret")).toBe(false);
  });

  it("từ chối khi secret chưa được cấu hình phía server", () => {
    expect(verifyWebhookSecret("my-secret", undefined)).toBe(false);
    expect(verifyWebhookSecret("my-secret", "")).toBe(false);
  });
});
