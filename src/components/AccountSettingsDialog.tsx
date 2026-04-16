import { useState, useEffect } from 'react'
import { accountService } from '@/services'
import type { AccountSettings } from '@/services/account'

interface AccountSettingsDialogProps {
  screenName: string
  onClose: () => void
  onAccountDeleted: () => void
}

export default function AccountSettingsDialog({
  screenName,
  onClose,
  onAccountDeleted,
}: AccountSettingsDialogProps) {
  const [settings, setSettings] = useState<AccountSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [personality, setPersonality] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0)

  useEffect(() => {
    loadAccountSettings()
  }, [screenName])

  const loadAccountSettings = async () => {
    try {
      const result = await accountService.getAccountSettings(screenName)
      setSettings(result)
      setPersonality(result.personality)
    } catch (error) {
      console.error('Failed to load account settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePersonalityChange = (value: string) => {
    setPersonality(value)
    setHasChanges(value !== settings?.personality)
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      await accountService.saveAccountPersonality(screenName, personality)
      setSettings({ ...settings, personality })
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save personality:', error)
      alert('保存失败: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await loadAccountSettings()
  }

  const handleUnlink = async () => {
    if (!confirm(`确定要解除 ${screenName} 的绑定吗？本软件将不再管理此账号。`)) {
      return
    }

    try {
      await accountService.unlinkAccount(screenName)
      onAccountDeleted()
    } catch (error) {
      console.error('Failed to unlink account:', error)
      alert('解除绑定失败: ' + (error as Error).message)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1)
      return
    }

    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2)
      return
    }

    // Step 2: Actually delete
    try {
      await accountService.deleteAccountCompletely(screenName)
      onAccountDeleted()
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('删除失败: ' + (error as Error).message)
      setDeleteConfirmStep(0)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmStep(0)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl p-6">
          <div className="text-center text-sm text-secondary">加载中...</div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">账号设置</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Basic Info */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <img
                src={settings.avatar}
                alt={settings.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="text-base font-semibold">{settings.name}</div>
                <div className="text-sm text-secondary">{settings.screenName}</div>
              </div>
              <button
                onClick={handleRefresh}
                className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
              >
                刷新
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-secondary mb-1">Twitter ID</div>
                <div className="font-mono">{settings.twitterId}</div>
              </div>
              <div>
                <div className="text-secondary mb-1">链接状态</div>
                <div className={settings.isLinked ? 'text-green-500' : 'text-secondary'}>
                  {settings.isLinked ? '已链接' : '未链接'}
                </div>
              </div>
              {settings.isLinked && settings.extensionId && (
                <>
                  <div>
                    <div className="text-secondary mb-1">扩展 ID</div>
                    <div className="font-mono text-xs">{settings.extensionId}</div>
                  </div>
                  <div>
                    <div className="text-secondary mb-1">扩展名称</div>
                    <div>{settings.extensionName}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Personality */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              人物性格设置
              <span className="text-xs text-secondary ml-2">
                (用于 AI 交互时的提示词)
              </span>
            </label>
            <textarea
              value={personality}
              onChange={(e) => handlePersonalityChange(e.target.value)}
              placeholder="描述此账号的人物性格、语言风格、发推特的习惯等..."
              className="w-full h-48 px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded resize-none focus:outline-none focus:border-[#6D5BF6] overflow-y-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(109, 91, 246, 0.3) transparent'
              }}
            />
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-2 h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            )}
          </div>

          {/* Danger Zone */}
          <div className="border border-red-500/30 rounded-lg p-4">
            <div className="text-sm font-semibold text-red-500 mb-3">危险操作</div>

            {deleteConfirmStep === 0 && (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={handleUnlink}
                    className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
                  >
                    解除绑定
                  </button>
                  <button
                    onClick={handleDelete}
                    className="h-8 px-3 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    彻底删除
                  </button>
                </div>
                <div className="text-xs text-secondary mt-2">
                  解除绑定：本软件不再管理此账号 | 彻底删除：删除账号及所有本地数据
                </div>
              </>
            )}

            {deleteConfirmStep === 1 && (
              <div className="bg-red-500/10 border border-red-500 rounded p-3">
                <div className="text-sm text-red-500 font-medium mb-2">
                  ⚠️ 确定要彻底删除 {screenName} 吗？
                </div>
                <div className="text-xs text-secondary mb-3">
                  该账号的本地数据积木也将被删除
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="h-8 px-3 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    继续删除
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {deleteConfirmStep === 2 && (
              <div className="bg-red-500/10 border border-red-500 rounded p-3">
                <div className="text-sm text-red-500 font-medium mb-2">
                  🚨 此操作不可恢复！
                </div>
                <div className="text-xs text-secondary mb-3">
                  确定要继续删除 {screenName} 吗？所有数据将永久丢失！
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="h-8 px-3 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-semibold"
                  >
                    确认删除
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
