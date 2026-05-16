import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { Message, MessageAttachment } from '../store/chatStore'

export type ApiFormat = 'openai' | 'anthropic'

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  apiFormat: ApiFormat
}

function buildMessageContent(
  text: string,
  attachments?: MessageAttachment[],
): string {
  if (!attachments || attachments.length === 0) return text

  const parts: string[] = [text, '', '---', '📎 引用文件:']
  for (const att of attachments) {
    parts.push(`\n### ${att.name}\n\`\`\`\n${att.content}\n\`\`\``)
  }
  return parts.join('\n')
}

export async function streamChat(
  config: ApiConfig,
  systemPrompt: string,
  messages: Message[],
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
  if (!config.baseUrl) throw new Error('请先在设置中配置 Base URL')

  const apiMessages = messages
    .filter((m) => m.content || (m.role === 'user' && m.attachments?.length))
    .map((m) => ({
      role: m.role,
      content: buildMessageContent(m.content, m.attachments),
    }))

  // Build request payload matching Rust's StreamRequest enum
  const request =
    config.apiFormat === 'anthropic'
      ? {
          format: 'anthropic' as const,
          url: `${config.baseUrl}/messages`,
          api_key: config.apiKey,
          model: config.model,
          system: systemPrompt,
          messages: apiMessages,
        }
      : {
          format: 'openai' as const,
          url: `${config.baseUrl}/chat/completions`,
          api_key: config.apiKey,
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...apiMessages,
          ],
        }

  let unlistenChunk: UnlistenFn | null = null
  let unlistenDone: UnlistenFn | null = null

  const cleanup = () => {
    unlistenChunk?.()
    unlistenDone?.()
  }

  return new Promise<void>(async (resolve, reject) => {
    let settled = false

    const finish = (err?: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    }

    try {
      // Listen for SSE chunks
      unlistenChunk = await listen<{ request_id: string; chunk: string }>(
        'chat:chunk',
        (event) => {
          onChunk(event.payload.chunk)
        },
      )

      // Listen for done event
      unlistenDone = await listen<{ request_id: string }>('chat:done', () => {
        finish()
      })

      // Invoke Rust command — it streams back via events
      await invoke('stream_chat_request', { request })
      // If invoke resolves without streaming (e.g. error path), finish
      finish()
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)
      finish(new Error(msg))
    }
  })
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  apiFormat: 'openai',
}

export const API_PRESETS: { label: string; baseUrl: string; model: string; format: ApiFormat }[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', format: 'openai' },
  { label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', format: 'anthropic' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', format: 'openai' },
  { label: 'MiniMax', baseUrl: 'https://api.minimaxi.com/anthropic/v1', model: 'MiniMax-M2.7', format: 'anthropic' },
  { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3', format: 'openai' },
]
