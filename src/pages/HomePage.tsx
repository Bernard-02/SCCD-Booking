/**
 * 首頁 - 登入畫面
 * 單欄直排（標題→登入→訪客→工作室連結），無 Header／Footer；手機置中、桌機靠右
 */

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requestPasswordReset } from '../services/authService'
import { useT } from '../stores/langStore'
import ConfirmDialog from '../components/common/ConfirmDialog'

const STUDIO_LINKS = [
  { en: 'Studio', zh: '工作室', icon: 'desk', href: 'https://drive.google.com/drive/folders/1LimCk34X8UdWWo4hQx4a3AWDxrfX8bdL?usp=drive_link' },
  { en: 'Film Studio', zh: '專業攝影棚', icon: 'photo_camera', href: 'https://drive.google.com/drive/folders/1z6eI-UGdBTNubM7bjw-0Erf4puDikobK?usp=drive_link' },
]

const HomePage = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated, currentUser } = useAuth()
  const t = useT()

  // 登入後導向：admin 進後台，其餘進型錄
  const landingPath = (role?: string) => (role === 'admin' ? '/admin' : '/catalog')
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [studentIdError, setStudentIdError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  // 忘記密碼流程狀態
  const [resetStudentId, setResetStudentId] = useState('')
  const [resetSent, setResetSent] = useState('') // 已寄出：存遮罩後的 email
  const [resetError, setResetError] = useState('')
  const [resetSending, setResetSending] = useState(false)

  const sendReset = async () => {
    if (!resetStudentId.trim() || resetSending) return
    setResetError('')
    setResetSending(true)
    const result = await requestPasswordReset(resetStudentId.trim())
    setResetSending(false)
    if (result.ok && result.maskedEmail) {
      setResetSent(result.maskedEmail)
    } else {
      setResetError(result.message || '寄送失敗')
    }
  }

  // 關閉時重置，下次打開回到輸入學號
  const closeForgotPassword = () => {
    setShowForgotPasswordModal(false)
    setResetStudentId('')
    setResetSent('')
    setResetError('')
  }

  // 如果已登入，自動導向到 BookingResourcesPage
  useEffect(() => {
    if (isAuthenticated) {
      navigate(landingPath(currentUser?.role), { replace: true })
    }
  }, [isAuthenticated, currentUser, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // 空白欄位先擋，不打 API
    const idError = studentId.trim() ? '' : '請輸入學號'
    const pwError = password ? '' : '請輸入密碼'
    setStudentIdError(idError)
    setPasswordError(pwError)
    if (idError || pwError) return

    const result = await login(studentId.trim(), password, rememberMe)

    if (result.success) {
      navigate(landingPath(result.student?.role), { replace: true })
    } else if (result.error === 'user_not_found') {
      setStudentIdError(t('ID Incorrect', '學號錯誤'))
    } else {
      setPasswordError(t('Password Incorrect', '密碼錯誤'))
    }
  }

  // 輸入框共用樣式：錯誤時改紅框（ring-inset 避免被 float-up-container 的 overflow 裁掉）
  const inputClass = (hasError: string) =>
    `w-full h-14 px-6 rounded-2xl bg-[#1a1a1a] text-sm text-white placeholder:text-white outline-none ring-inset focus:ring-1 focus:ring-white ${hasError ? 'ring-1 ring-[var(--color-error2)]' : ''}`

  return (
    <div className="bg-black text-white min-h-screen flex items-center py-16">
      <div className="container flex justify-center md:justify-end">
        {/* 單欄：手機置中、桌機靠右 */}
        <div className="w-full max-w-[340px] md:mr-[8%] float-up-container">
          <div className="float-up flex flex-col">
            <h1 className="text-lg text-center mb-16">SCCDSA Booking</h1>

            {/* 錯誤訊息固定在輸入框下方的預留槽（h-9），出現時版面不跳動 */}
            <form onSubmit={handleLogin} className="flex flex-col">
              {/* 學號 */}
              <div>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                  className={inputClass(studentIdError)}
                  placeholder={t('Student ID', '學號')}
                  aria-label={t('Student ID', '學號')}
                  aria-invalid={!!studentIdError}
                  autoComplete="username"
                />
                <p className="h-9 pt-2 px-2 text-2xs text-error2" aria-live="polite">{studentIdError}</p>
              </div>

              {/* 密碼 */}
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/[\u4E00-\u9FFF]/g, ''))}
                    className={`${inputClass(passwordError)} pr-14`}
                    placeholder={t('Password', '密碼')}
                    aria-label={t('Password', '密碼')}
                    aria-invalid={!!passwordError}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 inset-y-0 px-5 flex items-center text-white hover:opacity-70 transition-opacity cursor-pointer"
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="h-9 pt-2 px-2 text-2xs text-error2" aria-live="polite">{passwordError}</p>
              </div>

              {/* 記住我／忘記密碼 */}
              <div className="flex justify-between items-center px-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  {/* 原生 checkbox 藏起來保留鍵盤／讀屏，外觀用 Material Symbol */}
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span className="material-symbols-outlined text-white rounded-full peer-focus-visible:outline peer-focus-visible:outline-1" style={{ fontSize: '20px' }}>
                    {rememberMe ? 'check_circle' : 'circle'}
                  </span>
                  <span className="text-sm text-gray-scale2">{t('Remember Me', '記住我')}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="text-sm text-white hover:opacity-70 transition-opacity cursor-pointer"
                >
                  {t('Forgot Password?', '忘記密碼？')}
                </button>
              </div>

              <button
                type="submit"
                className="mt-5 h-14 rounded-2xl bg-white text-black text-sm hover:opacity-70 transition-opacity cursor-pointer"
              >
                {t('Login', '登入')}
              </button>
            </form>

            {/* 訪客：可逛型錄、選日期；加入清單時才要求登入（useCart 把關） */}
            <Link
              to="/catalog"
              className="mt-5 self-center text-sm text-gray-scale2 underline underline-offset-4 hover:!text-white transition-colors"
            >
              訪客登入
            </Link>

            {/* 工作室／攝影棚外部連結 */}
            <div className="mt-20 flex flex-col gap-5">
              {STUDIO_LINKS.map(({ en, zh, href, icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-16 px-6 rounded-2xl border border-white/80 flex items-center gap-5 text-white hover:bg-white hover:text-black transition-colors no-underline"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{icon}</span>
                  <span className="flex-1 text-sm">{t(en, zh)}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_outward</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 忘記密碼：沿用 ConfirmDialog 外觀；寄出後同一個框改顯示結果 */}
      <ConfirmDialog
        isOpen={showForgotPasswordModal}
        title={resetSent ? '重設信已寄出' : '忘記密碼'}
        titleEn={resetSent ? undefined : 'Forgot Password'}
        message={
          resetSent
            ? `重設密碼信已寄至 ${resetSent}，請至信箱點擊連結設定新密碼。`
            : '輸入學號，系統會寄送重設密碼連結到你的學校信箱。'
        }
        confirmText={resetSent ? 'Confirm' : 'Send'}
        confirmTextZh={resetSent ? '確認' : '寄送'}
        confirmDisabled={!resetSent && (!resetStudentId.trim() || resetSending)}
        hideCancel={!!resetSent}
        onConfirm={resetSent ? closeForgotPassword : sendReset}
        onCancel={closeForgotPassword}
      >
        {!resetSent && (
          // form 讓輸入框按 Enter 也能寄送
          <form onSubmit={(e) => { e.preventDefault(); sendReset() }} className="mt-4">
            <input
              type="text"
              value={resetStudentId}
              onChange={(e) => setResetStudentId(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
              placeholder={t('Student ID', '學號')}
              aria-label={t('Student ID', '學號')}
              autoFocus
              className="w-full px-3 py-2 bg-[#2b2b2b] border border-[#545454] text-white text-xs focus:outline-none focus:border-white rounded-lg"
            />
            {resetError && <p className="mt-2 text-2xs text-[#ff8698]">{resetError}</p>}
          </form>
        )}
      </ConfirmDialog>

    </div>
  )
}

export default HomePage
