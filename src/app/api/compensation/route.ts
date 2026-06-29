import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/compensation → lista todos os workers (com comp se houver)
export async function GET() {
  const workers = await prisma.worker.findMany({
    orderBy: { name: 'asc' },
    include: { compensation: true },
  })
  return NextResponse.json(workers.map(w => ({
    id: w.id,
    name: w.name,
    role: w.role,
    active: w.active,
    compensation: w.compensation ? {
      id: w.compensation.id,
      contractType: w.compensation.contractType,
      monthlySalary: w.compensation.monthlySalary,
      dailyBenefit: w.compensation.dailyBenefit,
      benefitPaymentForm: w.compensation.benefitPaymentForm,
      updatedAt: w.compensation.updatedAt,
    } : null,
  })))
}

// POST /api/compensation → criar/upsert manual
export async function POST(req: Request) {
  const body = await req.json() as {
    workerId: number
    contractType: string
    monthlySalary: number
    dailyBenefit: number
    benefitPaymentForm?: string | null
  }
  if (!body.workerId) return NextResponse.json({ error: 'workerId obrigatório' }, { status: 400 })

  const data = {
    contractType: body.contractType || 'OUTRO',
    monthlySalary: Number(body.monthlySalary) || 0,
    dailyBenefit: Number(body.dailyBenefit) || 0,
    benefitPaymentForm: body.benefitPaymentForm ?? null,
  }
  const existing = await prisma.workerCompensation.findUnique({ where: { workerId: body.workerId } })
  const saved = existing
    ? await prisma.workerCompensation.update({ where: { workerId: body.workerId }, data })
    : await prisma.workerCompensation.create({ data: { ...data, workerId: body.workerId } })
  return NextResponse.json(saved)
}
