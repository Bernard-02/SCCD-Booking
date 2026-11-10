/**
 * 空間租借頁面 - React 新版
 */

import { BTN, BTN_INVERT, BTN_TOOL } from '@/components/common/btn'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/layouts/Header'
import BackButton from '../components/common/BackButton'
import Footer from '../components/layouts/Footer'
import DatePickerBar from '../components/DatePickerBar'
import SpaceAreaMap from '../components/space/SpaceAreaMap'
import ClassroomList from '../components/space/ClassroomList'
import { useSpaceBlocks, fetchOccupiedSpaces, fetchOccupiedSpacesDaily } from '../services/spaceService'
import { toDateKey, rescheduleCategory } from '../components/cart/cartHelpers'
import { dayKeysBetween, fromDateKey } from '../utils/timeUtils'
import PartialDialog from '../components/common/PartialDialog'
import { useCart, loginPath, takePendingSelection } from '../hooks/useCart'
import { useDateSelection } from '../contexts/DateSelectionContext'
import Toast from '../components/common/Toast'
import { useAuth } from '../contexts/AuthContext'
import { isSophomoreOrAbove } from '../utils/gradeUtils'
import { sortBlockIds } from '../components/cart/cartHelpers'
import { useT } from '../stores/langStore'
import { useAreaName } from '../services/contentService'
import Collapse from '../components/common/Collapse'
import { NAV_HOVER, navItemCls } from '../components/common/navItem'

// 子分類項目（主分類用共用的 navItemCls）：icon 那側 padding 少 4px，一般字重
const SUB_ITEM = 'flex items-center gap-2 pl-3 pr-4 py-1.5 rounded-lg text-sm text-left cursor-pointer'

// 子分類 → SVG 區域代碼對應（專案許可區包含 corridor 與 pillar）
const AREA_MAPPING: Record<string, string[]> = {
  'Square': ['square'],
  'FrontTerrace': ['front-terrace'],
  'BackTerrace': ['back-terrace'],
  'GlassWall': ['glass-wall'],
  'CasePermitArea': ['corridor', 'pillar']
}

