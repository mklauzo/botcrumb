'use client'

import { useEffect, useRef, useState } from 'react'
import { ollamaApi } from '@/lib/api'

type PullState = 'idle' | 'pulling' | 'done' | 'error'

interface ProviderModel {
  id: string
  size_gb?: number
  builtin?: boolean
}

const BUILTIN_MODELS: Record<string, ProviderModel[]> = {
  ollama: [
    { id: 'llama3.2' },
    { id: 'llama3.1' },
    { id: 'phi4-mini' },
    { id: 'mistral' },
    { id: 'gemma3' },
    { id: 'deepseek-r1:8b' },
  ],
  openai: [
    { id: 'gpt-4o', builtin: true },
    { id: 'gpt-4o-mini', builtin: true },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5', builtin: true },
    { id: 'claude-haiku-4-5-20251001', builtin: true },
    { id: 'claude-3-5-haiku-20241022', builtin: true },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', builtin: true },
    { id: 'gemini-2.0-flash-lite', builtin: true },
    { id: 'gemini-1.5-flash', builtin: true },
  ],
}

const PROVIDER_META = [
  { key: 'ollama', label: 'Ollama', desc: 'local, free', needsKey: false },
  { key: 'openai', label: 'OpenAI', desc: 'requires sk-...', needsKey: true },
  { key: 'anthropic', label: 'Anthropic', desc: 'requires sk-ant-...', needsKey: true },
  { key: 'gemini', label: 'Gemini', desc: 'requires AIza...', needsKey: true },
]

interface Props {
  currentModel: string
  apiKeys: Record<string, string>
  onSelect: (model: string) => void
}

export default function ModelBrowser({ currentModel, apiKeys, onSelect }: Props) {
  const [ollamaAvailable, setOllamaAvailable] = useState<string[]>([])
  const [pullState, setPullState] = useState<Record<string, PullState>>({})
  const [models, setModels] = useState<Record<string, ProviderModel[]>>(BUILTIN_MODELS)
  const [fetching, setFetching] = useState<Record<string, boolean>>({})
  const [fetchError, setFetchError] = useState<Record<string, string>>({})
  const pollRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    refreshOllama()
    return () => { Object.values(pollRef.current).forEach(clearInterval) }
  }, []) // eslint-disable-line

  const refreshOllama = () => {
    ollamaApi.listModels()
      .then(r => setOllamaAvailable(r.models))
      .catch(() => {})
  }

  const isOllamaAvailable = (name: string) =>
    ollamaAvailable.some(m => m === name || m.startsWith(name + ':'))

  const pullModel = (name: string) => {
    setPullState(s => ({ ...s, [name]: 'pulling' }))
    ollamaApi.pullModel(name).catch(() => {
      setPullState(s => ({ ...s, [name]: 'error' }))
    })
    const interval = setInterval(() => {
      ollamaApi.listModels().then(r => {
        setOllamaAvailable(r.models)
        const found = r.models.some(m => m === name || m.startsWith(name + ':'))
        if (found) {
          setPullState(s => ({ ...s, [name]: 'done' }))
          clearInterval(interval)
          delete pollRef.current[name]
        }
      }).catch(() => {})
    }, 5000)
    pollRef.current[name] = interval
  }

  const fetchProvider = async (providerKey: string) => {
    setFetching(s => ({ ...s, [providerKey]: true }))
    setFetchError(s => ({ ...s, [providerKey]: '' }))
    try {
      const res = await ollamaApi.fetchProviderModels(providerKey, apiKeys[providerKey] ?? '')
      if (res.error) {
        setFetchError(s => ({ ...s, [providerKey]: res.error! }))
        return
      }
      setModels(prev => {
        const existing = new Set((prev[providerKey] || []).map(m => m.id))
        const newOnes = res.models.filter(m => !existing.has(m.id))
        return { ...prev, [providerKey]: [...(prev[providerKey] || []), ...newOnes] }
      })
      if (providerKey === 'ollama') setOllamaAvailable(res.models.map(m => m.id))
    } catch (e: unknown) {
      setFetchError(s => ({ ...s, [providerKey]: e instanceof Error ? e.message : 'Error' }))
    } finally {
      setFetching(s => ({ ...s, [providerKey]: false }))
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden text-sm">
      {PROVIDER_META.map(provider => (
        <ProviderSection
          key={provider.key}
          provider={provider}
          models={models[provider.key] || []}
          isOllamaAvailable={isOllamaAvailable}
          pullState={pullState}
          fetching={!!fetching[provider.key]}
          fetchError={fetchError[provider.key] || ''}
          currentModel={currentModel}
          onFetch={() => fetchProvider(provider.key)}
          onPull={pullModel}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function ProviderSection({
  provider, models, isOllamaAvailable, pullState, fetching, fetchError,
  currentModel, onFetch, onPull, onSelect,
}: {
  provider: { key: string; label: string; desc: string; needsKey: boolean }
  models: ProviderModel[]
  isOllamaAvailable: (name: string) => boolean
  pullState: Record<string, PullState>
  fetching: boolean
  fetchError: string
  currentModel: string
  onFetch: () => void
  onPull: (name: string) => void
  onSelect: (model: string) => void
}) {
  const [open, setOpen] = useState(provider.key === 'ollama')
  const fullId = (id: string) => provider.key === 'ollama' ? `ollama:${id}` : id

  return (
    <div className="border-b border-gray-800 last:border-0">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 font-medium text-gray-300 hover:text-white"
        >
          <span>{provider.label}</span>
          <span className="text-xs text-gray-500 font-normal">{provider.desc}</span>
          <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
        </button>
        <button
          type="button"
          onClick={onFetch}
          disabled={fetching}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40"
        >
          {fetching ? 'Checking...' : '↻ Refresh'}
        </button>
      </div>

      {fetchError && (
        <p className="px-3 pb-1 text-xs text-red-400">{fetchError}</p>
      )}

      {open && (
        <div className="divide-y divide-gray-900">
          {models.map(m => {
            const fid = fullId(m.id)
            const isActive = currentModel === fid
            const available = provider.key === 'ollama' ? isOllamaAvailable(m.id) : true
            const state = pullState[m.id] || 'idle'

            return (
              <div
                key={m.id}
                className={`flex items-center justify-between px-3 py-1.5 ${
                  isActive ? 'bg-gray-700' : 'bg-gray-950 hover:bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-gray-300 text-xs truncate">{m.id}</span>
                  {m.size_gb ? <span className="text-xs text-gray-500">{m.size_gb}GB</span> : null}
                  {isActive && <span className="text-xs bg-green-800 text-green-300 px-1.5 py-0.5 rounded">active</span>}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {provider.key === 'ollama' && (
                    <>
                      {(available || state === 'done') && (
                        <span className="text-xs text-green-500">✓</span>
                      )}
                      {state === 'pulling' && (
                        <span className="text-xs text-blue-400 animate-pulse">↓...</span>
                      )}
                      {state === 'error' && (
                        <span className="text-xs text-red-400">Error</span>
                      )}
                      {!available && state === 'idle' && (
                        <button
                          type="button"
                          onClick={() => onPull(m.id)}
                          className="text-xs bg-yellow-900 hover:bg-yellow-800 text-yellow-400 px-1.5 py-0.5 rounded"
                        >
                          ↓ Pull
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelect(fid)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      isActive
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {isActive ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
