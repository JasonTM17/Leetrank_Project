# Đóng góp cho LeetRank

🌐 [English](CONTRIBUTING.md) · **Tiếng Việt**

Cảm ơn bạn quan tâm. Hướng dẫn này tóm tắt quy trình làm việc hàng ngày — đặt
tên nhánh, format commit, cài dev, PR và review.

Chúng tôi theo [Conventional Commits](https://www.conventionalcommits.org/) và
một-feature-một-PR. Đọc qua một lần trước PR đầu tiên để tiết kiệm vòng review.

## Quy tắc ứng xử

Mọi tham gia tuân theo [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Báo cáo hành
vi không phù hợp qua **jasonbmt06@gmail.com**.

## Cài dev

### Với Docker (khuyến nghị)

Cần Docker Desktop 4.30+ hoặc Docker Engine 24+, Compose v2.

```bash
git clone https://github.com/JasonTM17/Leetrank_Project.git
cd Leetrank_Project
cp .env.example .env

# Boot toàn bộ stack
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# Theo dõi web service
docker compose logs -f app
```

Stack mở các port:

- http://localhost:3000 — Web (Next.js)
- http://localhost:4000 — Read API
- http://localhost:4011 — Auth (Go)
- http://localhost:4012 — Submissions (Go)
- http://localhost:4013 — Problems (Go)
- http://localhost:9090 — Judge service

### Native

Cần Node 20, pnpm 10+, Go 1.22, PostgreSQL 16, Redis 7.

```bash
pnpm install
cp .env.example .env

pnpm db:push     # apply Prisma schema
pnpm db:seed     # seed bài tập, tag, tài khoản demo
pnpm dev         # http://localhost:3000
```

Tài khoản demo: `admin@leetrank.local` / `Admin123!` và
`demo@leetrank.local` / `Demo123!`.

## Mô hình nhánh

- `main` luôn ở trạng thái có thể ship được. CI phải xanh mới merge.
- Tạo nhánh từ `main` cho mọi thay đổi.
- Tên nhánh: `<type>/<tom-tat-kebab>`, `<type>` giống commit type bên dưới.

Ví dụ:

```
feat/contest-leaderboard-redis
fix/auth-cookie-samesite-strict
docs/judge-runbook
chore/bump-prisma-5.22
```

Migration dài hạn (ví dụ Phase 3 backend split) chạy trên nhánh tracked riêng,
feature branch merge vào nhánh đó trước khi merge vào main.

## Commit message

Theo [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

`<type>` bắt buộc một trong:

| Type       | Dùng cho                            |
| ---------- | ----------------------------------- |
| `feat`     | Hành vi mới user thấy được          |
| `fix`      | Sửa bug                             |
| `docs`     | Chỉ tài liệu                        |
| `style`    | Format; không đổi hành vi           |
| `refactor` | Không phải feature/fix              |
| `perf`     | Cải thiện hiệu năng                 |
| `test`     | Thêm/sửa test                       |
| `build`    | Build system, tooling, dependencies |
| `ci`       | Cấu hình CI                         |
| `chore`    | Công việc phụ trợ                   |

`<scope>` là khu vực chạm tới: `api`, `auth`, `auth-go`, `web`, `judge`,
`submissions-go`, `problems-go`, `prisma`, `ci`, `docs`, v.v.

Ví dụ:

```
feat(auth-go): real register/login/me/logout/change-password
fix(ci): npm install (no lockfile) + judge GOFLAGS=-mod=mod
docs(adr): add 0021 rating algorithm (Glicko-2)
```

Quy tắc subject:

- Mệnh lệnh (`add` không phải `added`).
- Không có dấu chấm cuối câu.
- 72 ký tự trở xuống.

Body giải thích **vì sao**, không phải **làm gì** — diff đã tự nói rồi.

### Ghi danh commit

Repo hiện single-contributor. Commit ký bởi
`Nguyen Tien Son <jasonbmt06@gmail.com>`. **KHÔNG** thêm trailer
`Co-Authored-By: Claude` (hoặc bất kỳ AI tooling nào). Nếu bạn đóng góp qua
PR, authorship của bạn được Git capture bình thường.

## Code style

### TypeScript / JavaScript

- TypeScript strict mode, không implicit `any`.
- Ưu tiên named export; default export chỉ khi framework yêu cầu.
- ESLint + Prettier config có sẵn trong repo. Đừng override local.
- Theo thứ tự import: stdlib → third-party → workspace → local.

### Go

- `gofmt` / `goimports` bắt buộc; CI reject code chưa format.
- stdlib trước third-party. Group import.
- Dùng `slog` log; không `fmt.Println` trong service code.
- Error là value: `if err != nil { return fmt.Errorf("operation: %w", err) }`.

### SQL

- Migration forward-only. Không sửa migration đã merge.
- Schema TS qua Prisma (`prisma/schema.prisma`); Go service tự quản
  migration của nó ở `services/<svc>/internal/migrations/`.

## Test

| Layer                | Lệnh                                   |
| -------------------- | -------------------------------------- |
| Web unit + component | `pnpm test`                            |
| Web e2e (Playwright) | `pnpm test:e2e`                        |
| API workspace        | `pnpm --filter apps/api test`          |
| Auth (Go)            | `cd services/auth-go && go test ./...` |
| Go services          | `cd services/<svc> && go test ./...`   |
| Judge                | `cd judge-service && go test ./...`    |

Thêm test cho mỗi thay đổi hành vi. Nếu khu vực bạn làm chưa có framework
test, dựng nó lên — không ship code không có coverage.

## OpenAPI specs

Contract giữa các service nằm ở:

- `apps/api/openapi.yaml`
- `services/auth-go/openapi.yaml`
- `docs/openapi.yaml` (legacy combined)

Lint với `pnpm openapi:lint` (Redocly). Spec phải lint sạch trước khi merge PR.

## Pull request

1. Tạo nhánh từ `main`. Một feature/fix một PR.
2. Chạy local: `pnpm typecheck && pnpm lint && pnpm test` (TS) và
   `go test ./... && go vet ./...` (Go).
3. Push và mở PR vào `main`. Dùng template; điền đầy đủ.
4. CI chạy `web`, `api`, `judge`, `audit`, `docker`. Tất cả phải xanh.
5. Phản hồi review bằng commit mới — chúng tôi squash khi merge nên không
   cần lo commit hygiene trong lúc review.

PR title theo cùng format Conventional Commits như commit; merge commit
sẽ dùng nguyên văn.

### Mô hình review (solo maintainer)

LeetRank hiện là dự án một maintainer nên `CODEOWNERS` route mọi PR về
`@JasonTM17`. Self-review là cố ý: maintainer mở PR, để toàn bộ status
check chạy (`web`, `api`, `judge`, `go-tests`, `audit`, `e2e`, `codeql`,
`trivy-fs`), review diff trên GitHub UI, và chỉ merge khi CI xanh và
codecov gate pass. Xem `docs/release.md` cho danh sách required check
và branch protection.

Nếu bạn là contributor ngoài, PR sẽ tự động assign cho `@JasonTM17`;
không cần lo chọn reviewer.

### PR description template

```
## Summary
Có gì thay đổi và tại sao. Một đoạn văn.

## How I tested
Lệnh và bước reviewer có thể chạy lại.

## Screenshots / GIFs
Cho thay đổi UI.

## Related
ADR, issue, PR liên quan.
```

## Báo bug

Mở GitHub issue với:

- Title rõ (`fix(judge): SIGSEGV on Rust submissions over 100KB`).
- Bước tái hiện.
- Hành vi kỳ vọng vs thực tế.
- Commit SHA bạn đã test.
- Log (sanitised — không paste secret).

Lỗ hổng bảo mật dùng kênh riêng tư trong [SECURITY.vi.md](SECURITY.vi.md),
không phải GitHub issue.

## Làm việc với ADR

Thay đổi cấp kiến trúc cần Architecture Decision Record trước khi code.
Copy `docs/adr/template.md`, tăng số, điền Context / Decision /
Consequences / Alternatives. ADR giữ nguyên tiếng Anh để đồng bộ với
cộng đồng kỹ thuật quốc tế. Mở PR ADR trước PR implementation —
reviewer có thể disagree với design trước khi code.

## License

Khi đóng góp, bạn đồng ý tác phẩm của bạn được cấp phép theo
[MIT License](LICENSE).
