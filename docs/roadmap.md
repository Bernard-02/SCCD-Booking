# 完成路線圖（Roadmap）

> 距離可上線，剩下的階段與任務。整體現況（2026-09 更新）：**階段 1 後端接線已完成**——
> 登入／訂單／庫存／空間／通知全部走 Supabase，mock 已全數移除。
> 業務規則見 [rental-rules.md](./rental-rules.md)；後端用 **Supabase**（Auth + PostgreSQL + RLS）。
> 階段 2 → 3 有依賴順序；階段 4（品質）可與任何階段並行；階段 5（手機版）等階段 1.5 桌面版驗收確認後再做（Bernard 2026-10-03）。

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
- [x] 收尾（2026-10-03）：刪除 `orderValidation`（讀 localStorage receipts 的重複下單檢查）與
      `useOrderSubmission` 的 receipts 雙寫——server 端 `submit_orders`＋`DatePickerBar` 同類型未歸還檢查已取代

## 階段 1.5：桌面版整體驗收（先於階段 2 與手機版，已與 Bernard 議定）

**前置：先逐項定案 [order-lifecycle.md](./order-lifecycle.md) 的訂單生命週期情境**（沒繳押金、逾期、
取消、部分歸還等——情境沒定案，後台沒得做），再用桌面版把整套流程跑過一遍確認無誤，才進後台與手機版。
測試工具：測試帳號（阿志／小美，大明已改為 sccdsa admin）開不同瀏覽器互相搶。候選衝突場景（開工時再補齊）：

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
側欄分區架構（`AdminLayout`）：值班（總覽／訂單／空間地圖）＋設定（設備管理／空間管理／會員管理／營業時間）。admin 登入自動導向 `/admin`。
視覺沿用前台 Profile 的設計語彙（`components/admin/adminUi.tsx`：狀態標籤、按鈕、輸入框、頁標題共用）。
權限真正防線在 Supabase RLS，前端的 `AdminRoute` 只是 UX。
**編輯政策**（見 order-lifecycle 情境 9）：軟性欄位（原因／班級／老師）可就地改，硬性資料（日期／品項／狀態／押金）一律走專用動作按鈕。

- [x] 訂單全覽：姓名／學號／種類／起訖／品項／原因／押金／狀態＋搜尋＋狀態／種類篩選＋全欄排序（`AdminOrdersPage`）
- [x] 確認收押金（`admin_mark_paid`：pending → in-progress）
- [x] 整單歸還＋逾期罰款確認（`admin_mark_returned`：in-progress/overdue → returned，寫 `penalty_total`，前端預填試算）
- [x] 總覽 dashboard：訂單概況統計、教室／空間使用中、待繳押金倒數、違規帳號（停權＋逾期）
- [x] 值班經手人追溯：收押金／歸還必選經手幹部（`orders.paid_by`／`returned_by` 姓名快照）；系學會名單每年換屆維護（2026-10-01 起併入會員管理 `AdminMembersPage`：身分選「系學會」＝加入 `staff_members`，見 supabase/staff-members.sql）
- [x] 公休日／寒暑假封鎖維護（2026-10-01 合併為「營業時間管理」`AdminHoursPage`，`/admin/hours`；直接 CRUD，RLS 把關）
- [x] 會員管理（2026-10-01，`AdminMembersPage`，`/admin/members`）：全體帳號搜尋＋身分／違規篩選、展開租借歷史、
      改年級／身分（助教・系秘、休學擋新借、轉學生）。supabase/members.sql＋重貼 orders-rpc.sql（已執行 2026-10-01）
- [x] **代客延期**（`admin_extend_order`：不受僅乙次／前三天限制、不動學生 has_extended、
      每次 1-7 天可多次、撞期照擋、overdue 延期後回 in-progress；經手人寫 `extended_by`）
- [x] 前台「部分延期」（情境 5＋8）：ExtendDialog 選天數→逐品項顯示可否延（`extend_check`）→勾選送出，
      全勾整單延、部分勾自動拆子單（`extend_my_order_partial`；含 `parent_order_id`／`refunded` 欄位，
      SQL 在 supabase/partial-extend.sql，已執行）
- [x] 後台「部分歸還拆單」（含大單）：歸還視窗勾「已歸還」品項，全勾整單歸還、部分勾未還品項拆子單續租
      （`admin_mark_returned_partial`；小單退差額寫 `refunded`、大單押金不拆全還才退。SQL 同在 partial-extend.sql）
- [x] 代取消（`admin_cancel_order`：pending 直接作廢、in-progress 現場退押金後結案；
      overdue 不可取消需走歸還；經手人寫 `canceled_by`）
