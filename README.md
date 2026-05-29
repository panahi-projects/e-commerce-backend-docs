# E-Commerce Backend — Documentation

VitePress documentation site for the multi-tenant white-label e-commerce backend!
This is a standalone project, separated from the backend repository. The AI context
docs (`docs/ai/`) intentionally remain in the backend repo.

## Audiences

| Section     | Path           | Purpose                               |
| ----------- | -------------- | ------------------------------------- |
| User Guide  | `/guide/`      | How to use the platform as a customer |
| Admin Guide | `/admin/`      | How to manage the platform            |
| Developer   | `/developer/`  | How to build and extend the platform  |
| Frontend    | `/frontend/`   | How to connect a frontend to the API  |
| Deployment  | `/deployment/` | Per-platform deploy guides            |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/e-commerce-backend-docs/
```

## Build

```bash
npm run build      # output in .vitepress/dist/
npm run preview    # preview the production build
```

## Deployment

Auto-deployed to GitHub Pages on every push to `main` via
`.github/workflows/deploy.yml`.

The VitePress `base` is set to `/e-commerce-backend-docs/` in
`.vitepress/config.mts` — this must match the GitHub repository name so asset
URLs resolve correctly at `https://<owner>.github.io/e-commerce-backend-docs/`.
If you rename the repo or attach a custom domain, update `base` accordingly
(`/` for a custom domain or user/organization site).

> **One-time GitHub setup:** in the repo's **Settings → Pages**, set
> **Source** to **GitHub Actions**.
