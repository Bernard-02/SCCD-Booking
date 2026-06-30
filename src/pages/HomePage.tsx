/**
 * 首頁 - 登入畫面
 * 100vh 高度，底部是 Footer，主要內容在 Footer 上方
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'

const HomePage = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [studentIdError, setStudentIdError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // 如果已登入，自動導向到 BookingResourcesPage
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/catalog', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setStudentIdError('')
    setPasswordError('')

    const result = await login(studentId.trim(), password, rememberMe)

    if (result.success) {
      navigate('/catalog', { replace: true })
    } else {
      // 根據錯誤類型顯示不同訊息
      if (result.error === 'user_not_found') {
        setStudentIdError('error') // 使用簡單的標記
      } else if (result.error === 'invalid_password') {
        setPasswordError('error') // 使用簡單的標記
      } else {
        setPasswordError('error') // 使用簡單的標記
      }
    }
  }

  return (
    <div className="bg-black text-white h-screen flex flex-col">
      <Header hideNavigation />

      {/* 主要內容區域 - 佔滿剩餘空間，Footer 固定在底部 */}
      <section className="flex-1 flex items-end">
        <div className="container w-full">
          <div className="flex justify-between items-end">
            {/* 桌面版佈局 */}
            <div className="hidden md:flex justify-end items-end w-full">
              {/* 右側 - 顯示登入表單 */}
              <div className="flex-shrink-0">
                  <div className="float-up-container">
                    <div className="flex gap-4 float-up float-up-delay-5">
                      {/* 左側：Login 區塊 */}
                      <div className="h-[300px] border border-[#7c7c7c] rounded-3xl bg-black/80 backdrop-blur-sm p-8 flex flex-col relative" style={{ width: 'fit-content' }}>
                        {/* 標題 */}
                        <div className="mb-8 flex gap-6">
                          <h2 className="font-['Inter',_sans-serif] text-medium-title text-white leading-tight whitespace-nowrap">
                            Space <span className="font-['Noto_Sans_TC',_sans-serif] text-white">空間</span>
                          </h2>
                          <h2 className="font-['Inter',_sans-serif] text-medium-title text-white leading-tight whitespace-nowrap">
                            Equipment <span className="font-['Noto_Sans_TC',_sans-serif] text-white">設備</span>
                          </h2>
                        </div>

                        <form onSubmit={handleLogin} className="flex gap-6 flex-1">
                          {/* 左側：Input 區域 */}
                          <div className="flex flex-col gap-12" style={{ width: '200px' }}>
                            {/* 學號輸入 */}
                            <div className="input-group relative" style={{ marginBottom: 0 }}>
                              <input
                                type="text"
                                id="desktop-student-id"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                                className="input-field"
                                placeholder=" "
                                autoComplete="username"
                                style={{ width: '100%', borderColor: studentIdError ? 'var(--color-error2)' : '' }}
                              />
                              <label htmlFor="desktop-student-id" className="input-label text-small-title pointer-events-none whitespace-nowrap" style={{ fontSize: '0.9rem' }}>
                                Student ID <span className="font-['Noto_Sans_TC',_sans-serif]">學號</span>
                              </label>
                              {studentIdError && (
                                <div className="text-error2 text-tiny absolute top-full left-0 mt-1 whitespace-nowrap">
                                  <span className="font-['Inter',_sans-serif]">ID Incorrect</span> <span className="font-['Noto_Sans_TC',_sans-serif]">學號錯誤</span>
                                </div>
                              )}
                            </div>

                            {/* 密碼輸入 */}
                            <div className="input-group relative" style={{ marginBottom: 0 }}>
                              <input
                                type={showPassword ? 'text' : 'password'}
                                id="desktop-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value.replace(/[\u4E00-\u9FFF]/g, ''))}
                                className="input-field"
                                placeholder=" "
                                autoComplete="current-password"
                                style={{ width: '100%', borderColor: passwordError ? 'var(--color-error2)' : '', paddingRight: '2.5rem' }}
                              />
                              <label htmlFor="desktop-password" className="input-label text-small-title pointer-events-none whitespace-nowrap" style={{ fontSize: '0.9rem' }}>
                                Password <span className="font-['Noto_Sans_TC',_sans-serif]">密碼</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-gray-scale2 hover:text-white transition-colors z-10"
                                tabIndex={-1}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                  {showPassword ? 'visibility' : 'visibility_off'}
                                </span>
                              </button>
                              {passwordError && (
                                <div className="text-error2 text-tiny absolute top-full left-0 mt-1 whitespace-nowrap">
                                  <span className="font-['Inter',_sans-serif]">Password Incorrect</span> <span className="font-['Noto_Sans_TC',_sans-serif]">密碼錯誤</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 右側：Checkbox 和按鈕區域 */}
                          <div className="flex items-end" style={{ width: 'fit-content' }}>
                            <div className="flex flex-col gap-2 items-start">
                              {/* 記住我 */}
                              <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none border border-gray-scale2 bg-transparent checked:border-white checked:bg-white transition-all"
                                  />
                                  <svg
                                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity"
                                    width="10"
                                    height="8"
                                    viewBox="0 0 10 8"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M1 4L3.5 6.5L9 1"
                                      stroke="black"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                                <span className="text-tiny text-white group-hover:text-gray-scale2 transition-colors leading-tight">
                                  <span className="font-['Inter',_sans-serif]">Remember Me</span> <span className="font-['Noto_Sans_TC',_sans-serif]">記住我</span>
                                </span>
                              </label>

                              {/* 忘記密碼 */}
                              <button
                                type="button"
                                onClick={() => setShowForgotPasswordModal(true)}
                                className="font-['Inter',_sans-serif] text-white text-tiny hover:text-gray-scale2 transition-colors cursor-pointer text-left p-0 whitespace-nowrap"
                              >
                                Forgot Password? <span className="font-['Noto_Sans_TC',_sans-serif]">忘記密碼?</span>
                              </button>

                              {/* Login 按鈕 */}
                              <button
                                type="submit"
                                disabled={!studentId || !password}
                                className="text-small-title font-medium whitespace-nowrap text-white hover:opacity-70 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:opacity-30 mt-2"
                              >
                                <span className="font-['Inter',_sans-serif]">Login</span> <span className="font-['Noto_Sans_TC',_sans-serif]">登入</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>

                      {/* 右側：導航區塊 */}
                      <div className="w-[320px] h-[300px] flex flex-col gap-4">
                        {/* 右上：Studio */}
                        <a
                          href="https://drive.google.com/drive/folders/1LimCk34X8UdWWo4hQx4a3AWDxrfX8bdL?usp=drive_link"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 border border-[#7c7c7c] rounded-3xl flex items-center justify-between p-8 hover:bg-white/10 transition-colors group relative overflow-hidden no-underline bg-black/80 backdrop-blur-sm"
                        >
                          <div className="flex flex-col z-10">
                            <span className="font-['Inter',_sans-serif] text-medium-title text-white">Studio</span>
                            <span className="font-['Noto_Sans_TC',_sans-serif] text-medium-title text-white">工作室</span>
                          </div>
                          {/* 斜45度箭頭 */}
                          <div className="z-10">
                             <svg className="w-12 h-12 text-white transform rotate-[-45deg] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                             </svg>
                          </div>
                        </a>

                        {/* 右下：Film Studio */}
                        <a
                          href="https://drive.google.com/drive/folders/1z6eI-UGdBTNubM7bjw-0Erf4puDikobK?usp=drive_link"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 border border-[#7c7c7c] rounded-3xl flex items-center justify-between p-8 hover:bg-white/10 transition-colors group relative overflow-hidden no-underline bg-black/80 backdrop-blur-sm"
                        >
                          <div className="flex flex-col z-10">
                            <span className="font-['Inter',_sans-serif] text-medium-title text-white">Film Studio</span>
                            <span className="font-['Noto_Sans_TC',_sans-serif] text-medium-title text-white">專業攝影棚</span>
                          </div>
                          {/* 斜45度箭頭 */}
                          <div className="z-10">
                             <svg className="w-12 h-12 text-white transform rotate-[-45deg] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
                             </svg>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

            {/* 手機版佈局 */}
            <div className="md:hidden flex flex-col items-start w-full gap-6">
              {/* 標題 */}
              <div className="float-up-container">
                <h1 className="font-['Inter',_sans-serif] text-white text-hero-title float-up float-up-slow">
                  Booking
                </h1>
              </div>

              {/* 登入表單 */}
              <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
                {/* 學號 */}
                <div className="flex flex-col gap-2">
                  <div className="input-group">
                    <input
                      type="text"
                      id="mobile-student-id"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                      className="input-field"
                      placeholder=" "
                      autoComplete="username"
                      style={{ borderColor: studentIdError ? 'var(--color-error2)' : '' }}
                    />
                    <label htmlFor="mobile-student-id" className="input-label text-small-title pointer-events-none">
                      Student ID <span className="font-['Noto_Sans_TC',_sans-serif]">學號</span>
                    </label>
                    {studentIdError && (
                      <div className="text-error2 text-tiny mt-1">
                        <span className="font-['Inter',_sans-serif]">ID Incorrect</span> <span className="font-['Noto_Sans_TC',_sans-serif]">學號錯誤</span>
                      </div>
                    )}
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none border border-gray-scale2 bg-transparent checked:border-white checked:bg-white transition-all"
                      />
                      <svg
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity"
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="text-tiny text-white group-hover:text-gray-scale2 transition-colors leading-tight">
                      <span className="font-['Inter',_sans-serif]">Remember Me</span> <span className="font-['Noto_Sans_TC',_sans-serif]">記住我</span>
                    </span>
                  </label>
                </div>

                {/* 密碼 */}
                <div className="flex flex-col gap-2">
                  <div className="input-group relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="mobile-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/[\u4E00-\u9FFF]/g, ''))}
                      className="input-field"
                      placeholder=" "
                      autoComplete="current-password"
                      style={{ borderColor: passwordError ? 'var(--color-error2)' : '', paddingRight: '2.5rem' }}
                    />
                    <label htmlFor="mobile-password" className="input-label text-small-title pointer-events-none">
                      Password <span className="font-['Noto_Sans_TC',_sans-serif]">密碼</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-gray-scale2 hover:text-white transition-colors z-10"
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        {showPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                    {passwordError && (
                      <div className="text-error2 text-tiny mt-1">
                        <span className="font-['Inter',_sans-serif]">Password Incorrect</span> <span className="font-['Noto_Sans_TC',_sans-serif]">密碼錯誤</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="font-['Inter',_sans-serif] text-white text-tiny text-left hover:text-gray-scale2 transition-colors"
                  >
                    Forgot Password? <span className="font-['Noto_Sans_TC',_sans-serif]">忘記密碼?</span>
                  </button>
                </div>

                {/* LOGIN 按鈕 */}
                <button
                  type="submit"
                  disabled={!studentId || !password}
                  className="text-small-title font-medium whitespace-nowrap text-white hover:opacity-70 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:opacity-30"
                >
                  <span className="font-['Inter',_sans-serif]">Login</span> <span className="font-['Noto_Sans_TC',_sans-serif]">登入</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 忘記密碼 Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowForgotPasswordModal(false)}
          ></div>
          
          {/* Modal 內容 */}
          <div className="relative bg-[#1a1a1a] border border-[#7c7c7c] rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all">
            <button 
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 text-gray-scale2 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h3 className="text-medium-title font-['Noto_Sans_TC',_sans-serif] text-white mb-4">
              忘記密碼？
            </h3>
            
            <div className="space-y-4 text-content text-gray-scale1 font-['Noto_Sans_TC',_sans-serif]">
              <p>由於帳號與學號綁定，若您忘記密碼，請聯繫系辦公室或系統管理員進行重設。</p>
              
              <div className="bg-[#2b2b2b] p-4 rounded-lg mt-4">
                <p className="text-white font-medium mb-2">聯絡資訊</p>
                <p className="text-tiny text-gray-scale2">地點：A棟 5樓 系辦公室</p>
                <p className="text-tiny text-gray-scale2">電話：(02) 2538-1111 分機 7001</p>
                <p className="text-tiny text-gray-scale2">信箱：sccd@g2.usc.edu.tw</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default HomePage
