/**
 * React 應用入口
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Tailwind CSS (包含在 index.css 中)
import './index.css'

// 引入所有原有的 CSS 文件
import '../css/colors.css'
import '../css/common.css'
import '../css/mobile-menu.css'
import '../css/typography.css'
import '../css/animations.css'
import '../css/equipment.css'
import '../css/booking.css'
import '../css/breadcrumb.css'
import '../css/rental-list.css'
import '../css/forms.css'
import '../css/numbered-area.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
