/**
 * Server 錯誤原因的英文版（SQL 的 raise exception 維持中文，學生端切到 EN 時在這裡對照）。
 * 新增或修改 SQL 的錯誤訊息時，這裡要一起加英文；對不到的照原文（中文）顯示。
 * 範圍：學生會看到的 RPC——submit_orders、modify_my_order、change_my_pickup、extend_my_order_partial、extend_check。
 */

import { tr } from '../stores/langStore'

// 訂單類型（「您已有一張未歸還的%訂單」等訊息帶入的中文類型）
const TYPE_EN: Record<string, string> = {
  小量設備: 'light equipment',
  大量設備: 'mass equipment',
  個人空間: 'personal space',
  團體空間: 'group space'
}
const typeEn = (zh: string) => TYPE_EN[zh] ?? zh
// 多個品項以「」、「」串起來（無法延期：「A」、「B」…）
const names = (s: string) => s.split('」、「').map(n => `"${n}"`).join(', ')

const EXACT: Record<string, string> = {
  未登入: 'Please log in first.',
  查無此訂單: 'Order not found.',
  品項重複: 'Duplicate items in the order.',
  數量需為正整數: 'Quantities must be positive whole numbers.',
  品項類型不正確: 'Invalid item type.',
  訂單類型不符: 'Order type does not match the items.',
  沒有可送出的訂單: 'There is nothing to submit.',
  租借天數超過上限: 'The rental period is longer than allowed.',
  '租借日期不正確，請重新選擇': 'The rental dates are invalid. Please choose again.',
  '設備與空間須分開成兩張訂單': 'Equipment and spaces must be booked as separate orders.',
  '大量設備需於 3 天前預約': 'Mass equipment must be booked at least 3 days in advance.',
  '大量設備訂單需選擇繳押金與取件時段': 'Mass equipment orders need a deposit time slot and a pickup time slot.',
  '繳押金日期需介於今天與起租日之間，請重新選擇時段': 'The deposit date must be between today and the start date. Please choose another slot.',
  '所選租借期間為寒暑假封鎖期，暫不開放租借': 'The selected period falls in the winter/summer break, when rentals are closed.',
  'A508 教室僅限大二以上（含碩士）借用': 'Classroom A508 is only available to second-year students and above (including master’s students).',
  '尚未繳交系學會費，請先至系學會繳交後再預約': 'You haven’t paid the Student Association fee yet. Please pay it at the SA before booking.',
  '起租日最遠只能選今天起 30 天內': 'The start date can be at most 30 days from today.',
  '個人空間一個時段只能借一間教室': 'Personal bookings can include only one classroom per period.',
  '證明文件不存在，請重新上傳': 'The proof file could not be found. Please upload it again.',
  '老師名義需填老師名稱並上傳證明文件': 'Booking under a teacher’s name needs the teacher’s name and a proof document.',
  '一年級借雷切機需上傳授課教師核可證明': 'First-year students need to upload their course teacher’s approval to book the laser cutter.',
  '僅待取件的大量設備訂單可改取件日': 'Only mass equipment orders that are awaiting pickup can change the pickup date.',
  '目前的取件時段沒有公休，不用改取件日': 'Your pickup slot isn’t affected by a closure, so it doesn’t need changing.',
  '取件日需介於今天與起租日之間': 'The pickup date must be between today and the start date.',
  '這個時段沒有值班，請重新選擇': 'That slot isn’t staffed. Please choose another one.',
  '帳號已停權（未完成清潔歸還），無法送出預約，請聯絡系學會': 'Your account is suspended (clean return not completed), so you can’t submit bookings. Please contact the SA.',
  '帳號已停權（未完成清潔歸還），無法修改訂單，請聯絡系學會': 'Your account is suspended (clean return not completed), so you can’t edit orders. Please contact the SA.',
  '帳號已停用（已畢業），無法送出預約': 'Your account has been deactivated (graduated) and can’t submit bookings.',
  '帳號目前標記為休學，暫停租借；復學後請洽系學會恢復': 'Your account is marked as on leave, so rentals are paused. Please contact the SA after you return.',
  '有未繳清的罰款，請先至系學會繳清後再預約': 'You have an unpaid fine. Please pay it at the SA before booking again.',
  '僅待繳押金、已繳待取件、租借中的訂單可修改（逾期請先歸還）': 'Only orders that are awaiting deposit, awaiting pickup, or in progress can be edited (return overdue orders first).',
  僅設備訂單可修改品項: 'Only equipment orders can be edited.',
  '已取件的設備不能減少（不需要的到期一起歸還即可）': 'You can’t reduce equipment you’ve already picked up — just return what you don’t need on the return date.',
  訂單至少需保留一項設備: 'An order must keep at least one item.',
  僅租借中的訂單可延期: 'Only orders in progress can be extended.',
  '延期天數需為 1-7 天': 'Extensions must be 1–7 days.',
  '延期須在原歸還日前三天提出，已逾期限無法延期': 'Extensions must be requested at least 3 days before the return date; it’s too late to extend this order.',
  '此訂單已延期過（僅可延期乙次）': 'This order has already been extended (only one extension is allowed).',
  '無法延期：延長期間適逢寒暑假封鎖，最後歸還日為放假前一日': 'Can’t extend: the extension falls in the winter/summer break. The latest return date is the day before the break.',
  請選擇至少一項要延期的品項: 'Select at least one item to extend.',
  選取品項與訂單不符: 'The selected items don’t belong to this order.'
}

