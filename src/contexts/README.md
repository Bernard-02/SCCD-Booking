# 認證系統架構說明

## 概述

本專案使用 **React Context Pattern** 來管理全局認證狀態，並預留了 Firebase 整合接口。

## 架構優勢

### ✅ 符合 React 最佳實踐
- 使用 Context API 管理全局狀態
- 避免 prop drilling
- 組件之間狀態自動同步

### ✅ 類型安全
- 完整的 TypeScript 類型定義
- 編譯時錯誤檢查

### ✅ 易於測試
- 可以輕鬆 mock AuthProvider
- 組件與認證邏輯分離

### ✅ 可擴展性
- 預留 Firebase 接口
- 可以輕鬆替換成其他認證服務（Supabase、Auth0 等）

## 使用方式

### 1. 基本使用（目前的模擬 API）

```tsx
// App.tsx
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      {/* 你的應用 */}
    </AuthProvider>
  )
}
```

### 2. 在組件中使用

```tsx
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { currentUser, isAuthenticated, login, logout } = useAuth()

  const handleLogin = async () => {
    const result = await login('A111144001', '20030911', true)
    if (result.success) {
      console.log('登入成功')
    }
  }

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>歡迎, {currentUser?.name}</p>
          <button onClick={logout}>登出</button>
        </div>
      ) : (
        <button onClick={handleLogin}>登入</button>
      )}
    </div>
  )
}
```

### 3. 保護路由

```tsx
import ProtectedRoute from './components/ProtectedRoute'

<Route
  path="/profile"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>
```

## 整合 Firebase

### 步驟 1：安裝 Firebase

```bash
npm install firebase
```

### 步驟 2：配置 Firebase

1. 將 `src/services/firebaseAuthService.example.ts` 重命名為 `firebaseAuthService.ts`
2. 在 Firebase Console 創建專案
3. 填入你的 Firebase 配置

### 步驟 3：使用 Firebase 服務

```tsx
// App.tsx
import { AuthProvider } from './contexts/AuthContext'
import { firebaseAuthService } from './services/firebaseAuthService'

function App() {
  return (
    <AuthProvider authService={firebaseAuthService}>
      {/* 你的應用 */}
    </AuthProvider>
  )
}
```

## API 文件

### `useAuth()` Hook

返回以下屬性和方法：

#### 狀態屬性

- **`currentUser`**: `Student | null` - 當前登入的用戶資料
- **`isLoading`**: `boolean` - 是否正在載入認證狀態
- **`isAuthenticated`**: `boolean` - 是否已登入

#### 方法

- **`login(studentId, password, rememberMe?)`**: `Promise<LoginResult>`
  - 登入方法
  - 參數：
    - `studentId`: 學號
    - `password`: 密碼
    - `rememberMe`: 是否記住登入狀態（可選，預設 false）

- **`logout()`**: `Promise<void>`
  - 登出方法

- **`refreshUser()`**: `Promise<void>`
  - 重新載入用戶資料

### `ProtectedRoute` 組件

用於保護需要登入才能訪問的路由。

**Props:**
- `children`: 需要保護的組件

**行為:**
- 未登入時自動重定向到 `/login`
- 記錄原始 URL 作為 `redirect_url` 參數
- 登入成功後自動返回原頁面

## 資料流

```
User Input (Login Form)
    ↓
LoginPage calls useAuth().login()
    ↓
AuthContext.login()
    ↓
authService.login() or mockApiLogin()
    ↓
Save to localStorage/sessionStorage
    ↓
Update currentUser state
    ↓
All components using useAuth() re-render
    ↓
ProtectedRoute allows access
```

## 測試帳號

```
學號：A111144001
密碼：20030911
```

```
學號：A111141003
密碼：20020515
```

## 未來改進

- [ ] 實現 Firebase Authentication
- [ ] 加入 OAuth 登入（Google、Facebook 等）
- [ ] 實現雙因素認證（2FA）
- [ ] 加入密碼重置功能
- [ ] 實現 Email 驗證流程
- [ ] 加入 Session 管理（多設備登入控制）
