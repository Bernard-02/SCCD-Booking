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
