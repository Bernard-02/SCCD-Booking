/**
 * 首頁 - 登入畫面
 * 單欄直排（標題→登入→訪客→工作室連結），無 Header／Footer；手機置中、桌機靠右
 * 預設 Google 登入（google-login.sql，學生與後台都走這條）；學號＋密碼退為備援（2026-11-09 定）：Google 鈕下方左「學號密碼登入」、右「訪客模式」，兩種表單可互切。
 */

import { BTN } from '@/components/common/btn'
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { renderGoogleButton } from '../services/authService'
import { useT, useLangStore } from '../stores/langStore'

const STUDIO_LINKS = [
  { en: 'Studio', zh: '工作室', icon: 'desk', href: 'https://drive.google.com/drive/folders/1LimCk34X8UdWWo4hQx4a3AWDxrfX8bdL?usp=drive_link' },
  { en: 'Film Studio', zh: '專業攝影棚', icon: 'photo_camera', href: 'https://drive.google.com/drive/folders/1z6eI-UGdBTNubM7bjw-0Erf4puDikobK?usp=drive_link' },
]

// 線框卡片鈕（工作室連結、學號密碼／訪客）：hover 反白＝白底黑字（CLAUDE.md 線框鈕連結版）
const OUTLINE_CARD = 'rounded-2xl border border-white/50 flex items-center text-white hover:bg-white hover:border-white hover:text-black no-underline'
// 學號密碼／訪客並排半寬：icon 那側少 4px
const OPTION_CLS = `${OUTLINE_CARD} h-14 pl-4 pr-5 gap-3 text-sm whitespace-nowrap`

// LINE／IG／FB 內建瀏覽器：Google 不給在 App 內嵌網頁登入（disallowed_useragent）
const IN_APP = /Line\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent)

// Google 標誌（品牌規範：登入鈕要放原色 G）
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

