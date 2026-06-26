import { parsePersonnel } from '@/lib/personnel-parser'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Lê XLSX e devolve:
//  - workers parseados (com allocations por dia)
//  - lista de aliases (nomes curtos de obra) detectados
//  - mapeamentos existentes (alias → projectId) já salvos no banco
//  - lista de aliases pendentes (precisam mapeamento manual antes do save)
//  - obras ativas (pra dropdown de mapeamento)
export async function POST(req: Request) {
  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const year = parseInt(String(fd.get('year') ?? ''), 10)
  const month = parseInt(String(fd.get('month') ?? ''), 10)
  const dayRaw = String(fd.get('day') ?? '').trim()
  const day = dayRaw ? parseInt(dayRaw, 10) : null

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!year || !month) return NextResponse.json({ error: 'Mês e ano obrigatórios' }, { status: 400 })

  const buf = await file.arrayBuffer()
  let parsed
  try {
    parsed = parsePersonnel(buf, year, month, day)
  } catch (e) {
    return NextResponse.json({
      error: 'Falha ao ler XLSX: ' + (e instanceof Error ? e.message : String(e)),
    }, { status: 400 })
  }
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: parsed.errors.join(' · ') }, { status: 400 })
  }

  // Carrega mapeamentos existentes em paralelo
  const [existingAliases, activeProjects] = await Promise.all([
    prisma.projectAlias.findMany({ where: { alias: { in: parsed.uniqueAliases } } }),
    prisma.project.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
  ])

  const aliasMap: Record<string, number> = {}
  existingAliases.forEach(a => { aliasMap[a.alias] = a.projectId })

  const pendingAliases = parsed.uniqueAliases.filter(a => !(a in aliasMap))

  // Resumo (contagem por status)
  let totalPresent = 0, totalAbsent = 0, totalTerminated = 0
  for (const w of parsed.workers) {
    for (const a of w.allocations) {
      if (a.status === 'PRESENT') totalPresent++
      else if (a.status === 'ABSENCE_JUSTIFIED' || a.status === 'ABSENCE_UNJUSTIFIED') totalAbsent++
      else if (a.status === 'TERMINATED') totalTerminated++
    }
  }

  return NextResponse.json({
    year: parsed.year,
    month: parsed.month,
    day: day ?? null,
    daysInMonth: parsed.daysInMonth,
    workers: parsed.workers,
    uniqueAliases: parsed.uniqueAliases,
    existingMappings: aliasMap,
    pendingAliases,
    activeProjects: activeProjects.map(p => ({ id: p.id, code: p.code, name: p.name })),
    summary: {
      workerCount: parsed.workers.length,
      totalPresent, totalAbsent, totalTerminated,
    },
  })
}
