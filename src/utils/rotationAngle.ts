/**
 * 導覽連結隨機旋轉角度
 * 範圍 -4° ~ +6°，排除 0°；角度存在 module 層級的 registry，
 * SPA 換頁重掛載 Header／Footer 時沿用同一組（同分頁不重抽）；
 * hover 換新角度並寫回 registry，active（點擊）因此繼承最後 hover 的角度
 */

const randomAngle = (): number => {
  const a = Math.floor(Math.random() * 10) - 4 // -4 .. 5
  return a >= 0 ? a + 1 : a // -4..-1 ∪ 1..6
}

const angleStore: Record<string, number> = {}

/** 取得某個 key 的目前角度（第一次取用時隨機產生） */
export const angleFor = (key: string): number => {
  if (!(key in angleStore)) angleStore[key] = randomAngle()
  return angleStore[key]
}

/** onMouseEnter handler 工廠：換新角度、寫回 registry 並更新元素的 --rotation-angle */
export const spinOnHover = (key: string) => (e: { currentTarget: HTMLElement }) => {
  angleStore[key] = randomAngle()
  e.currentTarget.style.setProperty('--rotation-angle', `${angleStore[key]}deg`)
}
