/**
 * 租借資源頁面
 * 顯示設備和空間兩個選項
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import { useT } from '../stores/langStore'
import { CATALOG_ENTERED_KEY } from '../utils/storageKeys'

const BookingResourcesPage = () => {
  const t = useT()
  // 卡片進場動畫（css/animations.css slideIn）只在這個分頁第一次進來播，跑完前不能點（避免還在滑動就被點進去）；之後再進來直接顯示
  const [animate] = useState(() => {
    const seen = sessionStorage.getItem(CATALOG_ENTERED_KEY)
    sessionStorage.setItem(CATALOG_ENTERED_KEY, '1')
    return !seen
  })
  const [ready, setReady] = useState<Set<string>>(new Set())
  const slideIn = (key: string, animCls: string, className: string) => ({
    className: animate ? `${className} ${animCls} ${ready.has(key) ? '' : 'pointer-events-none'}` : className,
    onAnimationEnd: () => setReady(prev => new Set(prev).add(key))
  })
  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      {/* 主要內容區域 - 佔滿剩餘空間，Footer 固定在底部 */}
      <main className="flex-1 pt-20 flex flex-col overflow-hidden relative">
        <div className="container hidden md:flex flex-1 gap-6 overflow-hidden items-stretch pb-20 pt-12">
          {/* 左側標題 */}
          <div className="flex-shrink-0 overflow-hidden">
            <h1 className="text-white text-xl mb-6">{t('Category', '類別')}</h1>
          </div>

          {/* 右側：兩個卡片橫向排列，高度自適應 */}
          <div className="flex gap-12 flex-1 items-end justify-end">
            {/* 空間卡片 */}
            <Link
              to="/space"
              {...slideIn('space', 'card-slide-in', 'border border-white relative overflow-hidden rounded-2xl group cursor-pointer block h-full hover:border-transparent')}
              style={{ padding: '2rem', aspectRatio: '4/5' }}
            >
              {/* 背景圖片 */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100">
                <img
                  src="/Images/Space Image.webp"
                  alt="Space"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              {/* Gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
                }}
              ></div>
              {/* 文字內容 */}
              <div className="relative z-10 h-full flex flex-col justify-end">
                <h1 className="text-2xl font-normal">{t('Space', '空間')}</h1>
              </div>
            </Link>

            {/* 設備卡片 */}
            <Link
              to="/equipment"
              {...slideIn('equipment', 'card-slide-in', 'border border-white relative overflow-hidden rounded-2xl group cursor-pointer block h-full hover:border-transparent')}
              style={{ padding: '2rem', aspectRatio: '4/5' }}
            >
              {/* 背景圖片 */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100">
                <img
                  src="/Images/Extension Cord.webp"
                  alt="Equipment"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              {/* Gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
                }}
              ></div>
              {/* 文字內容 */}
              <div className="relative z-10 h-full flex flex-col justify-end">
                <h1 className="text-2xl font-normal">{t('Equipment', '設備')}</h1>
              </div>
            </Link>
          </div>
        </div>

        {/* 手機版：兩個卡片垂直排列 */}
        <div className="md:hidden flex flex-col gap-6 w-full container">
            {/* 空間卡片 */}
            <Link to="/space" {...slideIn('m-space', 'mobile-card-slide-in', 'relative overflow-hidden rounded-2xl block mobile-card')}>
              <div className="absolute inset-0">
                <img
                  src="/Images/Space Image.webp"
                  alt="Space"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
                }}
              ></div>
              <div className="relative z-10 h-full flex flex-col justify-end text-left">
                <h1 className="text-2xl font-normal">{t('Space', '空間')}</h1>
              </div>
            </Link>

            {/* 設備卡片 */}
            <Link
              to="/equipment"
              {...slideIn('m-equipment', 'mobile-card-slide-in', 'relative overflow-hidden rounded-2xl block mobile-card')}
            >
              <div className="absolute inset-0">
                <img
                  src="/Images/Extension Cord.webp"
                  alt="Equipment"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
                }}
              ></div>
              <div className="relative z-10 h-full flex flex-col justify-end text-left">
                <h1 className="text-2xl font-normal">{t('Equipment', '設備')}</h1>
              </div>
            </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default BookingResourcesPage
