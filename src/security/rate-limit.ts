/**
 * Giới hạn tần suất (rate limit) theo từng người dùng và
 * chống xử lý trùng một Telegram update (dedupe theo update_id).
 *
 * Lưu ý: trạng thái lưu trong bộ nhớ của isolate. Trên Cloudflare Workers
 * Free Plan, một isolate có thể phục vụ nhiều request liên tiếp nên cơ chế
 * này có tác dụng thực tế, nhưng không phải là giới hạn toàn cục tuyệt đối
 * giữa các isolate.
 */

/** Giới hạn số request mỗi người dùng trong một cửa sổ 60 giây. */
export class RateLimiter {
  private readonly hits = new Map<number, number[]>();

  constructor(private limitPerMinute: number) {}

  setLimit(limitPerMinute: number): void {
    this.limitPerMinute = limitPerMinute;
  }

  allow(userId: number, now: number = Date.now()): boolean {
    const windowStart = now - 60_000;
    const previous = (this.hits.get(userId) ?? []).filter((t) => t > windowStart);
    if (previous.length >= this.limitPerMinute) {
      this.hits.set(userId, previous);
      return false;
    }
    previous.push(now);
    this.hits.set(userId, previous);
    return true;
  }
}

/** Ghi nhớ các update_id đã xử lý để bỏ qua update gửi trùng. */
export class UpdateDedupe {
  private static readonly MAX_TRACKED = 10_000;
  private readonly seen = new Set<number>();
  private readonly order: number[] = [];

  /** Trả về true nếu update_id này đã được xử lý trước đó. */
  isDuplicate(updateId: number): boolean {
    if (this.seen.has(updateId)) return true;
    this.seen.add(updateId);
    this.order.push(updateId);
    if (this.order.length > UpdateDedupe.MAX_TRACKED) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return false;
  }
}
