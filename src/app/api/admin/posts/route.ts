import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostStatus, Prisma } from '@prisma/client'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const postListSelect = {
  id: true,
  title: true,
  excerpt: true,
  status: true,
  createdAt: true,
  publishedAt: true,
  updatedAt: true,
  author: {
    select: {
      name: true,
      email: true,
    },
  },
  category: {
    select: {
      name: true,
    },
  },
  _count: {
    select: {
      comments: true,
    },
  },
} satisfies Prisma.PostSelect

function normalizePage(value: string | null): number {
  const page = Number.parseInt(value || '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

function normalizeLimit(value: string | null): number {
  const parsed = Number.parseInt(value || `${DEFAULT_LIMIT}`, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

function buildPostWhere(
  q: string,
  status: string,
  categoryId: string
): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {}

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { excerpt: { contains: q } },
      { content: { contains: q } },
    ]
  }

  if (status && Object.values(PostStatus).includes(status as PostStatus)) {
    where.status = status as PostStatus
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  return where
}

// GET /api/admin/posts - 获取文章列表（支持筛选/搜索/分页）
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    const status = searchParams.get('status') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const requestedPage = normalizePage(searchParams.get('page'))
    const limit = normalizeLimit(searchParams.get('limit'))
    const where = buildPostWhere(q, status, categoryId)

    const queryPosts = (skip: number) =>
      prisma.post.findMany({
        where,
        select: postListSelect,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      })

    const [firstBatch, total] = await Promise.all([
      queryPosts((requestedPage - 1) * limit),
      prisma.post.count({ where }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(requestedPage, totalPages)
    const posts =
      page === requestedPage
        ? firstBatch
        : await queryPosts((page - 1) * limit)

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('获取文章失败:', error)
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 })
  }
}
