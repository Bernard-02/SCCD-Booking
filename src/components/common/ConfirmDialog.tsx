/**
 * ConfirmDialog 組件
 * 可重用的確認對話框，用於需要用戶二次確認的重要操作
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

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
  variant = 'default'
}) => {
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
        className="bg-[#151515] border border-[#545454] max-w-lg w-full mx-4 flex flex-col rounded-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題區 */}
        <div className="px-6 pt-6">
          <h2 className="font-['Inter',_sans-serif] text-small-title text-white font-medium">
            {titleEn && <>{titleEn} </>}
            <span className="font-['Noto_Sans_TC',_sans-serif]">{title}</span>
          </h2>
        </div>

        {/* 內容區 */}
        <div className="px-6 py-4">
          {messageEn && (
            <p className="font-['Inter',_sans-serif] text-tiny text-[#cccccc] leading-relaxed whitespace-pre-line mb-2">
              {messageEn}
            </p>
          )}
          <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc] leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          {/* 取消按鈕 */}
          <button
            onClick={onCancel}
            className="text-[#cccccc] hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-['Inter',_sans-serif] text-tiny">
              {cancelText}{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">{cancelTextZh}</span>
            </span>
          </button>

          {/* 確認按鈕 */}
          <button
            onClick={onConfirm}
            className={`${getConfirmButtonTextColor()} hover:opacity-70 transition-opacity cursor-pointer`}
          >
            <span className="font-['Inter',_sans-serif] text-tiny">
              {confirmText}{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">{confirmTextZh}</span>
            </span>
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
