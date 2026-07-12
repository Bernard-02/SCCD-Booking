/**
 * 重設密碼頁
 * 使用者從重設信的連結進入（Supabase 會在網址帶 recovery token，
 * supabase-js 自動換成 session），在此設定新密碼。
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { updatePassword } from '../services/authService'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'

const ResetPasswordPage = () => {
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
      setError('密碼至少 8 碼')
      return
    }
    if (password !== confirm) {
      setError('兩次輸入的密碼不一致')
      return
    }

    const result = await updatePassword(password)
    if (!result.ok) {
      setError(result.message || '設定失敗，請重新從信中連結進入')
      return
    }

    setDone(true)
    // 重設完成後登出 recovery session，回首頁用新密碼登入
    await supabase.auth.signOut()
    setTimeout(() => navigate('/', { replace: true }), 2500)
  }

  return (
    <div className="bg-black text-white h-screen flex flex-col">
      <Header hideNavigation />

      <section className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <h1 className="text-medium-title text-white mb-6">
            <span className="font-['Inter',_sans-serif]">Reset Password</span>{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">重設密碼</span>
          </h1>

          {done ? (
            <p className="text-content text-gray-scale1 font-['Noto_Sans_TC',_sans-serif]">
              密碼已更新，即將回到登入頁…
            </p>
          ) : !ready ? (
            <p className="text-content text-gray-scale1 font-['Noto_Sans_TC',_sans-serif]">
              請從「忘記密碼」重設信中的連結進入此頁。
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password 新密碼（至少 8 碼）"
                className="w-full px-4 py-3 bg-[#2b2b2b] border border-[#545454] rounded-lg text-white text-content focus:outline-none focus:border-white"
                style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password 再次輸入新密碼"
                className="w-full px-4 py-3 bg-[#2b2b2b] border border-[#545454] rounded-lg text-white text-content focus:outline-none focus:border-white"
                style={{ fontFamily: 'Inter, "Noto Sans TC", sans-serif' }}
              />
              {error && <p className="text-tiny text-[#ff8698]">{error}</p>}
              <button
                type="submit"
                disabled={!password || !confirm}
                className={`w-full py-3 rounded-lg text-content font-medium transition ${
                  password && confirm
                    ? 'bg-white text-black hover:opacity-70 cursor-pointer'
                    : 'bg-gray-scale4 text-gray-scale2 cursor-not-allowed'
                }`}
              >
                <span className="font-['Inter',_sans-serif]">Confirm</span>{' '}
                <span className="font-['Noto_Sans_TC',_sans-serif]">確認</span>
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
