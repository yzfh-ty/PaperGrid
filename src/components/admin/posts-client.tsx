'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PostsFilters } from '@/components/admin/posts-filters'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const FILTER_DEBOUNCE_MS = 200

type CategoryOption = {
  id: string
  name: string
}

type PostRecord = {
  id: string
  title: string
  excerpt: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  createdAt: string | Date
  publishedAt: string | Date | null
  updatedAt: string | Date
  author: { name: string | null; email: string | null }
  category: { name: string } | null
  _count: { comments: number }
}

type FilterState = {
  query: string
  status: string
  categoryId: string
}

type QueryState = FilterState & {
  page: number
}

type PaginationState = {
  page: number
  limit: number
  total: number
  totalPages: number
}

function formatDateLabel(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const parsed = Math.floor(value)
  return parsed > 0 ? parsed : fallback
}

function normalizePagination(raw: unknown, fallback: PaginationState): PaginationState {
  if (!raw || typeof raw !== 'object') return fallback

  const next = raw as Partial<PaginationState>
  const limit = normalizePositiveInt(next.limit, fallback.limit)
  const total = typeof next.total === 'number' && Number.isFinite(next.total)
    ? Math.max(0, Math.floor(next.total))
    : fallback.total
  const totalPages = Math.max(1, normalizePositiveInt(next.totalPages, fallback.totalPages))
  const page = Math.min(normalizePositiveInt(next.page, fallback.page), totalPages)

  return {
    page,
    limit,
    total,
    totalPages,
  }
}

interface AdminPostsClientProps {
  initialPosts: PostRecord[]
  categories: CategoryOption[]
  initialQuery: string
  initialStatus: string
  initialCategoryId: string
  initialPagination: PaginationState
}

