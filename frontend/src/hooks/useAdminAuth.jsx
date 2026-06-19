import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const SESSION_KEY = 'social-dashboard-admin-pin'
const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [pin, setPin] = useState(() => sessionStorage.getItem(SESSION_KEY))
  const isAdmin = Boolean(pin)

  const login = useCallback(async (attempt) => {
    const { data, error } = await supabase.rpc('verify_admin_pin', { attempt })
    if (error) return { success: false, error: error.message }
    if (data !== true) return { success: false, error: 'Incorrect PIN. Please try again.' }
    sessionStorage.setItem(SESSION_KEY, attempt)
    setPin(attempt)
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setPin(null)
  }, [])

  return (
    <AdminAuthContext.Provider value={{ isAdmin, pin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
