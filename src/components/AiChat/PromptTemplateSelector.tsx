import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { usePromptStore } from '../../store/promptStore'

export function PromptTemplateSelector() {
  const { templates, activeTemplateId, setActiveTemplate } = usePromptStore()
  const active = templates.find((t) => t.id === activeTemplateId) ?? templates[0]
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <span>{active.icon}</span>
        <span>{active.name}</span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTemplate(t.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                t.id === activeTemplateId ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
