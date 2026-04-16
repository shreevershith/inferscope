export async function sendChatMessage(userMessage, context, provider = 'claude') {
  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: sanitizeInput(userMessage),
      context,
      provider,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'AI service temporarily unavailable')
  }

  const data = await res.json()
  return data.text
}

function sanitizeInput(text) {
  return text
    .replace(/[^\x20-\x7E\s]/g, '')
    .slice(0, 500)
    .trim()
}
