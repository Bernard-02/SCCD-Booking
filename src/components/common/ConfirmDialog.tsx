/**
 * ConfirmDialog 組件
 * 可重用的確認對話框，用於需要用戶二次確認的重要操作；
 * children 可塞輸入欄位（例：忘記密碼），hideCancel 用於只需「確認」的告知訊息
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../stores/langStore'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  titleEn?: string
  message: string
  messageEn?: string
  confirmText?: string
  confirmTextZh?: string
  cancelText?: string
  cancelTextZh?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'danger'
  children?: React.ReactNode // 訊息下方的自訂內容
  confirmDisabled?: boolean
  hideCancel?: boolean
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  titleEn,
  message,
  messageEn,
  confirmText = 'Confirm',
  confirmTextZh = '確認',
  cancelText = 'Cancel',
  cancelTextZh = '取消',
  onConfirm,
  onCancel,
  variant = 'default',
  children,
  confirmDisabled = false,
  hideCancel = false
}) => {
  const t = useT()
  // 按 ESC 鍵關閉對話框
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onCancel])

  // 阻止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  // 根據 variant 設置確認按鈕文字顏色
  const getConfirmButtonTextColor = () =>
    variant === 'danger' ? 'text-[#ff8698]' : 'text-white'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      {/* 對話框容器 */}
      <div
        className="bg-[#151515] border border-[#545454] max-w-lg w-full mx-4 flex flex-col rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6">
          <h2 className="text-sm text-white font-normal">{t(titleEn ?? title, title)}</h2>
        </div>

        {/* 內容區 */}
        <div className="px-6 py-4">
          <p className="text-xs text-[#cccccc] leading-relaxed whitespace-pre-line">
            {t(messageEn ?? message, message)}
          </p>
          {children}
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          {/* 取消按鈕 */}
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="text-[#cccccc] hover:text-white transition-colors cursor-pointer"
            >
              <span className="text-xs">{t(cancelText, cancelTextZh)}</span>
            </button>
          )}

          {/* 確認按鈕 */}
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`${getConfirmButtonTextColor()} hover:opacity-70 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <span className="text-xs">{t(confirmText, confirmTextZh)}</span>
          </button>
        </div>
      </div>

      {/* 淡入動畫 */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default ConfirmDialog
