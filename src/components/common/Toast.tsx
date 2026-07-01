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

  return (
    <div
      className={`toast ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}
      style={{
        position: 'fixed',
        top: '4rem',
        right: show ? '2rem' : '-400px',
        backgroundColor: type === 'error' ? 'var(--color-bg-toast-error)' : 'var(--color-bg-toast)',
        color: type === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        zIndex: 50,
        opacity: show ? 1 : 0,
        transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        width: 'fit-content',
        minWidth: '150px',
        maxWidth: '600px',
        whiteSpace: 'nowrap'
      }}
    >
      <p style={{
        fontSize: '0.875rem',
        fontFamily: "'Noto Sans TC', sans-serif",
        lineHeight: 1.4,
        textAlign: 'center',
        margin: 0
      }}>
        {message}
      </p>
    </div>
  )
}

export default Toast
