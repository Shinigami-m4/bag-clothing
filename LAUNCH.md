# Launch Checklist

## Production persistence

This app now uses:

- `BLOB_PRIVATE_READ_WRITE_TOKEN` for inventory, portfolio entries, newsletter fallback data, and Stripe webhook event IDs.
- `BLOB_PUBLIC_READ_WRITE_TOKEN` for uploaded product and portfolio images.
- `BREVO_API_KEY` for newsletter signups.

If those env vars are missing, the app falls back to local JSON/files for development only.

## Vercel setup

1. Import the repo into Vercel.
2. Create two Blob stores in the Vercel dashboard:
   - one private store for JSON/data
   - one public store for uploaded images
3. Add the environment variables from `.env.example` to Vercel Production.
4. Set `NEXT_PUBLIC_SITE_URL` to your real domain, for example `https://blackartgoons.com`.

## Stripe setup

1. Add your live `STRIPE_SECRET_KEY` in Vercel.
2. In Stripe, create a webhook endpoint for:
   - `https://your-domain.com/api/webhook`
3. Subscribe that webhook to `checkout.session.completed`.
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel.

## Brevo setup

1. Create or choose your newsletter list in Brevo.
2. Generate a Brevo API key.
3. Add `BREVO_API_KEY` to Vercel.
4. Add `BREVO_NEWSLETTER_LIST_ID` with the numeric list id from Brevo.

If you want multiple Brevo lists later, the app also supports `BREVO_NEWSLETTER_LIST_IDS` as a comma-separated value.

## Namecheap + Vercel domain connection

1. Add the custom domain in Vercel first.
2. In Namecheap `Advanced DNS`, point:
   - `A` record for `@` to `76.76.21.21`
   - `CNAME` record for `www` to `cname.vercel-dns.com`
3. Wait for DNS propagation, then confirm the domain in Vercel.

## First production deploy note

`inventory.json` and `portfolio.json` are still read locally when Blob is empty, so the first production deploy can start from the checked-in data. After edits in production, Blob becomes the source of truth.
