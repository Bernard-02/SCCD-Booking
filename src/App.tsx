/**
 * 主應用組件 + 路由設置
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DateSelectionProvider } from './contexts/DateSelectionContext'
import ProtectedRoute from './components/ProtectedRoute'

// 首頁同步載入，避免初次進站出現載入畫面
import HomePage from './pages/HomePage'

// 其他頁面 lazy load，縮小 initial bundle
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'))
const SpacePage = lazy(() => import('./pages/SpacePage'))
const RentalListPage = lazy(() => import('./pages/RentalListPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const BookingResourcesPage = lazy(() => import('./pages/BookingResourcesPage'))
const OrderPage = lazy(() => import('./pages/OrderPage'))

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-black text-white">
    <div className="font-chinese text-sm text-zinc-400">載入中…</div>
  </div>
)

function App() {
  return (
    <>
      {/* Google Material Icons - 全域載入 */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

      <AuthProvider>
        <DateSelectionProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* 首頁 - 登入頁面 */}
                <Route path="/" element={<HomePage />} />

                {/* 租借流程 */}
                <Route path="/booking" element={<BookingResourcesPage />} />
                <Route path="/catalog" element={<BookingResourcesPage />} />
                <Route path="/booking-date" element={<BookingPage />} />
                <Route path="/equipment" element={<EquipmentPage />} />
                <Route path="/space" element={<SpacePage />} />
                <Route path="/rental-list" element={<RentalListPage />} />

                {/* 用戶相關 */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* 訂單詳情 */}
                <Route path="/order" element={<OrderPage />} />

                {/* 404 重定向到首頁 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DateSelectionProvider>
      </AuthProvider>
    </>
  )
}

export default App
