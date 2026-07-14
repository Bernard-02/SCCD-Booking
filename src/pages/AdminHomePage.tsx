/**
 * 後台 · 總覽（進入後台的落地頁）
 * 目前是各分區的入口卡；之後可加待辦數字（待收押金、逾期未還…）。
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_SECTIONS } from '../components/layouts/AdminLayout'

const AdminHomePage: React.FC = () => {
  const navigate = useNavigate()
  const sections = ADMIN_SECTIONS.filter(s => s.to !== '/admin') // 總覽自己不列

  return (
    <div>
      <h1 className="text-medium-title font-['Inter',_sans-serif] mb-6">
        Overview <span className="font-['Noto_Sans_TC',_sans-serif] text-content text-gray-scale2">總覽</span>
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {sections.map(s => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="text-left border border-gray-scale4 rounded-xl p-5 cursor-pointer hover:border-white transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-['Noto_Sans_TC',_sans-serif] text-content">{s.label}</span>
              {!s.done && <span className="text-[10px] text-gray-scale3 font-['Noto_Sans_TC',_sans-serif]">待做</span>}
            </div>
            <div className="font-['Inter',_sans-serif] text-tiny text-gray-scale2">{s.en}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default AdminHomePage
