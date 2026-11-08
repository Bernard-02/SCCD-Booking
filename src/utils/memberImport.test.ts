/**
 * memberImport 測試：會員匯入的表頭對應與逐列驗證（後台會員管理 › 匯入）
 */

import { describe, it, expect } from 'vitest'
import { parseMemberRows } from './memberImport'

describe('parseMemberRows', () => {
  it('表頭名稱對應（順序不拘）、略過標題列與空列、身份中文、Email 自動帶入、學號轉大寫', () => {
    const rows = parseMemberRows([
      ['會員名單 115 學年'],
      [],
      ['姓名', '學號', '班級', '會費', '身份', '職稱'],
      ['王小明', 'a113144001', '日媒一甲', '已繳', '', ''],
      ['李小華', 'A112141002', '', '', '系學會', '會長'],
      ['', '', '', '', '', '']
    ], new Set())
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      line: 4, sid: 'A113144001', name: '王小明', email: 'a113144001@gm.usc.edu.tw', identity: 'student', position: '',
      grade: '大一', class_name: '甲', dues_paid: true, error: undefined
    })
    expect(rows[1]).toMatchObject({ line: 5, sid: 'A112141002', identity: 'sa', position: '會長', grade: null, class_name: null, dues_paid: false })
  })

  it('班級與會費：碩士、大五；格式不對的列標錯', () => {
    const rows = parseMemberRows([
      ['學號', '班級', '會費'],
      ['M114144001', '碩媒一甲', 'V'],
      ['A109141001', '日媒五乙', '是'],
      ['A1', '四乙', ''],
      ['A2', '', '不知道']
    ], new Set())
    expect(rows[0]).toMatchObject({ grade: '碩一', class_name: '甲', dues_paid: true, error: undefined })
    expect(rows[1]).toMatchObject({ grade: '大五', class_name: '乙', dues_paid: true, error: undefined })
    expect(rows[2].error).toContain('班級格式不正確')
    expect(rows[3].error).toContain('會費只能填')
  })

  it('標出錯誤：缺學號、身份亂填、Email 格式、已有帳號、檔內重複（以後面那筆為準）', () => {
    const rows = parseMemberRows([
      ['學號', '姓名', 'Email', '身份'],
      ['', '無學號', '', ''],
      ['A1', '甲', '', '老師'],
      ['A2', '乙', 'not-an-email', ''],
      ['A3', '丙', '', ''],
      ['A4', '丁', '', ''],
      ['A4', '丁二', '', '']
    ], new Set(['A3']))
    expect(rows.map(r => r.error)).toEqual([
      '缺學號', '身份只能填 學生／轉學生／系學會／系秘', 'Email 格式不正確', '已有帳號', '學號重複，以後面那筆為準', undefined
    ])
  })

  it('沒有「學號」表頭 → 空陣列', () => {
    expect(parseMemberRows([['a', 'b'], ['1', '2']], new Set())).toEqual([])
  })
})
