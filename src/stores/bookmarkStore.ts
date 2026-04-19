/**
 * 收藏管理 Store
 * 基於原有的 UnifiedBookmarkManager 邏輯，使用 Zustand 實現
 */

import { create } from 'zustand'

// 擴展 Window 類型以支持舊版認證系統
declare global {
  interface Window {
    AuthStorage?: {
      isLoggedIn: () => boolean
      getLoginData: () => {
        student: {
          studentId: string
        }
      } | null
    }
  }
}

interface BookmarkState {
  bookmarks: Set<string>
  currentUserId: string | null
  isInitialized: boolean

  // 初始化
  init: () => void

  // 用戶管理
  updateCurrentUser: () => void
  getCurrentStorageKey: () => string

  // 數據管理
  loadFromStorage: () => void
  saveToStorage: () => void

  // 核心 API
  isBookmarked: (itemId: string) => boolean
  addBookmark: (itemId: string) => boolean
  removeBookmark: (itemId: string) => boolean
  toggleBookmark: (itemId: string) => boolean
  getAllBookmarks: () => string[]
  clearAllBookmarks: () => void

  // 分類管理
  getEquipmentBookmarks: () => string[]
  getClassroomBookmarks: () => string[]
}

const BASE_STORAGE_KEY = 'sccd_bookmarks'

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: new Set<string>(),
  currentUserId: null,
  isInitialized: false,

  // ===== 初始化 =====
  init: () => {
    const state = get()
    if (state.isInitialized) return

    state.updateCurrentUser()
    state.loadFromStorage()

    // 設置 storage 監聽器（跨頁面同步）
    window.addEventListener('storage', (event) => {
      const currentKey = get().getCurrentStorageKey()
      if (event.key === currentKey) {
        console.log('檢測到收藏數據變化，重新載入')
        get().loadFromStorage()
      }
    })

    // 監聽認證狀態變化
    window.addEventListener('authStateChanged', () => {
      console.log('認證狀態變化，更新收藏管理器')
      get().updateCurrentUser()
    })

    // 監聽頁面可見性變化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        get().updateCurrentUser()
      }
    })

    set({ isInitialized: true })
    console.log('BookmarkStore 初始化完成')
    console.log('當前用戶:', get().currentUserId)
    console.log('收藏列表:', Array.from(get().bookmarks))

    // 觸發全域事件
    window.dispatchEvent(new CustomEvent('bookmarkManagerReady'))
  },

  // ===== 用戶管理 =====
  updateCurrentUser: () => {
    try {
      // 檢查是否有 AuthStorage (舊版認證系統)
      if (typeof window.AuthStorage !== 'undefined' && window.AuthStorage.isLoggedIn()) {
        const loginData = window.AuthStorage.getLoginData()
        if (loginData && loginData.student && loginData.student.studentId) {
          const newUserId = loginData.student.studentId
          const currentUserId = get().currentUserId

          // 只有在用戶變更時才重新載入數據
          if (currentUserId !== newUserId) {
            set({ currentUserId: newUserId })
            if (get().isInitialized) {
              get().loadFromStorage()
            }
          }
          return
        }
      }

      // 嘗試從 localStorage 或 sessionStorage 獲取登入信息（React 版本）
      let authData = localStorage.getItem('sccd_login_data')
      if (!authData) {
        authData = sessionStorage.getItem('sccd_login_data')
      }

      if (authData) {
        try {
          const parsedAuth = JSON.parse(authData)
          if (parsedAuth.student && parsedAuth.student.studentId) {
            const newUserId = parsedAuth.student.studentId
            const currentUserId = get().currentUserId

            if (currentUserId !== newUserId) {
              set({ currentUserId: newUserId })
              if (get().isInitialized) {
                get().loadFromStorage()
              }
            }
            return
          }
        } catch (e) {
          console.warn('解析認證數據失敗:', e)
        }
      }

      // 如果都沒有，設為 null
      set({ currentUserId: null })
    } catch (error) {
      console.error('更新用戶狀態失敗:', error)
      set({ currentUserId: null })
    }
  },

  getCurrentStorageKey: () => {
    const { currentUserId } = get()
    if (currentUserId) {
      return `${BASE_STORAGE_KEY}_${currentUserId}`
    }
    return BASE_STORAGE_KEY // 向後兼容，未登入時使用預設key
  },

  // ===== 數據管理 =====
  loadFromStorage: () => {
    try {
      const storageKey = get().getCurrentStorageKey()
      const saved = localStorage.getItem(storageKey)

      if (saved) {
        const bookmarkArray = JSON.parse(saved)
        set({ bookmarks: new Set(bookmarkArray) })
      } else {
        set({ bookmarks: new Set() })
      }

      console.log(`從 ${storageKey} 載入收藏:`, Array.from(get().bookmarks))
    } catch (error) {
      console.warn('無法載入收藏清單:', error)
      set({ bookmarks: new Set() })
    }
  },

  saveToStorage: () => {
    try {
      const { bookmarks } = get()
      const storageKey = get().getCurrentStorageKey()
      const bookmarkArray = Array.from(bookmarks)
      localStorage.setItem(storageKey, JSON.stringify(bookmarkArray))
      console.log(`收藏清單已保存到 ${storageKey}:`, bookmarkArray)

      // 觸發全域事件
      window.dispatchEvent(new CustomEvent('bookmarkUpdated', {
        detail: { bookmarks: bookmarkArray }
      }))
    } catch (error) {
      console.warn('無法保存收藏清單:', error)
    }
  },

  // ===== 核心 API =====
  isBookmarked: (itemId: string) => {
    return get().bookmarks.has(itemId)
  },

  addBookmark: (itemId: string) => {
    const { bookmarks } = get()
    if (!bookmarks.has(itemId)) {
      const newBookmarks = new Set(bookmarks)
      newBookmarks.add(itemId)
      set({ bookmarks: newBookmarks })
      get().saveToStorage()
      console.log(`已添加收藏: ${itemId}`)
      return true
    }
    return false
  },

  removeBookmark: (itemId: string) => {
    const { bookmarks } = get()
    if (bookmarks.has(itemId)) {
      const newBookmarks = new Set(bookmarks)
      newBookmarks.delete(itemId)
      set({ bookmarks: newBookmarks })
      get().saveToStorage()
      console.log(`已移除收藏: ${itemId}`)
      return true
    }
    return false
  },

  toggleBookmark: (itemId: string) => {
    if (get().isBookmarked(itemId)) {
      get().removeBookmark(itemId)
      return false
    } else {
      get().addBookmark(itemId)
      return true
    }
  },

  getAllBookmarks: () => {
    return Array.from(get().bookmarks)
  },

  clearAllBookmarks: () => {
    set({ bookmarks: new Set() })
    get().saveToStorage()
    console.log('已清空所有收藏')
  },

  // ===== 分類管理 =====
  getEquipmentBookmarks: () => {
    return get().getAllBookmarks().filter(item => !item.includes('教室'))
  },

  getClassroomBookmarks: () => {
    return get().getAllBookmarks().filter(item => item.includes('教室'))
  },
}))

// 自動初始化
if (typeof window !== 'undefined') {
  // 等待 DOM 準備好後初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      useBookmarkStore.getState().init()
    })
  } else {
    useBookmarkStore.getState().init()
  }
}
