# 完成路線圖（Roadmap）

> 距離可上線，剩下的階段與任務。整體現況（2026-07 更新）：**階段 1 後端接線已完成**——
> 登入／訂單／庫存／空間／通知全部走 Supabase，mock 僅剩測試帳號定義檔。
> 業務規則見 [rental-rules.md](./rental-rules.md)；後端用 **Supabase**（Auth + PostgreSQL + RLS）。
> 階段 2 → 3 有依賴順序；階段 4（品質）與階段 5（手機版）可與任何階段並行。

## 階段 1：Supabase 後端接線 ✅（2026-07 完成）

資料庫端 SQL 都在 `supabase/`（schema、seeds、auth-setup、orders-rpc），前端統一走 `src/services/`。
關鍵設計：送單 `submit_orders` RPC 為單一 transaction（訂單＋品項＋通知全成立或全撤銷），
庫存與空間衝突於伺服器端鎖列檢查；押金與流水號伺服器端計算；RLS 為權限真防線。

- [x] Supabase 專案（Singapore）＋ `.env`（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`）
- [x] schema：students（年級＋role 三種）、equipment、space（含教室）、orders、order_items、notifications＋RLS
- [x] 登入（學號→email→Auth）、忘記密碼自助重設（`/reset-password`）、Profile 改密碼／手機
- [x] 設備 118 筆（官方編號 #MASA001 式）＋空間 130 筆（venue_code）入庫
- [x] 送單 RPC＋庫存扣減（`equipment_reserved`）＋空間佔用（`space_occupied`）＋延期（`extend_my_order`）
- [x] Profile 讀真實訂單、Header 讀真實通知（已讀入庫）
- [ ] 決定購物車與日期選擇是否跟帳號走（跨裝置同步）——未定案，不擋上線
- [ ] 收尾：`orderValidation` 重複下單檢查仍讀 localStorage receipts（階段 3 搬 server 端後，
      `useOrderSubmission` 的 receipts 雙寫一併移除）；`testAuthData.ts` 僅剩型別與測試帳號說明可再瘦身

## 階段 1.5：桌面版整體驗收（先於階段 2 與手機版，已與 Bernard 議定）

**前置：先逐項定案 [order-lifecycle.md](./order-lifecycle.md) 的訂單生命週期情境**（沒繳押金、逾期、
取消、部分歸還等——情境沒定案，後台沒得做），再用桌面版把整套流程跑過一遍確認無誤，才進後台與手機版。
測試工具：三個測試帳號（阿志/小美/大明）開不同瀏覽器互相搶。候選衝突場景（開工時再補齊）：

- [ ] 兩人同時搶同一格空間／最後一件設備（一成一敗、敗方訊息清楚、購物車保留可重送）
- [ ] 訂單送出後改日期重送（Exist Cart 過期時段就地修復 → 新時段的佔用計算正確）
- [ ] pending 逾 24 小時（工作時）自動視為取消後，佔用是否釋放（目前 status 仍是 pending——
      前端顯示取消但資料庫佔用未釋放，**已知落差，驗收時討論**：需排程或查詢時排除逾時 pending）
- [ ] 延期後的新歸還日是否正確影響後續時段的佔用
- [ ] 同帳號多分頁／多裝置操作購物車與送單
- [ ] 大量訂單（滿 10 件、班級老師必填）與團體空間（免押金上限）全流程
- [ ] 忘記密碼信到學校信箱的實測（redirect 白名單、改完新密碼登入）

## 階段 2：管理後台（進行中）

後台是**自己寫的 `/admin` 頁面**（同 repo、同部署、同視覺），不是資料庫平台的 GUI；
側欄分區架構（`AdminLayout`）：總覽／訂單／幹部名單／公休日／寒暑假封鎖。admin 登入自動導向 `/admin`。
視覺沿用前台 Profile 的設計語彙（`components/admin/adminUi.tsx`：狀態標籤、按鈕、輸入框、頁標題共用）。
權限真正防線在 Supabase RLS，前端的 `AdminRoute` 只是 UX。
**編輯政策**（見 order-lifecycle 情境 9）：軟性欄位（原因／班級／老師）可就地改，硬性資料（日期／品項／狀態／押金）一律走專用動作按鈕。

- [x] 訂單全覽：姓名／學號／種類／起訖／品項／原因／押金／狀態＋搜尋＋狀態／種類篩選＋全欄排序（`AdminOrdersPage`）
- [x] 確認收押金（`admin_mark_paid`：pending → in-progress）
- [x] 整單歸還＋逾期罰款確認（`admin_mark_returned`：in-progress/overdue → returned，寫 `penalty_total`，前端預填試算）
- [x] 總覽 dashboard：訂單概況統計、教室／空間使用中、待繳押金倒數、違規帳號（停權＋逾期）
- [x] 值班經手人追溯：收押金／歸還必選經手幹部（`orders.paid_by`／`returned_by` 姓名快照）；幹部名單每年換屆維護（`AdminStaffPage`＋`staff_members` 表，見 supabase/staff-members.sql）
- [x] 公休日／寒暑假封鎖維護（`AdminClosedDatesPage`／`AdminBlackoutsPage`，直接 CRUD，RLS 把關）
- [ ] **代客延期**（admin 幫學生延期，不受前台「僅乙次」與前三天限制）
- [ ] 部分歸還／部分延期拆單（小單先做，見情境 5；`parent_order_id`＋`refunded` 欄位待加）
- [ ] 代取消（in-progress 學生取消需 admin 處理，退押金）
- [ ] 軟性欄位就地編輯（原因／班級／老師）
- [ ] 帳號狀態調整（改 `account_level`；解除停權、老師通融）
- [ ] 手動建單（電話／現場預約，admin 代下）
- [ ] 庫存管理（新增／下架／調整數量）
- ~~公告~~（2026-07 定案不做：公告一律發 Facebook；系統只需知道「整天不開」＝公休日／寒暑假封鎖，營業「時段」調動不影響任何計算——倒數與逾期皆以整天計，唯一時間點是歸還死線 19:00）
- [ ] **助教直借（`staff` 角色）**：用一般前台流程選借，但免押金、免審核、送出即 in-progress、不受學生數量規則限制（情境 10）

## 階段 3：規則補完（依賴階段 1 的資料模型）

- [x] 空間 14 天例外：四年級、碩士班放寬到 30 天（`gradeUtils.ts`＋`DatePickerBar`／`DateEditDialog`）
- [x] A508 教室限大二以上（`SpacePage` UX 提示＋`submit_orders` server 端擋）
- [x] 停權帳號：擋送單（不擋登入）——情境 7 已實作
- [x] 延期「歸還日前三天提出」：**程式強制**已實作（`extend_my_order` RPC 依日期擋＋`isWithinExtendWindow` UX）
- [x] 重複下單、庫存衝突改由 server 端把關
- [x] 寒暑假封鎖 server 端（`rental_blackouts` 表＋`submit_orders` 擋 student）——情境 11-a 已實作
- [x] 寒暑假封鎖前端日曆：封鎖日期灰化不可選＋擋跨封鎖選取（`Calendar` 讀 `fetchBlackouts`）

## 階段 4：品質（可並行）

- [x] 測試基礎：vitest 已建置（`timeUtils`／`useCart`／`useCartValidation`，`npm test`）；後續有新規則再補對應案例
- [ ] Tech debt：拆 700 行大檔（`CartList`、`OrderPage`、`SpacePage`、`RentalListPage`）、`DateSelectionContext` 拆成設備／空間兩個、CSS 雙軌漸進遷移
- [ ] 零散 TODO：延長線佔位圖（`EquipmentGrid.tsx:184`）、`ProfilePage` 狀態圓點

## 階段 5：手機版（純前端，可與階段 1-3 並行）

RWD 標準見 CLAUDE.md「手機版（RWD）標準」一節。已有手機版：Home、Booking、BookingResources、About、Header（mobile menu）。

- [ ] Equipment 設備頁手機版（目前 `hidden md:block`，手機無內容）
- [ ] Space 空間頁手機版（同上；區域地圖 SVG 的觸控操作要特別設計）
- [ ] RentalList 清單頁手機版
- [ ] Order 訂單頁手機版（含 PDF 輸出的手機行為）
- [ ] Profile 頁手機版檢查（無 `md:` 斷點，需逐一驗證）
- [ ] Footer 手機版（目前 `hidden md:flex`）
- [ ] 對話框（DateEditDialog、GuideDialog 等 max-w 較大的）在小螢幕的呈現

## 階段 6：部署上線

- [ ] Hosting：**維持 Vercel**（`vercel.json` 已設好）＋環境變數管理（Supabase URL／anon key）
- [ ] 正式資料填入：真實學號名單、設備清單與庫存、空間資料
- [ ] 上線前驗收：照 [rental-rules.md](./rental-rules.md) 逐條走一遍真實流程
