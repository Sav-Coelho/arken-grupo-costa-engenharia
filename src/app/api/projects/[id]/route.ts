import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  const body = await req.json() as { active?: boolean; name?: string }
  const updated = await prisma.project.update({
    where: { id },
    data: { active: body.active, name: body.name },
  })
  return NextResponse.json(updated)
}
