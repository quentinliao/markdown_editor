import { useState } from 'react'
import { useAiStore } from '../../store/aiStore'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { config, setConfig } = useAiStore()
  const [form, setForm] = useState(config)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 space-y-4">
        <h3 className="font-semibold">AI 配置</h3>
        <div className="space-y-3">
          {([['Base URL', 'baseUrl'], ['API Key', 'apiKey'], ['模型', 'model']] as const).map(([label, key]) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input
                type={key === 'apiKey' ? 'password' : 'text'}
                className="w-full border rounded px-3 py-1.5 text-sm bg-transparent dark:border-gray-600 focus:outline-none"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border">取消</button>
          <button onClick={() => { setConfig(form); onClose() }} className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white">保存</button>
        </div>
      </div>
    </div>
  )
}
