# Xingchi Telegram AI Bot

Telegram AI Bot chạy hoàn toàn trên **Cloudflare Workers** (gói miễn phí),
dùng **XingchiAPI** (OpenAI-compatible Chat Completions) để trò chuyện.
Không cần VPS, không cần backend riêng.

- 💬 Trò chuyện AI bằng tiếng Việt và đa ngôn ngữ, có nhớ ngữ cảnh.
- 🤖 Chọn model bằng lệnh `/model` — danh sách model lấy **trực tiếp từ
  `/v1/models`**, không hardcode.
- 🔐 Webhook xác thực bằng secret token, rate limit, chống spam và chống
  gửi trùng update.
- 🚀 Deploy tự động bằng GitHub Actions + Wrangler khi push lên `main`.

> ⚠️ **Không bao giờ gửi secrets (Telegram Bot Token, Xingchi API Key,
> webhook secret) vào cuộc trò chuyện với AI hay bất kỳ ai.** Chỉ nhập
> chúng vào Cloudflare Worker Secrets / GitHub Repository Secrets như
> hướng dẫn bên dưới.

---

## Trạng thái xác minh (trung thực)

Cập nhật ngày 2026-11-26. Những gì đã kiểm chứng được và những gì chưa:

| Hạng mục | Kết quả |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | ✅ Pass |
| `npm test` (Vitest, mock fetch, không tốn quota thật) | ✅ **82/82 tests pass** (9 file) |
| `npm run build` (`tsc`) | ✅ Pass |
| `npx wrangler deploy --dry-run` | ✅ Pass — bundle 31,13 KiB (gzip 8,29 KiB), không deploy thật |
| Grep secrets trong source | ✅ Không có token/key thật hay giá trị mẫu nào ngoài `tests/` |
| `GET https://api.xingchiapi.com/v1/models` **không key** | ✅ Đã xác minh: trả về HTTP **401** `{"code":"API_KEY_REQUIRED","message":"API key is required in Authorization header (Bearer ...), x-api-key header, or x-goog-api-key header"}` — endpoint tồn tại và yêu cầu Bearer auth |
| Liệt kê model thật / chat completions thật với key thật | ⏳ **Chưa xác minh** — cần `XINGCHI_API_KEY` thật của bạn (xem mục 3) |
| Tham số `temperature` / `stream` | ⏳ **Chưa xác minh** tương thích với mọi model XingchiAPI nên **không gửi** — bot chỉ gửi `model`, `messages`, `max_tokens` |
| Deploy thật, đăng ký webhook, bot trả lời tin nhắn thật | ⏳ **Chưa thực hiện** — cần bạn tạo repo GitHub, cấu hình secrets và cung cấp token/key thật |

---

## 1. Tạo Telegram Bot qua @BotFather

1. Mở Telegram, tìm **@BotFather**.
2. Gửi `/newbot`, đặt tên hiển thị và username cho bot (username phải kết thúc bằng `bot`, vd: `xingchi_ai_bot`).
3. BotFather trả về **Telegram Bot Token** — giữ kín, chỉ dùng ở mục 6 và 8.
4. (Tùy chọn) Gửi `/setcommands` cho @BotFather để hiện gợi ý lệnh:
   ```
   start - Bắt đầu và giới thiệu bot
   help - Hướng dẫn sử dụng
   chat - Bắt đầu cuộc trò chuyện
   model - Chọn model AI
   models - Xem danh sách model khả dụng
   reset - Xóa lịch sử trò chuyện
   new - Tạo cuộc trò chuyện mới
   status - Kiểm tra trạng thái bot và API
   id - Xem Telegram ID của bạn
   about - Thông tin về bot
   ```

## 2. Đăng ký tài khoản XingchiAPI và tạo API Key

1. Đăng ký tài khoản tại trang chủ XingchiAPI.
2. Tạo API Key trong trang quản lý API key.
3. Ghi lại key — **chỉ hiển thị một lần**, không chia sẻ cho ai.

## 3. Kiểm tra danh sách model

