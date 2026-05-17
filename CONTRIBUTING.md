# Contributing to LeetRank

Thanks for your interest in contributing. Here's how to get started.

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in the required values.
4. Push the database schema: `npm run db:push`
5. Seed the database: `npm run db:seed`
6. Start the dev server: `npm run dev`

## Development Workflow

- Create a feature branch from `main`: `git checkout -b feat/your-feature`
- Make your changes, keeping commits focused and descriptive.
- Run `npm run typecheck` and `npm run lint` before pushing.
- Open a pull request against `main` with a clear description of what changed and why.

## Code Style

- TypeScript is required for all new code.
- Follow the existing file and folder conventions in `src/`.
- Use the existing component patterns — don't introduce new UI libraries.
- Keep components small and focused; co-locate related logic.

## Reporting Issues

Open a GitHub issue with a clear title, steps to reproduce, and the expected vs. actual behavior. Include relevant error messages or screenshots where helpful.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR.
- Update or add tests if the change affects behavior.
- Ensure CI passes before requesting review.
