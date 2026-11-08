/**
 * OrderReceipt 組件
 * A4 收據模板（白底，供 html2canvas 擷取成 PDF）。中英並列、不跟介面語言切換——紙本給系學會對照。
 * downloadReceiptPdf：jspdf／html2canvas 點下載時才動態載入，不進 Profile 頁的初始 bundle。
 */

import React from 'react'
import { formatDateRange, formatOrderTime } from './OrderDetail'
import type { Receipt } from './OrderDetail'
import { useBundles } from '../../services/equipmentService'
import { splitIntoSets } from '../../utils/bundleUtils'

// 設備＝小量／大量；空間單 'little'＝個人、'mass-group'＝團體
const bookingTypeLabel = (type?: string, isEquip = true) =>
  isEquip
    ? (type === 'mass-personal' || type === 'mass-group' ? 'Mass - 大量' : 'Light - 小量')
    : (type === 'mass-group' ? 'Group - 團體' : 'Personal - 個人')

const OrderReceipt = React.forwardRef<HTMLDivElement, { receipt: Receipt }>(({ receipt }, ref) => {
  const spaceItems = receipt.items.filter(i => i.category !== 'equipment')
  const equipmentItems = receipt.items.filter(i => i.category === 'equipment')
  const equipmentSets = splitIntoSets(equipmentItems, useBundles())

  return (
    <div
      ref={ref}
      className="font-chinese w-[210mm] min-h-[297mm] bg-white text-black p-8 box-border flex flex-col"
    >
      {/* A. Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-english text-lg font-bold mb-1">SCCDSA Booking</h1>
          <p className="text-lg font-bold">實踐媒傳系學會借用系統</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold mb-1">Receipt 收據</h2>
          <p className="font-english text-lg font-bold">{receipt.rentalNumber}</p>
        </div>
      </div>

      {/* B. Info：送出時間、使用日期、使用者 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-xs text-black mb-1 font-bold">Order Time 送出時間</p>
          <p className="font-english text-sm font-bold">{formatOrderTime(receipt.createdAt)}</p>
          {receipt.itemsUpdatedAt && (
            <>
              <p className="text-xs text-black mb-1 mt-2 font-bold">Updated 最後修改</p>
              <p className="font-english text-sm font-bold">{formatOrderTime(receipt.itemsUpdatedAt)}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-xs text-black mb-1 font-bold">Booking Date 使用日期</p>
          <p className="font-english text-sm font-bold">{formatDateRange(receipt.rentalDates)}</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-left w-fit">
            <p className="text-xs text-black mb-1 font-bold">User 使用者</p>
            <p className="text-sm font-bold">{receipt.borrowerName}</p>
          </div>
        </div>
      </div>

      {/* 訂單種類、使用原因 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div>
          <p className="text-xs text-black mb-1 font-bold">Order Type 訂單種類</p>
          <p className="text-sm font-bold">
            {bookingTypeLabel(receipt.items[0]?.bookingType, receipt.items[0]?.category === 'equipment')}
            {receipt.asTeacher && `（老師名義：${receipt.teacher ?? ''}）`}
          </p>
        </div>
        <div>
          <p className="text-xs text-black mb-1 font-bold">Reason 使用原因</p>
          <p className="text-sm font-bold text-black">{receipt.reason || '—'}</p>
        </div>
      </div>

      {/* C. Items Table：空間在上、設備在下 */}
      <div className="flex-1">
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr>
              <th className="w-[60%] border-b border-gray-mid"><div className="text-left pt-2 pb-4 font-bold">Item 項目</div></th>
              <th className="w-[20%] border-b border-gray-mid"><div className="text-left pt-2 pb-4 font-bold">Qty 數量</div></th>
              <th className="w-[20%] border-b border-gray-mid"><div className="text-left pt-2 pb-4 font-bold">Deposit 押金</div></th>
            </tr>
          </thead>
          <tbody>
            {spaceItems.length > 0 && (
              <tr><td colSpan={3} className="py-2 font-bold pt-4 text-sm">Space 空間</td></tr>
            )}
            {spaceItems.map((item, idx) => (
              <tr key={`space-${idx}`}>
                <td className="border-b border-gray-mid"><div className="pt-2 pb-4">{item.name}</div></td>
                <td className="border-b border-gray-mid"><div className="font-english pt-2 pb-4 text-left">{item.quantity || 1}</div></td>
                <td className="border-b border-gray-mid"><div className="font-english pt-2 pb-4 text-left">NT$ {item.deposit.toLocaleString()}</div></td>
              </tr>
            ))}
            {equipmentItems.length > 0 && (
              <tr><td colSpan={3} className="py-2 font-bold pt-4 text-sm">Equipment 設備</td></tr>
            )}
            {/* 湊成的組合一列（押金以組計），其餘單件照列 */}
            {equipmentSets.sets.map(({ bundle, count }) => (
              <tr key={bundle.id}>
                <td className="border-b border-gray-mid">
                  <div className="pt-2 pb-4">
                    Set 組合：{bundle.name}（
                    {bundle.items.map(c => `${equipmentItems.find(i => i.id === c.equipmentId)?.name ?? ''} ×${c.quantity * count}`).join('、')}）
                  </div>
                </td>
                <td className="border-b border-gray-mid"><div className="font-english pt-2 pb-4 text-left">{count}</div></td>
                <td className="border-b border-gray-mid"><div className="font-english pt-2 pb-4 text-left">NT$ {(bundle.deposit * count).toLocaleString()}</div></td>
              </tr>
            ))}
            {equipmentSets.loose.map((item, idx) => (
              <tr key={`equip-${idx}`}>
                <td className="border-b border-gray-mid">
                  <div className="pt-2 pb-4">
                    {item.name}
                    {item.pickupPending ? '（待點交）' : item.changedAt ? '（已更動）' : ''}
                  </div>
                </td>
                <td className="border-b border-gray-mid"><div className="font-english pt-2 pb-4 text-left">{item.quantity || 1}</div></td>
                <td className="border-b border-gray-mid"><div className="font-english pt-2 pb-4 text-left">NT$ {(item.deposit * (item.quantity || 1)).toLocaleString()}</div></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-6"></td>
              <td className="pt-6 text-left font-bold">Total 總押金</td>
              <td className="font-english pt-6 text-left font-normal">NT$ {receipt.totalDeposit.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* D. Footer：使用說明 */}
      <div className="mt-auto pt-4">
        <div className="flex justify-between items-end">
          <div className="w-[75%]">
            <h3 className="font-bold mb-2 text-xs">User Guide 使用說明</h3>
            <div className="text-xs space-y-1 text-black">
              <div className="flex gap-2">
                <span className="font-english flex-shrink-0">1.</span>
                <span>Please bring this receipt to the SA during business hours to pay the deposit. 請於營業時間內持本收據至系學會繳交押金。</span>
              </div>
              <div className="flex gap-2">
                <span className="font-english flex-shrink-0">2.</span>
                <span>Cash payments only. No change given. 僅接受現金，恕不找零。</span>
              </div>
              <div className="flex gap-2">
                <span className="font-english flex-shrink-0">3.</span>
                <span>On the return date, please present this receipt to retrieve your deposit. 歸還時請出示本收據以退還押金。</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-english text-xs font-normal">page 1/1</p>
          </div>
        </div>
      </div>
    </div>
  )
})

/** 擷取收據元素 → A4 PDF 下載 */
export async function downloadReceiptPdf(el: HTMLElement, rentalNumber: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(el, {
    scale: 2, // 約 192 DPI，收據（純文字白底）已足夠清晰
    useCORS: true,
    backgroundColor: '#ffffff'
  } as Parameters<typeof html2canvas>[1])
  // JPEG（白底不需透明）+ compress：檔案由數十 MB 降到約 1MB
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const width = pdf.internal.pageSize.getWidth()
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, (canvas.height * width) / canvas.width)
  pdf.save(`SCCD_Receipt_${rentalNumber}.pdf`)
}

export default OrderReceipt
