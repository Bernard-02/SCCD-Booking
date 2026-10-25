/**
 * Supabase client 單例
 * 環境變數見 .env（範本 .env.example）；anon key 受 RLS 約束，可放前端。
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少 Supabase 環境變數：請確認 .env 的 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY')
}

// 登入憑證（sb-* key）跟著「記住我」走：有勾放 localStorage（關瀏覽器仍登入，refresh token 自動續），
// 沒勾放 sessionStorage（關分頁即真的登出，共用電腦不留憑證）。
// 讀兩邊都找；寫沿用 key 目前所在（token 續期不換位置），新 key 預設 localStorage，登入後由 persistAuth 搬到正確位置
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (k: string) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
      setItem: (k: string, v: string) => (sessionStorage.getItem(k) !== null ? sessionStorage : localStorage).setItem(k, v),
      removeItem: (k: string) => { sessionStorage.removeItem(k); localStorage.removeItem(k) },
    },
  },
})

/**
 * 分段抓完整張表：Supabase API 一次最多回 1000 筆（專案設定 max-rows 預設值），沒分段的話超過的會默默不見。
 * page 收 from／to 回傳加了 .range(from, to) 的查詢；查詢要有穩定排序（最後補 unique 欄位），分段才不重複不漏。
 * ponytail: 每段 1000 筆照預設 max-rows；若在 Studio 把 max-rows 調小，這裡要一起改
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const SIZE = 1000
  const rows: T[] = []
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < SIZE) return rows
  }
}

/** 登入成功後依「記住我」把 Supabase 憑證搬到對應的 storage */
export const persistAuth = (rememberMe: boolean) => {
  const [from, to] = rememberMe ? [sessionStorage, localStorage] : [localStorage, sessionStorage]
  Object.keys(from).filter(k => k.startsWith('sb-')).forEach(k => {
    to.setItem(k, from.getItem(k)!)
    from.removeItem(k)
  })
}
