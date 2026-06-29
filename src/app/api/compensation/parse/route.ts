import { parseCompensation, bestNameMatch, normalizeName } from '@/lib/compensation-parser'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Parseia a planilha "Colaboradores Valores" e devolve preview.
// Para cada linha:
//  - tenta encontrar um Worker existente por nome (exato + fuzzy)
//  - devolve sugestão de match (workerId + score) ou null
// O analista revisa antes de salvar.
export async function POST(req: Request) {
  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const buf = await file.arrayBuffer()
  const parsed = parseCompensation(buf)
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: parsed.errors.join(' · ') }, { status: 400 })
  }

  const workers = await prisma.worker.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  const workerByNorm = new Map(workers.map(w => [normalizeName(w.name), w]))

  const rows = parsed.rows.map(r => {
    let matchWorker: { id: number; name: string; role: string | null } | null = null
    let matchScore = 1
    const exact = workerByNorm.get(r.normalizedName)
    if (exact) {
      matchWorker = exact
    } else {
      const fuzzy = bestNameMatch(r.normalizedName, Array.from(workerByNorm.keys()), 0.5)
      if (fuzzy) {
        matchWorker = workerByNorm.get(fuzzy.key) || null
        matchScore = fuzzy.score
      }
    }
    return {
      rawName: r.rawName,
      role: r.role,
      contractType: r.contractType,
      contractTypeRaw: r.contractTypeRaw,
      monthlySalary: r.monthlySalary,
      dailyBenefit: r.dailyBenefit,
      benefitPaymentForm: r.benefitPaymentForm,
      matchedWorkerId: matchWorker?.id ?? null,
      matchedWorkerName: matchWorker?.name ?? null,
      matchScore: matchWorker ? matchScore : null,
    }
  })

  return NextResponse.json({
    total: rows.length,
    matched: rows.filter(r => r.matchedWorkerId != null).length,
    rows,
    warnings: parsed.warnings,
    workers: workers.map(w => ({ id: w.id, name: w.name, role: w.role })),
  })
}
