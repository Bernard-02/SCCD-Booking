/**
 * 帳號停權狀態（情境 7）
 * 先用登入快照的 accountLevel 立即顯示，掛載後即時查 Supabase 更新——
 * 登入中途被停權（或被解鎖）不用重新登入就會反映。
 * 真正的防線在 submit_orders RPC；此 hook 供 UI 鎖按鈕／擋購物車用。
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyAccountLevel } from '../services/authService'

export const useSuspension = (): boolean => {
  const { currentUser } = useAuth()
  const [isSuspended, setIsSuspended] = useState((currentUser?.accountLevel ?? 0) >= 5)

  useEffect(() => {
    setIsSuspended((currentUser?.accountLevel ?? 0) >= 5)
    fetchMyAccountLevel().then(level => {
      if (level !== null) setIsSuspended(level >= 5)
    })
  }, [currentUser])

  return isSuspended
}
