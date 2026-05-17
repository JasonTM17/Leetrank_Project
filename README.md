<div align="center">

<h1>LeetRank</h1>

<p><strong>A competitive programming platform for practicing algorithms and data structures</strong></p>

<p>
  <img src="https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/Go-1.21-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

<p>
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#api-reference">API Reference</a>
</p>

</div>

---

<details>
<summary><strong>Table of Contents</strong></summary>

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Docker](#docker)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Judge Service](#judge-service)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

</details>

---

## About

LeetRank is a full-stack competitive programming platform inspired by LeetCode and HackerRank. It provides a complete environment for practicing coding problems, participating in contests, and tracking progress on a leaderboard.

The platform features a production-grade code judge service written in Go that supports Python, JavaScript, and Ruby with sandboxed execution, time/memory limits, and security blocklists.

### Why LeetRank?

- 30+ algorithm problems across Easy, Medium, and Hard difficulties
- Real-time code execution with Monaco Editor (VS Code's editor)
- Contest system with live rankings
- Multi-language judge service (Go backend, Python/JS/Ruby runners)
- Full admin dashboard for problem and contest management

---

## Features

| Feature | Description |
|---------|-------------|
| Problem Library | 30+ problems with descriptions, examples, constraints, hints, and starter code |
| Code Editor | Monaco Editor with syntax highlighting, autocomplete, and multi-language support |
| Judge Service | Go-based sandboxed execution with Python, JavaScript, and Ruby runners |
| Contests | Timed competitions with live leaderboard and problem sets |
| User Dashboard | Personal stats, submission history, and progress tracking |
| Leaderboard | Global rankings by problems solved and contest performance |
| Admin Panel | CRUD for problems, users, contests, and test cases |
| Authentication | JWT-based auth with httpOnly cookies, bcrypt password hashing |
| Dark Mode | Full dark/light theme support |
| Responsive | Mobile-first design with Tailwind CSS |

---

## Tech Stack

<div align="center">

| Layer | Technology |
|-------|------------|
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js_16-000?style=flat-square&logo=next.js) ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) |
| **Editor** | ![Monaco](https://img.shields.io/badge/Monaco_Editor-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white) |
| **Backend** | ![Next.js API](https://img.shields.io/badge/Next.js_API_Routes-000?style=flat-square&logo=next.js) ![Prisma](https://img.shields.io/badge/Prisma_5-2D3748?style=flat-square&logo=prisma) |
| **Judge** | ![Go](https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white) ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) ![Ruby](https://img.shields.io/badge/Ruby-CC342D?style=flat-square&logo=ruby&logoColor=white) |
| **Database** | ![SQLite](https://img.shields.io/badge/SQLite_(dev)-003B57?style=flat-square&logo=sqlite) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL_(prod)-4169E1?style=flat-square&logo=postgresql&logoColor=white) |
| **State** | ![Zustand](https://img.shields.io/badge/Zustand-443E38?style=flat-square) |
| **Auth** | ![JWT](https://img.shields.io/badge/JWT_(jose)-000?style=flat-square&logo=jsonwebtokens) ![bcrypt](https://img.shields.io/badge/bcrypt-339933?style=flat-square) |
| **DevOps** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white) |

</div>

---

## Architecture

```
LeetRank_Project/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # 14+ API routes
│   │   ├── problems/           # Problem list & detail pages
│   │   ├── contests/           # Contest system
│   │   ├── dashboard/          # User dashboard
│   │   ├── leaderboard/        # Global rankings
│   │   ├── admin/              # Admin panel
│   │   ├── login/              # Authentication
│   │   └── register/
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives
│   │   └── layout/             # Navbar, Footer
│   ├── hooks/                  # Custom hooks (useAuth)
│   ├── lib/                    # Utilities (db, auth, utils)
│   ├── services/               # Business logic (judge)
│   └── types/                  # TypeScript interfaces
├── judge-service/              # Go judge with language runners
│   ├── main.go                 # HTTP server, rate limiting, CORS
│   ├── runners/
│   │   ├── python_runner.py
│   │   ├── js_runner.js
│   │   └── ruby_runner.rb
│   └── Dockerfile
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Base seed (10 problems)
│   └── seed-extra.ts           # Extended seed (20 problems)
├── docs/screenshots/           # Project screenshots & GIFs
├── docker-compose.yml          # Multi-service orchestration
├── Dockerfile                  # Next.js production build
├── .github/workflows/ci.yml    # CI pipeline
└── RULES.md                    # Project best practices
```

<details>
<summary><strong>System Architecture Diagram</strong></summary>

```
┌──────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Browser    │────────▶│   Next.js App    │────────▶│  SQLite/    │
│  (React 19)  │◀────────│  (API + SSR)     │◀────────│  PostgreSQL │
└──────────────┘         └────────┬─────────┘         └─────────────┘
                                  │
                          ┌───────▼────────┐
                          │  Judge Service │
                          │   (Go 1.21)    │
                          ├────────────────┤
                          │ ┌────┐ ┌────┐  │
                          │ │ Py │ │ JS │  │
                          │ └────┘ └────┘  │
                          │ ┌────┐         │
                          │ │Ruby│         │
                          │ └────┘         │
                          └────────────────┘
```

</details>

---

## Screenshots

> Screenshots will be added after UI testing. Run `npm run dev` and capture with browser DevTools.

| Page | Description |
|------|-------------|
| `docs/screenshots/landing-page.png` | Hero section with stats, features, and CTA |
| `docs/screenshots/problems-list.png` | Problem list with search, filter by difficulty/tag |
| `docs/screenshots/code-editor.png` | Monaco editor with problem description and test runner |
| `docs/screenshots/dashboard.png` | User stats, progress chart, recent submissions |
| `docs/screenshots/leaderboard.png` | Global rankings table |
| `docs/screenshots/contests.png` | Active and upcoming contests |
| `docs/screenshots/admin-panel.png` | Admin CRUD interface |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Go** >= 1.21 (for judge service)
- **Docker** & Docker Compose (optional, for containerized setup)

```bash
node --version   # v18+
go version       # go1.21+
docker --version # 24+ (optional)
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/JasonTM17/Leetrank_Project.git
cd Leetrank_Project

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env

# 4. Initialize database
npx prisma migrate dev
npm run db:seed
npm run seed:extra

# 5. Start development server
npm run dev
# App available at http://localhost:3000
```

### Docker

```bash
# Start all services (app + judge)
docker-compose up --build

# App: http://localhost:3000
# Judge: http://localhost:8080
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|--------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` |
| `JWT_SECRET` | Secret for JWT token signing | (required) |
| `JUDGE_SERVICE_URL` | Judge service endpoint | `http://localhost:8080` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |

---

## Usage

### Default Accounts (after seeding)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `john_doe` | `password123` | User |
| `jane_smith` | `password123` | User |

### Running Code

1. Navigate to any problem
2. Write your solution in the Monaco editor
3. Click "Run Code" to test against visible test cases
4. Click "Submit" to run against all test cases (including hidden)

---

## API Reference

<details>
<summary><strong>Authentication</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/auth/me` | Get current user |

</details>

<details>
<summary><strong>Problems</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/problems` | List problems (paginated, filterable) |
| GET | `/api/problems/[slug]` | Get problem by slug |
| GET | `/api/tags` | List all tags |

</details>

<details>
<summary><strong>Code Execution</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/run-code` | Run code against visible test cases |
| POST | `/api/submissions` | Submit solution (all test cases) |
| GET | `/api/submissions` | Get user's submissions |

</details>

<details>
<summary><strong>Contests & Leaderboard</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contests` | List contests |
| GET | `/api/contests/[slug]` | Get contest details |
| GET | `/api/leaderboard` | Global rankings |

</details>

<details>
<summary><strong>Admin</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| POST | `/api/admin/problems` | Create problem |
| PUT | `/api/admin/problems/[id]` | Update problem |
| DELETE | `/api/admin/problems/[id]` | Delete problem |

</details>

---

## Judge Service

The judge service is a standalone Go application that executes user-submitted code in a sandboxed environment.

### Security Features

- Per-language blocklists (dangerous imports: `os`, `subprocess`, `exec`, `eval`, etc.)
- Hard time limits (10s default)
- Memory limits
- No network access during execution
- Separate process per submission
- Temp file cleanup after execution

### Supported Languages

| Language | Runner | Version |
|----------|--------|--------|
| Python | `runners/python_runner.py` | 3.x |
| JavaScript | `runners/js_runner.js` | Node.js |
| Ruby | `runners/ruby_runner.rb` | 3.x |

### Judge API

```bash
POST http://localhost:8080/execute
Content-Type: application/json

{
  "language": "python",
  "code": "print(sum([1,2,3]))",
  "testCases": [
    { "input": "", "expected": "6" }
  ]
}
```

Response:
```json
{
  "results": [
    {
      "status": "accepted",
      "stdout": "6\n",
      "stderr": "",
      "exitCode": 0,
      "timeMs": 45,
      "memoryKb": 32000
    }
  ]
}
```

---

## Testing

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build verification
npm run build

# Database reset + reseed
npm run db:reset
```

---

## Deployment

<details>
<summary><strong>Docker Compose (Recommended)</strong></summary>

```bash
# Production build
docker-compose -f docker-compose.yml up --build -d

# Services:
# - app (Next.js): port 3000
# - judge (Go): port 8080
```

</details>

<details>
<summary><strong>Manual Deployment</strong></summary>

```bash
# Build Next.js
npm run build

# Build Judge Service
cd judge-service && go build -o judge-service . && cd ..

# Start both
npm start &
./judge-service/judge-service &
```

</details>

---

## Roadmap

- [x] User authentication (register, login, JWT)
- [x] Problem library with 30+ problems
- [x] Monaco code editor with multi-language support
- [x] Code execution and submission system
- [x] Contest system with live rankings
- [x] User dashboard and progress tracking
- [x] Global leaderboard
- [x] Admin panel (CRUD problems, users, contests)
- [x] Go judge service with Python/JS/Ruby runners
- [x] Docker containerization
- [x] CI/CD pipeline
- [ ] WebSocket real-time contest updates
- [ ] Discussion forum per problem
- [ ] User profiles with badges
- [ ] Solution explanations and editorials
- [ ] C++ and Java language support

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">

**Built by [Nguyễn Sơn](https://github.com/JasonTM17)**

> Đây là dự án học tập của **Nguyễn Sơn** (jasonbmt06@gmail.com).
> Mọi ý kiến đóng góp và phản hồi xin gửi qua email hoặc [GitHub Issues](https://github.com/JasonTM17/Leetrank_Project/issues).

</div>
