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
  /** 可復原的操作（刪除後）：訊息右邊多一顆復原鈕，樣式同清單頁刪除品項的那顆；label＝讀屏／tooltip 文字 */
  undo?: { label: string; run: () => void }
}

const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 3000, type = 'success', undo }) => {
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
    <div role={type === 'error' ? 'alert' : 'status'} className={`toast ${show ? 'show' : ''} ${type === 'error' ? 'error' : ''} ${undo ? 'flex items-center gap-4' : ''}`}>
      <p>{message}</p>
      {undo && (
        <button
          type="button"
          onClick={() => { undo.run(); onClose() }}
          aria-label={undo.label}
          title={undo.label}
          className="flex items-center text-black hover:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>undo</span>
        </button>
      )}
    </div>
  )
}

export default Toast