- [x] 軟性欄位編輯（2026-10-01）：訂單操作欄鉛筆 icon → `OrderInfoDialog` 改原因／班級／老師
      （必填規則同前台：原因必填、大量／團體需班級＋老師），`adminUpdateOrderInfo` 直接 update（RLS `orders: admin all`）。
      學生端不可改：無 update 權限、前台無介面；另移除學生直接 insert 訂單的權限（可繞過 RPC 檢查），
      supabase/orders-lockdown.sql（已執行 2026-10-01）
- [x] 解除停權（總覽違規名單「Unsuspend」鈕，`admin_unsuspend_student`：account_level 5→0＋通知；
      以上三支 RPC 在 supabase/admin-actions.sql，已執行）
- [x] 值班可靠性（2026-10-02）：訂單／總覽／空間地圖自動更新（`useAutoRefresh`：每 60 秒＋切回分頁即更新，
      背景失敗不蓋畫面；訂單工具列「更新於 hh:mm」＋手動重新整理）；後台全部頁面
      載入失敗改顯示原因＋重試（`LoadError`，不再誤顯示成「沒有資料」）；所有寫入操作成功皆有 Toast
- ~~手動建單~~——**2026-10-04 定案不做**：學會不能代學生下單；可代改借用資訊（原因／班級／老師），品項有錯請學生重新下單
- [x] 畢業生帳號停用（2026-10-04）：會員管理手動標記「已畢業」→ 不能登入（有未歸還訂單者例外）、
      `submit_orders` 擋新單（members.sql＋重貼 orders-rpc.sql，已執行 2026-10-04）
- [x] **後台改版：側欄分兩段**（2026-09-30 定案）——「值班 Daily」（總覽／訂單／空間地圖）
      與「設定 Settings」（設備管理／空間管理／會員管理／營業時間）分開，防誤觸：
      查看與寫入不同頁、設定段寫入一律確認 dialog、下架＝軟性停用不刪資料（`AdminLayout` 分組）
  - [x] 設備管理（新增／編輯／軟性下架，`AdminEquipmentPage`＋`adminService`；前台快取政策同公休日：學生端重整生效）。
        分類為固定下拉（2026-10-01）：前台篩選與後台共用 `types/equipment.ts` 的 `EQUIPMENT_CATEGORIES`
  - [x] 空間管理（開放 toggle，`AdminSpacesPage`；教室清單改吃 space 表 `is_active`——`SpacePage.isClassroomOpen`；
        A508／後陽台預設關閉 SQL 在 supabase/close-a508-backterrace.sql，已執行）
  - [x] 空間／圖片編輯（2026-10-01）：教室改名稱／押金／圖片、編號區押金整區改（`updateAreaDeposit`）；
        設備與教室點縮圖換圖（Storage bucket `images`，`uploadImage`）。前台 `SpacePage` 教室與地圖 tooltip 押金
        改吃 space 表。supabase/space-edit-images.sql（已執行）（space.image_url＋bucket＋admin 寫入 policy）
  - [x] 空間地圖（唯讀：SVG 區塊依日期上色＋點擊看借用人／單號，教室另列，`AdminSpaceMapPage`
        ＋`fetchSpaceOccupancy`；2026-09-29 新規則 #6）
- [x] 歸還視窗「準時／逾期歸還」下拉（情境 6：準時免罰、逾期才展開罰款欄，`OrderActionDialog`）
- [x] 學年升級（情境 12）：pg_cron 每年 9/1 自動全體 +1（`promote_grades_core`，大四／碩二不動，
      API 端已撤執行權）；個別調整（延畢／休學）與轉學生＝Studio 手動，之後併入帳號管理
- [x] 收罰款／欠繳擋新單（情境 13）：歸還時「已當場繳清」勾選、欠繳單顯示「收罰款」鈕
      （`penalty_paid`／`penalty_collected_by`＋`admin_collect_penalty`＋`submit_orders` 擋單，
      SQL 在 supabase/penalty-and-grades.sql，已執行）
- [x] 營業時間通知（2026-10-02，`AdminHoursPage`）：公休日分類（學會辦活動／大總評／其他，`closed_dates.kind`，supabase/closed-date-kinds.sql 已執行），新增時自動發全站公告 template（不另設手寫公告頁；網頁版進通知鈴鐺標「公告」，一人一列寫 notifications type `announcement`，日後做 App 可在 insert 掛 webhook 推播）；法定假日進後台時自動匯入（`autoImportHolidays`，今年＋明年各一次，刪除＝照常營業不補回），與寒暑假封鎖同列「假期」。另：新增公休日／寒暑假封鎖時自動通知受影響訂單（`notifyClosedDateAffected`／`notifyBlackoutAffected`）。
- **公告兩邊同步**（2026-10-02 定案）：Facebook 與系統全站通知**同一則公告兩邊都發**，不是互相取代
  （2026-07 原定「公告只走 Facebook、系統不做」已改）。計算面不變：系統只需知道「整天不開」＝公休日／寒暑假封鎖，營業「時段」調動不影響任何計算——倒數與逾期皆以整天計，唯一時間點是歸還死線 19:00）
