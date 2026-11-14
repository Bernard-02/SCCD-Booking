/**
 * 對話框按 Enter＝確認（2026-11-14）。open＝對話框開著；疊了好幾層時只有最上面（最後開的）那個收。
 * 不搶的情況：注音／拼音選字中、textarea 換行、焦點在按鈕或連結上（照原生行為按那顆）、下拉清單自己用掉的 Enter、選檔案。
 * 開啟時把焦點從「打開它的那顆鈕」移開，不然 Enter 會再按一次那顆鈕而不是確認。
 * 刪除、取消訂單這類危險確認不接（呼叫端傳 open=false）：多按一下 Enter 就收不回來。
 */

import { useEffect, useRef } from 'react'

const stack: symbol[] = []

export function useEnterConfirm(open: boolean, onConfirm: (() => void) | undefined, canConfirm = true) {
  const latest = useRef({ onConfirm, canConfirm })
  latest.current = { onConfirm, canConfirm }

  useEffect(() => {
    if (!open) return
    const id = Symbol()
    stack.push(id)
    const opener = document.activeElement
    if (opener instanceof HTMLElement && ['BUTTON', 'A'].includes(opener.tagName)) opener.blur()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.isComposing || e.keyCode === 229 || e.defaultPrevented) return
      if (stack[stack.length - 1] !== id) return
      const el = e.target as HTMLInputElement
      if (['BUTTON', 'A', 'TEXTAREA'].includes(el.tagName) || el.type === 'file') return
      e.preventDefault()
      if (latest.current.canConfirm) latest.current.onConfirm?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
    }
  }, [open])
}
