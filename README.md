# PG — Hostel Management

Multi-building hostel & PG management system.

## Buildings

| Building | Yearly fee | Electricity | Non-refundable | Capacity |
| --- | --- | --- | --- | --- |
| Chalapathi Main | ₹95,000 | ₹5,000 | ₹2,000 | 300 (50 flats × 6) |
| Stanza | ₹85,000 | — | ₹2,000 | 60 (5 floors × 4 rooms × 3) |
| Villas | ₹1,00,000 | — | ₹2,000 | 60 (4 villas × 15) |
| Siddha Middle Block | ₹85,000 | ₹5,000 | ₹2,000 | TBD |

Yearly fees can be paid in full or split half/half across two semesters.

## Stack

- React 18 + Vite 6 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix)
- React Router v7
- Supabase (Postgres, auth, storage)
- Vercel (hosting)

## Local dev

```bash
pnpm install
cp .env.example .env.local   # paste Supabase project URL + anon key
pnpm dev                     # http://localhost:5173
```

## Build

```bash
pnpm build      # outputs dist/
pnpm preview    # serves dist/ locally on :4173
```

## Demo credentials (until Supabase is wired)

- Admin: `12345` / `admin123`
- Student: `9876543210` / `student123`
