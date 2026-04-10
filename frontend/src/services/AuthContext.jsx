import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { setTokenGetter } from './api'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Keep a ref to the latest session so the token getter always has it
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
    setTokenGetter(async () => {
      if (sessionRef.current?.access_token) return sessionRef.current.access_token
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    })
  }, [session])

  const value = { user, session, loading, signUp, signIn, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
