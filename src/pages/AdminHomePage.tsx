/**
 * 後台 · 總覽 Dashboard
 * 唯讀摘要：訂單概況、教室／空間使用中、待繳押金、違規帳號。
 * 操作細項都在側欄各分區，這裡只看數字與名單；點擊統計或「查看」跳到對應篩選的訂單頁。
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAllOrders, fetchClosedDates } from '../services/ordersService'
import type { AdminOrderRow, OrderStatus } from '../services/ordersService'
import { listSuspendedStudents } from '../services/adminService'
import type { SuspendedStudent } from '../services/adminService'
import { STATUS_META, STATUS_ORDER, PageTitle } from '../components/admin/adminUi'
import {
  pendingMsRemaining,
  overdueBusinessDays,
  overduePenalty,
  toDateKey,
  SUSPENSION_OVERDUE_DAYS
} from '../utils/timeUtils'

const fmtMD = (d: string) => d?.slice(5).replace('-', '/') // 'YYYY-MM-DD' → 'MM/DD'

/** 區塊標題：英中＋數量，右側選填「查看」連到對應篩選 */
const SectionTitle: React.FC<{ en: string; zh: string; count: number; onMore?: () => void }> = ({
  en,
  zh,
  count,
  onMore
}) => (
  <div className="flex items-baseline justify-between border-b border-gray-scale4 pb-3">
    <h2 className="text-small-title text-white">
      <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
      <span className="font-english text-gray-scale2 ml-2">{count}</span>
    </h2>
    {onMore && (
      <button
        onClick={onMore}
        className="text-tiny text-gray-scale2 hover:text-white transition-colors cursor-pointer"
      >
        <span className="font-english">View</span> <span className="font-chinese">查看</span> →
      </button>
    )}
  </div>
)

const Empty: React.FC<{ zh: string }> = ({ zh }) => (
  <p className="py-6 text-tiny text-gray-scale3 font-chinese">{zh}</p>
)

