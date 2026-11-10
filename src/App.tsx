/**
 * 主應用組件 + 路由設置
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useCartSync } from './services/cartService'
import { DateSelectionProvider } from './contexts/DateSelectionContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute, { AdminOnly } from './components/AdminRoute'

// 首頁同步載入，避免初次進站出現載入畫面
import HomePage from './pages/HomePage'

// 其他頁面 lazy load，縮小 initial bundle
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'))
const SpacePage = lazy(() => import('./pages/SpacePage'))
const RentalListPage = lazy(() => import('./pages/RentalListPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const BookingResourcesPage = lazy(() => import('./pages/BookingResourcesPage'))
const AdminLayout = lazy(() => import('./components/layouts/AdminLayout'))
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage'))
const AdminHoursPage = lazy(() => import('./pages/AdminHoursPage'))
const AdminMembersPage = lazy(() => import('./pages/AdminMembersPage'))
const AdminEquipmentPage = lazy(() => import('./pages/AdminEquipmentPage'))
const AdminSpacesPage = lazy(() => import('./pages/AdminSpacesPage'))
const AdminSpaceMapPage = lazy(() => import('./pages/AdminSpaceMapPage'))
const AdminContentPage = lazy(() => import('./pages/AdminContentPage'))
const AdminNotificationsPage = lazy(() => import('./pages/AdminNotificationsPage'))

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-black text-white">
    <div className="font-chinese text-xs text-gray-light">載入中…</div>
  </div>
)

// 購物車與借用資訊跟帳號同步（services/cartService）
const CartSync = () => {
  useCartSync(useAuth().currentUser?.studentId)
  return null
}

function App() {
  return (
    <>
      <AuthProvider>
        <CartSync />
        <DateSelectionProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* 首頁 - 登入頁面 */}
                <Route path="/" element={<HomePage />} />


                {/* 租借流程 */}
                <Route path="/catalog" element={<BookingResourcesPage />} />
                <Route path="/equipment" element={<EquipmentPage />} />
                <Route path="/space" element={<SpacePage />} />
                <Route path="/cart" element={<RentalListPage />} />

                {/* 用戶相關 */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* 後台：側欄外框 + 各分區；值班三頁最高權限與學會成員都能用，其餘（設定）只有最高權限 */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  {/* 總覽已拿掉（2026-10-24），/admin 直接進訂單 */}
                  <Route index element={<Navigate to="orders" replace />} />
                  <Route path="orders" element={<AdminOrdersPage />} />
                  <Route path="space-map" element={<AdminSpaceMapPage />} />
                  <Route path="notifications" element={<AdminNotificationsPage />} />
                  <Route element={<AdminOnly />}>
                    <Route path="hours" element={<AdminHoursPage />} />
                    <Route path="members" element={<AdminMembersPage />} />
                    <Route path="equipment" element={<AdminEquipmentPage />} />
                    <Route path="spaces" element={<AdminSpacesPage />} />
                    <Route path="content" element={<AdminContentPage />} />
                  </Route>
                </Route>

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
