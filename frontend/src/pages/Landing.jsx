import { useState } from 'react'
import { Link } from 'react-router-dom'

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleContact = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })
      setSent(true)
      setContactForm({ name: '', email: '', message: '' })
    } catch (e) {
      // Silent fail
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Eli Peterson Consulting LLC</h1>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              Menu
              <svg className={`w-4 h-4 transition ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                <a href="#about" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">About</a>
                <a href="#contact" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Contact Us</a>
                <div className="border-t border-gray-100 my-1" />
                <p className="px-4 py-1.5 text-xs text-gray-400 font-medium">Apps</p>
                <Link to="/login" className="block px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50">ShopRight</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Eli Peterson Consulting LLC</h2>
        <p className="text-lg text-gray-600 max-w-2xl">
          We build apps and websites for technology companies. From concept to launch, we deliver
          modern software solutions that solve real business problems.
        </p>
      </section>

      {/* About */}
      <section id="about" className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">About</h3>
          <p className="text-gray-600 max-w-2xl">
            Eli Peterson Consulting LLC specializes in building custom applications and websites
            for technology companies. We focus on delivering clean, reliable software that
            helps businesses operate more efficiently. Our approach is hands-on — we work
            directly with our clients from initial concept through production launch.
          </p>
        </div>
      </section>

      {/* Apps */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Our Apps</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-sm">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">ShopRight</h4>
            <p className="text-sm text-gray-600 mb-4">
              Field assessment tool for mystery shoppers. Voice-powered visit entry,
              AI review, automated report generation.
            </p>
            <Link
              to="/login"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Launch App
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Contact Us</h3>
          <div className="max-w-md">
            <p className="text-sm text-gray-600 mb-4">Eli Peterson — Reach out with any questions or project inquiries.</p>
            {sent ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 text-sm">Message sent! We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleContact} className="space-y-3">
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Your name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="Your email"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Your message"
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-400">Eli Peterson Consulting LLC</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
