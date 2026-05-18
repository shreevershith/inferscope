// Client wrapper for /api/ai-chat. Adds:
//   - AbortController-driven timeout so the chat UI never spins forever
//   - typed errors with `.source` + `.status` so the UI can classify them
//   - logged JSON-parse failures (no more silently returning {})

const TIMEOUT_MS = 30_000  // Groq Llama 3.3 70B can take a while on first cold response

class AiClientError extends Error {
  constructor(message, { status = 0, source = 'ai-chat', cause } = {}) {
    super(message)
    this.name = 'AiClientError'
    this.status = status
    this.source = source
    if (cause) this.cause = cause
  }
}

export async function sendChatMessage(userMessage, context, provider = 'claude') {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res
  try {
    res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: sanitizeInput(userMessage),
        context,
        provider,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      throw new AiClientError('Request timed out — the AI service took too long to respond.', { source: 'timeout', cause: err })
    }
    // Network unreachable, DNS, TLS, offline
    throw new AiClientError('Network unavailable. Check your connection and try again.', { source: 'network', cause: err })
  } finally {
    clearTimeout(timeoutId)
  }

  // Parse response body once, logging failures (don't swallow)
  let body
  try {
    body = await res.json()
  } catch (err) {
    console.error('[ai-chat] response JSON parse failed:', err)
    throw new AiClientError(
      res.status === 429
        ? 'AI service is overloaded. Please try again in a moment.'
        : 'AI service returned an unexpected response.',
      { status: res.status, source: 'parse', cause: err },
    )
  }

  if (!res.ok) {
    // Server gave a structured error message — surface it directly.
    const msg = (body && typeof body.error === 'string' && body.error) || 'AI service temporarily unavailable.'
    throw new AiClientError(msg, { status: res.status, source: res.status === 429 ? 'rate-limited' : 'server' })
  }

  if (typeof body.text !== 'string' || !body.text.trim()) {
    throw new AiClientError('AI service returned an empty response. Please try rephrasing.', { status: 502, source: 'empty' })
  }

  return body.text
}

function sanitizeInput(text) {
  return String(text || '')
    .replace(/[^\x20-\x7E\s]/g, '')
    .slice(0, 500)
    .trim()
}
