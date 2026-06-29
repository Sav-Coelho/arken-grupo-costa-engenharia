import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// PUT /api/compensation/[id] → edição manual (id da WorkerCompensation)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  const body = await req.json() as Partial<{
    contractType: string; monthlySalary: number; dailyBenefit: number; benefitPaymentForm: string | null
  }>
  const data: Record<string, unknown> = {}
  if (body.contractType != null) data.contractType = body.contractType
  if (body.monthlySalary != null) data.monthlySalary = Number(body.monthlySalary)
  if (body.dailyBenefit != null) data.dailyBenefit = Number(body.dailyBenefit)
  if (body.benefitPaymentForm !== undefined) data.benefitPaymentForm = body.benefitPaymentForm
  const updated = await prisma.workerCompensation.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  await prisma.workerCompensation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
