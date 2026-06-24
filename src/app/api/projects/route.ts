import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: [{ active: 'desc' }, { code: 'asc' }],
    include: { aliases: true, _count: { select: { allocations: true } } },
  })
  return NextResponse.json(projects)
}
