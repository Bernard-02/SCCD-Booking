/**
 * 年級／學制判斷（與 orders-rpc.sql 的 v_sophomore_up 同一套慣例）
 * students.grade 慣例：'1'-'4' 或「大一」-「大四」，碩士含「碩」字樣。
 * 未填或格式不符一律**從嚴**視為一般生（大一待遇：14 天、A508 擋）——
 * 要享有放寬需由系學會在 Studio 填妥 grade。
 */

/** 大二以上（含碩士）——A508 教室借用資格 */
export const isSophomoreOrAbove = (grade?: string | null): boolean => {
  const g = grade ?? ''
  return /^[234]$/.test(g) || /大二|大三|大四|碩/.test(g)
}

/** 大四或碩士——空間租借上限由 14 天放寬為 30 天 */
export const isSeniorOrGraduate = (grade?: string | null): boolean => {
  const g = grade ?? ''
  return /^4$/.test(g) || /大四|碩/.test(g)
}

const NUM = ['一', '二', '三', '四']

// 學號第 5–7 碼的班別代碼（同 ProfilePage.formatClassName）
const SECTION_BY_CODE: Record<string, string> = { '141': '甲', '144': '乙' }

/**
 * 班級標籤「日媒四乙」「碩媒一甲」＝ grade（年級，規則與 9/1 升級都看它）＋ class_name（班別甲／乙）。
 * 兩欄分開存、顯示才組起來，升級後標籤自動跟著變。grade 格式不符（舊資料）原樣顯示。
 * 班別：class_name 裡的甲／乙（可能存「乙」「乙班」「日媒四乙」）；沒填就看學號代碼。
 */
export const classLabel = (grade?: string | null, className?: string | null, studentId?: string): string => {
  const m = (grade ?? '').match(/^(大|碩)?([1-4]|[一二三四])$/)
  if (!m) return [grade, className].filter(Boolean).join(' ')
  const year = /\d/.test(m[2]) ? NUM[Number(m[2]) - 1] : m[2]
  const section = (className ?? '').match(/[甲乙]/)?.[0] ?? SECTION_BY_CODE[studentId?.substring(4, 7) ?? ''] ?? ''
  return `${m[1] === '碩' ? '碩' : '日'}媒${year}${section}`
}

/** 「日媒四乙」→ { grade: '大四', class_name: '乙' }；空字串＝清空兩欄；格式不符回 null */
export const parseClassLabel = (label: string): { grade: string | null; class_name: string | null } | null => {
  const s = label.trim()
  if (!s) return { grade: null, class_name: null }
  const m = s.match(/^(日|碩)媒([一二三四])([甲乙])?$/)
  if (!m) return null
  return { grade: `${m[1] === '碩' ? '碩' : '大'}${m[2]}`, class_name: m[3] ?? null }
}
