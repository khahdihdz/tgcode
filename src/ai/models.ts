/**
 * Cache danh sách model lấy từ /v1/models + kiểm tra model có tồn tại.
 * Danh sách model KHÔNG BAO GIỜ được hardcode — luôn lấy từ API.
 */
import type { XingchiClient, XingchiModel } from "./xingchi";
import { MODEL_CACHE_TTL_MS } from "../env";

export class ModelCache {
  private cached: XingchiModel[] | null = null;
  private fetchedAt = 0;

  constructor(
    private readonly client: XingchiClient,
    private readonly ttlMs: number = MODEL_CACHE_TTL_MS,
  ) {}

  async getModels(forceRefresh = false): Promise<XingchiModel[]> {
    const now = Date.now();
    if (!forceRefresh && this.cached && now - this.fetchedAt < this.ttlMs) {
      return this.cached;
    }
    const models = await this.client.listModels();
    this.cached = models;
    this.fetchedAt = now;
    return models;
  }

  async findModel(modelId: string): Promise<XingchiModel | null> {
    const models = await this.getModels();
    return models.find((m) => m.id === modelId) ?? null;
  }

  /** Model người dùng chọn chỉ hợp lệ khi có trong danh sách API trả về. */
  async isValidModel(modelId: string): Promise<boolean> {
    return (await this.findModel(modelId)) !== null;
  }

  clear(): void {
    this.cached = null;
    this.fetchedAt = 0;
  }
}
