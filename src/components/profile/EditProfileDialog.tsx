/**
 * 修改個人資料對話框（密碼 / 手機號碼）
 * 密碼：由上層以目前密碼重新驗證後更新（Supabase Auth）；
 * 手機：由上層寫入 students 表（RPC update_my_phone）。
 * onConfirm 回傳結果，失敗時在對話框內顯示錯誤、不關閉。
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type EditMode = 'password' | 'phone'

// 錯誤訊息（雙語、簡短）
const ERRORS = {
  currentRequired: { en: 'Enter current password', zh: '請輸入目前密碼' },
  currentWrong: { en: 'Incorrect password', zh: '目前密碼錯誤' },
  tooShort: { en: 'Min. 8 characters', zh: '新密碼至少 8 個字元' },
  mismatch: { en: "Passwords don't match", zh: '兩次密碼不一致' },
  phoneInvalid: { en: 'Invalid phone number', zh: '手機號碼格式錯誤' },
  saveFailed: { en: 'Save failed, try again', zh: '儲存失敗，請再試一次' }
}

export interface EditConfirmResult {
  ok: boolean
  // 密碼模式：目前密碼錯誤時 wrongCurrent = true；其他失敗給 message
  wrongCurrent?: boolean
  message?: { en: string; zh: string }
}

interface EditProfileDialogProps {
  isOpen: boolean
  mode: EditMode
  currentPhone?: string
  onConfirm: (value: string, currentPassword?: string) => Promise<EditConfirmResult>
  onCancel: () => void
}

const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  isOpen,
  mode,
  currentPhone = '',
  onConfirm,
  onCancel
}) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<{ en: string; zh: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 開啟時重置欄位
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPhone(currentPhone)
      setError(null)
    }
  }, [isOpen, currentPhone, mode])

  // ESC 關閉 + 阻止背景滾動
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel()
    }
    window.addEventListener('keydown', handleEsc)
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isPassword = mode === 'password'

  const handleSubmit = async () => {
    if (submitting) return

    if (isPassword) {
      if (!currentPassword) return setError(ERRORS.currentRequired)
      if (newPassword.length < 8) return setError(ERRORS.tooShort)
      if (newPassword !== confirmPassword) return setError(ERRORS.mismatch)

      setSubmitting(true)
      const result = await onConfirm(newPassword, currentPassword)
      setSubmitting(false)
      if (!result.ok) {
        setError(result.wrongCurrent ? ERRORS.currentWrong : (result.message ?? ERRORS.saveFailed))
      }
    } else {
      if (!/^09\d{8}$/.test(phone)) return setError(ERRORS.phoneInvalid)

      setSubmitting(true)
      const result = await onConfirm(phone)
      setSubmitting(false)
      if (!result.ok) {
        setError(result.message ?? ERRORS.saveFailed)
      }
    }
  }

  const inputClass =
    'w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-tiny focus:outline-none focus:border-white rounded-lg'
  const labelClass = 'block mb-2 text-tiny text-[#cccccc]'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-[#545454] max-w-md w-full mx-4 flex flex-col rounded-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 標題 */}
        <div className="px-6 pt-6">
          <h2 className="font-['Inter',_sans-serif] text-small-title text-white font-medium">
            {isPassword ? 'Change Password ' : 'Change Phone '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">
              {isPassword ? '修改密碼' : '修改手機號碼'}
            </span>
          </h2>
        </div>

        {/* 表單 */}
        <div className="px-6 py-4 space-y-4">
          {isPassword ? (
            <>
              <div>
                <label className={labelClass}>
                  <span className="font-['Inter',_sans-serif]">Current Password </span>
                  <span className="font-['Noto_Sans_TC',_sans-serif]">目前密碼</span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  placeholder="請輸入目前密碼"
                />
              </div>
              <div>
                <label className={labelClass}>
                  <span className="font-['Inter',_sans-serif]">New Password </span>
                  <span className="font-['Noto_Sans_TC',_sans-serif]">新密碼</span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="至少 8 個字元"
                />
              </div>
              <div>
                <label className={labelClass}>
                  <span className="font-['Inter',_sans-serif]">Confirm New Password </span>
                  <span className="font-['Noto_Sans_TC',_sans-serif]">確認新密碼</span>
                  <span className="text-[#ff8698] ml-1">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="再次輸入新密碼"
                />
              </div>
            </>
          ) : (
            <div>
              <label className={labelClass}>
                <span className="font-['Inter',_sans-serif]">Phone Number </span>
                <span className="font-['Noto_Sans_TC',_sans-serif]">手機號碼</span>
                <span className="text-[#ff8698] ml-1">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="09xxxxxxxx"
              />
            </div>
          )}

          {error && (
            <p className="text-tiny text-[#ff8698]">
              <span className="font-english">{error.en}</span>{' '}
              <span className="font-chinese">{error.zh}</span>
            </p>
          )}

        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-[#545454]"></div>
        </div>

        {/* 按鈕 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          <button
            onClick={onCancel}
            className="text-[#cccccc] hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-['Inter',_sans-serif] text-tiny">
              Cancel <span className="font-['Noto_Sans_TC',_sans-serif]">取消</span>
            </span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`transition-opacity ${submitting ? 'text-gray-scale2 cursor-not-allowed' : 'text-white hover:opacity-70 cursor-pointer'}`}
          >
            <span className="font-['Inter',_sans-serif] text-tiny">
              Save <span className="font-['Noto_Sans_TC',_sans-serif]">儲存</span>
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default EditProfileDialog
