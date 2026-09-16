# AI2Dot marketing website

This directory is a standalone Next.js application for `www.ai2note.com`. It does not import from or modify the product application in the repository root.

## Local development

```bash
cd website
npm install
npm run dev
```

The product CTA target is defined once in `lib/site.ts` and points to `https://ai.ai2dot.com/`.

## Contact form

Copy `.env.example` to `.env.local` and configure:

- `RESEND_API_KEY`: Resend API key
- `CONTACT_TO_EMAIL`: inbox that receives enterprise leads
- `CONTACT_FROM_EMAIL`: verified sender, for example `AI2Dot <business@updates.example.com>`

Without these variables, the form returns a clear configuration error and does not claim that a message was sent.

## Vercel deployment

Create a separate Vercel project from this repository and set **Root Directory** to `website`. Keep the existing AI2Dot application project pointed at the repository root.

1. Import the same Git repository as a new Vercel project.
2. Set Root Directory to `website`.
3. Keep Framework Preset as Next.js. Build and output settings can stay automatic.
4. Add the three contact-form environment variables for Production and Preview.
5. Add `www.ai2note.com` under Domains.
6. Configure the DNS record exactly as Vercel displays, then verify the domain.

This produces two isolated deployments:

- Product application: `ai.ai2dot.com`, repository root
- Marketing website: `www.ai2note.com`, `website/`

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
