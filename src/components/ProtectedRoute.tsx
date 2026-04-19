/**
 * 受保護的路由組件
 * 需要登入才能訪問的頁面使用此組件包裝
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // 正在載入認證狀態時，顯示載入畫面
  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-['Inter',_sans-serif] mb-4">(LOADING...)</div>
          <div className="text-sm text-gray-400">正在驗證登入狀態</div>
        </div>
      </div>
    )
  }

  // 未登入時，重定向到登入頁面，並記錄原始 URL
  if (!isAuthenticated) {
    // 將當前頁面 URL 作為 redirect_url 參數傳遞
    const redirectUrl = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect_url=${redirectUrl}`} replace />
  }

  // 已登入，顯示受保護的內容
  return <>{children}</>
}

export default ProtectedRoute
