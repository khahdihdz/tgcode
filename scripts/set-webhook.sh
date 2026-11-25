#!/usr/bin/env bash
# Đăng ký Telegram webhook cho Worker đã deploy.
#
# Cách dùng (token chỉ lấy từ biến môi trường, KHÔNG ghi vào file):
#   TELEGRAM_BOT_TOKEN=... WORKER_URL=https://xingchi-telegram-bot.<subdomain>.workers.dev \
#     TELEGRAM_WEBHOOK_SECRET=... bash scripts/set-webhook.sh
#
# Script sẽ gọi setWebhook (kèm secret_token) rồi kiểm tra bằng getWebhookInfo.
# Sau bước này, hãy gửi thử một tin nhắn cho bot để kiểm tra thực tế.

set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?Thiếu biến môi trường TELEGRAM_BOT_TOKEN}"
: "${WORKER_URL:?Thiếu biến môi trường WORKER_URL (VD: https://xingchi-telegram-bot.<subdomain>.workers.dev)}"
: "${TELEGRAM_WEBHOOK_SECRET:?Thiếu biến môi trường TELEGRAM_WEBHOOK_SECRET}"

API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

echo "Dang ky webhook: ${WORKER_URL}"
curl -sS -X POST "${API}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode "drop_pending_updates=true"
echo

echo "Kiem tra webhook:"
curl -sS "${API}/getWebhookInfo"
echo
