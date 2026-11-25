import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDeps, handleUpdate, resetBotState } from "../src/telegram/webhook";
import {
  makeEnv,
  makeMockFetch,
  telegramSendMessageTexts,
  FAKE_TELEGRAM_TOKEN,
  FAKE_WEBHOOK_SECRET,
  FAKE_XINGCHI_KEY,
} from "./helpers";

async function readAllFiles(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await readAllFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("không rò rỉ secrets vào source code", () => {
  it("không có file src nào chứa giá trị secret (kể cả giá trị giả trong test)", async () => {
    const root = join(process.cwd(), "src");
    const files = await readAllFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      expect(content).not.toContain(FAKE_TELEGRAM_TOKEN);
      expect(content).not.toContain(FAKE_WEBHOOK_SECRET);
      expect(content).not.toContain(FAKE_XINGCHI_KEY);
    }
  });

  it("wrangler.toml không chứa secrets dưới dạng giá trị", async () => {
    const content = await readFile(join(process.cwd(), "wrangler.toml"), "utf-8");
    for (const name of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "XINGCHI_API_KEY"]) {
      expect(content).not.toMatch(new RegExp(`^${name}\\s*=`, "m"));
    }
  });

  it(".env.example chỉ chứa giá trị mẫu (your-...)", async () => {
    const content = await readFile(join(process.cwd(), ".env.example"), "utf-8");
    for (const name of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "XINGCHI_API_KEY"]) {
      const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
      expect(line).toBeDefined();
      expect(line as string).toMatch(/^[^=]+=(your-|$)/);
    }
  });

  it("workflow deploy không in secrets ra log", async () => {
    const content = await readFile(
      join(process.cwd(), ".github/workflows/deploy.yml"),
      "utf-8",
    );
    expect(content).not.toContain("echo $TELEGRAM_BOT_TOKEN");
    expect(content).not.toContain("echo $XINGCHI_API_KEY");
    expect(content).toContain("wrangler secret put");
  });
});

describe("không rò rỉ secrets vào phản hồi Telegram", () => {
  let mock: ReturnType<typeof makeMockFetch>;

  beforeEach(() => {
    resetBotState();
    mock = makeMockFetch();
    vi.stubGlobal("fetch", mock.fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("các tin nhắn gửi cho user không chứa API key hay bot token", async () => {
    const deps = createDeps(makeEnv());
    await handleUpdate(deps, {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 111 },
        chat: { id: 111 },
        text: "xin chào",
      },
    });
    await handleUpdate(deps, {
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 111 },
        chat: { id: 111 },
        text: "/status",
      },
    });
    const texts = telegramSendMessageTexts(mock.calls);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).not.toContain(FAKE_XINGCHI_KEY);
      expect(text).not.toContain(FAKE_TELEGRAM_TOKEN);
      expect(text).not.toContain(FAKE_WEBHOOK_SECRET);
    }
  });

  it("ngay cả khi API lỗi, phản hồi cũng không chứa API key", async () => {
    resetBotState();
    mock = makeMockFetch({ chatStatus: 401 });
    vi.stubGlobal("fetch", mock.fetchMock);
    const deps = createDeps(makeEnv());
    await handleUpdate(deps, {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 111 },
        chat: { id: 111 },
        text: "xin chào",
      },
    });
    const texts = telegramSendMessageTexts(mock.calls);
    for (const text of texts) {
      expect(text).not.toContain(FAKE_XINGCHI_KEY);
    }
  });
});
