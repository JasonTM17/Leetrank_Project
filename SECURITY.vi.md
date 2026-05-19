# Chính sách Bảo mật

🌐 [English](SECURITY.md) · **Tiếng Việt**

## Phiên bản được hỗ trợ

LeetRank đang phát triển tích cực trên nhánh `main`. Các bản vá bảo mật nhắm
vào commit mới nhất trên `main`; các tag release sẽ được back-port từ `main`
khi vẫn còn trong thời hạn hỗ trợ. Các tag cũ không được vá.

## Báo cáo lỗ hổng

**Vui lòng KHÔNG mở GitHub issue công khai để báo lỗi bảo mật.** Thay vào đó,
gửi email tới **jasonbmt06@gmail.com** kèm:

- Mô tả vấn đề và mức độ tác động (auth bypass, RCE, lộ dữ liệu, DoS, v.v.).
- Các bước tái hiện hoặc PoC tối thiểu (ưu tiên dạng `curl` hoặc test ngắn).
- Phiên bản / commit hash bạn đã test.
- Tác động dự kiến và phạm vi ảnh hưởng (single user, tenant, toàn hệ thống).
- Các đề xuất khắc phục (không bắt buộc).

Vui lòng cho chúng tôi thời gian khắc phục một cách có trách nhiệm trước khi
công bố. Mục tiêu thời gian phản hồi:

- **Phản hồi đầu tiên**: 72 giờ.
- **Đánh giá triage**: 7 ngày.
- **Vá lỗi (high/critical)**: 30 ngày.

## Phạm vi

Các lỗ hổng trong phạm vi gồm:

- Xác thực / phân quyền (JWT, session, RBAC).
- Sandbox của bộ chấm bài (escape, persistence, cross-submission leak).
- Rate limiting / abuse vectors.
- SQL/NoSQL injection, XSS, CSRF.
- Lộ dữ liệu nhạy cảm (mật khẩu, token, source code của user khác).
- Server-side request forgery, deserialization.

Ngoài phạm vi:

- Best-practice headers thiếu (CSP, HSTS) — chấp nhận PR cải thiện thay vì
  báo lỗi bảo mật.
- Tấn công cần truy cập vật lý hoặc compromise tài khoản admin.
- Self-XSS, social engineering.
- Vấn đề chỉ xuất hiện trong setup non-default không support.

## An toàn ngầm

LeetRank vận hành theo các nguyên tắc:

- **Tham số hoá truy vấn** — Prisma client; không có raw SQL với dữ liệu user.
- **JWT trong cookie httpOnly + sameSite=lax** — KHÔNG dùng localStorage.
- **Rate limiting** trên auth, submit, API write paths.
- **Validation đầu vào** bằng Zod ở mọi route handler.
- **Sandbox bộ chấm** — Go judge với hard time limit và per-language blocklist.

## Ghi nhận

Người báo lỗi hợp lệ sẽ được ghi nhận trong CHANGELOG khi vá lỗi được công bố,
trừ khi bạn yêu cầu giấu tên.
