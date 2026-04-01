import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Token getter — set by AuthContext so API calls use the current session
let _getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export function setTokenGetter(fn) {
  _getAccessToken = fn
}

async function getAuthHeaders() {
  const token = await _getAccessToken()
  if (!token) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

async function request(path, options = {}) {
  const headers = options.auth !== false
    ? await getAuthHeaders()
    : { 'Content-Type': 'application/json' }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

const api = {
  healthCheck: () => request('/health', { auth: false }),

  getProfile: () => request('/auth/profile'),

  updateProfile: (data) => request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  testApiKey: (apiKey) => request('/auth/test-api-key', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey }),
  }),

  getNearbyStores: (lat, lng) => request(`/stores/nearby?lat=${lat}&lng=${lng}`),

  searchStores: (query) => request(`/stores/search?q=${encodeURIComponent(query)}`),

  getStorePrograms: (storeNumber, retailerName) =>
    request(`/stores/programs?store_number=${encodeURIComponent(storeNumber)}&retailer_name=${encodeURIComponent(retailerName)}`),
}

export default api
