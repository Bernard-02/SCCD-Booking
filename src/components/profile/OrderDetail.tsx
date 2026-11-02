/**
 * OrderDetail 組件
 * Profile 訂單 accordion 展開內容（取代原本的 /order 詳情頁）：
 * 左＝摘要列沒有的資訊（送單／最後修改時間、使用原因），右＝品項（設備／空間分組，編號區按區域合併）。
 * 只在展開時渲染，配色以白底為準。
 * 訂單型別與日期格式化也放這裡，ProfilePage／OrderReceipt 共用。
 */

import React from 'react'
import { CHIP } from '@/components/common/btn'
import { getAreaName, getBlockArea, getBlockImage, sortBlockIds } from '../cart/cartHelpers'
import { useT } from '../../stores/langStore'
import { useBundles, useItemImages } from '../../services/equipmentService'
import { splitIntoSets } from '../../utils/bundleUtils'

export interface ReceiptItem {
  id: string
  name: string
  category: 'equipment' | 'space-block' | 'classroom'
  quantity: number
  deposit: number
  startDate: string
  endDate: string
  image: string
  bookingType?: 'little' | 'mass-personal' | 'mass-group'
  changedAt?: string | null  // 送單後改過（修改訂單）
  pickupPending?: boolean    // 取件後新增、尚未點交
}

export type OrderStatus = 'pending' | 'in-progress' | 'returned' | 'overdue' | 'canceled'

export interface Receipt {
  borrowerName: string
  rentalDates: string[]
  rentalNumber: string
  totalDeposit: number
  items: ReceiptItem[]
  createdAt: string
  status?: OrderStatus
  hasExtended?: boolean
  reason?: string | null
  // 大量設備預選時段（mass-pickup.sql）；depositPaidAt 有值且仍 pending＝已繳押金待取件
  depositPaidAt?: string | null
  depositDate?: string | null
  depositSlot?: string | null
  pickupSlot?: string | null
  itemsUpdatedAt?: string | null // 學生最後一次改品項（收據印出，對照紙本新舊）
}

export const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })

export const formatDateRange = (dates: string[]) => {
  if (dates.length === 0) return ''
  const sorted = [...dates].sort()
  return `${formatDate(sorted[0])} - ${formatDate(sorted[sorted.length - 1])}`
}

/** 送單／最後修改時間：日期＋24 小時制時間 */
export const formatOrderTime = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${formatDate(iso)} ${d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

const ROW = 'grid grid-cols-[56px_1fr_60px_100px] gap-4 py-3 border-b border-gray-light last:border-b-0 items-center text-sm'

const Thumb: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div className="w-14 h-14 overflow-hidden rounded-lg">
    <img src={src} alt={alt} className="w-full h-full object-cover" />
  </div>
)

// 分組標題列：名稱＋總數＋總押金（押金上限 5,000）
const GroupHeader: React.FC<{ label: string; count: number; deposit: number }> = ({ label, count, deposit }) => (
  <div className="grid grid-cols-[1fr_60px_100px] gap-4 pb-2 text-sm" style={{ fontWeight: 500 }}>
    <span>{label}</span>
    <span className="text-center font-english">{count}</span>
    <span className="font-english">NT$ {Math.min(deposit, 5000).toLocaleString()}</span>
  </div>
)

