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

export async function POST(req: Request) {
  const body = await req.json() as { code?: string; name?: string; active?: boolean }
  const code = String(body.code ?? '').trim()
  const name = String(body.name ?? '').trim()
  if (!code) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })

  const dup = await prisma.project.findUnique({ where: { code } })
  if (dup) return NextResponse.json({ error: `Já existe obra com o código ${code}` }, { status: 409 })

  const created = await prisma.project.create({
    data: { code, name, active: body.active ?? true },
  })
  return NextResponse.json(created, { status: 201 })
}
