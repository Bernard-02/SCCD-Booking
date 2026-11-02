/**
 * 全站唯一的 X 關閉鈕（2026-10-27 收斂）：白色 20px Material Symbols close、hover 變淡、24×24 可點區。
 * 位置由 className 給（對話框右上角 absolute、標題列靠右…）；label 給 aria-label／title，前台用 t('Close', '關閉') 傳入。
 * 刪除／移除請用垃圾桶（delete），不要拿 X 當刪除。
 */

import { BTN } from '@/components/common/btn'
import React from 'react'

const CloseButton: React.FC<{ onClick: () => void; label?: string; className?: string }> = ({
  onClick, label = '關閉', className = ''
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`flex items-center justify-center w-6 h-6 shrink-0 text-white ${BTN} ${className}`}
  >
    <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">close</span>
  </button>
)

export default CloseButton