const OrderDetail: React.FC<{ receipt: Receipt }> = ({ receipt }) => {
  const t = useT()
  const images = useItemImages() // 編號區格子優先用後台上傳的圖（第一格），沒有退回區域示意圖
  const equipment = receipt.items.filter(i => i.category === 'equipment')
  const equipmentSets = splitIntoSets(equipment, useBundles())
  const classrooms = receipt.items.filter(i => i.category === 'classroom')
  const blocksByArea: Record<string, ReceiptItem[]> = {}
  receipt.items
    .filter(i => i.category === 'space-block')
    .forEach(i => { (blocksByArea[getBlockArea(i.id)] ??= []).push(i) })
  const spaceCount = classrooms.length + Object.values(blocksByArea).flat().length

  // 日期、押金、借用者（本人）、預約時段在摘要列已看得到，這裡只放摘要沒有的
  // 第三欄＝值的字型：時間用英文字距、使用原因是中文
  const info: [string, string, string][] = [
    [t('Order Time', '送單時間'), formatOrderTime(receipt.createdAt), 'font-english'],
    ...(receipt.itemsUpdatedAt ? [[t('Updated', '最後修改'), formatOrderTime(receipt.itemsUpdatedAt), 'font-english'] as [string, string, string]] : []),
    ...(receipt.reason ? [[t('Reason', '使用原因'), receipt.reason, 'font-chinese'] as [string, string, string]] : [])
  ]

  return (
    <div className="grid grid-cols-[2fr_3fr] gap-12">
      {/* 左：借用資訊 */}
      <dl className="space-y-4 text-sm">
        {info.map(([label, value, cls]) => (
          <div key={label} className="grid grid-cols-[100px_1fr] gap-4">
            <dt className="text-xs opacity-50">{label}</dt>
            <dd className={cls}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* 右：品項 */}
      <div className="space-y-6">
        {equipment.length > 0 && (
          <div>
            <GroupHeader
              label={t('Equipment', '設備')}
              count={equipment.reduce((s, i) => s + i.quantity, 0)}
              // 一張單只有設備或只有空間：直接用 server 記錄的押金（已套用設備組合與 cap）
              deposit={receipt.totalDeposit}
            />
            {/* 湊成的組合一列（押金以組計），其餘單件照列 */}
            {equipmentSets.sets.map(({ bundle, count }) => {
              const first = equipment.find(i => i.id === bundle.items[0]?.equipmentId)
              return (
                <div key={bundle.id} className={ROW}>
                  <Thumb src={first?.image ?? ''} alt={bundle.name} />
                  <div>
                    {bundle.name}
                    <div className="text-2xs opacity-50">
                      {bundle.items.map(c => `${equipment.find(i => i.id === c.equipmentId)?.name ?? ''} ×${c.quantity * count}`).join('、')}
                    </div>
                  </div>
                  <div className="text-center"><span className="font-english">{count}</span> {t('set', '組')}</div>
                  <div className="font-english">NT$ {(bundle.deposit * count).toLocaleString()}</div>
                </div>
              )
            })}
            {equipmentSets.loose.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className={ROW}>
                <Thumb src={item.image} alt={item.name} />
                <div>
                  {item.name}
                  {/* 修改訂單（情境 3）：取件後新增待點交／送單後改過 */}
                  {item.pickupPending
                    ? <span className={`${CHIP} ml-2 bg-yellow text-black`}>待點交</span>
                    : item.changedAt && <span className="text-2xs ml-2 opacity-50">已更動</span>}
                </div>
                <div className="text-center font-english">{item.quantity}</div>
                <div className="font-english">NT$ {(item.deposit * item.quantity).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {spaceCount > 0 && (
          <div>
            <GroupHeader
              label={t('Space', '空間')}
              count={spaceCount}
              deposit={receipt.items.filter(i => i.category !== 'equipment').reduce((s, i) => s + i.deposit, 0)}
            />
            {Object.entries(blocksByArea).map(([area, blocks]) => {
              const blockIds = sortBlockIds(blocks.map(b => b.id))
              return (
                <div key={area} className={ROW}>
                  <Thumb src={images[blocks[0].id] || getBlockImage(blocks[0].id)} alt={getAreaName(blocks[0].id)} />
                  <div>{getAreaName(blocks[0].id)}（{blockIds.join('、')}）</div>
                  <div className="text-center font-english">{blocks.length}</div>
                  <div className="font-english">NT$ {blocks.reduce((s, b) => s + b.deposit, 0).toLocaleString()}</div>
                </div>
              )
            })}
            {classrooms.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className={ROW}>
                <Thumb src={item.image} alt={item.name} />
                <div>{item.name}</div>
                <div className="text-center font-english">1</div>
                <div className="font-english">NT$ {item.deposit.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderDetail
