import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import type { User } from "../../../../shared/types"
import { AUTH_STORAGE_KEY } from "../../../../shared/constants"

type LoginOptions = {
  email: string
  password: string
}

type AuthContextType = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (options: LoginOptions) => Promise<User>
  loginFromOAuth: () => Promise<User>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
  clearError: () => void
}


function loadUserFromStorage(): User | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as User
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
  return null
}

function saveUserToStorage(user: User | null): void {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

function mapBackendUserToUser(userData: any): User {
  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    role: userData.role,
    display_name: userData.display_name,
    preferred_language: userData.preferred_language || "en",
    is_active: userData.is_active,
    email_verified: userData.email_verified,
    domain_level: "beginner",
    difficulty_preference: "medium",
    ai_assistance_level: "moderate",
    created_at: userData.created_at,
    last_login: userData.last_login
  }
}

const AUTH_DEBUG = (import.meta as any)?.env?.DEV ?? false

function logAuth(event: string, details?: Record<string, unknown>): void {
  if (!AUTH_DEBUG) return
  console.info(`[AuthContext] ${new Date().toISOString()} ${event}`, details ?? {})
}


const AuthContext = createContext<AuthContextType | null>(null)


type AuthProviderProps = {
  children: ReactNode
}


export function AuthProvider({ children }: AuthProviderProps) {
  const initialUser = useMemo(() => loadUserFromStorage(), [])

  // Initialize from localStorage
  const [user, setUser] = useState<User | null>(() => loadUserFromStorage())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verify user on initial load
  useEffect(() => {
    const verifyUser = async () => {
      console.log("[AuthVerify] Starting user verification.");
      // No user in storage, so we're done loading.
      if (!loadUserFromStorage()) {
        console.log("[AuthVerify] No user in storage. Finishing verification.");
        setIsLoading(false);
        return;
      }

      try {
        console.log("[AuthVerify] User found in storage. Fetching /api/users/me to verify.");
        const res = await fetch(`/api/users/me`, { credentials: "include" });
        console.log(`[AuthVerify] /api/users/me responded with status: ${res.status}`);

        if (!res.ok) {
          // Token is invalid, clear user state
          console.log("[AuthVerify] Token invalid or expired. Clearing user state.");
          setUser(null);
        } else {
          // Token is valid, update user state from server
          const userData = await res.json();
          console.log("[AuthVerify] Token valid. User data received:", userData);
          const user: User = {
            id: userData.id,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            display_name: userData.display_name,
            preferred_language: userData.preferred_language || "en",
            is_active: userData.is_active,
            email_verified: userData.email_verified,
            domain_level: "beginner",
            difficulty_preference: "medium",
            ai_assistance_level: "moderate",
            created_at: userData.created_at,
            last_login: userData.last_login
          };
          setUser(user);
        }
      } catch (error) {
        // Network error or other issue, assume logged out
        console.error("[AuthVerify] Error during verification:", error);
        setUser(null);
      } finally {
        // Finished verification, stop loading
        console.log("[AuthVerify] Verification process finished. Setting isLoading to false.");
        setIsLoading(false);
      }
    };

    verifyUser();
  }, []);

  // Sync to localStorage whenever user changes
  useEffect(() => {
    saveUserToStorage(user)
  }, [user])

  useEffect(() => {
    logAuth("provider-mounted", {
      hasStoredUser: initialUser !== null
    })
  }, [initialUser])

  useEffect(() => {
    if (initialUser !== null) {
      logAuth("bootstrap-skipped", { reason: "stored-user-present" })
      setIsLoading(false)
      return
    }

    let active = true

    async function hydrateSession() {
      logAuth("bootstrap-start")
      try {
        const sessionResponse = await fetch(`/api/auth/check`, {
          credentials: "include"
        })

        if (!sessionResponse.ok) {
          logAuth("bootstrap-check-error", { status: sessionResponse.status })
          if (active) {
            setUser(null)
          }
          return
        }

        const sessionData = await sessionResponse.json()
        if (!sessionData?.authenticated) {
          if (active) {
            setUser(null)
          }
          logAuth("bootstrap-no-session")
          return
        }

        const response = await fetch(`/api/users/me`, {
          credentials: "include"
        })

        if (!response.ok) {
          if (active) {
            setUser(null)
          }
          logAuth("bootstrap-profile-error", { status: response.status })
          return
        }

        const userData = await response.json()
        if (active) {
          setUser(mapBackendUserToUser(userData))
        }
        logAuth("bootstrap-success", {
          userId: userData.id,
          role: userData.role
        })
      } catch {
        logAuth("bootstrap-error")
        // Keep the user unauthenticated on bootstrap errors and allow manual login.
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    hydrateSession()

    return () => {
      active = false
    }
  }, [initialUser])

  const isAuthenticated = useMemo(() => user !== null, [user])

  // Real API login
  const login = useCallback(async (options: LoginOptions) => {

    const { email, password } = options
    setIsLoading(true)
    setError(null) // Clear previous errors

    try {
      logAuth("login-start", { email })

      // Step 1: Login to get tokens (now stored in HttpOnly cookies)
      const loginResponse = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include" // Send cookies
      })

      if (!loginResponse.ok) {
        let errorMessage = "Invalid email or password"
        try {
          const error = await loginResponse.json()
          errorMessage = error.detail || error.message || "Invalid email or password"
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = loginResponse.statusText || "Invalid email or password"
        }
        throw new Error(errorMessage)
      }

      // Tokens are now in HttpOnly cookies
      // Backend still returns tokens in response body, but we ignore them

      // Step 2: Fetch user profile (cookies sent automatically)
      const userResponse = await fetch(`/api/users/me`, {
        credentials: "include" // Send cookies
      })

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user profile")
      }

      const userData = await userResponse.json()

      const user = mapBackendUserToUser(userData)

      setUser(user)
      setError(null) // Clear error on success
      logAuth("login-success", {
        userId: user.id,
        role: user.role
      })
      return user
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      setError(errorMessage)
      logAuth("login-failed", { error: errorMessage })
      throw error // Re-throw so LoginPage can handle navigation/toasts if needed
    } finally {
      setIsLoading(false)
    }
  }, [])

  // OAuth login: cookies are already set by the backend redirect, just fetch the user profile
  const loginFromOAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      logAuth("oauth-login-start")
      const res = await fetch(`/api/users/me`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch user profile")
      const userData = await res.json()
      const user = mapBackendUserToUser(userData)
      setUser(user)
      logAuth("oauth-login-success", {
        userId: user.id,
        role: user.role
      })
      return user
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OAuth login failed"
      setError(msg)
      logAuth("oauth-login-failed", { error: msg })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    logAuth("logout-start", {
      userId: user?.id ?? null
    })
    // Call logout API to clear HttpOnly cookies on server
    try {
      await fetch(`/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include" // Send cookies
      })
    } catch {
      // Ignore logout API errors - clear local state anyway
    }

    // Clear local user data (cookies are cleared by server)
    setUser(null)
    logAuth("logout-finished")
  }, [user?.id])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    loginFromOAuth,
    logout,
    updateUser,
    clearError
  }), [user, isAuthenticated, isLoading, error, login, loginFromOAuth, logout, updateUser, clearError])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )

}


export function useAuth(): AuthContextType {
  
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context

}
