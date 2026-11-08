/**
 * 年級／學制判斷（與 orders-rpc.sql 的 v_sophomore_up 同一套慣例）
 * students.grade 慣例：'1'-'6' 或「大一」-「大六」，碩士含「碩」字樣。
 * 未填或格式不符一律**從嚴**視為一般生（大一待遇：14 天、A508 擋）——
 * 要享有放寬需由系學會在 Studio 填妥 grade。
 */

/** 大二以上（含碩士）——A508 教室借用資格 */
export const isSophomoreOrAbove = (grade?: string | null): boolean => {
  const g = grade ?? ''
  return /^[2-6]$/.test(g) || /大[二三四五六]|碩/.test(g)
}

/** 大四以上（含延畢的大五、大六）——設備不限天數 */
export const isSeniorUp = (grade?: string | null): boolean => {
  const g = grade ?? ''
  return /^[4-6]$/.test(g) || /大[四五六]/.test(g)
}

/** 大四以上或碩士——空間租借上限由 14 天放寬為 30 天 */
export const isSeniorOrGraduate = (grade?: string | null): boolean =>
  isSeniorUp(grade) || /碩/.test(grade ?? '')

/** 租借天數上限（迄日－起日），server 端 submit_orders 同規則：設備 30，大四以上不限；空間 14，大四以上與碩士 30 */
export const maxRentalDays = (category: 'equipment' | 'space', grade?: string | null): number =>
  category === 'equipment'
    ? (isSeniorUp(grade) ? 36500 : 30)
    : (isSeniorOrGraduate(grade) ? 30 : 14)

const NUM = ['一', '二', '三', '四', '五', '六']

/**
 * 班級標籤「日媒四乙」「碩媒一甲」＝ grade（年級，規則與 9/1 升級都看它）＋ class_name（班別甲／乙）。
 * 兩欄分開存、顯示才組起來，升級後標籤自動跟著變。grade 格式不符（舊資料）原樣顯示。
 * 班別取 class_name 裡的甲／乙（可能存「乙」「乙班」「日媒四乙」）。
 * 名單匯入有填班級就用名單的，沒填才由學號推（2026-11-07 Bernard 定，supabase/members-v2.sql）。
 */
export const classLabel = (grade?: string | null, className?: string | null): string => {
  const m = (grade ?? '').match(/^(大|碩)?([1-6]|[一二三四五六])$/)
  if (!m) return [grade, className].filter(Boolean).join(' ')
  const year = /\d/.test(m[2]) ? NUM[Number(m[2]) - 1] : m[2]
  const section = (className ?? '').match(/[甲乙]/)?.[0] ?? ''
  return `${m[1] === '碩' ? '碩' : '日'}媒${year}${section}`
}

/** 「日媒四乙」→ { grade: '大四', class_name: '乙' }；空字串＝清空兩欄；格式不符回 null */
export const parseClassLabel = (label: string): { grade: string | null; class_name: string | null } | null => {
  const s = label.trim()
  if (!s) return { grade: null, class_name: null }
  const m = s.match(/^(日|碩)媒([一二三四五六])([甲乙])?$/)
  if (!m) return null
  return { grade: `${m[1] === '碩' ? '碩' : '大'}${m[2]}`, class_name: m[3] ?? null }
}
