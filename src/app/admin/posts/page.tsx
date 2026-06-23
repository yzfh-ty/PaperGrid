import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminPostsClient } from '@/components/admin/posts-client'
import { PostStatus, Prisma } from '@prisma/client'

const PAGE_SIZE = 20

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

function normalizePage(value?: string): number {
  const page = Number.parseInt(value || '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
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

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; categoryId?: string; page?: string }>
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  const params = await searchParams
  const q = params.q?.trim() || ''
  const status = params.status || ''
  const categoryId = params.categoryId || ''
  const requestedPage = normalizePage(params.page)
  const where = buildPostWhere(q, status, categoryId)

  const queryPosts = (skip: number) =>
    prisma.post.findMany({
      where,
      select: postListSelect,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: PAGE_SIZE,
    })

  const [firstBatch, total] = await Promise.all([
    queryPosts((requestedPage - 1) * PAGE_SIZE),
    prisma.post.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const posts =
    currentPage === requestedPage
      ? firstBatch
      : await queryPosts((currentPage - 1) * PAGE_SIZE)

  // 获取分类列表
  const categories = await prisma.category.findMany()

  return (
    <AdminPostsClient
      initialPosts={posts}
      categories={categories}
      initialQuery={q}
      initialStatus={status}
      initialCategoryId={categoryId}
      initialPagination={{
        page: currentPage,
        limit: PAGE_SIZE,
        total,
        totalPages,
      }}
    />
  )
}
