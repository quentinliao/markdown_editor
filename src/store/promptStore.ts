import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PromptTemplate {
  id: string
  name: string
  icon: string
  systemPrompt: string
  quickActions: { label: string; prompt: string }[]
  isBuiltIn?: boolean
}

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'default',
    name: '写作助手',
    icon: '✍️',
    systemPrompt:
      '你是一个专业的 Markdown 写作助手。用户的当前文档内容会作为"📎 引用文件"附在每条消息中。\n\n你可以直接阅读和编辑文档。重要规则：\n- 当用户要求创建新文档（如 PRD、方案、报告等），直接输出完整的 Markdown 内容，不要加多余的解释或包裹。用户会通过操作按钮将内容应用到文档。\n- 当用户要求修改当前文档，直接输出修改后的完整 Markdown 内容。\n- 当用户只是提问或讨论，正常回答即可。\n- 保持 Markdown 格式规范，使用清晰的标题层级。',
    quickActions: [
      { label: '续写', prompt: '请根据上下文继续写作' },
      { label: '润色', prompt: '请润色以下文字，使其更流畅自然' },
      { label: '扩写', prompt: '请对以下内容进行详细扩写' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'translator',
    name: '翻译助手',
    icon: '🌐',
    systemPrompt:
      '你是一个翻译助手。用户会提供 Markdown 格式的文本，请保持 Markdown 格式进行翻译。默认翻译为英文，除非用户指定其他语言。',
    quickActions: [
      { label: '译为英文', prompt: '请将以下内容翻译成英文' },
      { label: '译为中文', prompt: '请将以下内容翻译成中文' },
      { label: '译为日文', prompt: '请将以下内容翻译成日文' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'summarizer',
    name: '摘要生成',
    icon: '📝',
    systemPrompt:
      '你是一个摘要生成助手。根据用户提供的文档，生成简洁、准确的摘要。保持 Markdown 格式。',
    quickActions: [
      { label: '简洁摘要', prompt: '请生成简洁摘要（100字以内）' },
      { label: '详细摘要', prompt: '请生成详细摘要，包含关键要点' },
      { label: '要点列表', prompt: '请提取文档的关键要点，以列表形式呈现' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'coder',
    name: '代码助手',
    icon: '💻',
    systemPrompt:
      '你是一个技术文档和代码助手。帮助用户编写技术文档、生成代码示例、解释技术概念。输出保持 Markdown 格式，代码块使用正确的语言标识。',
    quickActions: [
      { label: '生成文档', prompt: '请为以下代码生成技术文档' },
      { label: '代码示例', prompt: '请提供相关的代码示例' },
      { label: '技术解释', prompt: '请用通俗易懂的语言解释以下技术概念' },
    ],
    isBuiltIn: true,
  },
]

interface PromptState {
  templates: PromptTemplate[]
  activeTemplateId: string

  setActiveTemplate: (id: string) => void
  getActiveTemplate: () => PromptTemplate
  addTemplate: (template: Omit<PromptTemplate, 'id' | 'isBuiltIn'>) => void
  updateTemplate: (id: string, updates: Partial<PromptTemplate>) => void
  deleteTemplate: (id: string) => void
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      templates: BUILTIN_TEMPLATES,
      activeTemplateId: 'default',

      setActiveTemplate: (id) => set({ activeTemplateId: id }),

      getActiveTemplate: () => {
        const { templates, activeTemplateId } = get()
        return templates.find((t) => t.id === activeTemplateId) ?? templates[0]
      },

      addTemplate: (template) => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
        set((s) => ({
          templates: [...s.templates, { ...template, id, isBuiltIn: false }],
        }))
      },

      updateTemplate: (id, updates) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id && !t.isBuiltIn ? { ...t, ...updates } : t,
          ),
        })),

      deleteTemplate: (id) =>
        set((s) => {
          const target = s.templates.find((t) => t.id === id)
          if (target?.isBuiltIn) return s
          return {
            templates: s.templates.filter((t) => t.id !== id),
            activeTemplateId: s.activeTemplateId === id ? 'default' : s.activeTemplateId,
          }
        }),
    }),
    {
      name: 'prompt-store',
      partialize: (s) => ({
        templates: s.templates.filter((t) => !t.isBuiltIn),
        activeTemplateId: s.activeTemplateId,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<PromptState>
        const customTemplates = p.templates?.filter((t) => !t.isBuiltIn) ?? []
        return {
          ...current,
          templates: [...BUILTIN_TEMPLATES, ...customTemplates],
          activeTemplateId: p.activeTemplateId ?? 'default',
        }
      },
    },
  ),
)
