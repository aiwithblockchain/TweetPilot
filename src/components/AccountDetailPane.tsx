import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import type { SidebarItem } from '@/config/layout'
import type { AccountDetail } from '@/services/account'
import { addAccountToManagement, deleteAccountCompletely, getAccountDetail, removeAccountFromManagement, updateAccountPersonalityPrompt } from '@/services/account'
import type { AppInstance } from '@/types/layout'

interface AccountDetailPaneProps {
  item: SidebarItem | null
  instances: AppInstance[]
  onAccountsMutated?: () => Promise<void>
  onAccountSelectionCleared?: () => void
}

export function AccountDetailPane({ item, onAccountsMutated, onAccountSelectionCleared }: AccountDetailPaneProps) {
  console.log('[AccountDetailPane] Component rendered with item:', item ? { id: item.id, label: item.label } : null)
  const toast = useToast()
  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptValue, setPromptValue] = useState('')

  const loadDetail = async (twitterId: string) => {
    setLoading(true)
    setError(null)
    try {
      const nextDetail = await getAccountDetail(twitterId)
      setDetail(nextDetail)
    } catch (loadError) {
      setDetail(null)
      setError(loadError instanceof Error ? loadError.message : '账号详情加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('[AccountDetailPane] useEffect triggered, item.id:', item?.id)
    let cancelled = false

    const run = async () => {
      if (!item) {
        console.log('[AccountDetailPane] No item, clearing state')
        setDetail(null)
        setError(null)
        setLoading(false)
        setEditingPrompt(false)
        return
      }

      console.log('[AccountDetailPane] Calling getAccountDetail for:', item.id)
      setLoading(true)
      setError(null)

      try {
        const nextDetail = await getAccountDetail(item.id)
        console.log('[AccountDetailPane] getAccountDetail success:', nextDetail)
        if (!cancelled) {
          setDetail(nextDetail)
          setPromptValue(nextDetail.account.personalityPrompt || '')
          setEditingPrompt(false)
        }
      } catch (loadError) {
        console.error('[AccountDetailPane] getAccountDetail failed:', loadError)
        if (!cancelled) {
          setDetail(null)
          setError(loadError instanceof Error ? loadError.message : '账号详情加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [item?.id])

  const reloadDetail = async () => {
    if (!item) return
    await loadDetail(item.id)
  }

  const sourceLabel = useMemo(() => {
    if (!detail) return null
    if (detail.account.isManaged) {
      return '当前已管理账号'
    }
    return detail.account.source === 'managed-db' ? '历史管理账号' : '未管理在线账号'
  }, [detail])

  if (!item) {
    return <EmptyState title="推特账号" description="请先在左侧选择一个推特账号，再在中间查看账号详情。" />
  }

  if (loading) {
    return <MessageState message="正在加载账号详情..." />
  }

  if (error) {
    return <MessageState message={error} tone="error" />
  }

  if (!detail) {
    return <MessageState message="未找到账号详情。" tone="error" />
  }

  const latestTrend = detail.latestTrend

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center">
          {latestTrend?.avatarUrl ? (
            <img src={latestTrend.avatarUrl} alt={latestTrend.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl text-[var(--color-text-secondary)]">?</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-[var(--color-text)] truncate">{latestTrend?.displayName || item.label}</h2>
            {sourceLabel && (
              <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                {sourceLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 truncate">
            {latestTrend?.screenName ? `@${latestTrend.screenName}` : item.description}
          </p>
        </div>
      </div>

      <Section title="账号基础信息">
        <InfoGrid
          items={[
            ['Twitter ID', detail.account.twitterId],
            ['管理状态', detail.account.isManaged ? '当前已管理' : '未管理'],
            ['实例 ID', detail.account.instanceId ?? '—'],
            ['扩展名称', detail.account.extensionName ?? '—'],
            ['管理时间', detail.account.managedAt ?? '—'],
            ['解除管理时间', detail.account.unmanagedAt ?? '—'],
            ['更新时间', detail.account.updatedAt ?? '—'],
          ]}
        />
        {detail.account.source === 'managed-db' && (
          <div className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-[var(--color-text-secondary)]">性格提示词</div>
              {!editingPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPrompt(true)
                    setPromptValue(detail.account.personalityPrompt || '')
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] transition-colors"
                >
                  编辑
                </button>
              )}
            </div>
            {editingPrompt ? (
              <div className="space-y-2">
                <textarea
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className="w-full min-h-[80px] px-2 py-1.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] resize-y"
                  placeholder="输入性格提示词..."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await updateAccountPersonalityPrompt(detail.account.twitterId, promptValue || undefined)
                      toast.success('性格提示词已保存')
                      setEditingPrompt(false)
                      await Promise.all([
                        reloadDetail(),
                        onAccountsMutated ? onAccountsMutated() : Promise.resolve(),
                      ])
                    }}
                    className="px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] transition-colors"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrompt(false)
                      setPromptValue(detail.account.personalityPrompt || '')
                    }}
                    className="px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] transition-colors"
                  >
                    取消
                  </button>
                  {promptValue && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateAccountPersonalityPrompt(detail.account.twitterId, undefined)
                        toast.success('性格提示词已删除')
                        setEditingPrompt(false)
                        setPromptValue('')
                        await Promise.all([
                          reloadDetail(),
                          onAccountsMutated ? onAccountsMutated() : Promise.resolve(),
                        ])
                      }}
                      className="px-3 py-1.5 rounded border border-red-800/50 bg-red-950/30 text-xs text-[#F48771] hover:bg-red-950/50 transition-colors"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--color-text)] break-words whitespace-pre-wrap">
                {detail.account.personalityPrompt || '未设置'}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="最新账号信息">
        <InfoGrid
          items={[
            ['粉丝数', formatNumber(latestTrend?.followersCount)],
            ['关注数', formatNumber(latestTrend?.followingCount)],
            ['推文数', formatNumber(latestTrend?.tweetCount)],
            ['点赞数', formatNumber(latestTrend?.favouritesCount)],
            ['被收录数', formatNumber(latestTrend?.listedCount)],
            ['媒体数', formatNumber(latestTrend?.mediaCount)],
            ['最近在线', latestTrend?.lastOnlineTime ?? '—'],
            ['账号创建时间', latestTrend?.accountCreatedAt ?? '—'],
            ['个人简介', latestTrend?.description ?? '—'],
          ]}
        />
      </Section>

      <Section title="管理动作">
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-secondary)] space-y-3">
          <p>当前阶段支持通过后端 API 进行加入管理、解除管理、性格提示词更新与彻底删除。</p>
          <div className="flex flex-wrap gap-2">
            {detail.account.source === 'unmanaged-memory' || !detail.account.isManaged ? (
              <ActionButton
                label="加入管理"
                onClick={async () => {
                  await addAccountToManagement(detail.account.twitterId)
                  toast.success('账号已加入管理')
                  await (onAccountsMutated ? onAccountsMutated() : Promise.resolve())
                  // 重新加载详情，不清除选中状态
                  await reloadDetail()
                }}
              />
            ) : (
              <>
                <ActionButton
                  label="解除管理"
                  onClick={async () => {
                    await removeAccountFromManagement(detail.account.twitterId)
                    toast.success('账号已解除管理')
                    await Promise.all([
                      onAccountsMutated ? onAccountsMutated() : Promise.resolve(),
                    ])
                    onAccountSelectionCleared?.()
                  }}
                />
                <ActionButton
                  label="彻底删除"
                  danger
                  onClick={async () => {
                    await deleteAccountCompletely(detail.account.twitterId)
                    toast.success('账号已删除')
                    await Promise.all([
                      onAccountsMutated ? onAccountsMutated() : Promise.resolve(),
                    ])
                    onAccountSelectionCleared?.()
                  }}
                />
              </>
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  danger = false,
}: {
  label: string
  onClick: () => Promise<void>
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick()
      }}
      className={[
        'px-3 py-1.5 rounded border text-xs transition-colors cursor-pointer',
        danger
          ? 'border-red-800/50 bg-red-950/30 text-[#F48771] hover:bg-red-950/50'
          : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      {children}
    </section>
  )
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-[11px] text-[var(--color-text-secondary)] mb-1">{label}</div>
          <div className="text-sm text-[var(--color-text)] break-words">{value}</div>
        </div>
      ))}
    </div>
  )
}

function formatNumber(value?: number) {
  if (typeof value !== 'number') return '—'
  return new Intl.NumberFormat('zh-CN').format(value)
}

function MessageState({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div
        className={[
          'max-w-md text-center rounded border px-6 py-8 text-sm',
          tone === 'error'
            ? 'border-red-800/50 bg-red-950/30 text-[#F48771]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
        ].join(' ')}
      >
        {message}
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <MessageState message={`${title}：${description}`} />
}