- [x] **助教直借（`staff` 角色）** server 端（情境 10）：`submit_orders` 對 staff 免押金、送出即 in-progress；
      封鎖期不擋 staff（原有）。前端數量上限對 staff 未豁免（遇到需求再放寬）；staff 帳號在 Studio 建（同 admin 流程）

## 階段 3：規則補完（依賴階段 1 的資料模型）

- [x] 空間 14 天例外：四年級、碩士班放寬到 30 天（`gradeUtils.ts`＋`DatePickerBar`／`DateEditDialog`）
- [x] A508 教室限大二以上（`SpacePage` UX 提示＋`submit_orders` server 端擋）
- [x] 停權帳號：擋送單（不擋登入）——情境 7 已實作
- [x] 延期「歸還日前三天提出」：**程式強制**已實作（`extend_my_order` RPC 依日期擋＋`isWithinExtendWindow` UX）
- [x] 重複下單、庫存衝突改由 server 端把關
- [x] 寒暑假封鎖 server 端（`rental_blackouts` 表＋`submit_orders` 擋 student）——情境 11-a 已實作
- [x] 寒暑假封鎖前端日曆：封鎖日期灰化不可選＋擋跨封鎖選取（`Calendar` 讀 `fetchBlackouts`）
- [x] 延期不得延入寒暑假封鎖：`extend_my_order` 補 blackout 檢查＋`ExtendDialog` 封鎖日灰化
      （SQL 改在 orders-rpc.sql，已重貼生效）
- [x] 修改已送出的設備單（2026-10-03，情境 3）：小量／大量都改原單——取件前可增減、取件後只能加（新增待學會點交）；
      小量 ≤ 9、大量 ≥ 10、增量查庫存；押金已繳的差額現場算、系統記錄；品項標「已更動／待點交」＋最後修改時間；
      新增未領 24 工作時自動取消（pg_cron）、總覽「新增待點交」清單。
      （SQL：modify-order.sql＋重貼 orders-rpc.sql，已執行 2026-10-03）
- [x] 設備／空間分單（2026-10-02）：購物車組別＝訂單（`types/equipment.ts` `cartGroupKey`）——
      借用資訊每單各填、送單分組、類型互斥／押金／9 件（**僅計設備**）皆以單為單位；
      `submit_orders` 擋混合單、小量重複檢查分類別（orders-rpc.sql 已重貼 2026-10-03）；
      後台種類欄四格（小量設備／大量設備／個人空間／團體空間，`adminUi` 的 `orderKind`）
- [x] 大量設備預繳押金＋自選取件時間（2026-10-02）：購物車借用資訊選繳押金／取件時段（值班時段；
      取件＝起租日、繳押金＝24 工作時內且不晚於取件）；後台收押金可「同時取件」或先收後取（已繳待取件），
      逾時未取件紅字提醒。**SQL：執行 mass-pickup.sql，再重貼 orders-rpc.sql、auto-cancel.sql、admin-actions.sql**
- [x] 同類型限一單（2026-09-30 新規則，2026-10-02 實作兩層）：小量設備／大量設備／個人空間／團體空間四格——
      購物車同類別一張（`useCart` 擋類型＋時段、舊購物車結帳擋、日期列點衝突類型當下提示）；
      **server 端 `submit_orders` 擋同類型未歸還單**（僅 student；orders-rpc.sql 已重貼 2026-10-03）
- [ ] **與學會討論待定規則**（清單見 [sa-discussion.md](./sa-discussion.md)）：大量取件細節、遠期單範圍、
      同類型一單的算法、公休公告措辭、一時段一間教室、四年級／碩士天數上限、團體空間免押金、以老師名義押證件（後台標示押金／證件／兩者）。開會後依決議改程式＋rental-rules
- [ ] 遠期單阻擋（方向定案 2026-09-30）：起租日最遠可選範圍**待 Bernard 與學會討論定細則**
      （rental-rules 待確認 #4）——定案後改日曆可選範圍＋server 端擋
