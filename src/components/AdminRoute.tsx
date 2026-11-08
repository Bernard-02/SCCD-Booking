/**
 * 後台路由守衛：需登入且 role === 'admin'，並通過 2FA（MfaGate）才可進入。
 * 真正的權限防線在 Supabase RLS（admin 才讀改得到全部資料）；此處僅為 UX，擋非 admin。
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MfaGate from './admin/MfaGate'

// 2FA 開關（2026-11-07 先關閉，要與 SQL 一起切換）：開回來的步驟見 supabase/admin-session-limit.sql 開頭
const MFA_ENABLED = false

interface AdminRouteProps {
  children: React.ReactNode
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { currentUser, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-xs text-gray-light font-chinese">正在驗證權限…</div>
      </div>
    )
  }

  // 未登入或非 admin 一律導回首頁（不透露後台存在）
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return MFA_ENABLED ? <MfaGate>{children}</MfaGate> : <>{children}</>
}

export default AdminRoute
