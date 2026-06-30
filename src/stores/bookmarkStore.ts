/**
 * 收藏管理 Store
 * 基於原有的 UnifiedBookmarkManager 邏輯，使用 Zustand 實現
 */

import { create } from 'zustand'
import { getCurrentStudentId } from '../utils/authStorage'

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
        get().loadFromStorage()
      }
    })

    // 監聽頁面可見性變化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        get().updateCurrentUser()
      }
    })

    set({ isInitialized: true })
  },

  // ===== 用戶管理 =====
  updateCurrentUser: () => {
    // 從 localStorage→sessionStorage 讀取目前登入者學號（無資料/未登入回傳 null）
    const newUserId = getCurrentStudentId()
    const currentUserId = get().currentUserId

    if (newUserId) {
      // 已登入：用戶變更時才重新載入書籤
      if (currentUserId !== newUserId) {
        set({ currentUserId: newUserId })
        if (get().isInitialized) {
          get().loadFromStorage()
        }
      }
    } else {
      // 未登入：重設為匿名（切回預設書籤 key）
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
