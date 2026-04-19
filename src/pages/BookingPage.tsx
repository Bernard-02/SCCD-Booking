/**
 * 租借預約頁面
 * 從 booking.html 遷移
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/layouts/Header'
import Footer from '../components/layouts/Footer'
import Calendar from '../components/Calendar'

const BookingPage = () => {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  // 格式化日期顯示
  const formatDateDisplay = (date: Date | null): string => {
    if (!date) return '----/--/--'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  // 從 localStorage 載入暫存的日期
  useEffect(() => {
    const cachedDates = localStorage.getItem('tempSelectedDates')
    if (cachedDates) {
      try {
        const dates = JSON.parse(cachedDates)
        if (dates.startDate) setStartDate(new Date(dates.startDate))
        if (dates.endDate) setEndDate(new Date(dates.endDate))
      } catch (error) {
        console.error('無法解析暫存日期:', error)
        localStorage.removeItem('tempSelectedDates')
      }
    }
  }, [])

  // 日期選擇處理
  const handleDateSelect = (newStartDate: Date | null, newEndDate: Date | null) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)

    // 保存到 localStorage
    if (newStartDate || newEndDate) {
      localStorage.setItem(
        'tempSelectedDates',
        JSON.stringify({
          startDate: newStartDate ? newStartDate.toISOString() : null,
          endDate: newEndDate ? newEndDate.toISOString() : null
        })
      )
      localStorage.setItem('dateSelectionTime', Date.now().toString())
    } else {
      localStorage.removeItem('tempSelectedDates')
      localStorage.removeItem('dateSelectionTime')
    }
  }

  const handleResetDate = () => {
    setStartDate(null)
    setEndDate(null)
    localStorage.removeItem('tempSelectedDates')
    localStorage.removeItem('dateSelectionTime')
  }

  const handleConfirmDate = () => {
    if (startDate && endDate) {
      // 保存選擇的日期到 localStorage
      const rentalDateData = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
      localStorage.setItem('selectedRentalDates', JSON.stringify(rentalDateData))

      // 導航到設備選擇頁面
      navigate('/equipment')
    }
  }

  return (
    <div className="bg-black text-white h-screen overflow-hidden flex flex-col">
      <Header />

      {/* 主要內容區塊 */}
      <main className="flex-1 pt-20">
        <div className="container h-full">
          {/* 桌面版佈局：左右分割 */}
          <div className="hidden md:flex h-full">
            {/* 左側：文字資訊區塊 */}
            <div className="flex-shrink-0 w-[25%] flex flex-col">
              {/* 標題和描述 */}
              <div>
                {/* Breadcrumb */}
                <div className="float-up-container">
                  <div className="text-left float-up float-up-delay-1" style={{ paddingBottom: '1.08rem' }}>
                    <nav className="breadcrumb-inline">
                      <Link to="/" className="breadcrumb-item text-breadcrumb">
                        首頁
                      </Link>
                      <span className="breadcrumb-separator text-breadcrumb">/</span>
                      <span className="breadcrumb-item text-breadcrumb">租借日期</span>
                    </nav>
                  </div>
                </div>

                <div className="float-up-container">
                  <h1 className="font-['Noto_Sans_TC',_sans-serif] text-white text-hero-title mb-6 float-up float-up-delay-2">
                    租借日期
                  </h1>
                </div>

                <div className="float-up-container">
                  <p className="font-['Inter',_sans-serif] text-white text-content float-up float-up-delay-4">
                    選擇你想租借的日期
                  </p>
                </div>
              </div>

              {/* 日期顯示和按鈕 */}
              <div className="mt-auto">
                <div className="float-up-container">
                  <div className="mb-8 float-up float-up-delay-5">
                    <h2 className="font-['Inter',_sans-serif] text-zinc-300 uppercase tracking-wider mb-2 text-small-title">
                      START DATE <span className="font-['Noto_Sans_TC',_sans-serif]">起租日</span>
                    </h2>
                    <p className="font-['Inter',_sans-serif] text-white text-[2.5rem] tracking-tight">
                      {formatDateDisplay(startDate)}
                    </p>
                  </div>
                </div>

                <div className="float-up-container">
                  <div className="mb-8 float-up float-up-delay-6">
                    <h2 className="font-['Inter',_sans-serif] text-zinc-300 uppercase tracking-wider mb-2 text-small-title">
                      END DATE <span className="font-['Noto_Sans_TC',_sans-serif]">歸還日</span>
                    </h2>
                    <p className="font-['Inter',_sans-serif] text-white text-[2.5rem] tracking-tight">
                      {formatDateDisplay(endDate)}
                    </p>
                  </div>
                </div>

                <div className="float-up-container">
                  <div className="flex flex-col items-start float-up float-up-delay-7">
                    <button
                      onClick={handleResetDate}
                      disabled={!startDate}
                      className={`font-['Inter',_sans-serif] uppercase text-white text-button inline-block ${
                        startDate ? 'cursor-pointer opacity-100' : 'opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <div className="hero-cta-wrapper">
                        <span className="hero-cta-text">(RESET)</span>
                        <span className="hero-cta-hidden">(RESET)</span>
                      </div>
                    </button>

                    <button
                      onClick={handleConfirmDate}
                      disabled={!startDate || !endDate}
                      className={`font-['Inter',_sans-serif] uppercase text-white text-button inline-block ${
                        startDate && endDate ? 'cursor-pointer opacity-100' : 'opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <div className="hero-cta-wrapper">
                        <span className="hero-cta-text">(OKAY)</span>
                        <span className="hero-cta-hidden">(OKAY)</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 右側：日曆區塊 */}
            <div className="flex-1 min-w-0 flex items-end">
              <div id="date-picker-container" className="w-full overflow-hidden mt-[3rem] calendar-fade-in">
                <Calendar
                  startDate={startDate}
                  endDate={endDate}
                  onDateSelect={handleDateSelect}
                  isMobile={false}
                />
              </div>
            </div>
          </div>

          {/* 手機版佈局 */}
          <div className="md:hidden flex flex-col h-full">
            {/* 上方：麵包屑和標題 */}
            <div>
              <div className="float-up-container">
                <div className="text-left float-up float-up-delay-1" style={{ paddingBottom: '1.08rem' }}>
                  <nav className="breadcrumb-inline">
                    <Link to="/" className="breadcrumb-item text-breadcrumb">
                      首頁
                    </Link>
                    <span className="breadcrumb-separator text-breadcrumb">/</span>
                    <span className="breadcrumb-item text-breadcrumb">租借日期</span>
                  </nav>
                </div>
              </div>

              <div className="float-up-container">
                <h1 className="font-['Noto_Sans_TC',_sans-serif] text-white text-hero-title mb-4 float-up float-up-delay-2">
                  租借日期
                </h1>
              </div>
            </div>

            {/* 中間：日曆區塊 */}
            <div className="flex-1 overflow-y-auto">
              <div id="mobile-date-picker-container" className="calendar-fade-in">
                <Calendar
                  startDate={startDate}
                  endDate={endDate}
                  onDateSelect={handleDateSelect}
                  isMobile={true}
                />
              </div>
            </div>

            {/* 下方：日期顯示和按鈕 */}
            <div className="flex-shrink-0 pb-4">
              <div className="float-up-container">
                <div className="mb-4 float-up float-up-delay-5">
                  <h2 className="font-['Inter',_sans-serif] text-zinc-300 uppercase tracking-wider mb-2 text-small-title">
                    START DATE <span className="font-['Noto_Sans_TC',_sans-serif]">起租日</span>
                  </h2>
                  <p className="font-['Inter',_sans-serif] text-white text-[2rem] tracking-tight">
                    {formatDateDisplay(startDate)}
                  </p>
                </div>
              </div>

              <div className="float-up-container">
                <div className="mb-4 float-up float-up-delay-6">
                  <h2 className="font-['Inter',_sans-serif] text-zinc-300 uppercase tracking-wider mb-2 text-small-title">
                    END DATE <span className="font-['Noto_Sans_TC',_sans-serif]">歸還日</span>
                  </h2>
                  <p className="font-['Inter',_sans-serif] text-white text-[2rem] tracking-tight">
                    {formatDateDisplay(endDate)}
                  </p>
                </div>
              </div>

              <div className="float-up-container">
                <div className="flex items-center justify-between float-up float-up-delay-7">
                  <button
                    onClick={handleResetDate}
                    disabled={!startDate}
                    className={`font-['Inter',_sans-serif] uppercase text-white text-button ${
                      startDate ? 'cursor-pointer opacity-100' : 'opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <div className="hero-cta-wrapper">
                      <span className="hero-cta-text">(RESET)</span>
                      <span className="hero-cta-hidden">(RESET)</span>
                    </div>
                  </button>

                  <button
                    onClick={handleConfirmDate}
                    disabled={!startDate || !endDate}
                    className={`font-['Inter',_sans-serif] uppercase text-white text-button ${
                      startDate && endDate ? 'cursor-pointer opacity-100' : 'opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <div className="hero-cta-wrapper">
                      <span className="hero-cta-text">(OKAY)</span>
                      <span className="hero-cta-hidden">(OKAY)</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default BookingPage
