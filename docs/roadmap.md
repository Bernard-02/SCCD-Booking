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

先列出**預期會發生的衝突場景**逐一討論，再用桌面版把整套流程跑過一遍確認無誤，才進後台與手機版。
測試工具：三個測試帳號（阿志/小美/大明）開不同瀏覽器互相搶。候選衝突場景（開工時再補齊）：

- [ ] 兩人同時搶同一格空間／最後一件設備（一成一敗、敗方訊息清楚、購物車保留可重送）
- [ ] 訂單送出後改日期重送（Exist Cart 過期時段就地修復 → 新時段的佔用計算正確）
- [ ] pending 逾 24 小時（工作時）自動視為取消後，佔用是否釋放（目前 status 仍是 pending——
      前端顯示取消但資料庫佔用未釋放，**已知落差，驗收時討論**：需排程或查詢時排除逾時 pending）
- [ ] 延期後的新歸還日是否正確影響後續時段的佔用
- [ ] 同帳號多分頁／多裝置操作購物車與送單
- [ ] 大量訂單（滿 10 件、班級老師必填）與團體空間（免押金上限）全流程
- [ ] 忘記密碼信到學校信箱的實測（redirect 白名單、改完新密碼登入）

## 階段 2：管理後台（目前完全沒有）

後台是**自己寫的 `/admin` 頁面**（同 repo、同部署、同視覺），不是資料庫平台的 GUI；
過渡期可先用資料庫平台的表格介面（如 Supabase Studio）人工操作頂替。

**角色設計（階段 1 建帳號資料模型時就要放進去）**：`role` 欄位三種——
`student` 學生（現行規則）、`admin` 系學會幹部（進 `/admin` 操作）、`staff` 系辦助教（見下）。
權限的真正防線在資料庫層（如 Supabase RLS），前端的 `AdminRoute` 只是 UX。

- [ ] 訂單全覽：誰借（姓名／學號）、借什麼（品項數量）、借到何時（起訖日）、狀態篩選
- [ ] 訂單審核與押金繳交確認（繳押金後預約才成立的狀態機）
- [ ] 交接／歸還／逾期標記；**代客延期**（admin 幫學生延期，不受前台「僅乙次」限制）
- [ ] 逾期罰款計算：19:01 起算、第 1 日 100、每日翻倍（週末節假日不計）、上限押金總額、滿 6 日視為未完成清潔歸還
- [ ] 逾期天數累計 → 帳號 6 級狀態與停權（滿 5 天停權；前端 `ProfilePage` 目前寫死 level 0）
- [ ] 庫存管理（新增／下架／調整數量）
- [ ] **助教直借（`staff` 角色）**：用一般前台流程選借，但免押金、免審核、不受 9 件／滿 10 件／14 天等學生規則限制；訂單照常入庫、扣庫存，後台可見

## 階段 3：規則補完（依賴階段 1 的資料模型）

- [ ] 空間 14 天例外：四年級、碩士班放寬到 30 天（`DatePickerBar` 的 `maxDays` 依 `currentUser` 判斷）
- [ ] A508 教室限大二以上（`SpacePage.handleClassroomAdd` 擋大一）
- [ ] 停權帳號：擋登入或擋送單
- [ ] 延期「歸還日前三天提出」改為程式強制（目前只是文案）
- [ ] 重複下單、庫存衝突改由 server 端把關（目前只有前端檢查）

## 階段 4：品質（可並行）

- [ ] 測試：`npm test` 是 stub、零測試。優先蓋 `useCart`／`useCartValidation`（規則最密集、最容易回歸）
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
