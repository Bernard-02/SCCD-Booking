/**
 * 會員匯入（後台會員管理 › 匯入）：把試算表讀成的二維陣列解析成預先登記列並逐列驗證。
 * 表頭用名稱對應、不看欄位順序：學號／姓名／Email／班級／會費／身份／職稱，認不得的欄（電話…）略過；
 * 第一個含「學號」的列當表頭，它之前的列（標題、說明）略過，全空的列略過。
 * 身份填中文（學生／轉學生／系學會／系秘），空白＝學生；Email 空白＝學號@gm.usc.edu.tw（同新增會員的自動帶入）。
 * 班級填「日媒四乙」「碩媒一甲」，空白＝本人第一次登入時由學號推（碩士、轉學生推不準，要填；supabase/members-v2.sql）。
 * 會費填 已繳／未繳，空白＝未繳；沒繳不能送單（supabase/rules-2026-11.sql）。
 * 錯誤列（error 有值）不匯入，其餘照匯；檔內同學號以後面那筆為準。
 */

import { parseClassLabel } from './gradeUtils'

export type ImportIdentity = 'student' | 'transfer' | 'sa' | 'secretary'
export interface ImportRow {
  line: number // 試算表列號（1-based，預覽與錯誤訊息用）
  sid: string
  name: string
  email: string
  identity: ImportIdentity
  position: string
  grade: string | null
  class_name: string | null
  dues_paid: boolean
  error?: string
}

const HEADERS = {
  sid: /學號|student/i,
  name: /姓名|名字|^name$/i,
  email: /e-?mail|信箱/i,
  classLabel: /班級/,
  dues: /會費/,
  identity: /身份|身分|role/i,
  position: /職稱|職位|position/i
}
type Col = keyof typeof HEADERS
const IDENTITY_BY_ZH: Record<string, ImportIdentity> = { 學生: 'student', 轉學生: 'transfer', 系學會: 'sa', 系秘: 'secretary' }
export const IDENTITY_ZH_LIST = Object.keys(IDENTITY_BY_ZH).join('／')

const DUES: Record<string, boolean> = { '': false, 未繳: false, 否: false, 已繳: true, 是: true, V: true, v: true }

export const emailForSid = (sid: string) => `${sid.toLowerCase()}@gm.usc.edu.tw`

/** existingSids＝已有帳號的學號（大寫）：這些列標「已有帳號」跳過。找不到學號表頭回空陣列 */
export function parseMemberRows(aoa: unknown[][], existingSids: ReadonlySet<string>): ImportRow[] {
  const cell = (v: unknown) => String(v ?? '').trim()
  const headerIdx = aoa.findIndex(r => r?.some(c => HEADERS.sid.test(cell(c))))
  if (headerIdx === -1) return []
  const header = aoa[headerIdx].map(cell)
  const col = Object.fromEntries(
    (Object.keys(HEADERS) as Col[]).map(k => [k, header.findIndex(h => HEADERS[k].test(h))])
  ) as Record<Col, number>
  const get = (r: unknown[], k: Col) => (col[k] === -1 ? '' : cell(r[col[k]]))

  const rows: ImportRow[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i]
    if (!r || r.every(c => cell(c) === '')) continue
    const sid = get(r, 'sid').toUpperCase()
    const identityText = get(r, 'identity')
    const identity = identityText === '' ? 'student' : IDENTITY_BY_ZH[identityText]
    const email = get(r, 'email').toLowerCase() || (sid ? emailForSid(sid) : '')
    const klass = parseClassLabel(get(r, 'classLabel'))
    const dues = DUES[get(r, 'dues')]
    rows.push({
      line: i + 1, sid, name: get(r, 'name'), email, identity: identity ?? 'student', position: get(r, 'position'),
      grade: klass?.grade ?? null, class_name: klass?.class_name ?? null, dues_paid: dues ?? false,
      error:
        !sid ? '缺學號'
        : !identity ? `身份只能填 ${IDENTITY_ZH_LIST}`
        : !/^\S+@\S+\.\S+$/.test(email) ? 'Email 格式不正確'
        : !klass ? '班級格式不正確（例：日媒四乙、碩媒一甲）'
        : dues === undefined ? '會費只能填 已繳／未繳'
        : existingSids.has(sid) ? '已有帳號'
        : undefined
    })
  }
  const lastLine = new Map(rows.filter(r => !r.error).map(r => [r.sid, r.line]))
  for (const r of rows) if (!r.error && lastLine.get(r.sid) !== r.line) r.error = '學號重複，以後面那筆為準'
  return rows
}
