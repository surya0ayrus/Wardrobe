import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/** The logged-in session: user, companies, can(), login, logout, switchCompany … */
export function useAuth() {
  return useContext(AuthContext)
}

/** can('update_user') -> true / false */
export function useCan() {
  return useContext(AuthContext).can
}
