/**
 * Lưu trữ lịch sử hội thoại + model đã chọn của từng chat.
 *
 * Mặc định: lưu trong bộ nhớ của isolate (InMemoryHistoryStore).
 * Cloudflare Workers là stateless — lịch sử trong bộ nhớ chỉ là best-effort
 * và có thể mất khi isolate bị thu hồi. Để giữ lịch sử bền vững qua nhiều
 * request, bind Cloudflare KV với tên `HISTORY_KV` (xem wrangler.toml);
 * khi đó KvHistoryStore được dùng, có TTL và giới hạn dung lượng.
 *
 * Không lưu API key hay dữ liệu cá nhân không cần thiết. Lệnh /reset xóa
 * lịch sử của chat hiện tại.
 */
import type { Env } from "./env";
import { getIntEnv, DEFAULT_MAX_HISTORY_MESSAGES } from "./env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface HistoryStore {
  getHistory(chatId: number): Promise<ChatMessage[]>;
  append(chatId: number, message: ChatMessage): Promise<void>;
  clear(chatId: number): Promise<void>;
  getModel(chatId: number): Promise<string | null>;
  setModel(chatId: number, model: string): Promise<void>;
  historyCount(chatId: number): Promise<number>;
}

/** Lưu trong bộ nhớ isolate — best-effort, không bền vững. */
export class InMemoryHistoryStore implements HistoryStore {
  private readonly histories = new Map<number, ChatMessage[]>();
  private readonly models = new Map<number, string>();

  constructor(private readonly maxMessages: number = DEFAULT_MAX_HISTORY_MESSAGES) {}

  async getHistory(chatId: number): Promise<ChatMessage[]> {
    return [...(this.histories.get(chatId) ?? [])];
  }

  async append(chatId: number, message: ChatMessage): Promise<void> {
    const list = this.histories.get(chatId) ?? [];
    list.push(message);
    while (list.length > this.maxMessages) list.shift();
    this.histories.set(chatId, list);
  }

  async clear(chatId: number): Promise<void> {
    this.histories.delete(chatId);
  }

  async getModel(chatId: number): Promise<string | null> {
    return this.models.get(chatId) ?? null;
  }

  async setModel(chatId: number, model: string): Promise<void> {
    this.models.set(chatId, model);
  }

  async historyCount(chatId: number): Promise<number> {
    return this.histories.get(chatId)?.length ?? 0;
  }
}

/** Lưu bền vững trong Cloudflare KV, có TTL (mặc định 7 ngày). */
export class KvHistoryStore implements HistoryStore {
  constructor(
    private readonly kv: KVNamespace,
    private readonly maxMessages: number = DEFAULT_MAX_HISTORY_MESSAGES,
    private readonly ttlSeconds: number = 7 * 24 * 3600,
  ) {}

  private historyKey(chatId: number): string {
    return `history:${chatId}`;
  }

  private modelKey(chatId: number): string {
    return `model:${chatId}`;
  }

  async getHistory(chatId: number): Promise<ChatMessage[]> {
    const raw = await this.kv.get(this.historyKey(chatId), "text");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as ChatMessage[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async append(chatId: number, message: ChatMessage): Promise<void> {
    const list = await this.getHistory(chatId);
    list.push(message);
    while (list.length > this.maxMessages) list.shift();
    await this.kv.put(this.historyKey(chatId), JSON.stringify(list), {
      expirationTtl: this.ttlSeconds,
    });
  }

  async clear(chatId: number): Promise<void> {
    await this.kv.delete(this.historyKey(chatId));
  }

  async getModel(chatId: number): Promise<string | null> {
    return this.kv.get(this.modelKey(chatId), "text");
  }

  async setModel(chatId: number, model: string): Promise<void> {
    await this.kv.put(this.modelKey(chatId), model, {
      expirationTtl: this.ttlSeconds,
    });
  }

  async historyCount(chatId: number): Promise<number> {
    return (await this.getHistory(chatId)).length;
  }
}

export function createHistoryStore(env: Env): HistoryStore {
  const maxMessages = getIntEnv(
    env.MAX_HISTORY_MESSAGES,
    DEFAULT_MAX_HISTORY_MESSAGES,
  );
  if (env.HISTORY_KV) return new KvHistoryStore(env.HISTORY_KV, maxMessages);
  return new InMemoryHistoryStore(maxMessages);
}
