import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Devolve um snapshot completo: cells + workers envolvidos + comparativo
// com o Allocation de fechamento daquele dia.
//
// O comparativo identifica:
//  - "chegaramDepois": workerIds que estão PRESENT no fechamento mas não estavam PRESENT no snapshot
//  - "saiuApos": workerIds que estavam PRESENT no snapshot mas não estão PRESENT no fechamento
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const batch = await prisma.snapshotBatch.findUnique({
    where: { id },
    include: {
      cells: { include: { worker: true } },
    },
  })
  if (!batch) return NextResponse.json({ error: 'snapshot não encontrado' }, { status: 404 })

  // Allocation de fechamento daquele dia (pra comparativo)
  const finalAllocs = await prisma.allocation.findMany({
    where: { year: batch.year, month: batch.month, date: batch.date },
    select: { workerId: true, projectId: true, status: true },
  })

  const presentInSnapshot = new Set<number>()
  batch.cells.forEach(c => { if (c.status === 'PRESENT') presentInSnapshot.add(c.workerId) })

  const presentInFinal = new Set<number>()
  finalAllocs.forEach(a => { if (a.status === 'PRESENT') presentInFinal.add(a.workerId) })

  const chegaramDepois = Array.from(presentInFinal).filter(w => !presentInSnapshot.has(w))
  const saiuApos = Array.from(presentInSnapshot).filter(w => !presentInFinal.has(w))

  return NextResponse.json({
    id: batch.id,
    capturedAt: batch.capturedAt.toISOString(),
    label: batch.label,
    year: batch.year, month: batch.month, day: batch.day,
    date: batch.date.toISOString().slice(0, 10),
    cells: batch.cells.map(c => ({
      workerId: c.workerId,
      workerName: c.worker.name,
      workerRole: c.worker.role,
      projectId: c.projectId,
      status: c.status,
      rawValue: c.rawValue,
    })),
    finalAvailable: finalAllocs.length > 0,
    comparison: {
      presentInSnapshot: presentInSnapshot.size,
      presentInFinal: presentInFinal.size,
      chegaramDepoisIds: chegaramDepois,
      saiuAposIds: saiuApos,
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  await prisma.snapshotBatch.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