- [x] Order 頁使用說明補「現金交易不找零」（2026-10-03，畫面＋PDF 收據兩處）
- [x] **訪客瀏覽**（2026-10-20）：登入頁「訪客登入」→ 型錄；UI 全保留、可選日期看可借數量，
      加入清單時才擋（`useCart.addToCart` 回「請先登入才能加入清單」，空間區塊選取先擋不清空）

## 階段 4：品質（可並行）

- [x] 測試基礎：vitest 已建置（`timeUtils`／`gradeUtils`／`useCart`／`useCartValidation`，`npm test`）；後續有新規則再補對應案例
- [x] **安全修正（2026-10-03）**：`user_role()` 未登入回傳 NULL，後台 RPC 的 `<> 'admin'` 檢查被跳過
      （只帶 anon key 即可呼叫收押金／歸還／取消等 9 支）→ 改回傳 `'anon'`（supabase/user-role-fix.sql，已執行並驗證擋下）
- [ ] Tech debt：拆 700 行大檔（`CartList`、`OrderPage`、`SpacePage`、`RentalListPage`）、`DateSelectionContext` 拆成設備／空間兩個、CSS 雙軌漸進遷移
- [x] 設備圖片（2026-10-03）：前台清單／購物車原本寫死延長線圖，改讀設備 `image_url`（`equipmentService.imageSrc`，
      未上傳才用預設圖）——圖片之後由後台設備管理上傳即生效
- [x] 清理一輪（2026-10-04）：刪死碼（舊 equipment-data.json、localStorage 通知 key、未用的 RPC 包裝與 SQL `extend_my_order`／`admin_mark_returned`）；
      修 bug：購物車日期格式混用（ISO／YYYY-MM-DD，續訂後加購被誤擋）、改日期對話框大量設備／團體空間最早起租日顛倒、
      教室押金寫死 5,000、公休日快取不失效、購物車可調數量／缺貨判斷未扣他人訂單（改同型錄可借數量，`useCartReserved`）；**submit_orders 補 server 端檢查**：押金單價改讀資料表（原信任前端傳值）、
      下架／未開放擋單、類型配對、數量（小量 ≤ 9、大量／團體 ≥ 10、正整數、不重複）、日期與天數上限、大量設備 3 天前（orders-rpc.sql 需重貼）
- [ ] 清理待辦（2026-10-04 審查）：
      登入後年級是快照（9/1 升級或後台改了要重登）；押金 cap 5,000／9 件／10 件／14・30 天等常數散在多處；
      種類／狀態標籤 7 份副本（做雙語時一併收斂）；舊多單購物車相容碼；~~使用說明 GuideDialog 與規則不符~~（2026-10-04 依新版使用說明修正兩處：3 天前限大量設備、押金上限空間／設備各 5,000）
- [ ] `ProfilePage` 狀態圓點（`ProfilePage.tsx:642`）——等 Bernard 定 Profile 樣式再做

## 階段 5：手機版（純前端；等階段 1.5 桌面版驗收確認後再執行）

RWD 標準見 CLAUDE.md「手機版（RWD）標準」一節。已有手機版：Home、Booking、BookingResources、About、Header（mobile menu）。

- [ ] Equipment 設備頁手機版（目前 `hidden md:block`，手機無內容）
- [ ] Space 空間頁手機版（同上；區域地圖 SVG 的觸控操作要特別設計）
- [ ] RentalList 清單頁手機版
- [ ] Order 訂單頁手機版（含 PDF 輸出的手機行為）
- [ ] Profile 頁手機版檢查（無 `md:` 斷點，需逐一驗證）
- [ ] Footer 手機版（目前 `hidden md:flex`）
- [ ] 對話框（DateEditDialog、InfoDialog 等 max-w 較大的）在小螢幕的呈現

## 階段 6：部署上線

- [ ] Hosting：**維持 Vercel**（`vercel.json` 已設好）＋環境變數管理（Supabase URL／anon key）
- [ ] 正式資料填入：真實學號名單、設備清單與庫存、空間資料
- [ ] 自訂 SMTP（Supabase Auth → SMTP Settings）：內建寄信只寄得到專案團隊成員信箱且每小時限量，學生收不到忘記密碼信；Redirect URLs 加正式網域 `/reset-password`
- [ ] 上線前驗收：照 [rental-rules.md](./rental-rules.md) 逐條走一遍真實流程

## 遠期構想（未排程）

- [ ] **做成 App**（2026-09-26 記）：Bernard 有意把平台做成手機 App。方向未定案——最低成本是 PWA（現有 React SPA 加 manifest + service worker 即可安裝到主畫面），進一步是 Capacitor 包殼上架，原生重寫成本最高。等手機版（階段 5）完成後再評估，屆時 RWD 成果可直接沿用。
