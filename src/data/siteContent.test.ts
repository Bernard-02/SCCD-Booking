import { describe, it, expect } from 'vitest'
import { resolveContent, zipLines, splitTitled } from './siteContent'

describe('siteContent', () => {
  it('resolveContent：沒資料用內建，中文空白用內建，英文空白退回中文', () => {
    const d = resolveContent('about.quote')
    expect(d.zh).toContain('解決問題')
    expect(resolveContent('about.quote', { zh: '', en: '' })).toEqual(d)
    expect(resolveContent('about.quote', { zh: '新中文', en: '' })).toEqual({ zh: '新中文', en: '新中文' })
    expect(resolveContent('about.quote', { zh: '新中文', en: 'New' })).toEqual({ zh: '新中文', en: 'New' })
    expect(resolveContent('contact.email', { zh: 'a@b.c', en: '' }).en).toBe('a@b.c')
  })
  it('zipLines：一行一項、略過空行、英文不夠行顯示中文', () => {
    expect(zipLines({ zh: '甲\n\n乙 \n丙', en: 'A\nB' })).toEqual([
      { zh: '甲', en: 'A' }, { zh: '乙', en: 'B' }, { zh: '丙', en: '丙' }
    ])
  })
  it('splitTitled：中英各自的冒號，沒冒號整行是標題', () => {
    expect(splitTitled({ zh: '設備租借：相機', en: 'Rental: Cameras' })).toEqual({ zh: '設備租借', en: 'Rental', descZh: '相機', descEn: 'Cameras' })
    expect(splitTitled({ zh: '活動', en: 'Events' })).toEqual({ zh: '活動', en: 'Events', descZh: undefined, descEn: undefined })
    expect(splitTitled({ zh: '甲：乙', en: '甲：乙' })).toEqual({ zh: '甲', en: '甲', descZh: '乙', descEn: '乙' })
  })
})
