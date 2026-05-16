import { useState } from 'react'
import { useAIConfigStore } from '../../store/apiConfig'
import { usePromptStore } from '../../store/promptStore'
import { ApiFormat, API_PRESETS } from '../../lib/aiService'
import { X, Plus, Trash2 } from 'lucide-react'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { config, setConfig } = useAIConfigStore()
  const { templates, addTemplate, deleteTemplate } = usePromptStore()
  const [form, setForm] = useState(config)
  const [tab, setTab] = useState<'api' | 'templates'>('api')
  const [newTemplate, setNewTemplate] = useState({ name: '', icon: '🔧', systemPrompt: '' })

  const customTemplates = templates.filter((t) => !t.isBuiltIn)

  const applyPreset = (preset: (typeof API_PRESETS)[number]) => {
    setForm({ ...form, baseUrl: preset.baseUrl, model: preset.model, apiFormat: preset.format })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[420px] max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm">AI 设置</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['api', 'templates'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2 text-xs ${
                tab === t
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'api' ? 'API 配置' : 'Prompt 模板'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {tab === 'api' && (
            <>
              {/* Quick presets */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">快速预设</label>
                <div className="flex flex-wrap gap-1.5">
                  {API_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className={`px-2 py-1 text-xs rounded border ${
                        form.baseUrl === p.baseUrl && form.model === p.model
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* API format */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">API 格式</label>
                <div className="flex gap-2">
                  {(['openai', 'anthropic'] as ApiFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setForm({ ...form, apiFormat: fmt })}
                      className={`flex-1 px-3 py-1.5 text-xs rounded border ${
                        form.apiFormat === fmt
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {fmt === 'openai' ? 'OpenAI 兼容' : 'Anthropic'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {form.apiFormat === 'openai'
                    ? '适用于 OpenAI、DeepSeek、Ollama 等兼容接口'
                    : '适用于 Anthropic Claude 官方 API'}
                </p>
              </div>

              {/* Fields */}
              {(
                [
                  ['Base URL', 'baseUrl', 'text'],
                  ['API Key', 'apiKey', 'password'],
                  ['模型', 'model', 'text'],
                ] as const
              ).map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type={type}
                    className="w-full border rounded px-3 py-1.5 text-sm bg-transparent dark:border-gray-600 focus:outline-none"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border">
                  取消
                </button>
                <button
                  onClick={() => {
                    setConfig(form)
                    onClose()
                  }}
                  className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white"
                >
                  保存
                </button>
              </div>
            </>
          )}

          {tab === 'templates' && (
            <>
              {customTemplates.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500">自定义模板</div>
                  {customTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-600">
                      <span>{t.icon}</span>
                      <span className="text-sm flex-1">{t.name}</span>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs font-medium text-gray-500">内置模板</div>
              {templates
                .filter((t) => t.isBuiltIn)
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded border border-gray-100 dark:border-gray-700 opacity-70">
                    <span>{t.icon}</span>
                    <span className="text-sm flex-1">{t.name}</span>
                    <span className="text-[10px] text-gray-400">内置</span>
                  </div>
                ))}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <div className="text-xs font-medium text-gray-500">添加自定义模板</div>
                <div className="flex gap-2">
                  <input
                    className="w-8 text-center border rounded px-1 py-1.5 text-sm bg-transparent dark:border-gray-600"
                    value={newTemplate.icon}
                    onChange={(e) => setNewTemplate({ ...newTemplate, icon: e.target.value })}
                    placeholder="🔧"
                  />
                  <input
                    className="flex-1 border rounded px-3 py-1.5 text-sm bg-transparent dark:border-gray-600 focus:outline-none"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="模板名称"
                  />
                </div>
                <textarea
                  className="w-full border rounded px-3 py-1.5 text-xs bg-transparent dark:border-gray-600 focus:outline-none resize-none"
                  rows={3}
                  value={newTemplate.systemPrompt}
                  onChange={(e) => setNewTemplate({ ...newTemplate, systemPrompt: e.target.value })}
                  placeholder="System prompt..."
                />
                <button
                  onClick={() => {
                    if (newTemplate.name.trim() && newTemplate.systemPrompt.trim()) {
                      addTemplate({ ...newTemplate, quickActions: [] })
                      setNewTemplate({ name: '', icon: '🔧', systemPrompt: '' })
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
                >
                  <Plus size={12} />
                  添加模板
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
