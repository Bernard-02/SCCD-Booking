/**
 * gradeUtils 測試：班級標籤組合／解析（後台會員管理）
 */

import { describe, it, expect } from 'vitest'
import { classLabel, parseClassLabel, isSophomoreOrAbove } from './gradeUtils'

describe('classLabel', () => {
  it('組合 grade＋班別', () => {
    expect(classLabel('大四', '乙')).toBe('日媒四乙')
    expect(classLabel('4', '乙')).toBe('日媒四乙')
    expect(classLabel('碩一', '甲')).toBe('碩媒一甲')
    expect(classLabel('大二', null)).toBe('日媒二')
  })
  it('class_name 其他寫法也認得甲／乙', () => {
    expect(classLabel('大三', '日媒三乙')).toBe('日媒三乙')
    expect(classLabel('大三', '乙班')).toBe('日媒三乙')
  })
  it('class_name 沒填時用學號代碼（141 甲、144 乙）', () => {
    expect(classLabel('大四', null, 'B111144001')).toBe('日媒四乙')
    expect(classLabel('大四', '', 'B111141001')).toBe('日媒四甲')
    expect(classLabel('大四', '甲', 'B111144001')).toBe('日媒四甲') // class_name 優先
  })
  it('格式不符原樣顯示', () => {
    expect(classLabel(null, null)).toBe('')
    expect(classLabel('延畢', '甲')).toBe('延畢 甲')
  })
})

describe('parseClassLabel', () => {
  it('拆回 grade＋class_name，且與規則判斷相容', () => {
    expect(parseClassLabel('日媒四乙')).toEqual({ grade: '大四', class_name: '乙' })
    expect(parseClassLabel(' 碩媒一甲 ')).toEqual({ grade: '碩一', class_name: '甲' })
    expect(parseClassLabel('日媒二')).toEqual({ grade: '大二', class_name: null })
    expect(isSophomoreOrAbove(parseClassLabel('日媒二乙')!.grade)).toBe(true)
  })
  it('空字串清空、格式錯誤回 null', () => {
    expect(parseClassLabel('')).toEqual({ grade: null, class_name: null })
    expect(parseClassLabel('四乙')).toBeNull()
    expect(parseClassLabel('日媒五甲')).toBeNull()
  })
  it('來回一致', () => {
    const p = parseClassLabel('碩媒二乙')!
    expect(classLabel(p.grade, p.class_name)).toBe('碩媒二乙')
  })
})
