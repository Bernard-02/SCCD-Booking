/**
 * Footer 組件（桌機）
 * 左 Profile icon（在 /profile 再點 → 登出選單）、中 Copyright（Easter Egg）、右 語言切換＋link icon（工作室／攝影棚／官網）
 */

import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLangStore, useT } from '../../stores/langStore'

const EXTERNAL_LINKS = [
  { en: 'Studio', zh: '工作室', icon: 'desk', href: 'https://drive.google.com/drive/folders/1LimCk34X8UdWWo4hQx4a3AWDxrfX8bdL?usp=drive_link' },
  { en: 'Film Studio', zh: '專業攝影棚', icon: 'photo_camera', href: 'https://drive.google.com/drive/folders/1z6eI-UGdBTNubM7bjw-0Erf4puDikobK?usp=drive_link' },
  { en: 'To SCCD', zh: '官網', icon: 'school', href: 'https://sccd.usc.edu.tw/' },
]

const Footer: React.FC = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const t = useT()
  const toggleLang = useLangStore((s) => s.toggleLang)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [linksMenuOpen, setLinksMenuOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [easterEggText, setEasterEggText] = useState('')
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isAnimatingRef = useRef(false)

  // 彩蛋絕對定位疊在原文上：原文要比彩蛋長，否則會蓋到旁邊的 To SCCD
  const originalText = 'Copyright © SCCDSA All rights reserved.'
  const targetText = 'SHIH CHIEN COMMUNICATIONS DESIGN'
  const maxLength = Math.min(originalText.length, targetText.length)
  const truncatedTarget = targetText.substring(0, maxLength)

  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?~+=_|\\/<>[]{}'

  const getRandomChar = () => randomChars[Math.floor(Math.random() * randomChars.length)]

  const generateRandomString = (length: number) =>
    Array.from({ length }, getRandomChar).join('')

  const animateToTarget = () => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    let currentStep = 0
    const totalSteps = Math.ceil(2000 / 50)
    const charsToReveal = Math.ceil(maxLength / totalSteps * 4)

    setEasterEggText(generateRandomString(maxLength))
    setShowEasterEgg(true)

    animationIntervalRef.current = setInterval(() => {
      if (!isHovering) {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current)
        isAnimatingRef.current = false
        return
      }

      currentStep++
      const revealedChars = Math.min(Math.floor(currentStep * charsToReveal), maxLength)

      let displayText = ''
      for (let i = 0; i < maxLength; i++) {
        if (i < revealedChars) {
          displayText += truncatedTarget[i] || ' '
        } else {
          displayText += getRandomChar()
        }
      }

      setEasterEggText(displayText)

      if (revealedChars >= maxLength) {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current)
        isAnimatingRef.current = false
        setEasterEggText(truncatedTarget)
      }
    }, 50)
  }

  const animateToOriginal = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
    }

    isAnimatingRef.current = true
    let currentStep = 0
    const totalSteps = Math.ceil(300 / 30)

    animationIntervalRef.current = setInterval(() => {
      currentStep++
      const progress = currentStep / totalSteps

      if (progress >= 1) {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current)
        setShowEasterEgg(false)
        isAnimatingRef.current = false
        return
      }

      let displayText = ''
      for (let i = 0; i < maxLength; i++) {
        if (Math.random() < progress * 0.8) {
          displayText += getRandomChar()
        } else {
          displayText += easterEggText[i] || getRandomChar()
        }
      }
      setEasterEggText(displayText)
    }, 30)
  }

  useEffect(() => {
    if (isHovering) {
      animateToTarget()
    } else {
      animateToOriginal()
    }

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current)
      }
    }
  }, [isHovering])

  // 點選單外關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.profile-dropdown-container')) setProfileMenuOpen(false)
      if (!target.closest('.links-dropdown-container')) setLinksMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    setProfileMenuOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <footer className="bg-transparent footer-main">
      <div className="container">
        {/* 桌面版 Footer */}
        <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-end">
          {/* 左：Profile（在 /profile 再點一次 → 往上開登出選單） */}
          <div className="profile-dropdown-container relative justify-self-start">
            <Link
              to="/profile"
              onClick={(e) => {
                if (pathname === '/profile') {
                  e.preventDefault()
                  setProfileMenuOpen(!profileMenuOpen)
                }
              }}
              className="flex items-center text-white"
              aria-label={t('Profile', '我的')}
            >
              <span className="material-symbols-outlined">account_circle</span>
            </Link>

            {profileMenuOpen && (
              <div className="absolute bottom-full left-0 mb-4 bg-[#151515] border border-[#545454] rounded-2xl py-3 px-4" style={{ zIndex: 1000 }}>
                <button
                  onClick={handleLogout}
                  className="text-white hover:opacity-70 transition-opacity cursor-pointer whitespace-nowrap text-xs"
                >
                  {t('Log out', '登出')}
                </button>
              </div>
            )}
          </div>

          {/* 中：Copyright（hover 彩蛋） */}
          <div
            className="copyright desktop-copyright font-['Inter',_sans-serif] font-bold text-white text-center text-sm"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <p>
              <span className="copyright-original" style={{ opacity: showEasterEgg ? 0 : 1 }}>
                <span className="font-['Inter',_sans-serif] uppercase">Copyright © SCCDSA</span>
                <span className="font-['Inter',_sans-serif]"> All rights reserved.</span>
              </span>
              <span className="copyright-easter-egg" style={{ opacity: showEasterEgg ? 1 : 0 }}>
                {easterEggText}
              </span>
            </p>
          </div>

          {/* 右：語言切換（中／EN）＋外部連結（往上開） */}
          <div className="links-dropdown-container relative justify-self-end flex items-center gap-6">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center text-white cursor-pointer"
              aria-label={t('切換為中文', 'Switch to English')}
            >
              <span className="material-symbols-outlined">language</span>
            </button>
            <button
              type="button"
              onClick={() => setLinksMenuOpen(!linksMenuOpen)}
              className="flex items-center text-white cursor-pointer"
              aria-label="Links"
              aria-expanded={linksMenuOpen}
            >
              <span className="material-symbols-outlined text-md">link</span>
            </button>

            {linksMenuOpen && (
              <div className="absolute bottom-full right-0 mb-4 flex flex-col gap-2 min-w-[240px]" style={{ zIndex: 1000 }}>
                {EXTERNAL_LINKS.map(({ en, zh, icon, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setLinksMenuOpen(false)}
                    className="flex items-center gap-4 px-5 py-3 bg-[#151515] border border-[#545454] rounded-2xl text-white text-sm hover:bg-[#222] whitespace-nowrap no-underline"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{icon}</span>
                    <span className="flex-1">{t(en, zh)}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_outward</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
