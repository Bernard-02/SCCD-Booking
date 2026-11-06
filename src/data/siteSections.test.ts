import { describe, it, expect } from 'vitest'
import { cnNum, resolveSection, DEFAULT_SECTIONS } from './siteSections'

describe('siteSections', () => {
  it('cnNum：一～二十', () => {
    expect([1, 2, 9, 10, 11, 19, 20, 21].map(cnNum)).toEqual(['一', '二', '九', '十', '十一', '十九', '二十', '21'])
  })
  it('resolveSection：英文空白退回中文（標題與每個積木）', () => {
    const r = resolveSection({ titleZh: '宗旨', titleEn: '', blocks: [{ kind: 'text', zh: '甲', en: ' ', url: '' }, { kind: 'text', zh: '乙', en: 'B', url: '' }] })
    expect(r.titleEn).toBe('宗旨')
    expect(r.blocks.map(b => b.en)).toEqual(['甲', 'B'])
  })
  it('內建段落：使用教學有且只有一個連結積木（清單頁「完整使用說明」用它的網址）', () => {
    const links = DEFAULT_SECTIONS.guide.flatMap(s => s.blocks).filter(b => b.kind === 'link')
    expect(links).toHaveLength(1)
    expect(links[0].url).toMatch(/^https:\/\//)
  })
})
