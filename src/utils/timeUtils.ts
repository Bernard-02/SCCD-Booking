/**
 * 時間計算工具
 * 處理系學會公休日（週六、週日）的特殊邏輯
 */

// 判斷是否為公休日（週六或週日）
const isOffDay = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6 // 0 is Sunday, 6 is Saturday
}

// 計算經過的「有效時數」（排除公休日）
// 用於訂單 24 小時繳費倒數
export const calculateValidHoursPassed = (startDateStr: string): number => {
  const start = new Date(startDateStr)
  const now = new Date()
  
  if (now < start) return 0
  
  let totalTimeMs = now.getTime() - start.getTime()
  
  // 迭代每一天，扣除公休日的時間
  const temp = new Date(start)
  temp.setHours(0, 0, 0, 0)
  
  const endLoop = new Date(now)
  endLoop.setHours(0, 0, 0, 0)
  // 加一天以確保包含結束當天的檢查
  endLoop.setDate(endLoop.getDate() + 1)

  while (temp < endLoop) {
    if (isOffDay(temp)) {
      // 如果這一天是公休日，計算它與 [start, now] 的交集時間並扣除
      const dayStart = new Date(temp)
      const dayEnd = new Date(temp)
      dayEnd.setDate(dayEnd.getDate() + 1)
      
      const intersectionStart = dayStart < start ? start : dayStart
      const intersectionEnd = dayEnd > now ? now : dayEnd
      
      if (intersectionEnd > intersectionStart) {
        totalTimeMs -= (intersectionEnd.getTime() - intersectionStart.getTime())
      }
    }
    temp.setDate(temp.getDate() + 1)
  }
  
  return totalTimeMs / (1000 * 60 * 60)
}