export function AdminPostsClient({
  initialPosts,
  categories,
  initialQuery,
  initialStatus,
  initialCategoryId,
  initialPagination,
}: AdminPostsClientProps) {
  const { toast } = useToast()
  const [posts, setPosts] = useState<PostRecord[]>(initialPosts)
  const [queryState, setQueryState] = useState<QueryState>({
    query: initialQuery,
    status: initialStatus,
    categoryId: initialCategoryId,
    page: initialPagination.page,
  })
  const [pagination, setPagination] = useState<PaginationState>(initialPagination)
  const [loading, setLoading] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const didMountRef = useRef(false)
  const skipNextFetchRef = useRef(false)
  const overlayStartRef = useRef<number | null>(null)
  const overlayTimersRef = useRef<{ show?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout> }>({})

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }

    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    const controller = new AbortController()

    const fetchPosts = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (queryState.query) params.set('q', queryState.query)
        if (queryState.status) params.set('status', queryState.status)
        if (queryState.categoryId) params.set('categoryId', queryState.categoryId)
        params.set('page', queryState.page.toString())
        params.set('limit', pagination.limit.toString())

        const res = await fetch(`/api/admin/posts?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const data = await res.json()

        if (!res.ok) {
          toast({ title: '错误', description: data.error || '获取文章失败', variant: 'destructive' })
          return
        }

        const nextPosts = Array.isArray(data.posts) ? data.posts : []
        const nextPagination = normalizePagination(data.pagination, {
          page: queryState.page,
          limit: pagination.limit,
          total: 0,
          totalPages: 1,
        })

        setPosts(nextPosts)
        setPagination(nextPagination)

        if (nextPagination.page !== queryState.page) {
          skipNextFetchRef.current = true
          setQueryState((prev) => ({ ...prev, page: nextPagination.page }))
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('获取文章失败:', error)
        toast({ title: '错误', description: '获取文章失败', variant: 'destructive' })
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    const timer = setTimeout(fetchPosts, FILTER_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [queryState, pagination.limit, refreshToken, toast])

  useEffect(() => {
    const timers = overlayTimersRef.current
    if (loading) {
      if (timers.hide) clearTimeout(timers.hide)
      if (!overlayVisible) {
        timers.show = setTimeout(() => {
          overlayStartRef.current = Date.now()
          setOverlayVisible(true)
        }, 150)
      }
      return () => {
        if (timers.show) clearTimeout(timers.show)
      }
    }

    if (timers.show) clearTimeout(timers.show)
    if (!overlayVisible) return

    const startedAt = overlayStartRef.current ?? Date.now()
    const elapsed = Date.now() - startedAt
    const remaining = Math.max(0, 500 - elapsed)
    timers.hide = setTimeout(() => {
      setOverlayVisible(false)
      overlayStartRef.current = null
    }, remaining)

    return () => {
      if (timers.hide) clearTimeout(timers.hide)
    }
  }, [loading, overlayVisible])

  const stats = useMemo(() => {
    const total = pagination.total
    const published = posts.filter((p) => p.status === 'PUBLISHED').length
    const draft = posts.filter((p) => p.status === 'DRAFT').length
    const comments = posts.reduce((sum, p) => sum + (p._count?.comments || 0), 0)
    return { total, published, draft, comments }
  }, [posts, pagination.total])

  const handleFiltersChange = (nextFilters: FilterState) => {
    setQueryState((prev) => {
      const changed =
        prev.query !== nextFilters.query
        || prev.status !== nextFilters.status
        || prev.categoryId !== nextFilters.categoryId

      if (!changed) return prev

      return {
        ...prev,
        ...nextFilters,
        page: 1,
      }
    })
  }

  const handlePageChange = (nextPage: number) => {
    setQueryState((prev) => {
      const page = Math.min(Math.max(nextPage, 1), Math.max(1, pagination.totalPages))
      if (page === prev.page) return prev
      return { ...prev, page }
    })
  }

  const deletePost = async (id: string) => {
    try {
      setDeletingId(id)
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: '成功', description: '文章已删除' })
        setRefreshToken((prev) => prev + 1)
      } else {
        const data = await res.json()
        toast({ title: '错误', description: data.error || '删除失败', variant: 'destructive' })
      }
    } catch (error) {
      console.error('删除文章失败:', error)
      toast({ title: '错误', description: '删除失败', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
          <p className="text-muted-foreground">管理您的博客文章</p>
        </div>
        <Link href="/admin/posts/editor">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建文章
          </Button>
        </Link>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总文章数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">公开</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">草稿</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总评论数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.comments}</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <PostsFilters
            categories={categories}
            initialQuery={queryState.query}
            initialStatus={queryState.status}
            initialCategoryId={queryState.categoryId}
            onChange={handleFiltersChange}
            loading={loading}
          />
        </CardHeader>
      </Card>

      {/* 文章列表 */}
      <Card>
        <CardContent className="p-0">
          <div className={cn('relative', overlayVisible && 'opacity-70 transition-opacity')}>
            {overlayVisible && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 text-sm text-gray-500 backdrop-blur-sm dark:bg-gray-900/40">
                正在更新筛选结果...
              </div>
            )}
            {posts.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                暂无文章
                <div className="mt-2">
                  <Link href="/admin/posts/new">
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      创建第一篇文章
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile list */}
                <div className="space-y-3 p-4 md:hidden">
                  {posts.map((post) => (
                    <div key={post.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {post.title}
                          </div>
                          {post.excerpt && (
                            <div className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                              {post.excerpt}
                            </div>
                          )}
                        </div>
                        <span
                          className={`shrink-0 inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            post.status === 'PUBLISHED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : post.status === 'DRAFT'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {post.status === 'PUBLISHED'
                            ? '公开'
                            : post.status === 'DRAFT'
                            ? '草稿'
                            : '隐藏'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>分类：{post.category?.name || '-'}</span>
                        <span>评论：{post._count.comments}</span>
                        <span>发布：{post.publishedAt ? formatDateLabel(post.publishedAt) : '-'}</span>
                        <span>更新：{formatDateLabel(post.updatedAt)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Link href={`/admin/posts/editor?id=${post.id}`}>
                          <Button size="sm" variant="ghost">
                            编辑
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" disabled={deletingId === post.id}>
                              删除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>删除文章</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除这篇文章吗？此操作不可撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePost(post.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                确定删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                      <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
                        <th className="px-6 py-3 font-medium">标题</th>
                        <th className="px-6 py-3 font-medium">状态</th>
                        <th className="px-6 py-3 font-medium">分类</th>
                        <th className="px-6 py-3 font-medium">作者</th>
                        <th className="px-6 py-3 font-medium">评论</th>
                        <th className="px-6 py-3 font-medium">创建时间</th>
                        <th className="px-6 py-3 font-medium">发布时间</th>
                        <th className="px-6 py-3 font-medium">最后编辑</th>
                        <th className="px-6 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {posts.map((post) => (
                        <tr
                          key={post.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {post.title}
                              </div>
                              {post.excerpt && (
                                <div className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
                                  {post.excerpt}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                post.status === 'PUBLISHED'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : post.status === 'DRAFT'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {post.status === 'PUBLISHED'
                                ? '公开'
                                : post.status === 'DRAFT'
                                ? '草稿'
                                : '隐藏'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {post.category?.name || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {post.author.name || post.author.email}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {post._count.comments}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {formatDateLabel(post.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {post.publishedAt ? formatDateLabel(post.publishedAt) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {formatDateLabel(post.updatedAt)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/posts/editor?id=${post.id}`}>
                                <Button size="sm" variant="ghost">
                                  编辑
                                </Button>
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" disabled={deletingId === post.id}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>删除文章</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      确定要删除这篇文章吗？此操作不可撤销。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePost(post.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      确定删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              共 {pagination.total} 篇，当前第 {pagination.page} / {pagination.totalPages} 页
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={loading || pagination.page <= 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={loading || pagination.page >= pagination.totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
