export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

export interface FinishedGameTribe {
  id: number
  name: string
  color: string
  alive: boolean
  final_energy: number
  final_units: { worker: number; attacker: number; defender: number; queen: number }
}

export interface FinishedGame {
  winner: { id: number; name: string }
  ended_at: string
  duration_ticks: number
  tribes: FinishedGameTribe[]
}

export const historyApi = {
  get: () => apiFetch<{ games: FinishedGame[] }>('/api/history'),
}

export const ollamaApi = {
  listModels: () =>
    apiFetch<{ models: string[] }>('/api/models/ollama'),

  pullModel: (name: string) =>
    apiFetch<{ status: string }>('/api/models/pull', {
      method: 'POST',
      body: JSON.stringify({ model: name }),
    }),

  fetchProviderModels: (provider: string, apiKey: string) =>
    apiFetch<{ models: Array<{ id: string; size_gb?: number }>; error?: string }>(
      '/api/models/fetch',
      {
        method: 'POST',
        body: JSON.stringify({ provider, api_key: apiKey }),
      }
    ),
}
