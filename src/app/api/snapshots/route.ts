import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/snapshots?year=2026&month=5  → lista snapshots do mês
// GET /api/snapshots?year=2026&month=5&day=15  → lista snapshots do dia
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || '0', 10)
  const month = parseInt(searchParams.get('month') || '0', 10)
  const dayRaw = searchParams.get('day')
  const day = dayRaw ? parseInt(dayRaw, 10) : null

  if (!year || !month) {
    return NextResponse.json({ error: 'year/month obrigatórios' }, { status: 400 })
  }

  const batches = await prisma.snapshotBatch.findMany({
    where: { year, month, ...(day != null ? { day } : {}) },
    orderBy: [{ day: 'asc' }, { capturedAt: 'asc' }],
    select: {
      id: true, capturedAt: true, label: true,
      date: true, year: true, month: true, day: true,
      _count: { select: { cells: true } },
    },
  })

  return NextResponse.json({
    year, month, day,
    snapshots: batches.map(b => ({
      id: b.id,
      capturedAt: b.capturedAt.toISOString(),
      label: b.label,
      day: b.day,
      cellCount: b._count.cells,
    })),
  })
}
