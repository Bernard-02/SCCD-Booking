/**
 * Toast 通知組件
 * 使用與 css/common.css 相同的樣式（從右側滑入）
 */

import React, { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  onClose: () => void
  duration?: number
  type?: 'success' | 'error'
}

const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 3000, type = 'success' }) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 延遲顯示動畫
    setTimeout(() => setShow(true), 10)

    // 自動關閉
    const timer = setTimeout(() => {
      setShow(false)
      setTimeout(onClose, 400) // 等待動畫完成後才調用 onClose
    }, duration)

    return () => clearTimeout(timer)
  }, [onClose, duration])

  // 樣式全部交給 css/common.css 的 .toast 系列（含 show/error 狀態與手機版），這裡只切 class。
  // role：讀屏會唸出來（錯誤用 alert 立刻插話，其餘 status 等目前的話唸完）
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`toast ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}>
      <p>{message}</p>
    </div>
  )
}

export default Toast
