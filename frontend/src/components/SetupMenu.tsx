'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import ModelBrowser from './ModelBrowser'
import { historyApi, type FinishedGame } from '@/lib/api'

const API_KEY_FIELDS = [
  { provider: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { provider: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { provider: 'gemini', label: 'Gemini', placeholder: 'AIza...' },
]

export default function SetupMenu() {
  const {
    numTribes, setNumTribes,
    selectedModel, setSelectedModel,
    apiKeys, setApiKey,
    setGamePhase,
    setPendingStart,
  } = useGameStore()

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [history, setHistory] = useState<FinishedGame[]>([])

  useEffect(() => {
    historyApi.get().then(d => setHistory(d.games.slice().reverse())).catch(() => {})
  }, [])

  const toggleShow = (provider: string) =>
    setShowKeys(s => ({ ...s, [provider]: !s[provider] }))

  function formatDuration(ticks: number) {
    const secs = Math.floor(ticks * 0.2)
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (d > 0) return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-wider mb-2" style={{ color: '#00ff88' }}>
            BOTcrumb
          </h1>
          <p className="text-gray-400 text-sm">AI vs AI Strategy Battle Simulator</p>
        </div>

        <div className="space-y-6">
          {/* Tribe count */}
          <div className="bg-gray-900 rounded-xl p-5">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Number of Tribes
              <span className="ml-2 text-2xl font-bold" style={{ color: '#00ff88' }}>
                {numTribes}
              </span>
            </label>
            <input
              type="range"
              min={2}
              max={10}
              value={numTribes}
              onChange={e => setNumTribes(Number(e.target.value))}
              className="w-full accent-green-400"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>2</span>
              <span>10</span>
            </div>
          </div>

          {/* Model selection */}
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="text-sm font-medium text-gray-300 mb-3">
              LLM for Tribe Name Generation
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Selected: <span className="text-green-400 font-mono">{selectedModel}</span>
            </div>
            <ModelBrowser
              currentModel={selectedModel}
              apiKeys={apiKeys}
              onSelect={setSelectedModel}
            />
          </div>

          {/* API Keys */}
          <div className="bg-gray-900 rounded-xl p-5">
            <div className="text-sm font-medium text-gray-300 mb-3">API Keys</div>
            <div className="space-y-3">
              {API_KEY_FIELDS.map(({ provider, label, placeholder }) => (
                <div key={provider}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={showKeys[provider] ? 'text' : 'password'}
                      value={apiKeys[provider] ?? ''}
                      onChange={e => setApiKey(provider, e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(provider)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    >
                      {showKeys[provider] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Only needed for cloud providers. Ollama runs locally without a key.
            </p>
          </div>

          {/* Game history */}
          {history.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <div className="text-sm font-medium text-gray-300 mb-3">Recent Games</div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {history.map((game, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 text-xs">
                    {/* Header: winner + date + duration */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold" style={{ color: game.tribes.find(t => t.id === game.winner.id)?.color ?? '#00ff88' }}>
                        {game.winner.id === -1 ? 'Draw' : `Winner: ${game.winner.name}`}
                      </span>
                      <span className="text-gray-500 tabular-nums">{formatDuration(game.duration_ticks)}</span>
                    </div>
                    {/* Tribe list */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {game.tribes.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5">
                          <span className={t.alive ? '' : 'opacity-40'} style={{ color: t.color }}>
                            {t.alive ? '◆' : '✗'}
                          </span>
                          <span className={`font-mono truncate ${t.alive ? 'text-gray-200' : 'text-gray-500'}`}>
                            {t.name}
                          </span>
                          <span className="text-gray-600 ml-auto tabular-nums">
                            {t.final_units.worker}W {t.final_units.attacker}A {t.final_units.defender}D
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-gray-600 mt-1.5 text-right">{formatDate(game.ended_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            type="button"
            onClick={() => { setPendingStart(true); setGamePhase('playing') }}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #00ff88, #00ccff)',
              color: '#000',
            }}
          >
            Start Battle
          </button>

          <p className="text-center text-xs text-gray-600">
            Tribe names will be generated by {selectedModel} at game start
          </p>
        </div>
      </div>
    </div>
  )
}
