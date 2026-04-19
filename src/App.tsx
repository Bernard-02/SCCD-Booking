/**
 * 主應用組件 + 路由設置
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DateSelectionProvider } from './contexts/DateSelectionContext'
import ProtectedRoute from './components/ProtectedRoute'

// 頁面組件
import HomePage from './pages/HomePage'
import EquipmentPage from './pages/EquipmentPage'
import SpacePage from './pages/SpacePage'
import RentalListPage from './pages/RentalListPage'
import ProfilePage from './pages/ProfilePage'
import BookingPage from './pages/BookingPage'
import BookingResourcesPage from './pages/BookingResourcesPage'
import OrderPage from './pages/OrderPage'

function App() {
  return (
    <>
      {/* Google Material Icons - 全域載入 */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

      <AuthProvider>
        <DateSelectionProvider>
          <BrowserRouter>
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
          </BrowserRouter>
        </DateSelectionProvider>
      </AuthProvider>
    </>
  )
}

export default App
