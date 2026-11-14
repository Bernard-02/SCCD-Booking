/**
 * 後台路由守衛：最高權限（role === 'admin'，要過 2FA）或學會成員（值班頁，operator-access.sql）才可進入。
 * 真正的權限防線在 Supabase（RLS 與值班 RPC）；此處僅為 UX。
 */

import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchBackendAccess, type BackendAccess } from '../services/authService'
import MfaGate from './admin/MfaGate'

// 2FA 開關（2026-11-07 先關閉，要與 SQL 一起切換）：開回來的步驟見 supabase/admin-session-limit.sql 開頭
const MFA_ENABLED = false

interface AdminRouteProps {
  children: React.ReactNode
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { currentUser, isLoading, logout } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  // 學會成員的 role 還是 student，要問 server；null＝還沒問到
  const [access, setAccess] = useState<BackendAccess | null>(null)
  useEffect(() => {
    if (!currentUser || isAdmin) return
    void fetchBackendAccess().then(async a => {
      // 這次登入滿 12 小時：重新登入才有後台權限，登入後回到後台
      if (a === 'expired') { await logout(); window.location.replace('/?expired=1&redirect_url=/admin/orders'); return }
      setAccess(a ?? 'none')
    })
  }, [currentUser, isAdmin])

  if (isLoading || (currentUser && !isAdmin && access === null)) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-xs text-gray-light font-chinese">正在驗證權限…</div>
      </div>
    )
  }

  // 未登入或沒有後台權限一律導回首頁（不透露後台存在）
  if (!currentUser || (!isAdmin && access !== 'operator')) {
    return <Navigate to="/" replace />
  }

  return MFA_ENABLED && isAdmin ? <MfaGate>{children}</MfaGate> : <>{children}</>
}

/** 營業時間、文字內容只有最高權限：學會成員打網址進來導回訂單。會員／設備／空間學會成員可以看（唯讀），不包這層 */
export const AdminOnly: React.FC = () => {
  const { currentUser } = useAuth()
  return currentUser?.role === 'admin' ? <Outlet /> : <Navigate to="/admin/orders" replace />
}

export default AdminRoute
