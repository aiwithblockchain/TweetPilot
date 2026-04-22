export default function AccountManagement() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">账号管理</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-6">
          账号管理功能正在重构中，即将推出新的账号管理界面。
        </p>
      </div>

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-secondary)]">
        新的账号管理系统将基于 LocalBridge 实例和推特账号信息重新设计。
      </div>
    </div>
  )
}
