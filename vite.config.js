import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { request as httpsRequest } from 'https'

// Dev API plugin — proxies /api/ai-chat to Groq locally
function devApiPlugin() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ai-chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        // Load API key fresh each time (no caching — supports .env changes without restart)
        const env = loadEnv('development', process.cwd(), '')
        const apiKey = env.GROQ_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'GROQ_API_KEY not set in .env file' }))
          return
        }

        // Read request body
        let body = ''
        try {
          for await (const chunk of req) body += chunk
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Failed to read request body' }))
          return
        }

        let parsed
        try {
          parsed = JSON.parse(body)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
          return
        }

        const { userMessage, context } = parsed
        const sanitized = (userMessage || '').replace(/[^\x20-\x7E\s]/g, '').slice(0, 500).trim()

        if (!sanitized) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Empty message' }))
          return
        }

        const systemPrompt = `You are InferScope Advisor, an AI assistant specialized in helping engineers choose the right LLM model and infrastructure for their workloads.

LIVE DASHBOARD CONTEXT:
- Total models tracked: ${context?.totalModels || 'N/A'}
- Top Arena models:\n${context?.topModels || 'N/A'}
- Calculator scenario: ${context?.calculatorContext || 'No scenario configured'}
- Selected provider: ${context?.selectedProvider || 'None'}

RULES:
- Reference specific model names and prices from the context when available
- Give concrete cost estimates (e.g., "$X/month for Y requests")
- Compare at least 2 options when recommending
- Keep responses concise (under 200 words)
- If asked about something outside AI/ML, politely redirect`

        const groqPayload = JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sanitized },
          ],
          max_tokens: 512,
          temperature: 0.4,
        })

        // Use Node https module (more reliable than experimental fetch in Node 18)
        const groqReq = httpsRequest({
          hostname: 'api.groq.com',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(groqPayload),
          },
        }, (groqRes) => {
          let data = ''
          groqRes.on('data', chunk => { data += chunk })
          groqRes.on('end', () => {
            if (groqRes.statusCode !== 200) {
              console.error('Groq API error:', groqRes.statusCode, data)
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI service error. Check your GROQ_API_KEY.' }))
              return
            }
            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.message?.content || 'No response generated.'
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ text }))
            } catch {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to parse AI response' }))
            }
          })
        })

        groqReq.on('error', (err) => {
          console.error('Groq request error:', err.message)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Connection error: ${err.message}` }))
        })

        groqReq.write(groqPayload)
        groqReq.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
})
