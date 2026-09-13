# QR Menu SaaS — Multi-Restaurant Digital Menu Platform

## 🎯 The Problem & Solution

### The Problem
- Restaurants still rely on paper menus — hard to update, easily lost, no direct ordering capability
- Existing SaaS solutions are expensive ($50-200/month) with annual contracts
- No free Arabic-first solutions supporting: table ordering, delivery, real-time order management, and sales analytics

### The Solution
**QR Menu SaaS** is a multi-tenant platform enabling every restaurant to:
- Create a professional digital menu in minutes
- Unique QR codes per table — customers scan and order from their phones
- Real-time management dashboards (Staff Panel + Admin Panel)
- Support for dine-in and delivery orders
- Daily sales reports, best-sellers, and table performance
- **100% Free** on the Free Tier (Vercel + Supabase + Cloudflare)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Multi-tenant** | Single platform serving 15+ restaurants, each with their own slug |
| **QR Codes** | Per-table QR codes + general restaurant QR + PNG export for printing |
| **Real-time Polling** | Orders appear for staff within 10s (Staff) / 20s (Admin) |
| **PWA** | Installable as app — works offline partially, native feel |
| **Image Proxy** | Auto-compression & conversion (Sharp) + CDN + 1-year cache |
| **Order Management** | New → Preparing → Done + audio notifications |
| **Analytics** | Best-sellers, daily revenue, table utilization |
| **Billing** | 30-day free trial, monthly/annual subscriptions, restaurant exemptions |
| **Security** | Row-Level Security (RLS), Rate Limiting, CSP, Circuit Breaker |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| **Database** | PostgreSQL (Supabase) + Prisma ORM |
| **Auth** | Supabase Auth (Email/Password + PKCE) |
| **Real-time** | Smart Polling (10s/20s) with Page Visibility API |
| **Images** | Supabase Storage + Sharp Proxy API (WebP/AVIF) |
| **Testing** | Vitest (Unit/Integration) + Playwright (E2E) |
| **Monitoring** | Sentry + Vercel Analytics |
| **Deploy** | Vercel Hobby + Supabase Free + Cloudflare Free |

---

## 🔗 Platform Links

**Base URL:** https://site-menu.ddnsfree.com

- **Public Menu (Example):** https://site-menu.ddnsfree.com/m/kafy


---

## 🚀 Getting Started Locally

```bash
# 1. Clone the repository
git clone https://github.com/islam-abdo-1/qr-menu.git
cd qr-menu

# 2. Install dependencies
npm install

# 3. Environment variables (copy .env.example to .env.local and fill values)
cp .env.example .env.local

# 4. Database setup
npx prisma generate
npm run prisma:migrate

# 5. Run development server
npm run dev
```

**Opens at:** `http://localhost:3000`

---

## 🧪 Testing

```bash
# Unit + Integration Tests (Vitest)
npm run test

# E2E Tests (Playwright)
npx playwright install
npx playwright test

# Load Testing (15 restaurants)
node scripts/load-test-advanced.mjs http://localhost:3000
node scripts/polling-load-test.mjs http://localhost:3000 2
```

---

## 📁 Project Structure

```
qr-menu/
├── app/                    # Next.js App Router
│   ├── (public)/m/[slug]/  # Public menu pages
│   ├── (admin)/admin/      # Admin dashboard
│   ├── staff/[slug]/       # Staff order screen
│   └── api/                # API Routes (Image Proxy, Health, Orders)
├── components/             # React Components
│   ├── public/             # Public menu components
│   ├── admin/              # Admin dashboard components
│   └── staff/              # Staff screen components
├── lib/
│   ├── actions/            # Server Actions
│   ├── data.ts             # Data fetching + Caching (ISR)
│   ├── utils.ts            # Helpers (formatPrice, toImageProxyUrl, etc)
│   └── billing.ts          # Subscription logic
├── prisma/
│   └── schema.prisma       # Database Schema
├── scripts/                # Automation & load testing scripts
└── test/                   # Vitest + Playwright tests
```

---

## 🌐 Infrastructure (100% Free Tier)

| Service | Plan | Usage |
|---------|------|-------|
| **Vercel** | Hobby | Hosting + Functions + Edge + Analytics |
| **Supabase** | Free | PostgreSQL (500MB) + Auth + Storage (1GB) |
| **Cloudflare** | Free | DNS + Turnstile (CAPTCHA) + Analytics |

**Target Capacity:** 15 restaurants, ~100 concurrent users, < 2s p99 latency

---

## 🔒 Security

- **Row Level Security (RLS)** on all database tables
- **Rate Limiting** on Edge (300 req/min for menu, 30 req/min for orders)
- **CSP Headers** strict (only Google Analytics + Turnstile allowed)
- **Circuit Breaker** protects against cascade failures
- **No secrets in code** — all keys in Environment Variables

---

## 📄 License

MIT License — free for personal and commercial use.

---

## 🤝 Contributing

Contributions welcome! Open an Issue or Pull Request.
