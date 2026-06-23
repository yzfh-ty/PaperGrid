import { NextResponse } from 'next/server'
import slugify from 'slugify'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/api-keys'
import { revalidatePublicTaxonomyPaths } from '@/lib/post-revalidate'

function normalizeName(input: unknown) {
  return typeof input === 'string' ? input.trim() : ''
}

function buildSlug(name: string, input: unknown) {
  const rawSlug = typeof input === 'string' ? input.trim() : ''
  return slugify(rawSlug || name, { lower: true, strict: true, trim: true })
}

async function uniqueSlug(baseSlug: string) {
  const fallback = baseSlug || `tag-${Date.now()}`
  let slug = fallback
  let suffix = 1
  while (await prisma.tag.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${fallback}-${suffix}`
    suffix += 1
  }
  return slug
}

export async function GET(req: Request) {
  try {
    const authResult = await requireApiKey(req, 'POST_READ')
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status, headers: authResult.headers }
      )
    }

    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ tags }, { headers: authResult.headers })
  } catch (error) {
    console.error('插件获取标签失败:', error)
    return NextResponse.json({ error: '获取标签失败' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireApiKey(req, 'POST_CREATE')
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status, headers: authResult.headers }
      )
    }

    const body = await req.json()
    const name = normalizeName(body.name)
    if (!name) {
      return NextResponse.json(
        { error: '标签名称不能为空' },
        { status: 400, headers: authResult.headers }
      )
    }

    const requestedSlug = buildSlug(name, body.slug)
    const existing = await prisma.tag.findFirst({
      where: {
        OR: [
          { name },
          ...(requestedSlug ? [{ slug: requestedSlug }] : []),
        ],
      },
    })

    if (existing) {
      return NextResponse.json({ tag: existing }, { headers: authResult.headers })
    }

    const slug = await uniqueSlug(requestedSlug)
    const tag = await prisma.tag.create({
      data: {
        name,
        slug,
      },
    })

    revalidatePublicTaxonomyPaths({ tagSlugs: [tag.slug] })

    return NextResponse.json({ tag }, { status: 201, headers: authResult.headers })
  } catch (error) {
    console.error('插件创建标签失败:', error)
    return NextResponse.json({ error: '创建标签失败' }, { status: 500 })
  }
}
