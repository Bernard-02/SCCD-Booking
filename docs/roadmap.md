# 完成路線圖（Roadmap）

> 距離可上線，剩下的階段與任務。整體現況：**前端流程完整（mock 跑得通），沒有真實後端**。
> 業務規則見 [rental-rules.md](./rental-rules.md)；後端已定案用 **Supabase**（Auth + PostgreSQL + RLS）。
> 階段 1 → 2 → 3 有依賴順序；階段 4（品質）與階段 5（手機版）可與任何階段並行。

## 階段 1：Supabase 後端接線（最大缺口）

前端接口都已抽好（`AuthProvider` 的 `authService` prop、`utils/storageKeys.ts`），接線時換掉 mock 函式即可，不必重構。
選 Supabase 的理由：關聯式（Postgres）合適訂單／庫存／時段衝突查詢、transaction＋constraint 在資料庫層把關併發、RLS 做列級權限、Studio 表格介面可當過渡期後台。

詳細規劃（資料表草稿、接線順序、學號↔email 的坑）見 [supabase-backend-plan.md](./supabase-backend-plan.md)。

- [ ] Supabase 專案建立（region 選 Tokyo）＋ `.env` 環境變數（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`）
- [ ] 資料表 schema：students（含**年級／學制**與 **role**：student/admin/staff）、equipment、orders、order_items、space_blocks、notifications；RLS 政策（學生只讀自己的訂單）
- [ ] 登入換掉 `mockApiLogin`（`utils/testAuthData.ts`），注入 Supabase `authService`
- [ ] 忘記密碼：Supabase Auth 自助重設流程
- [ ] 設備資料與庫存入庫（`equipment-data.json` 匯入）：借出**真實扣庫存**，併發用 transaction 把關（`EquipmentGrid.tsx` TODO「需接入實際預訂數據」）
- [ ] 空間佔用：`mockAreaBlocksData`（`SpaceAreaMap.tsx`）換成真實預約資料，多人可見彼此衝突
- [ ] 送單：`useOrderSubmission` 改寫 Supabase；receipts／notifications 脫離 localStorage
- [ ] 通知：Header 的 `mockNotifications` 換真實來源
- [ ] 決定購物車與日期選擇是否跟帳號走（跨裝置同步）

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