const AdminHomePage: React.FC = () => {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [suspended, setSuspended] = useState<SuspendedStudent[]>([])
  const [closedDates, setClosedDates] = useState<ReadonlySet<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const now = new Date() // 進頁當下即可，摘要不需要倒數重繪

  useEffect(() => {
    Promise.all([fetchAllOrders(), listSuspendedStudents(), fetchClosedDates()])
      .then(([o, s, c]) => {
        setOrders(o)
        setSuspended(s)
        setClosedDates(c)
      })
      .catch(err => setError(err.message ?? '讀取失敗'))
      .finally(() => setLoading(false))
  }, [])

  // 各狀態訂單數
  const counts = useMemo(() => {
    const c: Record<OrderStatus, number> = {
      pending: 0,
      'in-progress': 0,
      overdue: 0,
      returned: 0,
      canceled: 0
    }
    for (const o of orders) c[o.status] += 1
    return c
  }, [orders])

  // 教室／空間使用中：租借中且今天在租期內的教室與 A5F 區域品項
  const today = toDateKey(now)
  const inUse = useMemo(
    () =>
      orders
        .filter(o => o.status === 'in-progress' && o.start_date <= today && o.end_date >= today)
        .flatMap(o => o.order_items.filter(i => i.item_type !== 'equipment').map(i => ({ o, i }))),
    [orders, today]
  )

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders])
  const overdueOrders = useMemo(() => orders.filter(o => o.status === 'overdue'), [orders])

  const goOrders = (status?: OrderStatus) =>
    navigate(status ? `/admin/orders?status=${status}` : '/admin/orders')

  return (
    <div className="max-w-5xl">
      <PageTitle en="Overview" zh="總覽" />

      {loading && <div className="text-gray-scale2 text-tiny font-chinese">載入中…</div>}
      {error && (
        <div className="text-tiny font-chinese" style={{ color: 'var(--color-error2)' }}>
          讀取失敗：{error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* 訂單概況：各狀態數量，點擊跳到對應篩選 */}
          <div className="flex flex-wrap gap-x-12 gap-y-6 mb-14">
            {STATUS_ORDER.map(s => (
              <button key={s} onClick={() => goOrders(s)} className="text-left cursor-pointer group">
                <div className="text-tiny text-gray-scale2 mb-1 whitespace-nowrap">
                  <span className="font-english">{STATUS_META[s].en}</span>{' '}
                  <span className="font-chinese">{STATUS_META[s].zh}</span>
                </div>
                <div
                  className="text-medium-title font-english transition-opacity group-hover:opacity-70"
                  style={{ color: STATUS_META[s].color }}
                >
                  {counts[s]}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-14">
            {/* 教室／空間使用中 */}
            <section>
              <SectionTitle
                en="In Use Today"
                zh="教室／空間使用中"
                count={inUse.length}
                onMore={() => goOrders('in-progress')}
              />
              {inUse.map(({ o, i }, idx) => (
                <div
                  key={`${o.id}-${idx}`}
                  className="py-4 border-b border-gray-scale4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-content font-chinese text-white">
                      {i.name}
                      {i.quantity > 1 ? ` ×${i.quantity}` : ''}
                    </div>
                    <div className="text-tiny text-gray-scale2 font-english">{o.rental_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-content font-chinese text-white">{o.students?.name ?? '—'}</div>
                    <div className="text-tiny text-gray-scale2 font-english">
                      {o.students?.student_id} · <span className="font-chinese">至</span> {fmtMD(o.end_date)}
                    </div>
                  </div>
                </div>
              ))}
              {inUse.length === 0 && <Empty zh="今天沒有使用中的教室或區域" />}
            </section>

            {/* 待繳押金 */}
            <section>
              <SectionTitle
                en="Awaiting Deposit"
                zh="待繳押金"
                count={pendingOrders.length}
                onMore={() => goOrders('pending')}
              />
              {pendingOrders.map(o => {
                const ms = pendingMsRemaining(o.created_at, now, closedDates)
                const hrs = Math.ceil(ms / 3_600_000)
                return (
                  <div
                    key={o.id}
                    className="py-4 border-b border-gray-scale4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-content font-chinese text-white">
                        {o.students?.name ?? '—'}
                        <span className="font-english text-tiny text-gray-scale2 ml-2">
                          {o.students?.student_id}
                        </span>
                      </div>
                      <div className="text-tiny text-gray-scale2 font-english">
                        {o.rental_number} · NT$ {o.deposit_total.toLocaleString()}
                      </div>
                    </div>
                    {ms > 0 ? (
                      <span
                        className="text-tiny font-english whitespace-nowrap"
                        style={{ color: 'var(--color-yellow)' }}
                      >
                        <span className="font-chinese">剩</span> {hrs} hrs
                      </span>
                    ) : (
                      <span className="text-tiny text-gray-scale3 font-chinese whitespace-nowrap">
                        已逾時，將自動取消
                      </span>
                    )}
                  </div>
                )
              })}
              {pendingOrders.length === 0 && <Empty zh="沒有待繳押金的訂單" />}
            </section>

            {/* 違規帳號：停權名單＋逾期中訂單 */}
            <section className="lg:col-span-2">
              <SectionTitle
                en="Violations"
                zh="違規帳號"
                count={suspended.length + overdueOrders.length}
                onMore={() => goOrders('overdue')}
              />
              {suspended.map(s => (
                <div
                  key={s.student_id}
                  className="py-4 border-b border-gray-scale4 flex items-center justify-between gap-4"
                >
                  <div className="text-content font-chinese text-white">
                    {s.name}
                    <span className="font-english text-tiny text-gray-scale2 ml-2">{s.student_id}</span>
                  </div>
                  <span
                    className="px-3 py-1 rounded-lg text-tiny font-english whitespace-nowrap"
                    style={{ backgroundColor: 'var(--color-error2)', color: 'white' }}
                  >
                    Suspended <span className="font-chinese">已停權</span>
                  </span>
                </div>
              ))}
              {overdueOrders.map(o => {
                const days = overdueBusinessDays(o.end_date, closedDates)
                const penalty = overduePenalty(o.end_date, o.deposit_total, closedDates, now)
                return (
                  <div
                    key={o.id}
                    className="py-4 border-b border-gray-scale4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-content font-chinese text-white">
                        {o.students?.name ?? '—'}
                        <span className="font-english text-tiny text-gray-scale2 ml-2">
                          {o.students?.student_id}
                        </span>
                      </div>
                      <div className="text-tiny text-gray-scale2 font-english">{o.rental_number}</div>
                    </div>
                    <div
                      className="text-tiny font-english text-right whitespace-nowrap"
                      style={{ color: 'var(--color-error2)' }}
                    >
                      <span className="font-chinese">逾期</span> {days}{' '}
                      <span className="font-chinese">
                        營業日{days >= SUSPENSION_OVERDUE_DAYS ? '（達停權門檻）' : ''}
                      </span>{' '}
                      · <span className="font-chinese">試算罰款</span> NT$ {penalty.toLocaleString()}
                    </div>
                  </div>
                )
              })}
              {suspended.length === 0 && overdueOrders.length === 0 && (
                <Empty zh="沒有違規帳號，大家都是好寶寶" />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default AdminHomePage
