/**
 * BookingDetailsDialog 組件
 * 用於填寫借用資訊（使用原因、班級、負責老師等）
 * 四種類型都能選「老師名義」：填老師名稱＋上傳證明文件，押金歸零（server 端 submit_orders 驗證）。
 * needsProof＝雷切機一年級：個人借也要上傳授課教師核可，押金照收。檔案符不符合由學會看，系統只收檔。
 * 大量設備另選「繳押金時段」與「取件時段」（rental-rules 新規則 3，mass-pickup.sql）：
 *   選項＝系學會值班時段；取件限起租日當天，繳押金限送單後 24 工作時內且不晚於取件（可同一時段＝同時進行）。
 */

import { BTN } from '@/components/common/btn'
import CloseButton from './CloseButton'
import { Select } from '../admin/adminUi'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fetchClosedDates, fetchDutySlots, uploadProof, PROOF_ACCEPT } from '../../services/ordersService'
import {
  addBusinessMs, dutySlotOptions, slotStart, slotLabel, toDateKey, PENDING_LIMIT_MS, type DutySlot
} from '../../utils/timeUtils'
import { useT } from '../../stores/langStore'
import { useEnterConfirm } from '../../hooks/useEnterConfirm'

export interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
  depositDate?: string  // 大量設備：繳押金日 'YYYY-MM-DD'
  depositSlot?: string  // 'HH:MM-HH:MM'
  pickupSlot?: string   // 取件時段（日期＝起租日）
  asTeacher?: boolean   // 老師名義
  proofPath?: string    // 證明文件（bucket proofs）
  proofName?: string    // 原檔名，重新打開對話框時顯示
}

interface BookingDetailsDialogProps {
  isOpen: boolean
  bookingType: 'little' | 'mass-personal' | 'mass-group'
  /** 大量設備單的起租日（＝取件日）；有值才顯示時段選單 */
  pickupDate?: string
  /** 這張單要授課教師核可（雷切機一年級） */
  needsProof?: boolean
  initialData?: BookingDetailsData
  onConfirm: (data: BookingDetailsData) => void
  onCancel: () => void
}

