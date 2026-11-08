/**
 * 後台 2FA 關卡（AdminRoute 包在 AdminLayout 外）：帳密或 Google 登入後，這個 session 還沒過 2FA 就停在這裡。
 * 第一次（或 SQL 清掉綁定後）顯示 QR 綁定，之後輸入驗證器 App 的 6 位數驗證碼。後台只有中文。
 * 這裡只是畫面；權限防線在 user_role() 要求 aal2（supabase/admin-session-limit.sql）。換屆重新綁定見 docs/google-login-setup.md「交接」。
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getMfaStep, verifyMfa, type MfaStep } from '../../services/authService'
import { BTN } from '../common/btn'

const MfaGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth()
  const [step, setStep] = useState<MfaStep | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  // StrictMode 的 effect 會跑兩次，綁定只能開一次（開兩次畫面上的 QR 可能是失效的那個）
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    // supabase-js 在分頁暫停過後可能卡住不回（同 AuthContext）：逾時提示重新整理，關卡不放行
    Promise.race([
      getMfaStep(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ]).then(setStep).catch(() => setError('無法確認兩步驟驗證狀態，請重新整理'))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!step || step.kind === 'passed') return
    setVerifying(true)
    setError('')
    const ok = await verifyMfa(step.factorId, code)
    setVerifying(false)
    if (ok) {
      setStep({ kind: 'passed' })
    } else {
      setCode('')
      setError('驗證碼錯誤，請再試一次')
    }
  }

  if (step?.kind === 'passed') return <>{children}</>

  if (!step && !error) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="text-xs text-gray-light font-chinese">正在驗證權限…</div>
      </div>
    )
  }

  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center px-4 py-16">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col font-chinese">
        <h1 className="text-md font-bold">兩步驟驗證</h1>

        {step?.kind === 'enroll' && (
          <>
            <p className="mt-3 text-sm text-gray-light">
              第一次使用要先綁定。請先安裝 Google Authenticator，打開 App 按「＋」掃描 QR code。不要用 iPhone 相機直接掃，會跳到內建的「密碼」App，不會出現驗證碼。
            </p>
            <p className="mt-2 text-sm text-gray-light">
              要值班的人請在這一步一起掃：按確認後 QR code 不會再顯示；重新整理會換一組，之前掃的就失效。
            </p>
            <img src={step.qrCode} alt="兩步驟驗證綁定用的 QR code" className="mt-5 w-48 h-48 self-center rounded-xl bg-white p-2" />
            <p className="mt-3 text-2xs text-gray-light">
              無法掃描時手動輸入金鑰：<span className="font-english break-all text-white">{step.secret}</span>
            </p>
          </>
        )}
        {step?.kind === 'verify' && (
          <p className="mt-3 text-sm text-gray-light">請輸入手機驗證器 App 顯示的 6 位數驗證碼。</p>
        )}

        {step && (
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="mt-5 h-14 px-6 rounded-2xl bg-gray-darker font-english text-sm text-white placeholder:text-white/50 outline-none ring-inset focus:ring-1 focus:ring-white"
            placeholder="000000"
            aria-label="6 位數驗證碼"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
        )}
        <p className="h-9 pt-2 px-2 text-2xs text-error" aria-live="polite">{error}</p>
        {step && (
          <button
            type="submit"
            disabled={code.length !== 6 || verifying}
            className={`h-14 rounded-2xl bg-white text-black text-sm ${BTN}`}
          >
            確認
          </button>
        )}
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 min-h-11 self-center cursor-pointer text-sm text-gray-light underline underline-offset-4 hover:opacity-50"
        >
          登出
        </button>
      </form>
    </div>
  )
}

export default MfaGate
