# Arken · Grupo Costa Engenharia

Plataforma de gestão corporativa do Grupo Costa Engenharia.

> **Status:** esqueleto inicial. Sem módulos de negócio ainda — só a casca visual Arken.

## Stack

- Next.js 14 (App Router)
- Prisma + Neon PostgreSQL
- Deploy Vercel
- Sem auth (por enquanto)

## Setup local

```bash
npm install
cp .env.example .env       # preencha DATABASE_URL e DIRECT_URL com as URLs do Neon
npx prisma db push          # sincroniza schema com o banco
npm run dev                 # http://localhost:3000
```

## Deploy

Push para `main` dispara deploy automático na Vercel. As env vars precisam estar
configuradas no painel da Vercel.
