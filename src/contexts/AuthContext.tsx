/**
 * 認證 Context
 * 提供全局認證狀態管理，並預留 Firebase 整合接口
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Student, LoginResult, mockApiLogin } from '../utils/testAuthData'

// 認證服務接口（可以替換成 Firebase 或其他後端）
export interface AuthService {
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<Student | null>
  onAuthStateChanged: (callback: (user: Student | null) => void) => () => void
}

interface AuthContextType {
  currentUser: Student | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (studentId: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// localStorage key
const STORAGE_KEY = 'sccd_login_data'

interface LoginData {
  student: Student
  token: string
  loginTime: number
  expiresIn: number
  rememberMe: boolean
}

// Props for AuthProvider
interface AuthProviderProps {
  children: React.ReactNode
  authService?: AuthService // 可選的自定義認證服務（用於 Firebase 等）
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, authService }) => {
  const [currentUser, setCurrentUser] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 從 storage 載入用戶數據
  const loadUserFromStorage = useCallback((): Student | null => {
    let loginDataStr = localStorage.getItem(STORAGE_KEY)
    if (!loginDataStr) {
      loginDataStr = sessionStorage.getItem(STORAGE_KEY)
    }

    if (!loginDataStr) return null

    try {
      const data: LoginData = JSON.parse(loginDataStr)

      // 檢查是否過期
      const now = Date.now()
      const expiryTime = data.loginTime + data.expiresIn

      if (now > expiryTime) {
        clearStorage()
        return null
      }

      return data.student
    } catch (error) {
      console.error('解析登入數據錯誤:', error)
      clearStorage()
      return null
    }
  }, [])

  // 清除 storage
  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  // 保存用戶數據到 storage
  const saveUserToStorage = (student: Student, token: string, expiresIn: number, rememberMe: boolean) => {
    const loginData: LoginData = {
      student,
      token,
      loginTime: Date.now(),
      expiresIn,
      rememberMe
    }

    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(STORAGE_KEY, JSON.stringify(loginData))
  }

  // 登入
  const login = useCallback(async (studentId: string, password: string, rememberMe: boolean = false): Promise<LoginResult> => {
    try {
      // 如果提供了自定義認證服務（例如 Firebase），使用它
      let result: LoginResult

      if (authService) {
        result = await authService.login(studentId, password, rememberMe)
      } else {
        // 否則使用模擬 API
        result = await mockApiLogin(studentId, password)
      }

      if (result.success && result.student && result.token && result.expiresIn) {
        // 只有在沒有外部認證服務（使用模擬模式）時，才需要手動保存到 Storage
        if (!authService) {
          saveUserToStorage(result.student, result.token, result.expiresIn, rememberMe)
        }
        setCurrentUser(result.student)
      }

      return result
    } catch (error) {
      console.error('[AuthContext] 登入錯誤:', error)
      return {
        success: false,
        message: '登入過程發生錯誤'
      }
    }
  }, [authService])

  // 登出
  const logout = useCallback(async () => {
    try {
      // 如果有自定義認證服務，調用其登出方法
      if (authService) {
        await authService.logout()
      }

      clearStorage()
      setCurrentUser(null)
    } catch (error) {
      console.error('登出錯誤:', error)
    }
  }, [authService])

  // 重新載入用戶數據
  const refreshUser = useCallback(async () => {
    if (authService) {
      const user = await authService.getCurrentUser()
      setCurrentUser(user)
    } else {
      const user = loadUserFromStorage()
      setCurrentUser(user)
    }
  }, [authService, loadUserFromStorage])

  // 初始化：載入用戶數據
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true)

      if (authService) {
        // 如果使用自定義認證服務（如 Firebase），監聽認證狀態變化
        const unsubscribe = authService.onAuthStateChanged((user) => {
          setCurrentUser(user)
          setIsLoading(false)
        })

        return unsubscribe
      } else {
        // 使用 localStorage 方式
        const user = loadUserFromStorage()
        setCurrentUser(user)
        setIsLoading(false)
      }
    }

    initAuth()
  }, [authService, loadUserFromStorage])

  // 監聽 storage 變化（跨標籤頁同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue) {
          try {
            const data: LoginData = JSON.parse(e.newValue)
            setCurrentUser(data.student)
          } catch (error) {
            console.error('解析登入數據錯誤:', error)
            setCurrentUser(null)
          }
        } else {
          setCurrentUser(null)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const value: AuthContextType = {
    currentUser,
    isLoading,
    isAuthenticated: currentUser !== null,
    login,
    logout,
    refreshUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 自定義 Hook 來使用 AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 導出類型供其他組件使用
export type { AuthContextType, LoginData }
