/**
 * BackButton 組件
 * 返回上一頁的箭頭（設備／空間／清單／訂單頁共用，放在頁面標題上方）。
 * 直接開網址、沒有站內上一頁時改回型錄，避免離開網站。
 */

import { useNavigate } from 'react-router-dom'
import { useT } from '../../stores/langStore'

const BackButton = () => {
  const navigate = useNavigate()
  const t = useT()
  // React Router 在 history.state.idx 記錄站內第幾頁，0＝進站第一頁
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/catalog'))

  return (
    <button type="button" onClick={goBack} aria-label={t('Back', '返回')} className="inline-flex mb-6 text-white cursor-pointer">
      <span className="material-symbols-outlined">arrow_back</span>
    </button>
  )
}

export default BackButton