const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^「(.+)」已下架，無法新增$/, n => `"${n}" has been removed from the catalog and can’t be added.`],
  [/^「(.+)」已下架，請從購物車移除$/, n => `"${n}" is no longer available. Please remove it from your cart.`],
  [/^「(.+)」目前未開放，請從購物車移除$/, n => `"${n}" is currently closed. Please remove it from your cart.`],
  [/^「(.+)」該時段已被預約$/, n => `"${n}" is already booked for these dates.`],
  [/^「(.+)」該時段庫存不足（剩餘 (\d+)）$/, (n, q) => `Not enough "${n}" for these dates (${q} left).`],
  [/^「(.+)」該時段庫存不足（最多可借 (\d+)）$/, (n, q) => `Not enough "${n}" for these dates (up to ${q} available).`],
  [/^小量訂單最多 9 件（目前 (\d+) 件，整組算 1 件）$/, q => `Light orders allow up to 9 items (currently ${q}; a full set counts as 1).`],
  [/^大量訂單需滿 10 件（目前 (\d+) 件）$/, q => `Mass orders need at least 10 items (currently ${q}).`],
  [/^大量／團體訂單需滿 10 件（目前 (\d+) 件）$/, q => `Mass and group orders need at least 10 items (currently ${q}).`],
  [/^設備不存在：(.+)$/, n => `Equipment not found: ${n}`],
  [/^空間不存在：(.+)$/, n => `Space not found: ${n}`],
  [/^您已有一張未歸還的(.+)訂單（(.+)），需歸還後才能再借(設備|空間)$/, (ty, no, cat) => `You have an unreturned ${typeEn(ty)} order (${no}). Return it before booking ${cat === '設備' ? 'equipment' : 'spaces'} again.`],
  [/^無法延期：「(.+)」於延長期間已被其他訂單預約$/, n => `Can’t extend: ${names(n)} ${n.includes('」、「') ? 'are' : 'is'} booked by another order during the extension.`]
]

/** server 錯誤原因 → 目前語言（中文介面原樣回傳；英文對不到也回傳原文） */
export const serverErrorText = (msg: string): string => {
  if (tr(false, true)) return msg
  const exact = EXACT[msg]
  if (exact) return exact
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re)
    if (m) return fn(...m.slice(1))
  }
  return msg
}
