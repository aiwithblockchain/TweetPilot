import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskCreatePane } from './TaskCreatePane'

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getManagedAccountsForTaskSelection: vi.fn(),
}))

vi.mock('@/services', () => ({
  taskService: {
    createTask: mocks.createTask,
    updateTask: mocks.updateTask,
  },
  getManagedAccountsForTaskSelection: mocks.getManagedAccountsForTaskSelection,
}))

vi.mock('./ScriptSelector', () => ({
  ScriptSelector: ({ value, onChange }: { value: string; onChange: (path: string) => void }) => (
    <div>
      <input
        aria-label="script-selector"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  ),
}))

vi.mock('./ParameterEditor', () => ({
  ParameterEditor: ({ value, onChange }: { value: Record<string, string>; onChange: (value: Record<string, string>) => void }) => (
    <button type="button" onClick={() => onChange({ ...value, topic: 'ai' })}>
      编辑参数
    </button>
  ),
}))

afterEach(() => {
  cleanup()
})

describe('TaskCreatePane', () => {
  beforeEach(() => {
    mocks.createTask.mockReset()
    mocks.updateTask.mockReset()
    mocks.getManagedAccountsForTaskSelection.mockReset()

    mocks.createTask.mockResolvedValue({ id: 'task-1' })
    mocks.updateTask.mockResolvedValue(undefined)
    mocks.getManagedAccountsForTaskSelection.mockResolvedValue([
      {
        twitterId: 'acct-1',
        displayName: 'Claude Account',
        screenName: 'claude_account',
      },
    ])
  })

  it('shows persona controls for AI session tasks with selected account', async () => {
    render(<TaskCreatePane />)

    fireEvent.click(screen.getByText('AI Session'))

    const accountSelect = await screen.findByDisplayValue('不指定账号')
    fireEvent.change(accountSelect, { target: { value: 'acct-1' } })

    expect(screen.getByText('附加账号人格提示词')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByPlaceholderText('输入该账号的人格设定、语气偏好、内容边界等')).toBeTruthy()
  })

  it('requires script path only in script mode', async () => {
    render(<TaskCreatePane />)

    fireEvent.change(screen.getByPlaceholderText('输入任务名称'), { target: { value: 'Script Task' } })
    fireEvent.click(screen.getByText('创建任务'))

    expect(await screen.findByText('请选择 Python 脚本')).toBeTruthy()
    expect(mocks.createTask).not.toHaveBeenCalled()
  })

  it('submits AI session task payload without script path and includes persona fields', async () => {
    render(<TaskCreatePane />)

    fireEvent.click(screen.getByText('AI Session'))
    fireEvent.change(screen.getByPlaceholderText('输入任务名称'), { target: { value: 'AI Task' } })
    fireEvent.change(
      screen.getByPlaceholderText('描述你希望 AI 完成什么任务、可以使用哪些工具、结果输出要求是什么'),
      { target: { value: '请生成一条推文并保存输出' } },
    )

    const accountSelect = await screen.findByDisplayValue('不指定账号')
    fireEvent.change(accountSelect, { target: { value: 'acct-1' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByPlaceholderText('输入该账号的人格设定、语气偏好、内容边界等'), {
      target: { value: '保持专业、简洁、乐观' },
    })

    fireEvent.click(screen.getByText('编辑参数'))
    fireEvent.click(screen.getByText('创建任务'))

    await waitFor(() => {
      expect(mocks.createTask).toHaveBeenCalledTimes(1)
    })

    expect(mocks.createTask).toHaveBeenCalledWith({
      name: 'AI Task',
      description: '请生成一条推文并保存输出',
      taskType: 'immediate',
      executionMode: 'ai_session',
      usePersona: true,
      personaPrompt: '保持专业、简洁、乐观',
      scriptPath: '',
      scheduleType: undefined,
      schedule: undefined,
      intervalSeconds: undefined,
      parameters: { topic: 'ai' },
      accountId: 'acct-1',
      timeout: undefined,
      retryCount: undefined,
      retryDelay: undefined,
      tags: undefined,
    })
  })
})