const SpacePage: React.FC = () => {
  const t = useT()
  const areaName = useAreaName()
  const { cart, addToCart, removeFromCart, rescheduleCart, isSuspended } = useCart()
  const { getCurrentSpaceDates, setSpaceDates } = useDateSelection()
  const { currentUser, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // 獲取當前模式的日期
  const spaceDates = getCurrentSpaceDates()

  // 檢查是否已選擇日期
  const hasSelectedDates = spaceDates.startDate !== null && spaceDates.endDate !== null

  // 空間區塊定義（id → 區域/押金，來自 Supabase space_blocks）
  const spaceBlocks = useSpaceBlocks()

  // 該時段被生效訂單佔用的空間 id（區塊＋教室）
  const [occupiedIds, setOccupiedIds] = useState<string[]>([])
  // 逐日佔用（部分時段可借用，supabase/partial-availability.sql）；RPC 不在時為 null → 全部當整段已租
  const [occupiedDays, setOccupiedDays] = useState<Record<string, Set<string>> | null>(null)
  // 正在開選段 popup 的格子
  const [partialBlock, setPartialBlock] = useState<string | null>(null)
  const occupiedStartKey = spaceDates.startDate ? toDateKey(spaceDates.startDate) : null
  const occupiedEndKey = spaceDates.endDate ? toDateKey(spaceDates.endDate) : null

  useEffect(() => {
    if (!occupiedStartKey || !occupiedEndKey) {
      setOccupiedIds([])
      setOccupiedDays(null)
      return
    }
    let mounted = true
    fetchOccupiedSpaces(occupiedStartKey, occupiedEndKey)
      .then(ids => { if (mounted) setOccupiedIds(ids) })
      .catch(err => console.error('讀取空間佔用失敗:', err))
    fetchOccupiedSpacesDaily(occupiedStartKey, occupiedEndKey)
      .then(map => { if (mounted) setOccupiedDays(map) })
      .catch(err => { console.warn('逐日佔用 RPC 不可用，退回整段判定:', err); if (mounted) setOccupiedDays(null) })
    return () => { mounted = false }
  }, [occupiedStartKey, occupiedEndKey])

  // 部分時段：區間每一天；有逐日資料時，只佔幾天的格子是「部分」（橘），整段都被佔的才是已租（粉）
  const spaceRangeDays = useMemo(
    () => (occupiedStartKey && occupiedEndKey ? dayKeysBetween(fromDateKey(occupiedStartKey), fromDateKey(occupiedEndKey)) : []),
    [occupiedStartKey, occupiedEndKey]
  )
  const partialIds = useMemo(
    () => (occupiedDays && spaceRangeDays.length
      ? occupiedIds.filter(id => (occupiedDays[id]?.size ?? spaceRangeDays.length) < spaceRangeDays.length)
      : []),
    [occupiedDays, occupiedIds, spaceRangeDays]
  )
  const rentedIds = useMemo(() => occupiedIds.filter(id => !partialIds.includes(id)), [occupiedIds, partialIds])

  // 個人租借（小量／大量-個人）：受每時段押金上限 5,000 約束，全選必定超標
  const isPersonalBooking = spaceDates.bookingType !== 'mass-group'

  // 使用 Ref 來保存最新的 addToCart 函數，解決閉包導致的狀態覆蓋問題
  const addToCartRef = useRef(addToCart)
  useEffect(() => {
    addToCartRef.current = addToCart
  }, [addToCart])

  // 訪客被導去登入前的選取（分類／區塊／專案許可），回來後還原
  const [pending] = useState(() => takePendingSelection<{ main: 'NumberedArea' | 'Classroom'; sub: string | null; blocks: string[]; permit: boolean }>('space'))
  // 主分類：NumberedArea 或 Classroom
  const [selectedMainCategory, setSelectedMainCategory] = useState<'NumberedArea' | 'Classroom'>(pending?.main ?? 'NumberedArea')
  // 編號區子分類 - 預設為 null（不選擇任何子分類，顯示全部地圖）
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(pending?.sub ?? null)
  // 當前選擇的區塊（尚未加入購物車）
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>(pending?.blocks ?? [])
  const [hasProjectPermission, setHasProjectPermission] = useState<boolean>(pending?.permit ?? false)
  // 訪客按加入清單：帶去登入頁、登入後還原的選取
  const goLogin = () => navigate(loginPath('space', { main: selectedMainCategory, sub: selectedSubCategory, blocks: selectedBlocks, permit: hasProjectPermission }))
  const [legendOpen, setLegendOpen] = useState(false) // lg 以下才有作用
  // 狀態篩選 - 添加 partial 狀態
  const [statusFilters, setStatusFilters] = useState<Set<'available' | 'unavailable' | 'partial'>>(
    new Set(['available', 'unavailable', 'partial'])
  )

  // 狀態篩選多選：全亮時點第一下只留那個，之後點其他的累加、點已選中的取消；全取消則恢復顯示全部
  const toggleStatusFilter = (status: 'available' | 'unavailable' | 'partial') => {
    setStatusFilters(prev => {
      const all: ('available' | 'unavailable' | 'partial')[] = ['available', 'unavailable', 'partial']
      if (prev.size === all.length) return new Set([status])
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next.size === 0 ? new Set(all) : next
    })
  }

  // 從購物車導航過來時，自動選擇對應的區域
  useEffect(() => {
    const state = location.state as { selectedBlock?: string; selectedArea?: string } | null
    if (state?.selectedArea) {
      // Area 到 SubCategory 的映射
      const areaToSubCategoryMap: Record<string, string> = {
        'square': 'Square',
        'front-terrace': 'FrontTerrace',
        'back-terrace': 'BackTerrace',
        'glass-wall': 'GlassWall',
        'corridor': 'CasePermitArea',
        'pillar': 'CasePermitArea',
        'classroom': 'Classroom'
      }

      const subCategory = areaToSubCategoryMap[state.selectedArea]

      if (subCategory === 'Classroom') {
        setSelectedMainCategory('Classroom')
        setSelectedSubCategory(null)
      } else if (subCategory) {
        setSelectedMainCategory('NumberedArea')
        setSelectedSubCategory(subCategory)
      }
    }
  }, [location.state])

  // Toast 狀態
  const [toastInfo, setToastInfo] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastInfo({ show: true, message, type })
  }

  // 從購物車中取得已加入的區塊 ID
  const cartBlockIds = useMemo(() => {
    return cart
      .filter(item => item.category === 'space-block')
      .map(item => item.id)
  }, [cart])

  // 教室資料：名稱／英文名稱／押金／圖片以 space 表為準（後台空間管理可改），載入前沿用預設值
  const classroomData = [
    { id: 'A503', name: 'A503 教室', enName: 'A503 Classroom', price: 5000, image: '/Images/A503.webp' },
    { id: 'A507', name: 'A507 教室', enName: 'A507 Classroom', price: 5000, image: '/Images/A507.webp' },
    { id: 'A508', name: 'A508 教室', enName: 'A508 Classroom', price: 5000, image: '/Images/A508.webp' },
  ].map(c => {
    const db = spaceBlocks[c.id]
    return db ? { ...c, name: db.name || c.name, enName: db.en_name || c.enName, price: db.deposit, image: db.image_url || c.image } : c
  })

  // 檢查教室是否在購物車中
  const isClassroomInCart = (id: string) => cart.some(item => item.id === id && item.category === 'classroom')

  // 教室開放狀態尊重 space 表 is_active（後台空間管理 toggle，2026-09-29 新規則 #1）：
  // spaceBlocks 只含 is_active=true；載入完成前（空物件）暫不過濾，避免清單閃爍
  const isClassroomOpen = (id: string) =>
    Object.keys(spaceBlocks).length === 0 || id in spaceBlocks

  // 篩選教室 - 先濾掉後台關閉的，再根據 statusFilters 狀態
  const filteredClassrooms = useMemo(() => {
    const openClassrooms = classroomData.filter(c => isClassroomOpen(c.id))
    if (statusFilters.size === 0 || statusFilters.size === 3) {
      // 顯示所有開放教室
      return openClassrooms
    }

    return openClassrooms.filter(classroom => {
      const inCart = isClassroomInCart(classroom.id)
      const rented = rentedIds.includes(classroom.id)
      const partial = partialIds.includes(classroom.id)
      if (statusFilters.has('available') && !inCart && !rented && !partial) return true
      if (statusFilters.has('unavailable') && (inCart || rented)) return true
      if (statusFilters.has('partial') && partial) return true
      return false
    })
  }, [statusFilters, cart, spaceBlocks, rentedIds, partialIds])

  // 處理區塊選擇（只能選擇當前子分類的區塊）
  // 部分時段 popup 確認：空間日期改成那段，清單裡的空間品項一起改日期；
  // 教室＝直接加入清單（同設備），編號區格子＝進入選取（之後照常按加入清單）
  const confirmPartialBlock = (startDate: string, endDate: string) => {
    if (!partialBlock) return
    const id = partialBlock
    setPartialBlock(null)
    setSpaceDates(fromDateKey(startDate), fromDateKey(endDate), spaceDates.bookingType)
    const classroom = classroomData.find(c => c.id === id)
    if (classroom) {
      const result = addToCart(
        { id: classroom.id, name: classroom.name, category: 'classroom', deposit: classroom.price, image: classroom.image,
          quantity: 1, startDate, endDate, bookingType: spaceDates.bookingType },
        rescheduleCategory(cart, 'space', startDate, endDate)
      )
      if (result.ok) showToast(t(`Added ${classroom.enName}. Space dates changed to ${startDate} – ${endDate}.`, `已加入 ${classroom.name}，空間日期改為 ${startDate} – ${endDate}`))
      else showToast(result.reason || t('Couldn’t add to your list.', '無法加入清單'), 'error')
      return
    }
    rescheduleCart('space', startDate, endDate)
    setSelectedBlocks(prev => (prev.includes(id) ? prev : [...prev, id]))
    showToast(t(`Space dates changed to ${startDate} – ${endDate}; ${id} selected.`, `空間日期改為 ${startDate} – ${endDate}，已選取 ${id}`))
  }

  const handleBlockSelect = (blockId: string) => {
    // 如果該區塊已在購物車中，則移除
    if (cartBlockIds.includes(blockId)) {
      removeFromCart(blockId)
      showToast(t(`Removed ${blockId} from your list`, `已從清單移除 ${blockId}`))
      return
    }

    // 尚未選日期前不開放選格子（格子的可借狀態取決於日期區間）
    if (!hasSelectedDates) {
      showToast(t('Please select rental dates first.', '請先選擇租借日期'), 'error')
      return
    }

    // 取消選取一律允許
    if (selectedBlocks.includes(blockId)) {
      setSelectedBlocks(prev => prev.filter(id => id !== blockId))
      return
    }

    // 個人租借：選取總押金不可超過每時段空間押金上限 5,000
    // （計入該時段購物車中既有的空間押金——區塊與教室共用同一個上限）
    if (isPersonalBooking) {
      const start = toDateKey(spaceDates.startDate!)
      const end = toDateKey(spaceDates.endDate!)
      const cartSpaceDeposit = cart
        .filter(item =>
          (item.category === 'space-block' || item.category === 'classroom') &&
          item.startDate === start && item.endDate === end
        )
        .reduce((sum, item) => sum + item.deposit * item.quantity, 0)
      const selectedDeposit = selectedBlocks.reduce((sum, id) => sum + getBlockDeposit(id), 0)

      if (cartSpaceDeposit + selectedDeposit + getBlockDeposit(blockId) > 5000) {
        showToast(t('Personal bookings have a NT$ 5,000 space deposit limit per period, so you can’t select more blocks.', '個人租借每時段空間押金上限 NT$ 5,000，無法再選取更多區塊'), 'error')
        return
      }
    }

    setSelectedBlocks(prev => [...prev, blockId])
  }

  // 處理子分類切換
  const handleSubCategoryChange = (newSubCategory: string | null) => {
    // 只切換子分類，保留當前選擇的區塊（即使是不同區域的）
    setSelectedSubCategory(newSubCategory)
    setHasProjectPermission(false)
  }

  // 處理回到 A5F 外層（清空未送出的選擇）
  const handleBackToNumberedArea = () => {
    setSelectedSubCategory(null)
    setSelectedBlocks([]) // 清空未加入購物車的選擇
    setHasProjectPermission(false)
  }

  // 計算單個區塊的押金（直接用資料庫的 deposit：後陽台 2000、其餘 1000）
  const getBlockDeposit = (blockId: string): number => {
    return spaceBlocks[blockId]?.deposit ?? 1000
  }

  // 計算總押金（帶上限）
  const calculateTotalDeposit = (blocks: string[]): number => {
    const total = blocks.reduce((sum, blockId) => sum + getBlockDeposit(blockId), 0)
    return Math.min(total, 5000) // 上限 NT$5,000
  }

  // 當前子分類的所有區塊
  const areaBlockIds = useMemo(() => {
    const targetAreas = selectedSubCategory ? AREA_MAPPING[selectedSubCategory] : undefined
    if (!targetAreas) return []
    return sortBlockIds(Object.keys(spaceBlocks).filter(id => targetAreas.includes(spaceBlocks[id].area)))
  }, [selectedSubCategory, spaceBlocks])

  // 當前子分類尚可選取的區塊（該時段未被佔用、不在購物車）
  const availableBlockIds = useMemo(
    () => areaBlockIds.filter(id => !occupiedIds.includes(id) && !cartBlockIds.includes(id)),
    [areaBlockIds, cartBlockIds, occupiedIds]
  )

  // 選中的區域整區都沒有開放中的格子（後台關閉，例：後陽台）→ 可檢視、不開放租借；資料載入前不判定
  const selectedAreaClosed = useMemo(() => {
    const targetAreas = selectedSubCategory ? AREA_MAPPING[selectedSubCategory] : undefined
    return !!targetAreas && Object.keys(spaceBlocks).length > 0 &&
      !Object.values(spaceBlocks).some(b => targetAreas.includes(b.area))
  }, [selectedSubCategory, spaceBlocks])

  // 可選區塊已全數選取（或根本無可選區塊）→ Select All 無事可做
  const allAvailableSelected = availableBlockIds.every(id => selectedBlocks.includes(id))

  // 全選當前區域的所有可用區塊（僅開放大量-團體；個人租借全選必超押金上限，
  // 且格子位置應由使用者自選，不代選「前 N 格」）
  const handleSelectAll = () => {
    if (!hasSelectedDates) {
      showToast(t('Please select rental dates first.', '請先選擇租借日期'), 'error')
      return
    }

    if (isPersonalBooking) {
      showToast(t('Personal bookings have a NT$ 5,000 space deposit limit per period, so you can’t select all. Pick blocks yourself or switch to a group booking.', '個人租借每時段空間押金上限 NT$ 5,000，無法全選，請手動選取或改用大量-團體'), 'error')
      return
    }

    // 保留之前的選擇，只補上尚未選取的
    setSelectedBlocks(prev => [...prev, ...availableBlockIds.filter(id => !prev.includes(id))])
  }

  // 加入選取的區塊到購物車
  const handleAddBlocks = () => {
    // 檢查是否已選擇日期
    if (!hasSelectedDates) {
      showToast(t('Please select rental dates first.', '請先選擇租借日期'), 'error')
      return
    }

    if (selectedBlocks.length === 0) {
      showToast(t('Please select blocks first.', '請先選擇區塊'), 'error')
      return
    }

    if (hasCasePermitBlocks && !hasProjectPermission) {
      showToast(t('Please tick the project permission confirmation first.', '請先勾選專案許可確認'), 'error')
      return
    }

    // 訪客／停權早退：在清空選取前擋下，保留使用者已選的區塊
    if (!isAuthenticated) {
      goLogin()
      return
    }
    if (isSuspended) {
      showToast(t('Your account is suspended (clean return not completed), so you can’t add items. Please contact the SA.', '帳號已停權（未完成清潔歸還），無法加入購物車，請聯絡系學會'), 'error')
      return
    }

    // 複製一份要加入的區塊 ID，避免狀態清除後拿不到
    const blocksToAdd = [...selectedBlocks]

    // 使用遞迴方式依序加入，確保 React 狀態更新週期完成
    // 解決 forEach + setTimeout 可能因間隔太短導致的狀態覆蓋問題
    // Toast 移到全部加入完成後才顯示，並回報加入失敗的原因
    const addNext = (index: number, added: string[], failReason?: string) => {
      if (index >= blocksToAdd.length) {
        // 全部加完才清空選取：先清的話區塊會先變回可借用色、再逐格（每 100ms）變綠，像重跑一次 highlight
        setSelectedBlocks([])
        const failedCount = blocksToAdd.length - added.length
        const displayIds = added.slice(0, 3).join('、')
        if (added.length > 0 && failedCount > 0) {
          // 部分成功：同時回報加入數量與未加入的原因，避免使用者以為全部都加進去了
          showToast(
            t(
              `Added ${displayIds}${added.length > 3 ? ' etc.' : ''} (${added.length}); ${failedCount} not added: ${failReason || 'could not be added'}`,
              `已加入 ${displayIds}${added.length > 3 ? ' 等' : ''} ${added.length} 件，其餘 ${failedCount} 件未加入：${failReason || '無法加入'}`
            ),
            'error'
          )
        } else if (added.length > 0) {
          showToast(added.length > 3
            ? t(`Added ${displayIds} and more to your list`, `已成功加入${displayIds}等編號到清單`)
            : t(`Added ${displayIds} to your list`, `已成功加入${displayIds}到清單`))
        } else if (failReason) {
          showToast(failReason, 'error')
        }
        return
      }

      const blockId = blocksToAdd[index]
      const result = addToCartRef.current({
        id: blockId,
        name: `區塊 ${blockId}`,
        category: 'space-block',
        deposit: getBlockDeposit(blockId), // 根據區域計算押金
        image: '/Area/A5F Area Booking.svg', // 區塊使用地圖圖片
        quantity: 1,
        startDate: toDateKey(spaceDates.startDate!),
        endDate: toDateKey(spaceDates.endDate!),
        bookingType: spaceDates.bookingType
      })

      const nextAdded = result.ok ? [...added, blockId] : added
      const nextFail = result.ok ? failReason : (result.reason || failReason)

      // 增加延遲至 100ms，確保上一次的狀態更新已寫入
      setTimeout(() => {
        addNext(index + 1, nextAdded, nextFail)
      }, 100)
    }

    addNext(0, [])
  }

  // A5F 編號區子分類
  const numberedAreaCategories = [
    { id: 'Square', icon: 'yard' },
    { id: 'FrontTerrace', icon: 'balcony' },
    { id: 'BackTerrace', icon: 'balcony' },
    { id: 'GlassWall', icon: 'window' },
    { id: 'CasePermitArea', icon: 'verified' }
  ]

  // 處理教室加入
  const handleClassroomAdd = (id: string) => {
    // 檢查是否已選擇日期
    if (!hasSelectedDates) {
      showToast(t('Please select rental dates first.', '請先選擇租借日期'), 'error')
      return
    }

    // 訪客：導去登入頁（放在 A508 年級檢查之前，訪客沒有年級）
    if (!isAuthenticated) {
      goLogin()
      return
    }

    // A508 限大二以上（submit_orders 亦擋，此處為 UX 提前提示）
    if (id === 'A508' && !isSophomoreOrAbove(currentUser?.year)) {
      showToast(t('Classroom A508 is only available to second-year students and above (including master’s students).', 'A508 教室僅限大二以上（含碩士）借用'), 'error')
      return
    }

    // 部分時段：開 popup 選一段（空間日期會改成那段），不走整段佔用檢查
    if (partialIds.includes(id)) {
      setPartialBlock(id)
      return
    }

    // 教室該時段已被其他訂單佔用
    if (occupiedIds.includes(id)) {
      showToast(t('This classroom is already booked for these dates.', '該教室於此時段已被預約'), 'error')
      return
    }

    const classroom = classroomData.find(c => c.id === id)
    if (classroom) {
      const result = addToCart({
        id: classroom.id,
        name: classroom.name,
        category: 'classroom',
        deposit: classroom.price,
        image: classroom.image,
        quantity: 1,
        startDate: toDateKey(spaceDates.startDate!),
        endDate: toDateKey(spaceDates.endDate!),
        bookingType: spaceDates.bookingType
      })
      if (result.ok) {
        showToast(t(`Added ${classroom.enName} to your list`, `已成功加入 ${classroom.name} 到清單`))
      } else {
        showToast(result.reason || t('Couldn’t add to your list.', '無法加入清單'), 'error')
      }
    }
  }

  // 判斷編號區是否被選中（主分類是 NumberedArea）
  const isNumberedAreaSelected = selectedMainCategory === 'NumberedArea'

  // 橘格（部分時段）：開選段 popup（地圖與格子清單共用）
  const handlePartialClick = (id: string) => {
    if (hasSelectedDates) setPartialBlock(id)
    else showToast(t('Please select rental dates first.', '請先選擇租借日期'), 'error')
  }

  // 排序選取的區塊 ID (A-Z, 1-10)
  const sortedSelectedBlocks = useMemo(() => {
    return sortBlockIds(selectedBlocks)
  }, [selectedBlocks])

  // 檢查是否有選中專案許可區的區塊
  const hasCasePermitBlocks = useMemo(() => {
    return selectedBlocks.some(blockId => {
      const blockData = spaceBlocks[blockId]
      return blockData && (blockData.area === 'corridor' || blockData.area === 'pillar')
    })
  }, [selectedBlocks, spaceBlocks])

  // Add 按鈕的阻擋條件（僅控制外觀；仍可點擊，點擊時 toast 提示缺什麼）
  const isAddBlocked = !selectedSubCategory || selectedBlocks.length === 0 || (hasCasePermitBlocks && !hasProjectPermission) || !hasSelectedDates || isSuspended

  return (
    <div className="bg-black text-white h-dvh flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 pt-20 max-lg:pt-16 flex flex-col overflow-hidden relative">
        <div className="container flex flex-1 gap-6 overflow-hidden items-stretch pb-6 max-lg:flex-col max-lg:gap-3 max-lg:pb-3 max-lg:overflow-y-auto">
          {/* 左側欄位：20% */}
          <div className="w-[20%] max-lg:w-full flex-shrink-0 flex flex-col overflow-hidden relative">
            {/* 返回上一頁＋標題在箭頭下方 */}
            <div className="flex-shrink-0 max-lg:flex max-lg:items-center max-lg:gap-3">
              <BackButton />
              <h1 className="text-white text-xl mb-6 max-lg:mb-0 max-lg:text-md">{t('Space', '空間')}</h1>
              {/* lg 以下圖例收起來，這顆展開；有篩選時標粉點，收著也看得出來 */}
              <button
                type="button"
                onClick={() => setLegendOpen(o => !o)}
                aria-expanded={legendOpen}
                className={`lg:hidden ml-auto ${BTN_TOOL} ${legendOpen ? '!bg-white !text-black cursor-pointer' : BTN_INVERT}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>filter_list</span>
                {t('Status', '狀態')}
                {!legendOpen && statusFilters.size < 3 && <span className="w-2 h-2 rounded-full bg-pink" />}
              </button>
            </div>

            {/* 側欄：主分類（icon＋膠囊，選中白底黑字，同 Profile 選單）；
                子分類在主分類 icon 正下方拉一條直線縮排，選中為淡色膠囊。
                inline-flex＝主分類與子分類區塊同寬（以最寬的為準） */}
            <div className="flex-1 overflow-hidden max-lg:flex-none">
              {/* 手機：主分類同一列，子分類排到下一列橫向捲動 */}
              <nav className="mt-8 max-lg:mt-3 inline-flex flex-col max-lg:flex max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-1">
                <button
                  onClick={() => {
                    setSelectedMainCategory('NumberedArea')
                    // 點擊 A5F 編號區時，回到外層並清空未送出的選擇
                    handleBackToNumberedArea()
                  }}
                  className={navItemCls(isNumberedAreaSelected)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>grid_view</span>
                  <span>{t('A5F Numbered Area', 'A5F編號區')}</span>
                </button>

                {/* 編號區子分類：只在編號區被選中時展開；直線＝主分類 icon 中心（pl-3 12px＋icon 半寬 10px） */}
                <div className="max-lg:order-last max-lg:w-full"><Collapse open={isNumberedAreaSelected}>
                  <div className="mt-2 ml-[22px] pl-3 border-l border-gray-mid flex flex-col gap-1 py-1 max-lg:ml-0 max-lg:pl-0 max-lg:border-l-0 max-lg:flex-row max-lg:overflow-x-auto">
                    {numberedAreaCategories.map((category) => {
                      // 專案許可區使用黃色（選中＝淡黃底＋黃字，其餘子分類為淡白底）
                      const isCasePermit = category.id === 'CasePermitArea'
                      const isSelected = selectedSubCategory === category.id
                      return (
                        <button
                          key={category.id}
                          onClick={() => handleSubCategoryChange(isSelected ? null : category.id)}
                          className={`${SUB_ITEM} max-lg:shrink-0 max-lg:whitespace-nowrap ${
                            isSelected
                              ? (isCasePermit ? 'bg-gray-dark text-yellow' : 'bg-gray-dark text-white')
                              : `text-gray-light ${NAV_HOVER}`
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{category.icon}</span>
                          <span>{areaName(category.id)}</span>
                        </button>
                      )
                    })}
                  </div>
                </Collapse></div>

                <button
                  onClick={() => {
                    setSelectedMainCategory('Classroom')
                    setSelectedBlocks([])
                  }}
                  className={`mt-2 max-lg:mt-0 ${navItemCls(selectedMainCategory === 'Classroom')}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>meeting_room</span>
                  <span>{t('Classroom', '教室')}</span>
                </button>
              </nav>
            </div>

            {/* 狀態篩選 Legend - 絕對定位在底部，只在 Classroom 選中時顯示 */}
            {selectedMainCategory === 'Classroom' && (
              <div className="absolute bottom-0 left-0 right-0 flex-shrink-0 max-lg:static">
                <Collapse open={legendOpen} below="lg">
                <div className="flex flex-col gap-3 max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-4 max-lg:gap-y-1 max-lg:pt-3">
                  <button
                    onClick={() => toggleStatusFilter('available')}
                    className={`flex items-center gap-2 ${statusFilters.has('available') ? 'cursor-pointer' : BTN}`}
                  >
                    <div className="w-3 h-3 bg-green"></div>
                    <span className={`text-xs ${
                      statusFilters.has('available') ? 'text-white' : 'text-gray-light'
                    }`}>
                      {t('Available', '全時段借用')}
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('unavailable')}
                    className={`flex items-center gap-2 ${statusFilters.has('unavailable') ? 'cursor-pointer' : BTN}`}
                  >
                    <div className="w-3 h-3 bg-pink"></div>
                    <span className={`text-xs ${
                      statusFilters.has('unavailable') ? 'text-white' : 'text-gray-light'
                    }`}>
                      {t('Unavailable', '不可借用')}
                    </span>
                  </button>

                  <button
                    onClick={() => toggleStatusFilter('partial')}
                    className={`flex items-center gap-2 ${statusFilters.has('partial') ? 'cursor-pointer' : BTN}`}
                  >
                    <div className="w-3 h-3 bg-orange"></div>
                    <span className={`text-xs ${
                      statusFilters.has('partial') ? 'text-white' : 'text-gray-light'
                    }`}>
                      {t('Partially Available', '部分時段借用')}
                    </span>
                  </button>
                </div>
                </Collapse>
              </div>
            )}
          </div>

          {/* 右側欄位：80% */}
          <div className="w-[80%] max-lg:w-full min-w-0 flex-1 flex gap-12 max-lg:flex-col max-lg:gap-4">
            {/* 編號區內容：常駐不卸載，只切 display（contents＝不影響原本 flex 版面）。
                卸載會讓每次切回都重抓／重注入 SVG、重綁所有格子事件，卡住側欄展開動畫 */}
            <div className={isNumberedAreaSelected ? 'contents' : 'hidden'}>
                {/* 左側：70% - 地圖區域 */}
                <div className="relative w-[70%] h-full flex items-center justify-center overflow-hidden max-lg:w-full max-lg:h-auto max-lg:aspect-[4/3] max-md:aspect-square max-lg:flex-shrink-0">
                  {/* 未開放區域提示：覆蓋在地圖上方置中；pointer-events-none 不擋地圖檢視 */}
                  {selectedAreaClosed && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex items-center gap-2 rounded-xl bg-black/80 pl-3 pr-4 py-3 text-sm text-white whitespace-nowrap">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>block</span>
                      <span>{t('This area is currently not open for booking', '此區域目前不開放租借')}</span>
                    </div>
                  )}
                  <SpaceAreaMap
                    selectedSubCategory={selectedSubCategory}
                    onAreaClick={(subCategoryId) => handleSubCategoryChange(subCategoryId)}
                    selectedBlocks={selectedBlocks}
                    onBlockSelect={handleBlockSelect}
                    cartBlocks={cartBlockIds}
                    rentedBlocks={rentedIds}
                    partialBlocks={partialIds}
                    onPartialClick={handlePartialClick}
                  />
                  {/* 部分時段：選一段再選取（空間日期改成那段） */}
                  {partialBlock && (
                    <PartialDialog
                      isOpen
                      title={`${classroomData.find(c => c.id === partialBlock)?.name ?? partialBlock}：只有部分天數可借`}
                      titleEn={`${classroomData.find(c => c.id === partialBlock)?.enName ?? partialBlock}: only some days available`}
                      days={spaceRangeDays}
                      okDays={new Set(spaceRangeDays.filter(d => !occupiedDays?.[partialBlock]?.has(d)))}
                      what="space"
                      confirmLabel={classroomData.some(c => c.id === partialBlock) ? 'add' : 'select'}
                      affectsOthers={cart.some(i => i.category !== 'equipment')}
                      onConfirm={confirmPartialBlock}
                      onCancel={() => setPartialBlock(null)}
                    />
                  )}
                </div>

                {/* 右側：30% - 借用資訊面板 */}
                <div className="w-[30%] h-full flex flex-col max-lg:w-full max-lg:h-auto">
                  {/* 狀態篩選 Legend - 可點擊 */}
                  {/* 顏色與 numbered-area.css 的 SVG 格子顏色一致 */}
                  <Collapse open={legendOpen} below="lg">
                  <div className="mb-6 flex flex-col gap-3 relative z-20 max-lg:mb-3 max-lg:flex-row max-lg:flex-wrap max-lg:gap-x-4 max-lg:gap-y-1">
                    <button
                      onClick={() => toggleStatusFilter('available')}
                      className={`flex items-center gap-2 ${statusFilters.has('available') ? 'cursor-pointer' : BTN}`}
                    >
                      {/* Available: 不透明淺綠色 color-mix(in srgb, var(--color-green) 50%, transparent) */}
                      <div className="w-3 h-3 bg-green/50"></div>
                      <span className={`text-xs ${
                        statusFilters.has('available') ? 'text-white' : 'text-gray-light'
                      }`}>
                        {t('Available', '可借用')}
                      </span>
                    </button>

                    <button
                      onClick={() => toggleStatusFilter('unavailable')}
                      className={`flex items-center gap-2 ${statusFilters.has('unavailable') ? 'cursor-pointer' : BTN}`}
                    >
                      {/* Unavailable: pink，與 SVG is-rented 一致 */}
                      <div className="w-3 h-3 bg-pink"></div>
                      <span className={`text-xs ${
                        statusFilters.has('unavailable') ? 'text-white' : 'text-gray-light'
                      }`}>
                        {t('Unavailable', '不可借用')}
                      </span>
                    </button>

                    <button
                      onClick={() => toggleStatusFilter('partial')}
                      className={`flex items-center gap-2 ${statusFilters.has('partial') ? 'cursor-pointer' : BTN}`}
                    >
                      {/* Partial: orange */}
                      <div className="w-3 h-3 bg-orange"></div>
                      <span className={`text-xs ${
                        statusFilters.has('partial') ? 'text-white' : 'text-gray-light'
                      }`}>
                        {t('Partially Available', '部分時段可借用')}
                      </span>
                    </button>

                    {/* Selected: green，與 SVG is-selected 一致 */}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green"></div>
                      <span className="text-xs text-white">
                        {t('Selected', '已選擇')}
                      </span>
                    </div>
                  </div>
                  </Collapse>

                  {/* lg 以下的格子清單：手機上地圖格子太小（玻璃牆最窄 2.4px）點不到；顏色與點擊同地圖（SpaceAreaMap） */}
                  {areaBlockIds.length > 0 && (
                    <div className="lg:hidden mb-6 flex flex-wrap gap-2">
                      {areaBlockIds.map(id => {
                        const inCart = cartBlockIds.includes(id)
                        const rented = rentedIds.includes(id)
                        const partial = partialIds.includes(id) && !inCart
                        const selected = inCart || selectedBlocks.includes(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={rented}
                            aria-pressed={selected}
                            onClick={() => (partial ? handlePartialClick(id) : handleBlockSelect(id))}
                            className={`min-w-11 h-11 px-2 rounded-lg text-xs font-english text-black cursor-pointer disabled:cursor-not-allowed ${
                              rented ? 'bg-pink' : partial ? 'bg-orange' : selected ? 'bg-green' : 'bg-green/50'
                            }`}
                          >
                            {id}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* 頂部區塊：選擇區塊 + 按鈕 */}
                  <div className="mb-6">
                    {/* 選擇區塊 */}
                    <div className="mb-4">
                      <div className="flex flex-col gap-1 mb-2">
                        <span className="text-xs text-gray-light">{t('Selected Area', '選擇區塊')}</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar mb-4">
                        <span className="text-md font-english font-normal break-words">
                          {sortedSelectedBlocks.length > 0 ? sortedSelectedBlocks.join(', ') : '--'}
                        </span>
                      </div>

                      {/* 全選和清除按鈕（icon＋文字）- 靠左對齊 */}
                      <div className="flex gap-2">
                        {/* 可選區塊全數選完時 disable；未選日期／個人租借時保持可點，點擊 toast 說明原因 */}
                        <button
                          onClick={handleSelectAll}
                          disabled={!selectedSubCategory || allAvailableSelected}
                          className={`${BTN_TOOL} font-english ${
                            !hasSelectedDates || isPersonalBooking ? 'opacity-20 cursor-not-allowed' : BTN_INVERT
                          }`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>select_all</span>
                          {t('Select All', '全選')}
                        </button>
                        <button
                          onClick={() => setSelectedBlocks([])}
                          disabled={!selectedSubCategory || selectedBlocks.length === 0}
                          className={`${BTN_TOOL} font-english ${BTN_INVERT}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                          {t('Clear', '清除')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 底部區塊：專案許可區 + Add 按鈕（含押金）- 靠底部對齊 */}
                  <div className="mt-auto">
                    {/* 專案許可區確認 Checkbox */}
                    {hasCasePermitBlocks && (
                      <div className="mb-6">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={hasProjectPermission}
                            onChange={(e) => setHasProjectPermission(e.target.checked)}
                            className="custom-checkbox"
                          />
                          <span className="text-xs font-chinese text-white leading-tight">
                            已與老師討論，確認老師知情並允許於此專案借用
                          </span>
                        </label>
                      </div>
                    )}

                    {/* 加入清單：整條寬、押金收在按鈕右側（省掉上方押金區）；被阻擋時 50% 透明但仍可點（toast 提示缺什麼） */}
                    <button
                      onClick={handleAddBlocks}
                      aria-disabled={isAddBlocked}
                      className={`w-full h-11 pl-3 pr-4 rounded-lg flex items-center gap-2 ${
                        isAddBlocked ? 'bg-white text-black opacity-20 cursor-not-allowed' : `bg-white text-black ${BTN}`
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_shopping_cart</span>
                      <span className="text-sm">{t('Add', '加入清單')}</span>
                      <span className="ml-auto text-sm font-english">
                        NT$ {calculateTotalDeposit(selectedBlocks).toLocaleString()}
                      </span>
                    </button>
                  </div>
                </div>
            </div>

            {/* 教室內容：同樣常駐，只切 display */}
            <div className={`w-full h-full flex-col ${selectedMainCategory === 'Classroom' ? 'flex' : 'hidden'}`}>
              <ClassroomList
                classrooms={filteredClassrooms}
                onAdd={handleClassroomAdd}
                occupiedIds={rentedIds}
                partialIds={partialIds}
              />
            </div>
          </div>
        </div>

        {/* 時間選擇欄 */}
        <DatePickerBar type="space" />
      </main>

      <Footer />

      {/* Toast 通知 */}
      {toastInfo.show && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(prev => ({ ...prev, show: false }))}
        />
      )}
    </div>
  )
}

export default SpacePage
