import { parseProjects } from '@/lib/projects-parser'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Upload-and-merge: parseia a planilha "Obras Ativas ECF" e faz upsert por code.
// Obras não presentes na nova planilha NÃO são desativadas automaticamente
// — você marca como inativa pela UI quando quiser.
export async function POST(req: Request) {
  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const buf = await file.arrayBuffer()
  let result
  try {
    result = parseProjects(buf)
  } catch (e) {
    return NextResponse.json({
      error: 'Falha ao ler XLSX: ' + (e instanceof Error ? e.message : String(e)),
    }, { status: 400 })
  }
  if (result.errors.length > 0) {
    return NextResponse.json({ error: result.errors.join(' · ') }, { status: 400 })
  }

  let created = 0
  let updated = 0
  for (const p of result.projects) {
    const existing = await prisma.project.findUnique({ where: { code: p.code } })
    if (existing) {
      if (existing.name !== p.name || !existing.active) {
        await prisma.project.update({
          where: { code: p.code },
          data: { name: p.name, active: true },
        })
        updated++
      }
    } else {
      await prisma.project.create({ data: { code: p.code, name: p.name, active: true } })
      created++
    }
  }

  return NextResponse.json({
    total: result.projects.length,
    created,
    updated,
    unchanged: result.projects.length - created - updated,
  })
}
