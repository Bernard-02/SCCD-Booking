/**
 * gradeUtils 測試：班級標籤組合／解析（後台會員管理）
 */

import { describe, it, expect } from 'vitest'
import { classLabel, parseClassLabel, isSophomoreOrAbove, isSeniorOrGraduate, isSeniorUp, maxRentalDays } from './gradeUtils'

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
  it('格式不符原樣顯示', () => {
    expect(classLabel(null, null)).toBe('')
    expect(classLabel('延畢', '甲')).toBe('延畢 甲')
  })
})

describe('年級判斷', () => {
  it('大五、大六算大二以上、大四以上；碩士算大二以上但不是大四以上', () => {
    for (const g of ['大四', '大五', '大六', '4', '5', '6']) {
      expect(isSophomoreOrAbove(g)).toBe(true)
      expect(isSeniorUp(g)).toBe(true)
      expect(isSeniorOrGraduate(g)).toBe(true)
    }
    expect(isSeniorUp('碩一')).toBe(false)
    expect(isSeniorOrGraduate('碩一')).toBe(true)
    expect(isSophomoreOrAbove('碩一')).toBe(true)
    expect(isSophomoreOrAbove('大一')).toBe(false)
    expect(isSophomoreOrAbove(null)).toBe(false)
  })

  it('maxRentalDays：設備 30，大四以上不限；空間 14，大四以上與碩士 30', () => {
    expect(maxRentalDays('equipment', '大三')).toBe(30)
    expect(maxRentalDays('equipment', '碩二')).toBe(30)
    expect(maxRentalDays('equipment', '大四')).toBeGreaterThan(3650)
    expect(maxRentalDays('equipment', '大六')).toBeGreaterThan(3650)
    expect(maxRentalDays('space', '大三')).toBe(14)
    expect(maxRentalDays('space', null)).toBe(14)
    expect(maxRentalDays('space', '碩一')).toBe(30)
    expect(maxRentalDays('space', '大五')).toBe(30)
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
    expect(parseClassLabel('日媒七甲')).toBeNull()
  })
  it('大五、大六', () => {
    expect(parseClassLabel('日媒五甲')).toEqual({ grade: '大五', class_name: '甲' })
    expect(classLabel('大六', '乙')).toBe('日媒六乙')
    expect(classLabel('5', '甲')).toBe('日媒五甲')
  })
  it('來回一致', () => {
    const p = parseClassLabel('碩媒二乙')!
    expect(classLabel(p.grade, p.class_name)).toBe('碩媒二乙')
  })
})
