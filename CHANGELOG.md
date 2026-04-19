# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-04-18

### Added

- Initial release of saasmail — self-hosted email server on Cloudflare Workers.
- One unified timeline per customer, collapsing marketing, notifications, and support emails into a single per-person view.
- Multi-inbox support with per-inbox display names and team member permissions.
- Per-inbox display mode: render as **Thread** (traditional email threading) or **Chat** (bubble-style conversation).
- Inbound email via Cloudflare Email Workers.
- Outbound email via Cloudflare Email Sending (`EMAIL` binding) or Resend (`RESEND_API_KEY`).
- Admin UI to create and configure inboxes.
- Authentication via better-auth, including passkey support.
- Drizzle ORM schema and migrations backed by Cloudflare D1.
- Hono + Zod OpenAPI backend with Swagger UI.
- React + Tailwind frontend with TipTap rich-text composer and CodeMirror HTML editor.
- Person detail view with `ChatInboxSection` (bubble layout, pagination, plain-text quick reply) and `ThreadInboxSection`.
- Stats endpoint with per-inbox and per-person aggregates.
- Demo deploy mode (`deploy:demo`) for DB-only demo instances.
- Project scaffolding: Vite build, Vitest tests, Prettier, Husky + lint-staged, TypeScript strict mode.

[Unreleased]: https://github.com/choyiny/cmail/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/choyiny/cmail/releases/tag/v0.0.1
