import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Recebe a lista revisada pelo analista (workerId já definido por linha).
// Faz upsert por workerId. Linhas sem workerId são ignoradas.
export async function POST(req: Request) {
  const body = await req.json() as {
    rows: {
      workerId: number | null
      contractType: string
      monthlySalary: number
      dailyBenefit: number
      benefitPaymentForm: string | null
    }[]
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'rows inválido' }, { status: 400 })
  }

  let created = 0, updated = 0, skipped = 0
  for (const r of body.rows) {
    if (r.workerId == null) { skipped++; continue }
    const existing = await prisma.workerCompensation.findUnique({ where: { workerId: r.workerId } })
    const data = {
      contractType: r.contractType || 'OUTRO',
      monthlySalary: Number(r.monthlySalary) || 0,
      dailyBenefit: Number(r.dailyBenefit) || 0,
      benefitPaymentForm: r.benefitPaymentForm,
    }
    if (existing) {
      await prisma.workerCompensation.update({ where: { workerId: r.workerId }, data })
      updated++
    } else {
      await prisma.workerCompensation.create({ data: { ...data, workerId: r.workerId } })
      created++
    }
  }

  return NextResponse.json({ created, updated, skipped })
}
