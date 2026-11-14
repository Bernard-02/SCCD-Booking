/**
 * useToast Hook
 * 取代原生 alert()：showToast(訊息, 'error' | 'success')，頁面裡放一次 {toastElement}。
 * 第三個參數 undo＝可復原的操作（刪除後）：toast 多一顆復原鈕、停久一點。
 * 回傳的是元素而非元件——若每次 render 產生新元件型別，Toast 會被重掛載、計時與滑入動畫重跑。
 */

import { useCallback, useState } from 'react'
import Toast from '../components/common/Toast'

type ToastType = 'success' | 'error'
type ToastUndo = { label: string; run: () => void }

export const useToast = () => {
  const [toast, setToast] = useState<{ id: number; message: string; type: ToastType; undo?: ToastUndo } | null>(null)

  // 預設 error：後台的提示多為驗證／操作失敗
  const showToast = useCallback((message: string, type: ToastType = 'error', undo?: ToastUndo) => {
    setToast({ id: Date.now(), message, type, undo })
  }, [])

  const handleClose = useCallback(() => setToast(null), [])

  // key＝id：連續觸發時換新的 Toast，重新計時
  const toastElement = toast && (
    // 錯誤多半要照著修正（例：哪件缺貨），停留久一點；可復原的要留時間給人按
    <Toast
      key={toast.id} message={toast.message} type={toast.type} undo={toast.undo}
      duration={toast.undo ? 6000 : toast.type === 'error' ? 5000 : 3000} onClose={handleClose}
    />
  )

  return { showToast, toastElement }
}
