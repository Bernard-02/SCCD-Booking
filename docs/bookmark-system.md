# 收藏系統文檔

## 概述

收藏系統允許已登入的用戶收藏設備和教室，並將收藏數據按用戶分別存儲在 localStorage 中。

## 架構

### 1. Zustand Store (`src/stores/bookmarkStore.ts`)

使用 Zustand 管理收藏狀態，提供以下功能：

#### 狀態
- `bookmarks: Set<string>` - 當前用戶的收藏列表
- `currentUserId: string | null` - 當前登入用戶的 ID
- `isInitialized: boolean` - 初始化狀態

#### 核心方法
- `init()` - 初始化系統
- `isBookmarked(itemId)` - 檢查是否已收藏
- `addBookmark(itemId)` - 添加收藏
- `removeBookmark(itemId)` - 移除收藏
- `toggleBookmark(itemId)` - 切換收藏狀態
- `getAllBookmarks()` - 獲取所有收藏
- `clearAllBookmarks()` - 清空所有收藏

#### 分類方法
- `getEquipmentBookmarks()` - 獲取設備收藏
- `getClassroomBookmarks()` - 獲取教室收藏

### 2. 數據存儲

#### Storage Key 規則
- 未登入：`sccd_bookmarks`
- 已登入：`sccd_bookmarks_{studentId}`

這確保每個用戶的收藏數據是獨立的。

#### 認證系統兼容
系統同時兼容兩種認證方式：
1. **舊版 JS 認證**：通過 `window.AuthStorage` 檢查
2. **React 版認證**：通過 `localStorage.getItem('sccd_auth')` 檢查

### 3. 自動同步

系統會在以下情況自動同步數據：
- Storage 變化（跨頁面/Tab 同步）
- 認證狀態變化
- 頁面可見性變化

## 使用方法

### 在組件中使用

```typescript
import { useBookmarkStore } from '../../stores/bookmarkStore'

const MyComponent = () => {
  const bookmarkStore = useBookmarkStore()

  // 檢查是否已收藏
  const isBookmarked = bookmarkStore.isBookmarked('equipment-id')

  // 切換收藏
  const handleToggle = () => {
    // 檢查登入狀態
    if (bookmarkStore.currentUserId === null) {
      alert('請先登入')
      return
    }

    bookmarkStore.toggleBookmark('equipment-id')
  }

  // 獲取所有收藏
  const allBookmarks = bookmarkStore.getAllBookmarks()

  return (
    <button onClick={handleToggle}>
      {isBookmarked ? '已收藏' : '收藏'}
    </button>
  )
}
```

### 監聽收藏變化

組件可以監聽全域事件來響應收藏變化：

```typescript
useEffect(() => {
  const handleBookmarkUpdate = () => {
    // 更新組件狀態
  }

  window.addEventListener('bookmarkUpdated', handleBookmarkUpdate)
  return () => window.removeEventListener('bookmarkUpdated', handleBookmarkUpdate)
}, [])
```

## 事件系統

### bookmarkManagerReady
當 bookmark 系統初始化完成時觸發。

### bookmarkUpdated
當收藏數據變化時觸發，包含以下 detail：
```typescript
{
  bookmarks: string[]  // 當前所有收藏
}
```

### authStateChanged
當認證狀態變化時觸發，bookmark 系統會自動響應並重新載入數據。

## 實現的組件

### EquipmentGrid
- 顯示設備列表
- 支持 bookmark 功能
- 「常用設備」篩選會顯示所有已收藏的設備
- 顯示 Toast 通知

### EquipmentCard
- 設備卡片視圖
- 支持 bookmark 功能
- 自動同步 bookmark 狀態

## 與舊版系統的兼容性

新系統完全兼容舊版 `js/bookmark.js` 的數據格式：
1. 使用相同的 storage key 命名規則
2. 使用相同的數據結構（JSON 數組）
3. 支持舊版認證系統（AuthStorage）

這意味著：
- 舊頁面的收藏數據可以在新頁面中讀取
- 新頁面的收藏數據可以在舊頁面中讀取
- 用戶在不同頁面間切換時收藏狀態保持一致

## 未來改進

1. **UNDO 功能**：移除收藏時顯示帶 UNDO 按鈕的 Toast
2. **收藏數量限制**：設置每個用戶的收藏上限
3. **收藏排序**：支持按時間、名稱等排序收藏列表
4. **批量操作**：支持批量添加/移除收藏
5. **服務器同步**：將收藏數據同步到服務器
