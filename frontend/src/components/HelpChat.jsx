import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../services/api'

const PAGE_CONTEXT = {
  '/app': 'The user is on the Home dashboard. They can start a session, add visits manually, or view reports.',
  '/session': 'The user is on the Session page viewing today\'s store visits. They can add stores, create vendor entries, close stores, or end the session.',
  '/new-store': 'The user is selecting a new store via GPS or search to begin a vendor visit.',
  '/visit': 'The user is filling out the assessment form for a vendor visit with evaluation fields, rep info, and visit recap.',
  '/weekly-report': 'The user is viewing the Weekly Shop File report. They can download or email the report.',
  '/monthly-invoice': 'The user is viewing the Monthly Invoice. They enter mileage and can send the invoice.',
  '/profile': 'The user is on their Profile page editing personal information.',
  '/settings': 'The user is on Settings managing their AI review API key, password, and subscription.',
}

const SYSTEM_PROMPT = `You are a friendly ShopRight help assistant. ShopRight is a mobile web app for mystery shoppers at Smart Circle International.

Key features:
- Start a session → Add stores via GPS or search → Add vendor visits → Fill assessment form → AI review → Submit
- Assessment form: Reps Present (Pass/Fail gate), 12 evaluation fields (Pass/Fail/N/A), Visit Recap
- Weekly Shop File: generates Excel report emailed to Smart Circle
- Monthly Invoice: enter mileage, auto-calculates pricing ($50 first vendor per stop, $15 additional)
- AI Review: optional, uses user's own Anthropic API key. Set up in Settings.

Setting up AI Review:
1. Go to Settings
2. Under "AI Review" tap Enable
3. Go to console.anthropic.com, create an account
4. Add $5 credits to your account (lasts months)
5. Go to API Keys → Create Key → name it "ShopRight"
6. Copy the key, paste it in Settings
7. Test the connection, then Save

Keep answers short, simple, and friendly. The users are not technical. Guide them step by step.`

function HelpChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getPageContext = () => {
    const path = location.pathname
    for (const [key, ctx] of Object.entries(PAGE_CONTEXT)) {
      if (path.startsWith(key)) return ctx
    }
    return 'The user is browsing ShopRight.'
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const result = await api.helpChat(userMsg, getPageContext())
      setMessages((prev) => [...prev, { role: 'assistant', text: result.data }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I couldn\'t process that. Try again or check the Help guide in Settings.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 z-50"
        aria-label="Help"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-4 w-80 max-h-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-800">ShopRight Help</p>
          <p className="text-xs text-gray-400">Ask me anything</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">Hi! How can I help you?</p>
            <div className="mt-3 space-y-1">
              {['How do I start a session?', 'How do I set up AI review?', 'How do I send my report?'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left text-xs text-blue-600 hover:underline px-2 py-1"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-lg text-sm">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-3 py-2 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

export default HelpChat
