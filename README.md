# Personal Site

Minimal Astro + Tailwind personal site scaffold, prepared for Docker deployment.

## Quick start

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose build
docker compose up -d
```

Site will be available at `http://localhost:4321`.

## Security defaults

- Container runs as non-root.
- Container filesystem is read-only (with `/tmp` mounted as tmpfs).
- Port bind is loopback-only (`127.0.0.1:4321`).
- App responses include baseline security headers via Astro middleware.

## Resume download

- Place your resume at `private/Rows_Carter_Resume.pdf`.
- Resume button links to `/api/resume`.
- `/api/resume` applies an in-memory rate limit (5 requests/minute per IP) and serves the PDF directly, so the file is not publicly addressable.
- `private/*.pdf` is gitignored to avoid accidentally committing private documents.

## Project structure

```text
.
├── Dockerfile
├── docker-compose.yml
├── astro.config.mjs
├── tailwind.config.cjs
├── postcss.config.cjs
├── public
│   ├── images
│   └── icons
├── private
│   └── Rows_Carter_Resume.pdf # add this file yourself
└── src
    ├── layouts
    │   └── BaseLayout.astro
    └── pages
        ├── api
        │   └── resume.ts
        └── index.astro
```