Chưa có key thì chỉ kiểm chứng được endpoint tồn tại (trả 401 như bảng trên).
Có key rồi thì kiểm tra bằng curl (key chỉ nằm trong terminal của bạn):

```bash
curl -s https://api.xingchiapi.com/v1/models \
  -H "Authorization: Bearer $XINGCHI_API_KEY"
```

Trả về JSON có `data: [{ "id": "<model-id>", ... }]`. Ghi lại một model ID
để đặt làm `DEFAULT_MODEL` (mục 7). **Không hardcode model vào code** —
bot luôn lấy danh sách này trực tiếp từ API mỗi khi bạn gọi `/models`
hoặc `/model`.

## 4. Tạo tài khoản Cloudflare

1. Đăng ký tại https://dash.cloudflare.com (gói Free là đủ).
2. Ghi lại **Account ID** (Workers & Pages → Overview, cột bên phải).
3. Tạo **API Token** có quyền tối thiểu: Account → Workers Scripts → Edit
   (và Account Settings → Read nếu cần). Chỉ dùng cho GitHub Actions.

## 5. Tạo GitHub repository

```bash
git init
git add .
git commit -m "feat: Xingchi Telegram AI Bot v1.0.0"
git branch -M main
git remote add origin git@github.com:<username>/<repo>.git
git push -u origin main
```

> Không commit file `.env` chứa dữ liệu thật. File `.gitignore` đã chặn
> `.env`, `.dev.vars`, `node_modules/`, `dist/`, `.wrangler/`.

## 6. Cấu hình GitHub Secrets

Vào repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Giá trị |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API Token Cloudflare (mục 4) |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |
| `TELEGRAM_BOT_TOKEN` | Token từ @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Chuỗi ngẫu nhiên dài do bạn tự đặt, vd: `openssl rand -hex 32` |
| `XINGCHI_API_KEY` | API key XingchiAPI (mục 2) |

Workflow `.github/workflows/deploy.yml` sẽ chạy `npm ci` → typecheck →
test → build, và **chỉ deploy khi tất cả đều pass**. Secrets được đưa vào
Worker bằng `wrangler secret put` (đọc từ stdin, không in ra log, không
ghi ra file). Nếu có thể, hãy ưu tiên GitHub OIDC thay cho API token dài
hạn; cấu hình hiện tại dùng token quyền tối thiểu làm phương án dự phòng.

## 7. Deploy bằng GitHub Actions

Push code lên nhánh `main` là workflow tự chạy. Hoặc deploy thủ công:

```bash
npm ci
npm run typecheck && npm test && npm run build
npx wrangler deploy
printf '%s' "$TELEGRAM_BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "$TELEGRAM_WEBHOOK_SECRET" | npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
printf '%s' "$XINGCHI_API_KEY" | npx wrangler secret put XINGCHI_API_KEY
npx wrangler deploy   # deploy lại để phiên bản đang chạy có đủ secrets
```

Sau khi deploy, Worker URL có dạng:

```
https://xingchi-telegram-bot.<subdomain>.workers.dev
```

## 8. Thiết lập Telegram Webhook

Không dùng long polling. Dùng script kèm theo (token chỉ đọc từ biến môi
trường, không ghi vào file):

```bash
TELEGRAM_BOT_TOKEN=... \
WORKER_URL=https://xingchi-telegram-bot.<subdomain>.workers.dev \
TELEGRAM_WEBHOOK_SECRET=... \
bash scripts/set-webhook.sh
```

Script gọi `setWebhook` kèm `secret_token`, rồi gọi `getWebhookInfo` để
kiểm tra. Kiểm tra thủ công:

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

`url` phải là Worker URL của bạn, `has_custom_certificate` là `false`,
và `last_error_message` trống.

## 9. Kiểm tra hoạt động

