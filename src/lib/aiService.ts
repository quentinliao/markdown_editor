import { AiConfig, Message } from '../store/aiStore'

export async function streamChat(
  config: AiConfig,
  systemPrompt: string,
  messages: Message[],
  onChunk: (chunk: string) => void,
): Promise<void> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
          .filter((m) => m.content)
          .map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const data = JSON.parse(line.slice(6))
        const chunk = data.choices?.[0]?.delta?.content
        if (chunk) onChunk(chunk)
      } catch { /* skip malformed lines */ }
    }
  }
}
