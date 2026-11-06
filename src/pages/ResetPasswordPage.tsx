/**
 * 重設密碼頁
 * 使用者從重設信的連結進入（Supabase 會在網址帶 recovery token，
 * supabase-js 自動換成 session），在此設定新密碼。
 */

import { BTN } from '@/components/common/btn'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { updatePassword } from '../services/authService'
import { useT } from '../stores/langStore'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'

const ResetPasswordPage = () => {
  const t = useT()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false) // recovery session 是否就緒
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // 確認 recovery session（直接打開此頁而沒有點信中連結時，顯示提示）
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(data.session !== null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(t('Password must be at least 8 characters.', '密碼至少 8 碼'))
      return
    }
    if (password !== confirm) {
      setError(t('The two passwords don’t match.', '兩次輸入的密碼不一致'))
      return
    }

    const result = await updatePassword(password)
    if (!result.ok) {
      setError(result.message || t('Couldn’t set the password. Please open the link in the email again.', '設定失敗，請重新從信中連結進入'))
      return
    }

    setDone(true)
    // 重設完成後登出 recovery session，回首頁用新密碼登入
    await supabase.auth.signOut()
    setTimeout(() => navigate('/', { replace: true }), 2500)
  }

  return (
    <div className="bg-black text-white h-dvh flex flex-col">
      <Header hideNavigation />

      <section className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="text-xl text-white mb-6">
            {t('Reset Password', '重設密碼')}
          </h1>

          {done ? (
            <p className="text-md text-gray-light font-chinese">
              密碼已更新，即將回到登入頁…
            </p>
          ) : !ready ? (
            <p className="text-md text-gray-light font-chinese">
              請從「忘記密碼」重設信中的連結進入此頁。
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('New password', '新密碼（至少 8 碼）')}
                className="font-english w-full px-4 py-3 bg-gray-darker border border-gray-mid rounded-lg text-white text-md focus:outline-none focus:border-white"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('Confirm password', '再次輸入新密碼')}
                className="font-english w-full px-4 py-3 bg-gray-darker border border-gray-mid rounded-lg text-white text-md focus:outline-none focus:border-white"
              />
              {error && <p className="text-2xs text-error">{error}</p>}
              <button
                type="submit"
                disabled={!password || !confirm}
                className={`w-full py-3 rounded-lg text-md font-normal bg-white text-black ${BTN}`}
              >
                {t('Confirm', '確認')}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default ResetPasswordPage
