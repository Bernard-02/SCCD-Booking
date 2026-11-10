/**
 * 購物車跟帳號走（carts 表一人一列，supabase/carts.sql）：手機加的換電腦也看得到。
 * localStorage 仍是本機那份，各處照舊用 cartHelpers 讀寫；這裡只負責跟帳號對齊——
 * 本機一寫（writeCart／writeDetails 廣播的 storage 事件）就推上去；登入、開 app、切回分頁時拉回來，兩邊以較新的為準。
 * 表沒建（SQL 未執行）或離線：讀寫失敗就只有本機，跟以前一樣。
 * ponytail: 整份覆蓋、晚改的贏；兩台都離線各改各的，早改的那台會被蓋掉。真的遇到再做逐項合併
 */

import { useEffect } from 'react'
import { supabase } from './supabase'
import { cartKey, detailsKey, readCart, readDetails, writeCart, writeDetails } from '../components/cart/cartHelpers'
import { getCurrentStudentId } from '../utils/authStorage'

/** 本機那份最後修改時間（ms）：sccd_cart_updated_{學號} */
const stampKey = () => `sccd_cart_updated_${getCurrentStudentId()}`
const localStamp = () => Number(localStorage.getItem(stampKey())) || 0

/** 拉回來之後該怎麼做：帳號較新＝蓋掉本機；本機較新（或帳號還沒有、本機有東西）＝推上去 */
export const syncAction = (localAt: number, serverAt: number | null, localHasItems: boolean): 'apply' | 'push' | 'none' => {
  if (serverAt !== null && serverAt > localAt) return 'apply'
  if (localAt > (serverAt ?? 0) || (serverAt === null && localHasItems)) return 'push'
  return 'none'
}

// 推與拉排成一列依序跑，不會舊的請求晚到蓋掉新的
let chain: Promise<void> = Promise.resolve()
const enqueue = (fn: () => Promise<void>) => { chain = chain.then(fn).catch(e => console.warn('購物車同步失敗:', e)) }

let applying = false // 正在把帳號那份寫進本機，這時的 storage 事件不要再推回去

async function push() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || !getCurrentStudentId()) return
  const { error } = await supabase.from('carts').upsert({
    user_id: session.user.id,
    items: readCart(),
    details: readDetails(),
    updated_at: new Date(localStamp() || Date.now()).toISOString(),
  })
  if (error) throw error
}

async function pull() {
  if (!getCurrentStudentId()) return
  const { data, error } = await supabase.from('carts').select('items, details, updated_at').maybeSingle()
  if (error) return // 表沒建或沒登入 Supabase：只用本機
  const serverAt = data ? Date.parse(data.updated_at) : null
  const action = syncAction(localStamp(), serverAt, readCart().length > 0)
  if (action === 'apply' && data) {
    applying = true
    writeCart(data.items ?? [])
    writeDetails(data.details ?? {})
    applying = false
    localStorage.setItem(stampKey(), String(serverAt))
  } else if (action === 'push') {
    await push()
  }
}

let pullQueued = false
const requestPull = () => {
  if (pullQueued || document.visibilityState !== 'visible') return
  pullQueued = true
  enqueue(async () => { pullQueued = false; await pull() })
}

let pushTimer: ReturnType<typeof setTimeout> | undefined
const onStorage = (e: StorageEvent) => {
  // 只管這個分頁自己寫的（cartHelpers 廣播的事件沒有 storageArea）；別的分頁寫的由那個分頁推
  if (applying || e.storageArea || !e.key || (e.key !== cartKey() && e.key !== detailsKey())) return
  localStorage.setItem(stampKey(), String(Date.now()))
  clearTimeout(pushTimer) // 連按數量 −＋ 只推最後一次
  pushTimer = setTimeout(() => enqueue(push), 300)
}

/** App 掛一次：登入的學號變了（登入／換人）就拉一次，之後監聽本機修改與切回分頁 */
export function useCartSync(studentId: string | undefined) {
  useEffect(() => {
    if (!studentId) return
    requestPull()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', requestPull)
    document.addEventListener('visibilitychange', requestPull)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', requestPull)
      document.removeEventListener('visibilitychange', requestPull)
    }
  }, [studentId])
}
