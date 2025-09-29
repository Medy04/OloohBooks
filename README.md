This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.jsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load the Geist font family.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - community feedback and contributions are welcome!

## Deployment

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for various hosting options.

## Supabase Setup

This project uses Supabase on the client (no Next.js API routes). Make sure to configure environment variables:

Required env vars (see `ENV_EXAMPLE.txt`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Database table expected:

```
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text check (type in ('BOUTIQUE','EN_LIGNE','POP_UP')),
  active boolean not null default true
);
```

If using Row Level Security (RLS), enable and add permissive policies for read/write in development.
