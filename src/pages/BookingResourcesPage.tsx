/**
 * 租借資源頁面
 * 顯示設備和空間兩個選項
 */

import { Link } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'

const BookingResourcesPage = () => {
  return (
    <div className="bg-black text-white h-screen flex flex-col overflow-hidden">
      <Header />

      {/* 主要內容區域 - 佔滿剩餘空間，Footer 固定在底部 */}
      <main className="flex-1 pt-20 flex flex-col overflow-hidden relative">
        <div className="container hidden md:flex flex-1 gap-6 overflow-hidden items-stretch pb-20 pt-12">
          {/* 左側標題 */}
          <div className="flex-shrink-0 overflow-hidden">
            <h1 className="font-['Inter',_sans-serif] text-white text-medium-title">Category</h1>
            <h1 className="font-['Noto_Sans_TC',_sans-serif] text-white text-medium-title mb-6">類別</h1>
          </div>

          {/* 右側：兩個卡片橫向排列，高度自適應 */}
          <div className="flex gap-12 flex-1 items-end justify-end">
            {/* 空間卡片 */}
            <Link
              to="/space"
              className="border border-white relative overflow-hidden group cursor-pointer block card-slide-in h-full"
              style={{ padding: '2rem', aspectRatio: '4/5' }}
            >
              {/* 背景圖片 */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <img
                  src="/Images/Space Image.webp"
                  alt="Space"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              {/* Gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
                }}
              ></div>
              {/* 文字內容 */}
              <div className="relative z-10 h-full flex flex-col justify-end" style={{ paddingBottom: '2%' }}>
                <h1 className="text-large-title font-['Inter',_sans-serif] font-normal">
                  Space
                </h1>
                <h1 className="text-large-title font-['Noto_Sans_TC',_sans-serif] font-medium">空間</h1>
              </div>
            </Link>

            {/* 設備卡片 */}
            <Link
              to="/equipment"
              className="border border-white relative overflow-hidden group cursor-pointer block card-slide-in h-full"
              style={{ padding: '2rem', aspectRatio: '4/5' }}
            >
              {/* 背景圖片 */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <img
                  src="/Images/Extension Cord.webp"
                  alt="Equipment"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              {/* Gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
                }}
              ></div>
              {/* 文字內容 */}
              <div className="relative z-10 h-full flex flex-col justify-end" style={{ paddingBottom: '2%' }}>
                <h1 className="text-large-title font-['Inter',_sans-serif] font-normal">
                  Equipment
                </h1>
                <h1 className="text-large-title font-['Noto_Sans_TC',_sans-serif] font-medium">設備</h1>
              </div>
            </Link>
          </div>
        </div>

        {/* 手機版：兩個卡片垂直排列 */}
        <div className="md:hidden flex flex-col gap-6 w-full container">
            {/* 空間卡片 */}
            <Link to="/space" className="relative overflow-hidden block mobile-card mobile-card-slide-in">
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
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
                }}
              ></div>
              <div className="relative z-10 h-full flex flex-col justify-end text-left">
                <h1 className="text-large-title font-['Inter',_sans-serif] font-normal">
                  Space
                </h1>
                <h1 className="text-large-title font-['Noto_Sans_TC',_sans-serif] font-medium">空間</h1>
              </div>
            </Link>

            {/* 設備卡片 */}
            <Link
              to="/equipment"
              className="relative overflow-hidden block mobile-card mobile-card-slide-in"
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
                    'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
                }}
              ></div>
              <div className="relative z-10 h-full flex flex-col justify-end text-left">
                <h1 className="text-large-title font-['Inter',_sans-serif] font-normal">
                  Equipment
                </h1>
                <h1 className="text-large-title font-['Noto_Sans_TC',_sans-serif] font-medium">設備</h1>
              </div>
            </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default BookingResourcesPage
