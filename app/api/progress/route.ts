import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/progress — load all progress for current user
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const [rows, user] = await Promise.all([
    prisma.progress.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { streak: true, lastStudyDay: true } }),
  ])

  const prog: Record<string, any> = {}
  for (const r of rows) {
    prog[r.kanji] = {
      status: r.status,
      ease: r.ease,
      weekSeen: JSON.parse(r.weekSeen),
    }
  }

  return NextResponse.json({
    prog,
    streak: user?.streak ?? 0,
    lastDay: user?.lastStudyDay ?? null,
  })
}

// POST /api/progress — save full state
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()
  const { prog, streak, lastDay } = body

  // Upsert each kanji progress row
  const ops = Object.entries(prog as Record<string, any>).map(([kanji, val]) =>
    prisma.progress.upsert({
      where: { userId_kanji: { userId, kanji } },
      update: {
        status: val.status,
        ease: val.ease,
        weekSeen: JSON.stringify(val.weekSeen ?? []),
      },
      create: {
        userId,
        kanji,
        status: val.status,
        ease: val.ease,
        weekSeen: JSON.stringify(val.weekSeen ?? []),
      },
    })
  )

  await Promise.all([
    ...ops,
    prisma.user.update({
      where: { id: userId },
      data: { streak, lastStudyDay: lastDay },
    }),
  ])

  return NextResponse.json({ ok: true })
}
