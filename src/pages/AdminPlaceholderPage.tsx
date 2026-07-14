/**
 * 後台 · 尚未實作分區的佔位頁（公告／公休日／寒暑假）。
 * 標題由路由帶入，實作後各自替換成真頁。
 */

import React from 'react'

const AdminPlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div>
    <h1 className="text-medium-title font-['Noto_Sans_TC',_sans-serif] mb-4">{title}</h1>
    <p className="text-tiny text-gray-scale2 font-['Noto_Sans_TC',_sans-serif]">此分區尚未實作。</p>
  </div>
)

export default AdminPlaceholderPage