1. Mở Telegram, tìm bot, gửi `/start` — bot phải chào và hiện hướng dẫn.
2. Gửi `/models` — phải liệt kê đúng model ID do XingchiAPI trả về.
3. Gửi `/model` — chọn một model bằng Inline Keyboard.
4. Gửi một tin nhắn thường — bot hiện "đang nhập..." rồi trả lời bằng AI.
5. Gửi `/status` — kiểm tra API đang hoạt động và model đang dùng.
6. Gửi `/reset` rồi `/status` — lịch sử về 0 tin nhắn.

Nếu bot không trả lời: kiểm tra `getWebhookInfo` có `last_error_message`
không, kiểm tra secrets đã được đặt đủ chưa (`npx wrangler secret list`),
và xem log bằng `npx wrangler tail`.

## 10. Cách sử dụng bot

| Lệnh | Tác dụng |
|---|---|
| `/start` | Bắt đầu, giới thiệu bot |
| `/help` | Hướng dẫn đầy đủ |
| `/chat` | Bắt đầu cuộc trò chuyện |
| `/model` | Chọn model AI (Inline Keyboard, danh sách live từ API) |
| `/models` | Xem danh sách model khả dụng |
| `/reset` | Xóa lịch sử trò chuyện hiện tại |
| `/new` | Tạo cuộc trò chuyện mới |
| `/status` | Trạng thái bot + API (không lộ secrets) |
| `/id` | Xem Telegram ID của bạn |
| `/about` | Thông tin phiên bản |

Gửi tin nhắn văn bản bất kỳ để trò chuyện. Có thể reply một tin nhắn của
bot để tiếp tục mạch trò chuyện. Bot chỉ hỗ trợ tin nhắn văn bản; tin nhắn
quá 8.000 ký tự sẽ bị từ chối lịch sự. Mỗi người dùng bị giới hạn
`RATE_LIMIT_PER_MINUTE` tin nhắn/phút (mặc định 20).

## 11. Cấu hình

