import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  const body = await req.json() as { active?: boolean; name?: string; code?: string }

  const data: { active?: boolean; name?: string; code?: string } = {}
  if (typeof body.active === 'boolean') data.active = body.active
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim()
    if (!trimmed) return NextResponse.json({ error: 'Descrição não pode ficar vazia' }, { status: 400 })
    data.name = trimmed
  }
  if (typeof body.code === 'string') {
    const trimmed = body.code.trim()
    if (!trimmed) return NextResponse.json({ error: 'Código não pode ficar vazio' }, { status: 400 })
    const dup = await prisma.project.findUnique({ where: { code: trimmed } })
    if (dup && dup.id !== id) {
      return NextResponse.json({ error: `Já existe obra com o código ${trimmed}` }, { status: 409 })
    }
    data.code = trimmed
  }

  const updated = await prisma.project.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const count = await prisma.allocation.count({ where: { projectId: id } })
  if (count > 0) {
    return NextResponse.json({
      error: `Não é possível deletar: existem ${count} alocação(ões) vinculada(s). Use "Desativar" pra ocultar a obra sem perder o histórico.`,
    }, { status: 409 })
  }
  await prisma.projectAlias.deleteMany({ where: { projectId: id } })
  await prisma.project.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
