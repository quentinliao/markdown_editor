import { useEffect, useRef } from 'react'
import { Message } from '../../store/aiStore'

export function MessageList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            msg.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
          }`}>
            {msg.content || '...'}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
