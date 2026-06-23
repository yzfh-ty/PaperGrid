import { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  })

  if (existingAdmin) {
    console.log('✅ 默认管理员账号已存在')
  } else {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10)

    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin',
        password: hashedPassword,
        role: 'ADMIN',
      },
    })

    console.log('✅ 默认管理员账号创建成功!')
    console.log('邮箱: admin@example.com')
    console.log('密码: admin123')
  }

  // 创建默认系统设置
  type SeedSetting = {
    key: string
    value: Prisma.InputJsonValue
    group: string
    editable: boolean
    secret?: boolean
  }

  const settings: SeedSetting[] = [
    { key: 'site.title', value: { title: '执笔为剑' }, group: 'site', editable: true },
    { key: 'site.description', value: { description: 'A minimalist blog powered by Next.js' }, group: 'site', editable: true },
    { key: 'site.ownerName', value: { name: '千叶' }, group: 'site', editable: true },
    { key: 'site.logoUrl', value: { url: '' }, group: 'site', editable: true },
    { key: 'site.faviconUrl', value: { url: '' }, group: 'site', editable: true },
    { key: 'posts.perPage', value: { perPage: 10 }, group: 'display', editable: true },
    { key: 'site.defaultTheme', value: { theme: 'system' }, group: 'display', editable: true },
    { key: 'site.defaultAvatarUrl', value: { url: '' }, group: 'site', editable: true },
    { key: 'ui.hideAdminEntry', value: { enabled: false }, group: 'ui', editable: true },
    { key: 'ui.mobileReadingBackground', value: { style: 'grid' }, group: 'ui', editable: true },
    { key: 'hero.typingTitles', value: { text: '欢迎来到我的博客\n探索技术的无限可能\n记录成长的点点滴滴\n分享代码与生活的美好' }, group: 'hero', editable: true },
    { key: 'hero.subtitle', value: { text: '全栈开发者 / 开源爱好者 / 终身学习者' }, group: 'hero', editable: true },
    { key: 'hero.location', value: { text: '中国 · 热爱技术' }, group: 'hero', editable: true },
    { key: 'profile.tagline', value: { text: '全栈开发者 / 技术分享' }, group: 'profile', editable: true },
    { key: 'profile.signature', value: { text: '“热爱技术, 喜欢分享。这里记录我的学习和成长过程。”' }, group: 'profile', editable: true },
    { key: 'profile.role', value: { text: '全栈开发者' }, group: 'profile', editable: true },
    { key: 'profile.location', value: { text: '中国' }, group: 'profile', editable: true },
    { key: 'profile.joinedYear', value: { text: '2024' }, group: 'profile', editable: true },
    { key: 'profile.bio', value: { text: '你好!我是一名热爱技术的全栈开发者,专注于构建优雅、高效的 Web 应用程序。\n这个博客是我记录学习过程、分享技术心得和生活感悟的地方。\n\n我相信技术的力量可以改变世界,也相信持续学习是保持竞争力的关键。\n在这里,我会分享我在开发过程中遇到的问题、解决方案以及一些有趣的项目。' }, group: 'profile', editable: true },
    { key: 'profile.techStack', value: { text: '前端开发: React, Next.js, TypeScript, TailwindCSS, Vue.js\n后端开发: Node.js, Python, PostgreSQL, MongoDB, Redis\nDevOps & 工具: Docker, Git, AWS, Linux, Nginx' }, group: 'profile', editable: true },
    { key: 'profile.hobbies', value: { text: '📚 阅读技术书籍和科幻小说\n🎮 玩独立游戏\n📷 摄影和旅行\n🎵 听音乐和学习新乐器\n☕ 咖啡探索' }, group: 'profile', editable: true },
    { key: 'profile.contactIntro', value: { text: '如果你想与我交流技术问题、合作项目,或者只是打个招呼,欢迎通过以下方式联系我:' }, group: 'profile', editable: true },
    { key: 'profile.contactEmail', value: { text: '' }, group: 'profile', editable: true },
    { key: 'profile.contactGithub', value: { text: 'https://github.com/xywml/PaperGrid' }, group: 'profile', editable: true },
    { key: 'profile.contactX', value: { text: '' }, group: 'profile', editable: true },
    { key: 'profile.contactBilibili', value: { text: '' }, group: 'profile', editable: true },
    { key: 'profile.contactQQ', value: { text: '' }, group: 'profile', editable: true },
    { key: 'profile.social.github.enabled', value: { enabled: true }, group: 'profile', editable: true },
    { key: 'profile.social.x.enabled', value: { enabled: true }, group: 'profile', editable: true },
    { key: 'profile.social.bilibili.enabled', value: { enabled: true }, group: 'profile', editable: true },
    { key: 'profile.social.email.enabled', value: { enabled: true }, group: 'profile', editable: true },
    { key: 'profile.social.qq.enabled', value: { enabled: true }, group: 'profile', editable: true },
    { key: 'comments.enabled', value: { enabled: true }, group: 'comments', editable: true },
    { key: 'comments.moderationRequired', value: { moderationRequired: false }, group: 'comments', editable: true },
    { key: 'comments.allowGuest', value: { enabled: false }, group: 'comments', editable: true },
    { key: 'comments.guestModerationRequired', value: { enabled: false }, group: 'comments', editable: true },
    { key: 'auth.allowRegistration', value: { allow: true }, group: 'auth', editable: true },
    { key: 'email.enabled', value: { enabled: false }, group: 'email', editable: true },
    { key: 'email.from', value: { from: 'PaperGrid 通知' }, group: 'email', editable: true },
    { key: 'email.reply.enabled', value: { enabled: true }, group: 'email', editable: true },
    { key: 'email.reply.requireApproved', value: { enabled: true }, group: 'email', editable: true },
    { key: 'email.reply.unsubscribeEnabled', value: { enabled: true }, group: 'email', editable: true },
    { key: 'email.reply.unsubscribeList', value: { text: '' }, group: 'email', editable: false },
    // AI 设置（单机 + OpenAI 兼容）
    { key: 'ai.enabled', value: { value: false }, group: 'ai', editable: true },
    { key: 'ai.provider', value: { value: 'openai-compatible' }, group: 'ai', editable: true },
    { key: 'ai.openai.baseUrl', value: { value: '' }, group: 'ai', editable: true },
    { key: 'ai.openai.apiKey', value: { value: '' }, group: 'ai', editable: false, secret: true },
    { key: 'ai.chat.model', value: { value: 'gpt-4o-mini' }, group: 'ai', editable: true },
    { key: 'ai.embedding.model', value: { value: 'text-embedding-3-small' }, group: 'ai', editable: true },
    { key: 'ai.embedding.dimensions', value: { value: 1536 }, group: 'ai', editable: true },
    { key: 'ai.rag.topK', value: { value: 8 }, group: 'ai', editable: true },
    { key: 'ai.rag.minScore', value: { value: 0.2 }, group: 'ai', editable: true },
    { key: 'ai.answer.maxTokens', value: { value: 32768 }, group: 'ai', editable: true },
    // 页脚设置
    { key: 'site.footer_icp', value: { value: '蜀ICP备xxxx' }, group: 'site', editable: true },
    { key: 'site.footer_mps', value: { value: '' }, group: 'site', editable: true },
    { key: 'site.footer_copyright_start_year', value: { value: '' }, group: 'site', editable: true },
    { key: 'site.footer_copyright_name', value: { value: 'xywml' }, group: 'site', editable: true },
    { key: 'site.footer_copyright_url', value: { value: 'https://xywml.com/' }, group: 'site', editable: true },
    { key: 'site.footer_powered_by_enabled', value: { enabled: true }, group: 'site', editable: true },
    { key: 'site.footer_custom_html', value: { text: '' }, group: 'site', editable: true },
    { key: 'site.footer_powered_by', value: { value: 'by xywml' }, group: 'site', editable: true },
    // Gotify 通知默认配置
    { key: 'notifications.gotify.enabled', value: { enabled: false }, group: 'notifications', editable: true },
    { key: 'notifications.gotify.url', value: { url: '' }, group: 'notifications', editable: true },
    { key: 'notifications.gotify.notifyNewComment', value: { enabled: true }, group: 'notifications', editable: true },
    { key: 'notifications.gotify.notifyPendingComment', value: { enabled: true }, group: 'notifications', editable: true },
    // token 为 secret，不能通过通用 PATCH 更新（可通过单独接口设置）
    { key: 'notifications.gotify.token', value: { token: '' }, group: 'notifications', editable: false, secret: true },
    // 管理员初始化提示
    { key: 'admin.initialSetup', value: { enabled: true }, group: 'admin', editable: true },
  ]

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      // 保留已有配置值，避免重复 seed 时覆盖管理员在后台保存的设置。
      update: { group: s.group, editable: s.editable, secret: s.secret ?? false },
      create: s,
    })
  }
}

main()
  .catch((e) => {
    console.error('❌ 创建失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
