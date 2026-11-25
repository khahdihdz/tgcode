/**
 * Lỗi và thông điệp thân thiện với người dùng.
 * Không bao giờ đưa chi tiết kỹ thuật hay secrets vào thông điệp gửi cho user.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export const VI_ERRORS = {
  apiKeyInvalid:
    "API key của AI đã hết hạn hoặc không hợp lệ. Vui lòng báo quản trị viên kiểm tra lại.",
  quotaExceeded:
    "AI đang quá tải hoặc đã hết quota. Vui lòng thử lại sau ít phút.",
  modelNotFound:
    "Model đã chọn không còn khả dụng. Hãy dùng /model để chọn model khác.",
  timeout: "AI phản hồi quá chậm. Vui lòng thử lại.",
  serverError: "Máy chủ AI tạm thời gặp sự cố. Vui lòng thử lại sau.",
  networkError: "Không thể kết nối tới máy chủ AI. Vui lòng thử lại sau.",
  unknown: "Đã xảy ra lỗi khi xử lý tin nhắn. Vui lòng thử lại sau.",
} as const;
