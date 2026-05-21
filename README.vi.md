<div align="center">

# LeetRank

**Nền tảng luyện thi lập trình tự host được, chuẩn thương mại.**
Giải bài, chấm bài, xếp hạng — trên 30+ ngôn ngữ, với BXH thời gian thực và cuộc thi.

🌐 [English](README.md) · **Tiếng Việt**

[![CI](https://github.com/JasonTM17/Leetrank_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/JasonTM17/Leetrank_Project/actions/workflows/ci.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/nguyenson1710/leetrank-app?logo=docker&label=pulls)](https://hub.docker.com/r/nguyenson1710/leetrank-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Chạy local](#chạy-local) · [Kiến trúc](#kiến-trúc) · [API](#api) · [ADR](docs/adr/) · [Đóng góp](CONTRIBUTING.vi.md)

</div>

---

## Vì sao có dự án này

LeetRank là nền tảng luyện thuật toán mã nguồn mở, được thiết kế để chạy thật ở môi trường production: chấm bài trong sandbox, BXH cập nhật theo thời gian thực, cuộc thi có rating, và hơn 30 ngôn ngữ chia sẻ chung một runner contract. Mục tiêu là cho dân tự học và team nhỏ một nền tảng nội bộ chất lượng cao mà không cần dựng lại từ đầu.

## Tính năng

- **30+ bài tập** với test ẩn, độ khó từ Easy đến Hard, kèm editorial.
- **Bộ chấm Go** chạy trong sandbox nsjail, hard time limit, blocklist theo từng ngôn ngữ.
- **34 ngôn ngữ** support đầy đủ — Python, Go, Rust, Java, C/C++, Kotlin, JavaScript/TypeScript, Ruby, Swift, PHP, C#, Scala, Bash và nhiều ngôn ngữ khác.
- **Cuộc thi** có rating, chấm điểm nguyên tử, BXH live.
- **BXH dedup-aware**: chỉ đếm bài unique đã solve, không bị lạm dụng spam submit.
- **Bookmark, thảo luận, editorial** cho từng bài.
- **Auth** JWT cookie httpOnly + JWKS cutover (xem `docs/adr/0030-web-tier-jwt-cutover.md`).
- **Quan trắc** với Prometheus + Grafana, log có trace_id, alert qua webhook.
- **Đa ngôn ngữ UI** với `next-intl` (English + Tiếng Việt).

## Kiến trúc

LeetRank tách backend / frontend / judge thành các service độc lập, mỗi service có Dockerfile riêng.

| Service                  | Vai trò                                                         | Stack                            |
| ------------------------ | --------------------------------------------------------------- | -------------------------------- |
| `app`                    | Next.js 16 App Router, UI + API routes nhẹ                      | TypeScript, React 19, Tailwind 4 |
| `apps/api`               | Read-only REST API (Hono)                                       | TypeScript, Hono, Prisma         |
| `auth-go`                | Identity + JWT issuer (image `nguyenson1710/leetrank-identity`) | Go, jose/JWKS, Postgres          |
| `problems-go`            | Problems read API                                               | Go, pgx, chi                     |
| `submissions-go`         | Submissions write/read                                          | Go, pgx, chi                     |
| `realtime-go`            | WebSocket fan-out cho live submissions                          | Go, gorilla/websocket            |
| `leaderboard-rust`       | Cache leaderboard + Redis sorted set                            | Rust, axum, redis                |
| `analytics-python`       | FastAPI analytics ingest                                        | Python 3.12, FastAPI             |
| `notifications-ruby`     | Sinatra notifications fan-out                                   | Ruby 3.3, Sinatra                |
| `judge`                  | Bộ chấm bài sandbox                                             | Go, runner contract, nsjail      |
| `db`                     | Postgres 16                                                     | Prisma migrations                |
| `redis`                  | Cache + queue + rate limit                                      | ioredis client                   |
| `caddy`                  | Reverse proxy + TLS                                             | Caddyfile                        |
| `prometheus` + `grafana` | Quan trắc                                                       | dashboards trong `infra/`        |

Mọi cross-service traffic đi qua Caddy. Submission đi vào `app` → enqueue Redis → `judge` consume → ghi kết quả về DB → invalidate cache → push event tới client qua polling.

## Chạy local

Cần Docker Desktop 4.30+ hoặc Docker Engine 24+, Compose v2.

```bash
git clone https://github.com/JasonTM17/Leetrank_Project.git
cd Leetrank_Project
cp .env.example .env

# Boot toàn bộ stack
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# Theo dõi log của web service
docker compose logs -f app
```

Stack mở các port:

- `http://localhost:3000` — web app
- `http://localhost:4000` — read API (`apps/api`)
- `http://localhost:4011` — identity (`services/auth-go`)
- `http://localhost:4012` — submissions (`services/submissions-go`)
- `http://localhost:4013` — problems (`services/problems-go`)
- `http://localhost:4014` — leaderboard (`services/leaderboard-rust`)
- `http://localhost:4015` — notifications (`services/notifications-ruby`)
- `http://localhost:4016` — analytics (`services/analytics-python`)
- `http://localhost:4017` — realtime (`services/realtime-go`)
- `http://localhost:9090` — judge service
- `postgresql://localhost:5432` — Postgres
- `redis://localhost:6379` — Redis
- `http://localhost:3001` — Grafana (overlay observability, admin/admin)

Lần đầu chạy seed:

```bash
docker compose exec app pnpm db:push
docker compose exec app pnpm db:seed
```

### Không dùng Docker

Cần Node.js 20.x, pnpm 10+, Postgres 16 và Redis 7 chạy local.

```bash
pnpm install
cp .env.example .env   # chỉnh DATABASE_URL, REDIS_URL
pnpm db:push
pnpm db:seed
pnpm dev
```

## API

OpenAPI specs nằm ở `apps/api/openapi.yaml`, `services/auth-go/openapi.yaml`, `docs/openapi.yaml`. Lint:

```bash
pnpm openapi:lint
```

Auth contract: cookie `token` JWT, verified bằng JWKS từ `auth-go` ở `/.well-known/jwks.json`. Legacy HS256 fallback bật trong dev và khi `LEGACY_HS256_FALLBACK=true`, sẽ tắt sau cutover (xem ADR 0030).

## Đa ngôn ngữ

UI hỗ trợ tiếng Anh và tiếng Việt qua `next-intl` (Phase 1, cookie-based — chưa có route `/[locale]`). Người dùng đổi ngôn ngữ qua dropdown trong navbar; lựa chọn lưu trong cookie `NEXT_LOCALE` (TTL 1 năm).

- File dịch: `messages/en.json`, `messages/vi.json`.
- Cấu hình: `src/i18n/request.ts` (auto-detect từ `Accept-Language` nếu không có cookie).
- Server action: `src/i18n/actions.ts`.

Doc canonical (README, CONTRIBUTING, SECURITY) có cả bản English và Tiếng Việt. ADR và OpenAPI giữ tiếng Anh để đồng bộ với cộng đồng kỹ thuật quốc tế.

## Đóng góp

Đọc [CONTRIBUTING.vi.md](CONTRIBUTING.vi.md). Tóm tắt:

- Theo Conventional Commits.
- Một feature một PR.
- Chạy `pnpm typecheck && pnpm test && pnpm build` trước khi push.
- Thêm test cho code mới (vitest hoặc playwright).

## Bảo mật

Báo lỗ hổng riêng tư qua email `jasonbmt06@gmail.com`. Xem [SECURITY.vi.md](SECURITY.vi.md).

## License

MIT. Xem [LICENSE](LICENSE).