Các biến trong `wrangler.toml` (`[vars]`) — thay đổi rồi deploy lại:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DEFAULT_MODEL` | `""` | Model mặc định (ID do `/v1/models` trả về). Để trống = user bắt buộc chọn bằng `/model` |
| `MAX_OUTPUT_TOKENS` | `1024` | Số token tối đa cho mỗi câu trả lời |
| `MAX_HISTORY_MESSAGES` | `20` | Số tin nhắn giữ lại trong lịch sử mỗi chat |
| `RATE_LIMIT_PER_MINUTE` | `20` | Tin nhắn tối đa mỗi user trong 1 phút |
| `ALLOWED_USER_IDS` | `""` | VD: `"123456789,987654321"` — để trống = cho phép mọi người dùng |

Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `XINGCHI_API_KEY`)
**không** nằm trong `wrangler.toml`; đổi bằng `wrangler secret put` rồi
deploy lại.

### Thay đổi model mặc định

1. Lấy model ID thật bằng `/models` (hoặc curl ở mục 3).
2. Sửa `DEFAULT_MODEL = "<model-id>"` trong `wrangler.toml`.
3. Push lên `main` (Actions tự deploy) hoặc `npx wrangler deploy`.

### Lịch sử bền vững (tùy chọn)

Mặc định lịch sử chỉ lưu trong bộ nhớ của isolate (best-effort, có thể mất
khi Worker bị thu hồi). Để giữ lịch sử qua nhiều request:

```bash
npx wrangler kv namespace create HISTORY_KV
```

Bỏ comment khối `[[kv_namespaces]]` trong `wrangler.toml`, điền ID vừa tạo,
deploy lại. KV có TTL 7 ngày và giới hạn theo `MAX_HISTORY_MESSAGES`.

## 12. Cập nhật và rollback

- **Cập nhật:** sửa code → push lên `main` → Actions chạy test rồi deploy.
  Kiểm tra lại bằng `/status` và một tin nhắn thử.
- **Rollback:** vào Cloudflare Dashboard → Workers & Pages → bot →
  Deployments → chọn deployment cũ → **Rollback to this deployment**.
  Hoặc rollback bằng git: `git revert <commit>` rồi push lại.

## 13. Xoay vòng API Key khi bị lộ

1. **Thu hồi key cũ ngay** trong trang quản lý XingchiAPI.
2. Tạo key mới.
3. Cập nhật secret cho Worker:
   ```bash
   printf '%s' "<key-moi>" | npx wrangler secret put XINGCHI_API_KEY
   npx wrangler deploy
   ```
   Hoặc cập nhật GitHub Secret `XINGCHI_API_KEY` rồi push một commit
   trống để Actions chạy lại (`git commit --allow-empty -m "chore: rotate Xingchi key"`).
4. Kiểm tra lại bằng `/status` và một tin nhắn thử.
5. **Không bao giờ** commit key vào repo, không gửi key vào chat với bot
   hay bất kỳ ai.

Tương tự với Telegram Bot Token bị lộ: dùng `/revoke` với @BotFather để
lấy token mới, rồi cập nhật secret `TELEGRAM_BOT_TOKEN` và đăng ký lại
webhook (mục 8).

## 14. Cấu trúc dự án

```
xingchi-telegram-bot/
├── src/
│   ├── index.ts              # Worker fetch handler (POST only, xác thực webhook)
│   ├── env.ts                # Kiểu Env + đọc biến cấu hình
│   ├── storage.ts            # Lịch sử hội thoại (in-memory + KV tùy chọn)
│   ├── telegram/
│   │   ├── webhook.ts        # Phân tích & điều phối Telegram Update
│   │   ├── commands.ts       # /start /help /model /models /reset ...
│   │   ├── messages.ts       # Tin nhắn thường -> gọi AI -> trả lời
│   │   └── keyboards.ts      # Inline Keyboard chọn model
│   ├── ai/
│   │   ├── xingchi.ts        # Client XingchiAPI (/v1/models, /v1/chat/completions)
│   │   ├── models.ts         # Cache + kiểm tra model tồn tại
│   │   └── prompts.ts        # System prompt tiếng Việt
│   ├── security/
│   │   ├── auth.ts           # Xác thực webhook (so sánh hằng thời gian)
│   │   └── rate-limit.ts     # Rate limit + chống trùng update
│   └── utils/
│       ├── telegram.ts       # Gọi Telegram API, escape HTML, chia tin nhắn
│       └── errors.ts         # Thông điệp lỗi tiếng Việt
├── .github/workflows/deploy.yml
├── tests/                    # Vitest, mock fetch, không tốn quota thật
├── scripts/set-webhook.sh
├── .env.example
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

## 15. Phát triển local

```bash
npm install
npm run dev        # wrangler dev (cần .dev.vars cho secrets khi test local)
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build      # tsc
```

Test dùng **mock fetch hoàn toàn**, không gọi API thật, không tốn quota.
Muốn test local với Telegram thật, tạo `.dev.vars` (đã có trong
`.gitignore`) từ `.env.example` và dùng `wrangler dev` + ngrok/cloudflared
để nhận webhook — hoặc test bằng `wrangler tail` sau khi deploy.

## 16. Giới hạn đã biết

- **Workers Free Plan:** 100.000 request/ngày, CPU 10 ms/request (miễn phí).
  Gọi AI thường vượt CPU? Không — thời gian chờ fetch API không tính vào
  CPU time. Tin nhắn dài + lịch sử dài làm tăng chi phí token, không tăng
  CPU đáng kể.
- **Lịch sử trong bộ nhớ** chỉ là best-effort nếu không dùng KV (mục 11).
- **Rate limit / dedupe** lưu trong bộ nhớ isolate nên không phải giới hạn
  toàn cục tuyệt đối giữa các isolate.
- **Không hỗ trợ streaming** trong bản này (chưa xác minh tương thích với
  mọi model XingchiAPI và luồng sửa tin nhắn Telegram). Bot trả lời trọn
  vẹn một lần, chia nhỏ nếu dài hơn 4.096 ký tự.
- **Chỉ tin nhắn văn bản.** Chưa hỗ trợ ảnh/file (chỉ thêm khi đã xác minh
  model và API hỗ trợ).
