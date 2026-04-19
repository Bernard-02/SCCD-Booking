/**
 * 主要佈局組件
 * 包含 Header 和 Footer
 */

import React from 'react'
import Header from './Header'
import Footer from './Footer'

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="bg-black text-white min-h-screen overflow-x-hidden flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-8 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default MainLayout
