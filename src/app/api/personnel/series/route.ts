import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Devolve tudo que o dashboard precisa numa request:
//  - meses disponíveis (year/month presentes em Allocations)
//  - allocations do mês selecionado, achatadas pra heatmap
//  - projetos (ativos + inativos com allocations no mês)
//  - KPIs agregados
//
// Query params:
//   ?year=2026&month=5     → recorta o mês (obrigatório se houver dados)
//   ?projectIds=1,3,5      → filtra por obras específicas (opcional)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || '0', 10)
  const month = parseInt(searchParams.get('month') || '0', 10)
  const projectIdsRaw = searchParams.get('projectIds')
  const projectIdsFilter = projectIdsRaw
    ? projectIdsRaw.split(',').map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n))
    : null

  // Meses disponíveis (year, month distinctos em Allocation)
  const availablePeriodsRaw = await prisma.allocation.groupBy({
    by: ['year', 'month'],
    _count: { _all: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  const availablePeriods = availablePeriodsRaw.map(p => ({
    year: p.year, month: p.month, count: p._count._all,
  }))

  // Sem ano/mês, devolve só lista de períodos
  if (!year || !month) {
    return NextResponse.json({
      availablePeriods,
      year: null, month: null,
      daysInMonth: 0,
      workers: [], allocations: [], projects: [],
      summary: { workerCount: 0, presentDays: 0, absenceJustified: 0, absenceUnjustified: 0, terminated: 0, dayOff: 0, weekend: 0 },
    })
  }

  // Allocations do mês (com filtro opcional de projeto)
  const allocs = await prisma.allocation.findMany({
    where: {
      year, month,
      ...(projectIdsFilter ? { OR: [{ projectId: { in: projectIdsFilter } }, { projectId: null }] } : {}),
    },
    include: { worker: true },
    orderBy: [{ workerId: 'asc' }, { date: 'asc' }],
  })

  // Projetos referenciados (ativos OU usados nas allocations)
  const referencedProjectIds = Array.from(new Set(allocs.map(a => a.projectId).filter((x): x is number => x !== null)))
  const projects = await prisma.project.findMany({
    where: { OR: [{ active: true }, { id: { in: referencedProjectIds } }] },
    orderBy: { code: 'asc' },
  })

  // Workers únicos das allocations
  const workerMap = new Map<number, { id: number; name: string; role: string | null; active: boolean }>()
  allocs.forEach(a => {
    if (!workerMap.has(a.workerId)) {
      workerMap.set(a.workerId, {
        id: a.worker.id,
        name: a.worker.name,
        role: a.worker.role,
        active: a.worker.active,
      })
    }
  })
  const workers = Array.from(workerMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  // KPIs
  let presentDays = 0, absenceJustified = 0, absenceUnjustified = 0, terminated = 0
  let dayOff = 0, weekend = 0, leave = 0, vacation = 0
  for (const a of allocs) {
    if (a.status === 'PRESENT') presentDays++
    else if (a.status === 'ABSENCE_JUSTIFIED') absenceJustified++
    else if (a.status === 'ABSENCE_UNJUSTIFIED') absenceUnjustified++
    else if (a.status === 'TERMINATED') terminated++
    else if (a.status === 'DAY_OFF') dayOff++
    else if (a.status === 'WEEKEND') weekend++
    else if (a.status === 'LEAVE') leave++
    else if (a.status === 'VACATION') vacation++
  }

  // Achatar pro heatmap (dia → workerId → cellInfo)
  const flatAllocs = allocs.map(a => ({
    workerId: a.workerId,
    date: a.date.toISOString().slice(0, 10),
    day: a.date.getUTCDate(),
    projectId: a.projectId,
    status: a.status,
    rawValue: a.rawValue,
  }))

  const daysInMonth = new Date(year, month, 0).getDate()

  // Lista snapshots do mês (pra dropdown no dashboard)
  const snapshots = await prisma.snapshotBatch.findMany({
    where: { year, month },
    orderBy: [{ day: 'asc' }, { capturedAt: 'asc' }],
    select: {
      id: true, capturedAt: true, label: true, day: true,
      _count: { select: { cells: true } },
    },
  })

  // Compensations dos workers envolvidos (pra cruzamento de custo no dashboard)
  const workerIds = workers.map(w => w.id)
  const compensations = workerIds.length > 0
    ? await prisma.workerCompensation.findMany({
        where: { workerId: { in: workerIds } },
        select: { workerId: true, contractType: true, monthlySalary: true, dailyBenefit: true },
      })
    : []

  return NextResponse.json({
    availablePeriods,
    year, month, daysInMonth,
    workers,
    allocations: flatAllocs,
    projects: projects.map(p => ({ id: p.id, code: p.code, name: p.name, active: p.active })),
    summary: {
      workerCount: workers.length,
      presentDays, absenceJustified, absenceUnjustified, terminated, dayOff, weekend,
      leave, vacation,
    },
    snapshots: snapshots.map(s => ({
      id: s.id,
      capturedAt: s.capturedAt.toISOString(),
      label: s.label,
      day: s.day,
      cellCount: s._count.cells,
    })),
    compensations,
  })
}
