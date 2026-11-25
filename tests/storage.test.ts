import { describe, it, expect } from "vitest";
import { InMemoryHistoryStore } from "../src/storage";

describe("InMemoryHistoryStore", () => {
  it("lưu và đọc lại lịch sử theo đúng thứ tự", async () => {
    const store = new InMemoryHistoryStore(10);
    await store.append(1, { role: "user", content: "chào" });
    await store.append(1, { role: "assistant", content: "xin chào" });
    const history = await store.getHistory(1);
    expect(history).toEqual([
      { role: "user", content: "chào" },
      { role: "assistant", content: "xin chào" },
    ]);
  });

  it("giới hạn số tin nhắn theo MAX_HISTORY_MESSAGES", async () => {
    const store = new InMemoryHistoryStore(4);
    for (let i = 0; i < 6; i++) {
      await store.append(1, { role: "user", content: `tin ${i}` });
    }
    const history = await store.getHistory(1);
    expect(history).toHaveLength(4);
    expect(history[0]?.content).toBe("tin 2");
    expect(history[3]?.content).toBe("tin 5");
  });

  it("lịch sử tách biệt theo từng chat", async () => {
    const store = new InMemoryHistoryStore(10);
    await store.append(1, { role: "user", content: "chat 1" });
    await store.append(2, { role: "user", content: "chat 2" });
    expect(await store.getHistory(1)).toHaveLength(1);
    expect(await store.getHistory(2)).toHaveLength(1);
    expect(await store.historyCount(1)).toBe(1);
  });

  it("/reset xóa lịch sử của chat", async () => {
    const store = new InMemoryHistoryStore(10);
    await store.append(1, { role: "user", content: "chào" });
    await store.clear(1);
    expect(await store.getHistory(1)).toEqual([]);
    expect(await store.historyCount(1)).toBe(0);
  });

  it("lưu và đọc model đã chọn theo từng chat", async () => {
    const store = new InMemoryHistoryStore(10);
    expect(await store.getModel(1)).toBeNull();
    await store.setModel(1, "model-x");
    expect(await store.getModel(1)).toBe("model-x");
    expect(await store.getModel(2)).toBeNull();
  });
});
