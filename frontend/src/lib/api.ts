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
