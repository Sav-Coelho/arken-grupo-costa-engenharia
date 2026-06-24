import { prisma } from '@/lib/prisma'
import type { ParsedWorker } from '@/lib/personnel-parser'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Salva os Workers (upsert por nome) e as Allocations do mês.
// Wipe-and-replace por (year, month): apaga todas as Allocations daquele mês
// e regrava com os dados da planilha. Permite reimport sem duplicar.
//
// Antes de salvar, valida que todos os aliases têm mapeamento — qualquer alias
// sem projectId resulta em erro 400 (não salva nada).
export async function POST(req: Request) {
  const body = await req.json() as {
    year: number
    month: number
    workers: ParsedWorker[]
    aliasMappings: Record<string, number>      // alias → projectId (vindo de mapeamentos novos + existentes)
  }

  if (!body.year || !body.month) {
    return NextResponse.json({ error: 'Ano/mês obrigatórios' }, { status: 400 })
  }

  // Valida que todo alias usado tem mapeamento
  const usedAliases = new Set<string>()
  for (const w of body.workers) {
    for (const a of w.allocations) {
      if (a.alias) usedAliases.add(a.alias)
    }
  }
  const unmapped: string[] = []
  Array.from(usedAliases).forEach(a => {
    if (!(a in body.aliasMappings)) unmapped.push(a)
  })
  if (unmapped.length > 0) {
    return NextResponse.json({
      error: `Aliases sem mapeamento: ${unmapped.join(', ')}`,
    }, { status: 400 })
  }

  // Persiste novos aliases (upsert) — os que ainda não estavam no banco
  const existingAliasRows = await prisma.projectAlias.findMany({
    where: { alias: { in: Array.from(usedAliases) } },
  })
  const existingAliasMap: Record<string, number> = {}
  existingAliasRows.forEach(r => { existingAliasMap[r.alias] = r.projectId })

  for (const a of Array.from(usedAliases)) {
    const desiredProjectId = body.aliasMappings[a]
    if (existingAliasMap[a] === desiredProjectId) continue
    if (a in existingAliasMap) {
      await prisma.projectAlias.update({
        where: { alias: a },
        data: { projectId: desiredProjectId },
      })
    } else {
      await prisma.projectAlias.create({ data: { alias: a, projectId: desiredProjectId } })
    }
  }

  // Upsert dos workers — em paralelo (pequeno volume)
  const workerIdByName: Record<string, number> = {}
  for (const w of body.workers) {
    const existing = await prisma.worker.findUnique({ where: { name: w.name } })
    const stillActive = w.allocations.some(a => a.status === 'PRESENT' || a.status === 'ABSENCE_JUSTIFIED' || a.status === 'ABSENCE_UNJUSTIFIED' || a.status === 'DAY_OFF' || a.status === 'WEEKEND')
    if (existing) {
      const updated = await prisma.worker.update({
        where: { id: existing.id },
        data: { role: w.role, active: stillActive },
      })
      workerIdByName[w.name] = updated.id
    } else {
      const created = await prisma.worker.create({
        data: { name: w.name, role: w.role, active: stillActive },
      })
      workerIdByName[w.name] = created.id
    }
  }

  // Wipe-and-replace das allocations do mês/ano
  const result = await prisma.$transaction(async tx => {
    const del = await tx.allocation.deleteMany({
      where: { year: body.year, month: body.month },
    })

    const rows: {
      workerId: number; date: Date; year: number; month: number;
      projectId: number | null; status: string; rawValue: string | null;
    }[] = []
    for (const w of body.workers) {
      const workerId = workerIdByName[w.name]
      for (const a of w.allocations) {
        rows.push({
          workerId,
          date: new Date(a.date + 'T00:00:00Z'),
          year: body.year,
          month: body.month,
          projectId: a.alias ? body.aliasMappings[a.alias] : null,
          status: a.status,
          rawValue: a.rawValue || null,
        })
      }
    }

    const ins = await tx.allocation.createMany({ data: rows, skipDuplicates: true })
    return { deleted: del.count, inserted: ins.count }
  })

  return NextResponse.json({
    year: body.year,
    month: body.month,
    workersUpserted: Object.keys(workerIdByName).length,
    allocationsDeleted: result.deleted,
    allocationsInserted: result.inserted,
  })
}
