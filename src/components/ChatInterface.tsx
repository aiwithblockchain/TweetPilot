import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    content: '你好，我是 Claude。右侧面板目前是 UI 占位版本，后续会接入真实助手能力。',
  },
  {
    id: 'm2',
    role: 'user',
    content: '帮我看看当前 TweetPilot 的 VSCode 风格布局还差哪些细节。',
  },
  {
    id: 'm3',
    role: 'assistant',
    content: '目前已具备标题栏、活动栏、左右面板与 Tab 外壳，下一步建议补真实数据和交互联动。',
  },
]

export function ChatInterface() {
  const toast = useToast()
  const [value, setValue] = useState('')

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface)]">
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {MOCK_MESSAGES.map((message) => {
          const isAssistant = message.role === 'assistant'

          return (
            <div
              key={message.id}
              className={[
                'max-w-[85%] rounded-md px-3 py-2 text-xs leading-5',
                isAssistant
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'bg-[#007ACC] text-white ml-auto',
              ].join(' ')}
            >
              {message.content}
            </div>
          )
        })}
      </div>

      <div className="border-t border-[var(--color-border)] p-3 space-y-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="输入消息..."
          className="w-full min-h-[84px] resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:border-[#007ACC]"
        />

        <div className="flex items-center justify-between">
          <button className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">📎 附件</button>
          <button
            onClick={() => toast.info('功能开发中')}
            className="h-7 px-3 rounded bg-[#007ACC] text-white text-xs hover:bg-[#1485D1] transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
