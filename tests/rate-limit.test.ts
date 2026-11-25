import { describe, it, expect } from "vitest";
import { RateLimiter, UpdateDedupe } from "../src/security/rate-limit";

describe("RateLimiter", () => {
  it("cho phép trong giới hạn", () => {
    const limiter = new RateLimiter(3);
    expect(limiter.allow(1, 1_000)).toBe(true);
    expect(limiter.allow(1, 2_000)).toBe(true);
    expect(limiter.allow(1, 3_000)).toBe(true);
  });

  it("chặn khi vượt giới hạn trong cùng một phút", () => {
    const limiter = new RateLimiter(2);
    expect(limiter.allow(1, 1_000)).toBe(true);
    expect(limiter.allow(1, 2_000)).toBe(true);
    expect(limiter.allow(1, 3_000)).toBe(false);
  });

  it("giới hạn theo từng người dùng riêng biệt", () => {
    const limiter = new RateLimiter(1);
    expect(limiter.allow(1, 1_000)).toBe(true);
    expect(limiter.allow(1, 2_000)).toBe(false);
    expect(limiter.allow(2, 2_000)).toBe(true);
  });

  it("mở lại sau khi cửa sổ 60 giây trôi qua", () => {
    const limiter = new RateLimiter(1);
    expect(limiter.allow(1, 1_000)).toBe(true);
    expect(limiter.allow(1, 2_000)).toBe(false);
    expect(limiter.allow(1, 62_000)).toBe(true);
  });
});

describe("UpdateDedupe", () => {
  it("update mới không phải trùng", () => {
    const dedupe = new UpdateDedupe();
    expect(dedupe.isDuplicate(100)).toBe(false);
    expect(dedupe.isDuplicate(101)).toBe(false);
  });

  it("update gửi lại bị phát hiện là trùng", () => {
    const dedupe = new UpdateDedupe();
    expect(dedupe.isDuplicate(100)).toBe(false);
    expect(dedupe.isDuplicate(100)).toBe(true);
    expect(dedupe.isDuplicate(100)).toBe(true);
  });
});
