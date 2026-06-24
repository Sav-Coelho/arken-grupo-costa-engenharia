# CLAUDE.md

Guidance for Claude Code working in this repo.

## Visão geral

Plataforma Arken para o Grupo Costa Engenharia.

**Módulo 1 — Pessoal por Obra** (`/pessoal-obra`)
- Importa XLSX mensal de RH com layout colaborador × dia
- Mapeia "aliases" de obras (nomes curtos na planilha) para a obra cadastrada
- Dashboard: heatmap colaborador × dia, KPIs, distribuição por função, top faltas

**Módulo 2 — Obras Ativas** (`/obras`)
- Cadastro de obras via upload do XLSX "Obras Ativas ECF" do ERP
- Upsert por código; obras encerradas viram inativas

## Commands

```bash
npm run dev          # dev server em http://localhost:3000
npm run build        # build de produção (roda: prisma generate && prisma db push && next build)
npm run db:studio    # Prisma Studio
git push             # dispara deploy automático na Vercel
```

Sem suíte de testes. Type-check via `npm run build`.

## Stack

Next.js 14 App Router + Prisma + Neon Postgres + Recharts + xlsx. Sem auth.
Env vars: `DATABASE_URL` (pooled) e `DIRECT_URL` (direct, usado pelo `prisma db push` no build).

## Restrição TypeScript

Target ES5 da Vercel **não** suporta `for...of` em `Map`/`Set` nem spread de `Set`.
Use `Array.from()`:

```typescript
// ❌ quebra no build
const arr = [...set]
for (const [k, v] of map) { }

// ✅ correto
const arr = Array.from(set)
Array.from(map.entries()).forEach(([k, v]) => { })
```

## Data Model

**Project** — obra ativa. `code` único (vem do ERP), `name`, `active`, `aliases[]`, `allocations[]`.

**ProjectAlias** — nomes curtos da planilha de pessoal mapeados pra um `Project`. Ex: `"BUTANTAN - SPCI"` → projeto 5013.

**Worker** — colaborador, único por nome. Tem `role` (cargo).

**Allocation** — 1 registro por colaborador × dia. Campos: `workerId`, `date`, `year`, `month`, `projectId` (null para status de ausência), `status` (`PRESENT | WEEKEND | DAY_OFF | ABSENCE_JUSTIFIED | ABSENCE_UNJUSTIFIED | TERMINATED`), `rawValue` (cell original pra auditoria).

## Fluxo de Importação (Pessoal)

1. `POST /api/personnel/parse` recebe XLSX + year + month. Lê linhas (col A=nome, B=função, C-AG=dias). Classifica cada célula em status e detecta `uniqueAliases` (nomes de obras). Devolve preview + `pendingAliases` (não mapeados) + projetos ativos pro dropdown.
2. UI mostra mapeamento pendente. Analista escolhe a obra pra cada alias novo.
3. `POST /api/personnel/save` valida que todos os aliases têm mapeamento, faz upsert dos `Worker` por nome, persiste novos `ProjectAlias`, e faz **wipe-and-replace** das `Allocation` por `(year, month)`.

## Dashboard `/pessoal-obra` (Visão Geral)

`GET /api/personnel/series?year=X&month=Y&projectIds=1,3` devolve allocations achatadas + projetos + KPIs em 1 request. Componente `Heatmap` renderiza grid sticky de N×31 (workers × dias) com cor por obra.

## UI Patterns

Sem biblioteca de UI — estilos inline + classes em `globals.css`: `.card`, `.btn`, `.btn-primary`, `.btn-sm`, `.form-select`, `.form-input`, `.table-wrap`, `.toast`, `.page-header`, `.page-title`, `.empty-state`, `.card-accent-yellow`.

Identidade Arken: navy `#0a2540`, amarelo `#f5c518`, serif DM Serif Display, sans Inter.
