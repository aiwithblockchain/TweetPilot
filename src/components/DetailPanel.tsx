import type { SidebarItem, View } from '@/config/layout'

interface DetailPanelProps {
  view: View
  item: SidebarItem | null
}

const DETAIL_COPY: Record<View, Record<string, { title: string; description: string; bullets: string[] }>> = {
  workspace: {
    'ws-default': {
      title: 'TweetPilot 工作区',
      description: '当前主工作区概览，聚合重构进度、布局状态与当前关注重点。',
      bullets: ['VSCode 风格四栏布局已落地', '右侧 Claude 面板支持折叠与宽度拖拽', '实例状态已接入真实数据刷新'],
    },
    'ws-assets': {
      title: '资源面板',
      description: '用于查看组件、样式与布局资源的组织方式。',
      bullets: ['组件已拆分为 TitleBar / Sidebar / RightPanel', '布局变量与主题色已集中在样式文件', '后续可继续拆分 App.tsx 状态管理'],
    },
    'ws-notes': {
      title: '重构说明',
      description: '记录 P0-14 UI 重构方案的落地情况与剩余工作。',
      bullets: ['阶段 1-5 已基本完成', '阶段 6 仍可继续补响应式细节', '文档已与当前实现同步'],
    },
  },
  accounts: {
    'acc-main': {
      title: '@tweetpilot_main',
      description: '主账号面板占位，可扩展为账号资料、运行状态与操作入口。',
      bullets: ['状态：在线', '用途：主运营账号', '后续可接入真实账号详情页'],
    },
    'acc-growth': {
      title: '@tweetpilot_growth',
      description: '增长账号面板占位，适合展示增长任务与数据摘要。',
      bullets: ['状态：空闲', '用途：增长实验账号', '后续可接入任务、标签、统计信息'],
    },
    'acc-backup': {
      title: '@tweetpilot_backup',
      description: '备用账号面板占位，用于风险切换或临时任务。',
      bullets: ['状态：离线', '用途：备用账号', '后续可接入重连与状态诊断'],
    },
  },
  'data-blocks': {
    'db-trending': {
      title: 'Trending Topics',
      description: '查看热点追踪卡片的布局说明与用途。',
      bullets: ['适合展示趋势话题', '可继续接入 DataBlocks 页面数据', '当前为中心详情占位卡'],
    },
    'db-mentions': {
      title: 'Mentions Monitor',
      description: '展示互动监控相关的信息层级。',
      bullets: ['适合展示提及与回复', '可延伸为告警流', '当前为布局联动示例'],
    },
    'db-content': {
      title: 'Content Queue',
      description: '内容候选池面板，用于展示待发布内容摘要。',
      bullets: ['适合展示草稿与候选内容', '可与任务计划联动', '当前为布局占位'],
    },
  },
  tasks: {
    'task-publish': {
      title: '定时发布任务',
      description: '当前关注的是调度与发布时间配置。',
      bullets: ['今天 18:00 自动执行', '可与任务管理页配合使用', '适合展示历史执行记录'],
    },
    'task-sync': {
      title: '账号同步任务',
      description: '聚焦 LocalBridge 数据同步与刷新频率。',
      bullets: ['60 秒轮询一次', '与实例状态刷新节奏一致', '可继续补失败重试策略'],
    },
    'task-review': {
      title: '内容审核任务',
      description: '内容审核工作流占位，适合接入审核列表与结果面板。',
      bullets: ['当前待处理 3 条', '可扩展为批量审核操作', '可与 Claude 面板形成协作流'],
    },
  },
  settings: {
    'setting-account': {
      title: '账号设置',
      description: '设置页已切换为 Google 登录 Mock 版本。',
      bullets: ['支持登录 / 登出切换', '显示订阅等级与 token 配额', '符合文档阶段 5 的要求'],
    },
    'setting-system': {
      title: '系统偏好',
      description: '管理语言、主题与 LocalBridge 配置。',
      bullets: ['支持语言与主题切换', '支持 LocalBridge endpoint 配置', '后续可补更多偏好项'],
    },
  },
}

export function DetailPanel({ view, item }: DetailPanelProps) {
  const fallbackItem = item ?? {
    id: 'default',
    label: '未选择项目',
    description: '请从左侧列表中选择一项查看详情。',
  }

  const detail = item ? DETAIL_COPY[view][item.id] : null

  if (!detail) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{fallbackItem.label}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{fallbackItem.description}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{detail.title}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-6">{detail.description}</p>
      </div>

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-sm font-semibold text-[var(--color-text)] mb-3">详情说明</div>
        <ul className="space-y-2 text-xs text-[var(--color-text-secondary)] leading-5">
          {detail.bullets.map((bullet) => (
            <li key={bullet}>• {bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
