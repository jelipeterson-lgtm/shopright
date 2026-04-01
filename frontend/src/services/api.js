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
    let msg = body.error || `Request failed: ${res.status}`
    if (body.detail) {
      msg = typeof body.detail === 'string'
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : JSON.stringify(body.detail)
    }
    throw new Error(msg)
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

  // Visits
  createVisit: (data) => request('/visits', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getVisits: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/visits${qs ? '?' + qs : ''}`)
  },

  getVisit: (id) => request(`/visits/${id}`),

  updateVisit: (id, data) => request(`/visits/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  completeVisit: (id) => request(`/visits/${id}/complete`, { method: 'POST' }),

  unlockVisit: (id) => request(`/visits/${id}/unlock`, { method: 'POST' }),

  discardVisit: (id) => request(`/visits/${id}`, { method: 'DELETE' }),

  closeStop: (storeNumber, retailerName, sessionDate) =>
    request(`/visits/close-stop?store_number=${encodeURIComponent(storeNumber)}&retailer_name=${encodeURIComponent(retailerName)}&session_date=${sessionDate}`, {
      method: 'POST',
    }),

  checkOpenStops: (sessionDate) => request(`/visits/check/open-stops?session_date=${sessionDate}`),

  reviewVisit: (visitId) => request('/review', {
    method: 'POST',
    body: JSON.stringify({ visit_id: visitId }),
  }),
}

export default api
