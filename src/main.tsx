/**
 * React 應用入口
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// 字型自架（原本 Google Fonts，慢網載不到）：各自依 unicode-range 拆小檔，瀏覽器只抓用到的
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/600.css'

// Tailwind CSS (包含在 index.css 中)
import './index.css'

// 引入所有原有的 CSS 文件
import '../css/common.css'
import '../css/typography.css'
import '../css/animations.css'
import '../css/booking.css'
import '../css/rental-list.css'
import '../css/numbered-area.css'
import '../css/scrollbar.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