const HomePage = () => {
  const navigate = useNavigate()
  const { login, loginWithGoogle, isAuthenticated, currentUser } = useAuth()
  const t = useT()
  const lang = useLangStore((s) => s.lang)
  const [passwordMode, setPasswordMode] = useState(false) // 學號＋密碼表單
  const [googleError, setGoogleError] = useState('')
  const [searchParams] = useSearchParams()
  // 登入後回跳的頁面（訪客按加入清單／ProtectedRoute 帶來的）
  const redirectUrl = searchParams.get('redirect_url')
  // 後台被導回來（到期）：借錯誤槽提示，不然值班的人會以為壞了
  const sessionNotice = searchParams.get('expired') ? t('Your session has expired. Please log in again.', '登入已過期，請重新登入') : ''

  // 登入後導向：admin 進後台，其餘回到被擋下的頁面或型錄
  const landingPath = (role?: string) =>
    role === 'admin' ? '/admin/orders' : redirectUrl?.startsWith('/') ? redirectUrl : '/catalog'
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [studentIdError, setStudentIdError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // 如果已登入，自動導向到 BookingResourcesPage
  useEffect(() => {
    if (isAuthenticated) {
      navigate(landingPath(currentUser?.role), { replace: true })
    }
  }, [isAuthenticated, currentUser, navigate])

  // Google 按鈕由 Google 畫（authService.renderGoogleButton），切回 Google 模式時重畫；選完帳號在本頁登入，不跳頁。
  // Google 登入一律記住（2026-11-10）：瀏覽器裡的 Google 帳號本來就一直登入著，關分頁登出也擋不住下一個人按一下就進來，
  // 所以不給選；共用電腦要靠登出＋登出 Google。記住我只留給學號密碼（學會櫃檯的 sccdsa）
  const googleBtnRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = googleBtnRef.current
    if (!el) return
    renderGoogleButton(el, lang === 'en' ? 'en' : 'zh-TW', async (token, nonce) => {
      setGoogleError('')
      const result = await loginWithGoogle(token, nonce, true)
      if (result.success) navigate(landingPath(result.student?.role), { replace: true })
      else setGoogleError(result.message ?? '')
    }).catch(err => {
      console.error('[auth]', err)
      setGoogleError(t('Couldn’t connect to Google. Please try again later.', '無法連線到 Google，請稍後再試'))
    })
  }, [passwordMode, lang])

  // App 內建瀏覽器不畫 Google 按鈕（Google 不給登入），放同樣子的鈕說明原因
  const handleInApp = () => {
    // LINE 認 openExternalBrowser=1，會改用手機預設瀏覽器開；IG／FB 只能請學生自己開
    if (/Line\//i.test(navigator.userAgent)) {
      window.location.href = `${window.location.origin}/?openExternalBrowser=1`
      return
    }
    setGoogleError(t(
      'Google sign-in doesn’t work in in-app browsers. Please open this page in Safari or Chrome.',
      'App 內建瀏覽器無法使用 Google 登入，請改用 Safari 或 Chrome 開啟本頁'
    ))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // 空白欄位先擋，不打 API
    const idError = studentId.trim() ? '' : t('Please enter your student ID', '請輸入學號')
    const pwError = password ? '' : t('Please enter your password', '請輸入密碼')
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
    `font-english w-full h-14 px-6 rounded-2xl bg-gray-darker text-sm text-white placeholder:text-white/50 outline-none ring-inset focus:ring-1 focus:ring-white ${hasError ? 'ring-1 ring-error' : ''}`

  return (
    <div className="bg-black text-white min-h-screen flex items-center py-16">
      <div className="container flex justify-center md:justify-end">
        {/* 單欄：手機置中、桌機靠右 */}
        <div className="w-full max-w-[340px] md:mr-[8%] float-up-container">
          <div className="float-up flex flex-col">
            <h1 className={`font-english text-lg text-center ${redirectUrl ? 'mb-6' : 'mb-16'}`}>SCCDSA Booking</h1>
            {/* 被擋下才來登入（加入清單／進 Profile）：說明原因 */}
            {redirectUrl && (
              <p className="mb-6 text-center text-sm text-gray-light">{t('Please log in to continue', '請先登入以繼續')}</p>
            )}

            {!passwordMode ? (
              <div className="flex flex-col">
                {IN_APP ? (
                  <button
                    type="button"
                    onClick={handleInApp}
                    className={`h-14 rounded-2xl bg-white text-black text-sm flex items-center justify-center gap-3 ${BTN}`}
                  >
                    <GoogleIcon />
                    {t('Continue with School Google Account', '使用學校 Google 帳號登入')}
                  </button>
                ) : (
                  // Google 畫的按鈕（高 40px，寬＝容器）；文字是 Google 的，「學校帳號」寫在下面
                  <div ref={googleBtnRef} className="min-h-10" />
                )}
                {/* 錯誤預留槽（同密碼表單），沒錯誤時提示選學校帳號；原因可能兩行，用 min-h */}
                <p className={`min-h-9 pt-2 px-2 text-2xs ${googleError || sessionNotice ? 'text-error' : 'text-gray-light'}`} aria-live="polite">
                  {googleError || sessionNotice || t('Please choose your school account (@gm／gm1／gm2.usc.edu.tw)', '請選擇學校帳號（@gm／gm1／gm2.usc.edu.tw）')}
                </p>
              </div>
            ) : (
            /* 錯誤訊息固定在輸入框下方的預留槽（h-9），出現時版面不跳動 */
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
                <p className="h-9 pt-2 px-2 text-2xs text-error" aria-live="polite">{studentIdError}</p>
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
                    className={`absolute right-0 inset-y-0 px-5 flex items-center text-white ${BTN}`}
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="h-9 pt-2 px-2 text-2xs text-error" aria-live="polite">{passwordError || sessionNotice}</p>
              </div>

              {/* 記住我（忘記密碼 2026-11-09 拿掉：一律 Google 登入，不做 SMTP；sccdsa 忘記密碼到 Supabase 後台重設） */}
              <div className="flex items-center px-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  {/* 全站共用圓形 checkbox（css/common.css .custom-checkbox） */}
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span className="text-sm text-gray-light">{t('Remember Me', '記住我')}</span>
                </label>
              </div>

              <button
                type="submit"
                className={`mt-5 h-14 rounded-2xl bg-white text-black text-sm ${BTN}`}
              >
                {t('Login', '登入')}
              </button>
            </form>
            )}

            {/* 左：兩種登入互切；右：訪客（可逛型錄、選日期，加入清單時才要求登入，useCart 把關）。
                樣子同下方工作室連結；半寬塞不下長英文，英文用短的 */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setPasswordMode(!passwordMode); setGoogleError('') }}
                className={`${OPTION_CLS} cursor-pointer`}
              >
                {passwordMode
                  ? <><span className="w-5 flex justify-center"><GoogleIcon /></span>{t('Google', 'Google 登入')}</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>badge</span>{t('Student ID', '學號密碼登入')}</>}
              </button>
              <Link to="/catalog" className={OPTION_CLS}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
                {t('Guest', '訪客模式')}
              </Link>
            </div>

            {/* 工作室／攝影棚外部連結 */}
            <div className="mt-20 flex flex-col gap-5">
              {STUDIO_LINKS.map(({ en, zh, href, icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${OUTLINE_CARD} h-16 px-6 gap-5`}
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

    </div>
  )
}

export default HomePage
