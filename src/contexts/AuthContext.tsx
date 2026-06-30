/**
 * 認證 Context
 * 提供全局認證狀態管理，並預留 Firebase 整合接口
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Student, LoginResult, mockApiLogin } from '../utils/testAuthData'
import { readLoginData } from '../utils/authStorage'
import type { LoginData } from '../utils/authStorage'

interface AuthContextType {
  currentUser: Student | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (studentId: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// localStorage key
const STORAGE_KEY = 'sccd_login_data'

// Props for AuthProvider
interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 從 storage 載入用戶數據
  const loadUserFromStorage = useCallback((): Student | null => {
    const data = readLoginData()
    if (!data) return null

    // 檢查是否過期
    const now = Date.now()
    const expiryTime = data.loginTime + data.expiresIn

    if (now > expiryTime) {
      clearStorage()
      return null
    }

    return data.student
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
      const result = await mockApiLogin(studentId, password)

      if (result.success && result.student && result.token && result.expiresIn) {
        saveUserToStorage(result.student, result.token, result.expiresIn, rememberMe)
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
  }, [])

  // 登出
  const logout = useCallback(async () => {
    try {
      clearStorage()
      setCurrentUser(null)
    } catch (error) {
      console.error('登出錯誤:', error)
    }
  }, [])

  // 初始化：載入用戶數據
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true)

      // 使用 localStorage 方式
      const user = loadUserFromStorage()
      setCurrentUser(user)
      setIsLoading(false)
    }

    initAuth()
  }, [loadUserFromStorage])

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
    logout
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
export type { AuthContextType }
