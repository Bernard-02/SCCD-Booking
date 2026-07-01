/**
 * 修改個人資料對話框（密碼 / 手機號碼）
 * 目前僅前端界面與驗證，onConfirm 由上層做樂觀更新；尚未接後端。
 * 接 Firebase 時：密碼→Auth updatePassword（需先 reauthenticate）、手機→Firestore 或 Auth OTP。
 * 見 docs/firebase-backend-plan.md
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type EditMode = 'password' | 'phone'

// 錯誤訊息（雙語、簡短）
const ERRORS = {
  currentRequired: { en: 'Enter current password', zh: '請輸入目前密碼' },
  currentWrong: { en: 'Incorrect password', zh: '目前密碼錯誤' },
  tooShort: { en: 'Min. 6 characters', zh: '新密碼至少 6 個字元' },
  mismatch: { en: "Passwords don't match", zh: '兩次密碼不一致' },
  phoneInvalid: { en: 'Invalid phone number', zh: '手機號碼格式錯誤' }
}

interface EditProfileDialogProps {
  isOpen: boolean
  mode: EditMode
  currentPhone?: string
  expectedPassword?: string // 目前密碼（mock 比對用；接後端後改由 Auth reauthenticate 驗證）
  onConfirm: (value: string) => void
  onCancel: () => void
}

const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  isOpen,
  mode,
  currentPhone = '',
  expectedPassword,
  onConfirm,
  onCancel
}) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<{ en: string; zh: string } | null>(null)

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

  const handleSubmit = () => {
    if (isPassword) {
      if (!currentPassword) return setError(ERRORS.currentRequired)
      if (expectedPassword !== undefined && currentPassword !== expectedPassword) return setError(ERRORS.currentWrong)
      if (newPassword.length < 6) return setError(ERRORS.tooShort)
      if (newPassword !== confirmPassword) return setError(ERRORS.mismatch)
      onConfirm(newPassword)
    } else {
      if (!/^09\d{8}$/.test(phone)) return setError(ERRORS.phoneInvalid)
      onConfirm(phone)
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
                  placeholder="至少 6 個字元"
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

          {/* 尚未接後端提示 */}
          <p className="text-tiny text-gray-scale2">
            <span className="font-english">Demo only, changes are not saved. </span>
            <span className="font-chinese">此功能尚未接後端，變更不會儲存。</span>
          </p>
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
            className="text-white hover:opacity-70 transition-opacity cursor-pointer"
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