const BookingDetailsDialog: React.FC<BookingDetailsDialogProps> = ({
  isOpen,
  bookingType,
  pickupDate,
  needsProof = false,
  initialData,
  onConfirm,
  onCancel
}) => {
  const t = useT()
  const [reason, setReason] = useState('')
  const [className, setClassName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [pickupSlot, setPickupSlot] = useState('')
  const [deposit, setDeposit] = useState('') // 'YYYY-MM-DD HH:MM-HH:MM'
  const [duties, setDuties] = useState<DutySlot[] | null>(null)
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())
  const [asTeacher, setAsTeacher] = useState(false)
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [proofError, setProofError] = useState('')

  const isMassBooking = bookingType === 'mass-personal' || bookingType === 'mass-group'
  const showTeacher = isMassBooking || asTeacher
  const showProof = asTeacher || needsProof

  // 初始化或更新表單資料
  useEffect(() => {
    if (isOpen) {
      setReason(initialData?.reason || '')
      setClassName(initialData?.className || '')
      setTeacher(initialData?.teacher || '')
      setPickupSlot(initialData?.pickupSlot || '')
      setDeposit(initialData?.depositDate ? `${initialData.depositDate} ${initialData.depositSlot}` : '')
      setAsTeacher(!!initialData?.asTeacher)
      setProof(initialData?.proofPath ? { path: initialData.proofPath, name: initialData.proofName ?? '' } : null)
      setProofError('')
    }
  }, [isOpen, initialData])

  // 大量設備才抓值班時段＋公休日
  useEffect(() => {
    if (!isOpen || !pickupDate) return
    Promise.all([fetchDutySlots(), fetchClosedDates()]).then(([d, c]) => { setDuties(d); setClosedDates(c) })
  }, [isOpen, pickupDate])

  // 時段選項：取件＝起租日當天；繳押金＝現在起 24 工作時內、且不晚於所選取件時段開始
  const now = new Date()
  const pickupKey = pickupDate ? toDateKey(new Date(pickupDate)) : ''
  const pickupDayEnd = new Date(`${pickupKey}T23:59`)
  const pickupOptions = pickupDate && duties
    ? dutySlotOptions(duties, now, pickupDayEnd, closedDates).filter(o => o.date === pickupKey)
    : []
  const depositUntil = new Date(Math.min(
    addBusinessMs(now, PENDING_LIMIT_MS, closedDates).getTime(),
    (pickupSlot ? slotStart(pickupKey, pickupSlot) : pickupDayEnd).getTime()
  ))
  const depositOptions = pickupDate && duties ? dutySlotOptions(duties, now, depositUntil, closedDates) : []
  // 已選的時段不在目前選項內（換了取件時段、或時間已過）→ 視為未選
  const depositValid = depositOptions.some(o => `${o.date} ${o.slot}` === deposit)
  const pickupValid = pickupOptions.some(o => o.slot === pickupSlot)

  const pickProof = async (file: File) => {
    setUploading(true)
    setProofError('')
    const res = await uploadProof(file)
    setUploading(false)
    if (res.path) setProof({ path: res.path, name: file.name })
    else setProofError(res.message ?? '')
  }

  // 按 ESC 鍵關閉
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onCancel])

  // 阻止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Enter＝確認（使用原因是 textarea，在裡面按 Enter 照樣換行）
  useEnterConfirm(isOpen, () => { if (isValid) handleSubmit() })

  if (!isOpen) return null

  const handleSubmit = () => {
    // 驗證必填欄位
    if (!reason.trim()) {
      alert(t('Please fill in the reason for use.', '請填寫使用原因'))
      return
    }

    if (isMassBooking) {
      if (!className.trim()) {
        alert(t('Please fill in the class.', '請填寫使用班級'))
        return
      }
      if (!teacher.trim()) {
        alert(t('Please fill in the supervising teacher.', '請填寫負責老師'))
        return
      }
    }

    // 提交資料
    const [depositDate, depositSlot] = deposit.split(' ')
    onConfirm({
      reason: reason.trim(),
      className: isMassBooking ? className.trim() : undefined,
      teacher: showTeacher ? teacher.trim() : undefined,
      asTeacher,
      ...(showProof ? { proofPath: proof?.path, proofName: proof?.name } : {}),
      ...(pickupDate ? { depositDate, depositSlot, pickupSlot } : {})
    })
  }

  // 檢查是否可以提交
  const isValid =
    reason.trim() !== '' &&
    (!isMassBooking || className.trim() !== '') &&
    (!showTeacher || teacher.trim() !== '') &&
    (!showProof || !!proof) &&
    !uploading &&
    (!pickupDate || (pickupValid && depositValid))

  const slotHint = (text: string) => (
    <p className="mt-2 text-2xs text-error">{text}</p>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onCancel}
    >
      {/* 對話框容器 */}
      <div
        className="relative bg-gray-darker border border-gray-mid max-w-md w-full mx-4 flex flex-col rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <CloseButton onClick={onCancel} label={t('Close', '關閉')} className="absolute top-6 right-6" />
        {/* 標題區 */}
        <div className="px-6 pt-6 pr-14">
          <h2 className="font-english text-sm text-white font-normal">
            {t('Booking Details', '借用資訊')}
          </h2>
        </div>

        {/* 表單區（pb 讓橫線與最後一個輸入框保持距離，與 ConfirmDialog 一致） */}
        <div className="px-6 pt-4 pb-4 space-y-4">
          {/* 使用原因 */}
          <div>
            <label className="block mb-2">
              <span className="text-xs text-white">{t('Reason', '使用原因')}</span>
              <span className="text-error ml-1">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-darker border border-gray-mid text-white text-xs focus:outline-none focus:border-white resize-none rounded-lg"
              rows={3}
              placeholder={t('Please fill in the reason for use', '請填寫使用原因')}
            />
          </div>

          {/* 借用名義：老師名義押金歸零，四種類型都能選 */}
          <div>
            <label className="block mb-2 text-xs text-white">{t('Book as', '借用名義')}</label>
            <Select
              value={asTeacher ? 'teacher' : 'personal'}
              onChange={v => setAsTeacher(v === 'teacher')}
              options={[
                { value: 'personal', label: t('Personal', '個人借') },
                { value: 'teacher', label: t('Under a teacher’s name', '老師名義') }
              ]}
              className="w-full"
              aria-label={t('Book as', '借用名義')}
            />
            {asTeacher && (
              <p className="mt-2 text-2xs text-gray-light">
                {t('No deposit. After submitting, bring the proof to the SA within 24 hrs.', '免押金。送出後請於 24 小時內到系學會核對證明文件。')}
              </p>
            )}
          </div>

          {/* 大量訂單才需要填寫班級 */}
          {isMassBooking && (
            <div>
              <label className="block mb-2">
                <span className="text-xs text-white">{t('Class', '使用班級')}</span>
                <span className="text-error ml-1">*</span>
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-darker border border-gray-mid text-white text-xs focus:outline-none focus:border-white rounded-lg"
                placeholder={t('Please fill in the class', '請填寫使用班級')}
              />
            </div>
          )}

          {/* 老師：大量訂單的負責老師，或老師名義的老師名稱 */}
          {showTeacher && (
            <div>
              <label className="block mb-2">
                <span className="text-xs text-white">
                  {asTeacher ? t('Teacher’s name', '老師名稱') : t('Teacher', '負責老師（若個人用就填個人）')}
                </span>
                <span className="text-error ml-1">*</span>
              </label>
              <input
                type="text"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="w-full px-3 py-2 bg-gray-darker border border-gray-mid text-white text-xs focus:outline-none focus:border-white rounded-lg"
                placeholder={asTeacher ? t('Please fill in the teacher’s name', '請填寫老師名稱') : t('Please fill in the teacher in charge', '請填寫負責老師')}
              />
            </div>
          )}

          {/* 證明文件：老師名義要老師簽名；雷切機一年級要授課教師核可 */}
          {showProof && (
            <div>
              <label className="block mb-2">
                <span className="text-xs text-white">
                  {asTeacher ? t('Proof with the teacher’s signature', '證明文件（需有老師簽名）') : t('Course teacher’s approval', '授課教師核可證明（一年級借雷切機）')}
                </span>
                <span className="text-error ml-1">*</span>
              </label>
              <label className={`flex items-center gap-2 pl-2 pr-3 py-2 border border-dashed border-gray-mid rounded-lg text-xs text-white min-w-0 ${uploading ? 'cursor-wait' : `cursor-pointer ${BTN}`}`}>
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }} aria-hidden="true">upload_file</span>
                <span className="truncate">
                  {uploading ? t('Uploading…', '上傳中…') : proof ? (proof.name || t('Uploaded', '已上傳')) : t('Choose a JPG, PNG or PDF', '選擇 JPG、PNG 或 PDF')}
                </span>
                <input
                  type="file"
                  accept={PROOF_ACCEPT}
                  className="sr-only"
                  disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void pickProof(f); e.target.value = '' }}
                />
              </label>
              {proofError && slotHint(proofError)}
            </div>
          )}

          {/* 大量設備：取件時段（起租日）＋繳押金時段（24 工作時內、不晚於取件；同一時段＝同時進行） */}
          {pickupDate && (
            <>
              <div>
                <label className="block mb-2 text-xs text-white">
                  <span>{t('Pickup', '取件時段（起租日當天，系學會值班時間）')}</span>
                  <span className="text-error ml-1">*</span>
                </label>
                <Select
                  value={pickupValid ? pickupSlot : ''}
                  onChange={setPickupSlot}
                  placeholder={duties ? t('Select', '請選擇') : t('Loading…', '載入中…')}
                  options={pickupOptions.map(o => ({ value: o.slot, label: slotLabel(o) }))}
                  className="w-full"
                  aria-label={t('Pickup slot', '取件時段')}
                />
                {duties && pickupOptions.length === 0 && slotHint('起租日沒有可取件的值班時段，請更改租借日期或洽系學會')}
              </div>
              <div>
                <label className="block mb-2 text-xs text-white">
                  <span>{t('Deposit', '繳押金時段（送單後 24 工作時內；可與取件同時）')}</span>
                  <span className="text-error ml-1">*</span>
                </label>
                <Select
                  value={depositValid ? deposit : ''}
                  onChange={setDeposit}
                  placeholder={duties ? t('Select', '請選擇') : t('Loading…', '載入中…')}
                  options={depositOptions.map(o => ({ value: `${o.date} ${o.slot}`, label: slotLabel(o) }))}
                  className="w-full"
                  aria-label={t('Deposit slot', '繳押金時段')}
                />
                {duties && depositOptions.length === 0 && slotHint('24 工作時內沒有可繳押金的值班時段，請洽系學會')}
              </div>
            </>
          )}
        </div>

        {/* 橫線 */}
        <div className="px-6">
          <div className="border-t border-gray-mid"></div>
        </div>

        {/* 按鈕區 */}
        <div className="px-6 py-4 flex justify-end gap-6">
          {/* 取消按鈕 */}
          <button
            onClick={onCancel}
            className={`text-gray-light ${BTN}`}
          >
            <span className="font-english text-xs">
              {t('Cancel', '取消')}
            </span>
          </button>

          {/* 確認按鈕 */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`text-white ${BTN}`}
          >
            <span className="font-english text-xs">
              {t('Confirm', '確認')}
            </span>
          </button>
        </div>
      </div>

      {/* 淡入動畫 */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default BookingDetailsDialog
