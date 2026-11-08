/**
 * 改取件時段（學生）：公休撞到大量設備的取件時段時，從通知的「修改取件日」或訂單卡開這個視窗。
 * 選項＝現在起到起租日的值班時段（中午或晚上，公休的已跳過）；起租日、歸還日不動，
 * 規則由 server 端 change_my_pickup 把關（supabase/rules-2026-11.sql）。
 */

import React, { useEffect, useState } from 'react'
import ConfirmDialog from '../common/ConfirmDialog'
import { Select } from '../admin/adminUi'
import { fetchClosedDates, fetchDutySlots } from '../../services/ordersService'
import { dutySlotOptions, slotLabel, type DutySlot } from '../../utils/timeUtils'
import { useT } from '../../stores/langStore'

interface Props {
  rentalNumber: string
  startDate: string // YYYY-MM-DD
  /** 回傳錯誤訊息（對話框保留）；null＝成功，由呼叫端關閉 */
  onConfirm: (date: string, slot: string) => Promise<string | null>
  onCancel: () => void
}

const ChangePickupDialog: React.FC<Props> = ({ rentalNumber, startDate, onConfirm, onCancel }) => {
  const t = useT()
  const [duties, setDuties] = useState<DutySlot[] | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const [value, setValue] = useState('') // 'YYYY-MM-DD HH:MM-HH:MM'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([fetchDutySlots(), fetchClosedDates()]).then(([d, c]) => { setDuties(d); setClosed(c) })
  }, [])

  const options = duties ? dutySlotOptions(duties, new Date(), new Date(`${startDate}T23:59`), closed) : []

  const submit = async () => {
    const [date, slot] = value.split(' ')
    setBusy(true)
    setError('')
    const message = await onConfirm(date, slot)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <ConfirmDialog
      isOpen
      title="修改取件日"
      titleEn="Change Pickup Date"
      message={`訂單 ${rentalNumber} 的取件時段遇到公休，請選新的取件時段。起租日和歸還日不變。`}
      messageEn={`The pickup slot for order ${rentalNumber} falls on a closure. Please choose a new one. Your start and return dates stay the same.`}
      confirmDisabled={!value || busy}
      onConfirm={submit}
      onCancel={onCancel}
    >
      <Select
        value={value}
        onChange={setValue}
        placeholder={duties ? t('Select', '請選擇') : t('Loading…', '載入中…')}
        options={options.map(o => ({ value: `${o.date} ${o.slot}`, label: slotLabel(o) }))}
        className="w-full"
        aria-label={t('Pickup slot', '取件時段')}
      />
      {duties && options.length === 0 && (
        <p className="mt-2 text-2xs text-error">{t('No staffed slots before your start date. Please contact the SA.', '起租日前沒有可取件的值班時段，請洽系學會')}</p>
      )}
      {error && <p className="mt-2 text-2xs text-error">{error}</p>}
    </ConfirmDialog>
  )
}

export default ChangePickupDialog
