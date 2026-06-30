/**
 * Footer 組件
 * 從 index-old.html 遷移
 * 包含 Copyright Easter Egg 效果
 */

import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const Footer: React.FC = () => {
  const [isHovering, setIsHovering] = useState(false)
  const [easterEggText, setEasterEggText] = useState('')
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isAnimatingRef = useRef(false)

  // 固定旋轉角度 -3°
  const rotationAngle = -3

  const originalText = 'Copyright © 2025 111屆系學會All rights reserved.'
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

  return (
    <footer className="bg-transparent footer-main">
      <div className="container">
        {/* 桌面版 Footer */}
        <div className="hidden md:flex justify-between items-center">
          {/* 左側：About, Studio, Film Studio */}
          <div className="flex items-center header-menu nav-gap">
            <Link
              to="/about"
              className="font-['Inter',_sans-serif] font-medium text-white flex items-center text-header header-nav-link"
              style={{ '--rotation-angle': '-2deg' } as React.CSSProperties}
            >
              <span>About</span>
              <span className="chinese-label">&nbsp;關於</span>
            </Link>
            <a
              href="https://drive.google.com/drive/folders/1LimCk34X8UdWWo4hQx4a3AWDxrfX8bdL?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Inter',_sans-serif] font-medium text-white flex items-center text-header header-nav-link group"
              style={{ '--rotation-angle': '2deg' } as React.CSSProperties}
            >
              <span>Studio</span>
              <span className="chinese-label">&nbsp;工作室</span>
              <svg className="w-6 h-6 ml-2 transform rotate-[-45deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://drive.google.com/drive/folders/1z6eI-UGdBTNubM7bjw-0Erf4puDikobK?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Inter',_sans-serif] font-medium text-white flex items-center text-header header-nav-link group"
              style={{ '--rotation-angle': '-2deg' } as React.CSSProperties}
            >
              <span>Film Studio</span>
              <span className="chinese-label">&nbsp;專業攝影棚</span>
              <svg className="w-6 h-6 ml-2 transform rotate-[-45deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* 右側：Copyright 和 To SCCD */}
          <div className="flex items-center header-menu nav-gap">
            <div
              className="copyright desktop-copyright font-['Inter',_sans-serif] font-medium text-white text-right text-header"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <p>
                <span className="copyright-original" style={{ opacity: showEasterEgg ? 0 : 1 }}>
                  <span className="font-['Inter',_sans-serif] uppercase">Copyright © 2025 111</span>
                  屆系學會
                  <span className="font-['Inter',_sans-serif]">All rights reserved.</span>
                </span>
                <span className="copyright-easter-egg" style={{ opacity: showEasterEgg ? 1 : 0 }}>
                  {easterEggText}
                </span>
              </p>
            </div>
            <a
              href="https://sccd.usc.edu.tw/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Inter',_sans-serif] font-medium text-white flex items-center text-header header-nav-link"
              style={{ '--rotation-angle': `${rotationAngle}deg` } as React.CSSProperties}
            >
              <span>To SCCD</span>
              <span className="chinese-label">&nbsp;官網</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
