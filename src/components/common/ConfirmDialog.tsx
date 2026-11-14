/**
 * ConfirmDialog 組件
 * 可重用的確認對話框，用於需要用戶二次確認的重要操作；
 * children 可塞輸入欄位（例：忘記密碼），hideCancel 用於只需「確認」的告知訊息，
 * closeOnly＝純資訊視窗（不顯示確認／取消列；右上 X 所有彈窗一律有，2026-11-01 統一）
 * 按 Enter＝確認（hooks/useEnterConfirm，2026-11-14），variant='danger' 除外。
 */

import { BTN } from '@/components/common/btn'
import React, { useEffect } from 'react'
import CloseButton from './CloseButton'
import { createPortal } from 'react-dom'
import { useT } from '../../stores/langStore'
import { useEnterConfirm } from '../../hooks/useEnterConfirm'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  titleEn?: string
  message?: string // 只用 children 呈現內容時可省略
  messageEn?: string
  confirmText?: string
  confirmTextZh?: string
  cancelText?: string
  cancelTextZh?: string
  onConfirm?: () => void // closeOnly 時不需要
  onCancel: () => void
  variant?: 'default' | 'danger'
  children?: React.ReactNode // 訊息下方的自訂內容
  confirmDisabled?: boolean
  hideCancel?: boolean
  closeOnly?: boolean
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
  hideCancel = false,
  closeOnly = false
}) => {
  const t = useT()
  // Enter＝確認；危險動作（刪除、取消訂單）要用點的。危險／純資訊的視窗也要佔住最上層（只是不做事）：
  // 疊在表單對話框上面時（例：修改組合裡按刪除），Enter 才不會被底下那個表單收走、直接存檔
  useEnterConfirm(isOpen, closeOnly || variant === 'danger' ? undefined : onConfirm, !confirmDisabled)
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
    variant === 'danger' ? 'text-error' : 'text-white'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      {/* 對話框容器 */}
      <div
        className="relative bg-gray-darker border border-gray-mid max-w-lg w-full mx-4 flex flex-col rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 右上 X＝取消（2026-11-01 起所有彈窗統一） */}
        <CloseButton onClick={onCancel} label={t('Close', '關閉')} className="absolute top-6 right-6" />

        {/* 標題區 */}
        <div className="px-6 pt-6 pr-14">
          <h2 className="text-sm text-white font-normal">{t(titleEn ?? title, title)}</h2>
        </div>

        {/* 內容區 */}
        <div className={`px-6 ${closeOnly ? 'pt-4 pb-6' : 'py-4'}`}>
          {message && (
            <p className="text-xs text-gray-light leading-relaxed whitespace-pre-line">
              {t(messageEn ?? message, message)}
            </p>
          )}
          {children}
        </div>

        {!closeOnly && (<>
        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-gray-mid"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          {/* 取消按鈕 */}
          {!hideCancel && (
            <button
              onClick={onCancel}
              className={`text-gray-light ${BTN}`}
            >
              <span className="text-xs">{t(cancelText, cancelTextZh)}</span>
            </button>
          )}

          {/* 確認按鈕 */}
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`${getConfirmButtonTextColor()} ${BTN}`}
          >
            <span className="text-xs">{t(confirmText, confirmTextZh)}</span>
          </button>
        </div>
        </>)}
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
