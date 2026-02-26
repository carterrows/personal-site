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

## Resume download

- Place your resume at `public/Rows_Carter_Resume.pdf`.
- Resume button links to `/api/resume`.
- `/api/resume` applies an in-memory rate limit (5 requests/minute per IP) and then redirects to `Rows_Carter_Resume.pdf`.

## Project structure

```text
.
├── Dockerfile
├── docker-compose.yml
├── astro.config.mjs
├── tailwind.config.cjs
├── postcss.config.cjs
├── public
│   ├── Rows_Carter_Resume.pdf # add this file yourself
│   ├── images
│   └── icons
└── src
    ├── layouts
    │   └── BaseLayout.astro
    └── pages
        ├── api
        │   └── resume.ts
        └── index.astro
```
