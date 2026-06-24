# CLAUDE.md

Guidance for Claude Code working in this repo.

## Status

**Esqueleto inicial.** Plataforma Arken para o Grupo Costa Engenharia, sem módulos de negócio
ainda. A casca visual (layout, Shell, identidade Arken) está pronta — os módulos serão
definidos com o cliente.

## Commands

```bash
npm run dev          # dev server em http://localhost:3000
npm run build        # build de produção (roda: prisma generate && prisma db push && next build)
npm run db:studio    # Prisma Studio (editor visual do banco)
git push             # dispara deploy automático na Vercel
```

Sem suíte de testes. Type-check via `npm run build`.

## Architecture

Next.js 14 App Router — páginas e API routes no mesmo projeto. Sem auth. Deploy Vercel,
banco Neon Postgres (`sa-east-1`).

**Env vars principais:**
- `DATABASE_URL` — URL pooled do Neon (runtime)
- `DIRECT_URL` — URL direta do Neon (usada por `prisma db push` no build)

Schema gerenciado com `prisma db push` (sem arquivos de migration).

## Restrição TypeScript

Target de build da Vercel **não** suporta `for...of` em `Map`/`Set` nem spread de `Set`.
Sempre use `Array.from()`:

```typescript
// ❌ quebra no build da Vercel
const arr = [...set]
for (const [k, v] of map) { }

// ✅ correto
const arr = Array.from(set)
Array.from(map.entries()).forEach(([k, v]) => { })
```

## UI Patterns

Sem biblioteca de UI — estilos inline + classes em `globals.css`: `.card`, `.btn`,
`.btn-primary`, `.btn-danger`, `.btn-sm`, `.form-select`, `.form-input`, `.table-wrap`,
`.toast`, `.page-header`, `.page-title`, `.empty-state`.

Identidade Arken: fonte serif **DM Serif Display** (`--font-serif`), navy `#0a2540`
(`--arken-navy`), amarelo `#f5c518` (`--arken-yellow`).

## Próximos passos

1. Definir o primeiro módulo com o cliente.
2. Remover o model `_Health` placeholder do schema quando entrar o primeiro model real.
3. Adicionar entrada no `NAV` em `src/components/Shell.tsx` para cada módulo novo.
