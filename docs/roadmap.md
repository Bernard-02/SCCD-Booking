# 完成路線圖（Roadmap）

> 距離可上線，剩下的階段與任務。整體現況（2026-11-01 更新）：**階段 1 後端接線已完成**——
> 登入／訂單／庫存／空間／通知全部走 Supabase，mock 已全數移除；學生登入已改學校 Google 帳號＋封閉名單（階段 2），
> Google Cloud／Supabase 的一次性設定還沒做（階段 6）。
> 業務規則見 [rental-rules.md](./rental-rules.md)；後端用 **Supabase**（Auth + PostgreSQL + RLS）。
> 階段 2 → 3 有依賴順序；階段 4（品質）可與任何階段並行；階段 5（RWD 與手機版）前台 layout 大致定案即可開始，不必等階段 1.5（2026-11-06 調整）。

## 階段 1：Supabase 後端接線 ✅（2026-07 完成）

資料庫端 SQL 都在 `supabase/`（schema、seeds、auth-setup、orders-rpc），前端統一走 `src/services/`。
關鍵設計：送單 `submit_orders` RPC 為單一 transaction（訂單＋品項＋通知全成立或全撤銷），
庫存與空間衝突於伺服器端鎖列檢查；押金與流水號伺服器端計算；RLS 為權限真防線。

- [x] Supabase 專案（Singapore）＋ `.env`（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`）
- [x] schema：students（年級＋role 三種）、equipment、space（含教室）、orders、order_items、notifications＋RLS
- [x] 登入（學號→email→Auth）、Profile 改密碼／手機（忘記密碼自助重設 2026-11-09 拿掉：一律 Google 登入，不做 SMTP；`sccdsa` 忘記密碼到 Supabase 後台重設）
- [x] 設備 118 筆（官方編號 #MASA001 式）＋空間 130 筆（venue_code）入庫
- [x] 送單 RPC＋庫存扣減（`equipment_reserved`）＋空間佔用（`space_occupied`）＋延期（`extend_my_order`）
- [x] Profile 讀真實訂單、Header 讀真實通知（已讀入庫）
- [ ] 決定購物車與日期選擇是否跟帳號走（跨裝置同步）——未定案，不擋上線
- [x] 收尾（2026-10-03）：刪除 `orderValidation`（讀 localStorage receipts 的重複下單檢查）與
      `useOrderSubmission` 的 receipts 雙寫——server 端 `submit_orders`＋`DatePickerBar` 同類型未歸還檢查已取代

## 階段 1.5：桌面版整體驗收（上線前完成；手機版不必等，2026-11-06 調整）

**前置：先逐項定案 [order-lifecycle.md](./order-lifecycle.md) 的訂單生命週期情境**（沒繳押金、逾期、
取消、部分歸還等——情境沒定案，後台沒得做），再用桌面版把整套流程跑過一遍確認無誤。
測試工具：測試帳號（阿志／小美，大明已改為 sccdsa admin）開不同瀏覽器互相搶。候選衝突場景（開工時再補齊）：

- [ ] 兩人同時搶同一格空間／最後一件設備（一成一敗、敗方訊息清楚、購物車保留可重送）
- [ ] 訂單送出後改日期重送（Exist Cart 過期時段就地修復 → 新時段的佔用計算正確）
- [ ] pending 逾 24 工作時自動取消後，佔用是否釋放（已實作：pg_cron 每 5 分鐘把逾時 pending 改 canceled、發通知，
      佔用查詢只認 pending／in-progress／overdue，`supabase/auto-cancel.sql`；驗收時實測，原「佔用未釋放」落差已不存在）
- [ ] 延期後的新歸還日是否正確影響後續時段的佔用
- [ ] 同帳號多分頁／多裝置操作購物車與送單
- [ ] 大量訂單（滿 10 件、班級老師必填）與團體空間（押金照收、上限 5,000）全流程

## 階段 2：管理後台（進行中）

後台是**自己寫的 `/admin` 頁面**（同 repo、同部署、同視覺），不是資料庫平台的 GUI；
側欄分區架構（`AdminLayout`）：值班（訂單／空間地圖）＋設定（設備管理／空間管理／會員管理／營業時間）。admin 登入自動導向 `/admin/orders`。
2026-10-23：側欄改小字組名＋icon 膠囊（同前台 Profile）、後台全面拿掉英文；值班時間編輯從會員管理搬到營業時間頁；後台大表（訂單、會員、公告收件人）改分段抓（`fetchAllRows`，破 Supabase 1000 筆上限）。
視覺沿用前台 Profile 的設計語彙（`components/admin/adminUi.tsx`：狀態標籤、按鈕、輸入框、頁標題共用）。
權限真正防線在 Supabase RLS，前端的 `AdminRoute` 只是 UX。
**編輯政策**（見 order-lifecycle 情境 9）：軟性欄位（原因／班級／老師）可就地改，硬性資料（日期／品項／狀態／押金）一律走專用動作按鈕。

- [x] 訂單全覽：姓名／學號／種類／起訖／品項／原因／押金／狀態＋搜尋＋狀態／種類篩選＋全欄排序（`AdminOrdersPage`）
- [x] 確認收押金（`admin_mark_paid`：pending → in-progress）
- [x] 整單歸還＋逾期罰款確認（`admin_mark_returned`：in-progress/overdue → returned，寫 `penalty_total`，前端預填試算）
- [x] ~~總覽 dashboard~~（2026-10-24 拿掉）：各狀態數量移到訂單頁上方、待繳押金倒數與逾期營業日進訂單狀態欄、
      解除停權移到會員管理（展開停權帳號）、教室／空間使用中看空間地圖
- [x] 值班經手人追溯：收押金／歸還必選經手幹部（`orders.paid_by`／`returned_by` 姓名快照）；訂單頁「收押金」「歸還」兩欄＝沒做是按鈕、做完顯示經手人（2026-10-26，取件／收罰款也在這兩欄，操作欄剩點交／延期／取消訂單）；系學會名單每年換屆維護（2026-10-01 起併入會員管理 `AdminMembersPage`：身分選「系學會」＝加入 `staff_members`，見 supabase/staff-members.sql）
- [x] 公休日／寒暑假封鎖維護（2026-10-01 合併為「營業時間管理」`AdminHoursPage`，`/admin/hours`；直接 CRUD，RLS 把關）；
      2026-10-26 改版：左「假期 & 休息日」月曆整合休息日／法定假日／寒暑假封鎖，點日期開小視窗新增或刪除；
      右值班表 週一～五 × 午班／晚班、每格 1～3 位系學會，編輯→確定一次寫入。規則見 admin-hours.md
- [x] 會員管理（2026-10-01，`AdminMembersPage`，`/admin/members`）：全體帳號搜尋＋身分／違規篩選、展開租借歷史、
      改年級／身分（助教・系秘、休學擋新借、轉學生）。supabase/members.sql＋重貼 orders-rpc.sql（已執行 2026-10-01）。
      2026-10-25 重寫：分頁 全部／學生／系學會、身份五選一、年級與租借狀態篩選、選取模式批次改身份／狀態、已畢業預設隱藏、
      總租借點了跳訂單頁（原展開歷史拿掉）、「新增會員」＝預先登記 `login_allowlist`（Google 登入封閉名單）、
      Excel 匯入（`MemberImportDialog`＋`utils/memberImport`：表頭對應不看順序、逐列驗證、下載範本；SheetJS 自官方 CDN 裝）。規則見 admin-members.md
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
- [x] 解除停權（原在總覽違規名單，2026-10-24 移到會員管理展開列，`admin_unsuspend_student`：account_level 5→0＋通知；
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
  - [x] 空間管理（開放 toggle，`AdminSpacesPage`；編號區依區收合成群組列、群組列一鍵開關整區＋整區押金（2026-10-25）；教室清單改吃 space 表 `is_active`——`SpacePage.isClassroomOpen`；
        A508／後陽台預設關閉 SQL 在 supabase/close-a508-backterrace.sql，已執行）
  - [x] 空間／圖片編輯（2026-10-01）：教室改名稱／押金／圖片、編號區押金整區改（`updateAreaDeposit`）；
        設備與教室點縮圖換圖（Storage bucket `images`，`uploadImage`）。前台 `SpacePage` 教室與地圖 tooltip 押金
        改吃 space 表。supabase/space-edit-images.sql（已執行）（space.image_url＋bucket＋admin 寫入 policy）
  - [x] 空間地圖（唯讀：SVG 區塊依日期上色＋點擊看借用人／單號，教室不列〔2026-10-24〕，`AdminSpaceMapPage`
        ＋`fetchSpaceOccupancy`；2026-09-29 新規則 #6）
- [x] ~~歸還視窗「準時／逾期歸還」下拉~~（2026-11-08 拿掉：罰金改在退押金填，預填試算，準時就改 0）
- [x] 學年升級（情境 12）：pg_cron 每年 9/1 自動全體 +1（`promote_grades_core`，大四／碩二不動，
      API 端已撤執行權）；個別調整（延畢／休學）與轉學生＝Studio 手動，之後併入帳號管理
- [x] 收罰款／欠繳擋新單（情境 13）：退押金時差額記欠繳、欠繳單顯示「收罰款」鈕
      （`penalty_paid`／`penalty_collected_by`＋`admin_collect_penalty`＋`submit_orders` 擋單，
      SQL 在 supabase/penalty-and-grades.sql，已執行）
- [x] 營業時間通知（2026-10-02，`AdminHoursPage`）：公休日分類（活動／大總評／其他，`closed_dates.kind`，supabase/closed-date-kinds.sql 已執行），新增時自動發全站公告 template（不另設手寫公告頁；網頁版進通知鈴鐺，一人一列寫 notifications type `announcement`，日後做 App 可在 insert 掛 webhook 推播）；法定假日進後台時自動匯入（`autoImportHolidays`，今年＋明年各一次，刪除＝照常營業不補回），與寒暑假封鎖同列「假期」。另：新增公休日／寒暑假封鎖時自動通知受影響訂單（`notifyClosedDateAffected`／`notifyBlackoutAffected`）。
- **公告兩邊同步**（2026-10-02 定案）：Facebook 與系統全站通知**同一則公告兩邊都發**，不是互相取代
  （2026-07 原定「公告只走 Facebook、系統不做」已改）；Facebook 由學會自己發，不經過系統（2026-11-07）。倒數與逾期以整天計，只休一班的日子照算，唯一時間點是歸還死線 19:00
- [x] **助教直借（`staff` 角色）** server 端（情境 10）：`submit_orders` 對 staff 免押金、送出即 in-progress；
      封鎖期不擋 staff（原有）。前端數量上限對 staff 未豁免（遇到需求再放寬）；staff 帳號在 Studio 建（同 admin 流程）
- [x] **學校 Google 登入＋封閉名單**（2026-10-24／25）：學生按「使用學校 Google 帳號登入」→ 跳回首頁 `finishGoogleLogin` 撈 profile；
      資格在 DB trigger 把關（網域 gm／gm1／gm2.usc.edu.tw **且**學號或 Email 已在後台「新增會員」登記＝`login_allowlist`），
      第一次登入自動建學生資料、不另寄驗證信。SQL：google-login.sql → members-v2.sql（已執行）。
      Supabase 已開 Google provider、接上 OAuth 用戶端（2026-11-10 確認），待實測（階段 6）
- [x] 設備組合（2026-10）：後台設備管理「組合」分頁（`BundleManager`，含圖片、選取設備一鍵「組成組合」）；
      湊滿一組押金只收一組、件數算 1（`utils/bundleUtils`，有 vitest）；前台卡片「單個／整組」下拉、單個加入時提示整組；
      訂單明細／收據組合一列。SQL：equipment-bundles.sql → bundle-images.sql（已執行）
- [x] 後台共用 UI 語彙（2026-10-25，`adminUi`）：灰底工具列、計數分頁、搜尋框、sticky 表頭、可排序表頭、選取模式、
      FormDialog／Field、Switch、Select（searchable）；設備／空間／會員三頁依此重寫；空間管理 F1–F6 刪除（remove-f-blocks.sql）
- [x] 後台通知（2026-11-02）：學生自己送單／改品項／延期（含部分延期拆單）／取消 → `orders` trigger 發給 admin 帳號
      （`supabase/admin-notifications.sql`，本人操作才發：auth.uid()＝該單學生；後台代操作與排程不發）；
      側欄鈴鐺＋下拉（`NotificationPanel` 前後台共用），點一則跳該生訂單篩選，關掉即全部已讀

- [x] 文字內容段落化（2026-11-03）：使用教學／系學會改成「一頁一串段落」（`site_sections`＋`save_site_sections` RPC，`supabase/site-sections.sql`），
      一段＝標題＋一串積木（段落／編號條列／項目＋說明／連結／聯絡方式）；後台段落清單拖曳排序（原生 HTML5 DnD）、
      點一列右側滑入面板改標題與積木（積木也拖曳、增刪），標題自動編號；
      關於／聯絡方式／延期規則維持固定欄位。清單頁「完整使用說明」連結改讀使用教學第一個「連結」段落
- [x] 大量訂單核對單（2026-11-08 學會會議，取代 Excel 團體租借表單副本）：訂單頁大量設備單的「核對單」鈕（團體空間沒有器材要點，不做），
      在學會 Drive 建 Google 試算表（2026-11-09 學會由 PDF 改試算表；`createCheckSheet`＋Apps Script 複製範本），每按一次一個新檔。
      Apps Script 暫用開發者個人帳號部署（試算表版 2026-11-09 本機實測完成）。
      **上線前**：轉給學會帳號（`docs/drive-upload-setup.md`「轉給學會帳號」），拿到最終網址後填 `.env` 與 Vercel 的 `VITE_DRIVE_UPLOAD_URL`（Vercel 還沒填，沒填時按鈕只跳提示）

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
      新增未領 24 工作時自動取消（pg_cron）、待點交在訂單頁標示＋點交動作（原總覽清單 2026-10-24 隨總覽拿掉）。
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
- [x] **與學會討論待定規則**（清單見 [sa-discussion.md](./sa-discussion.md)）：2026-11-06 全部決議，2026-11-07 補細則。下面幾條 2026-11-07 實作，SQL 見 `supabase/rules-2026-11.sql` 檔頭的執行順序，規則已同步 rental-rules／order-lifecycle
- [x] 已繳押金沒來取件自動取消：取件日 19:00 過後取消、釋放佔用，不算違規；押金留紀錄，後台訂單頁「退押金」欄與「待退押金」分頁結清（`admin_refund_deposit`）
- [x] 不開放提前取件：`admin_mark_paid` 擋，後台「同時取件」與「取件」鈕到取件日才能用
- [x] 遠期單阻擋：起租日最遠今天起 30 天內，四種類型相同，只有系秘不受限；大量「今天＋3」維持
- [x] 一類別一張單：設備、空間各只能有一種類型未歸還，系秘也受限；§6 舊的重複下單檢查已刪
- [x] 公休撞取件日：`orders.pickup_date`＋`change_my_pickup`，通知上有「修改取件日」鈕、Profile 訂單卡也有；沒改照常自動取消；繳押金時段順延到隔天；只有大量設備
- [x] 公休可選時段：`closed_dates.shift`（整天／午班／晚班），休息日可跨多天、選開始與結束時段（2026-11-07 Bernard 加）
- [x] 個人空間一間教室改明文檢查；團體可以借一間以上（2026-11-07 Bernard 定）
- [x] 設備天數上限依年級：大四、大五、大六不限，碩士與其他 30 天（`gradeUtils.maxRentalDays`）
- [x] grade 慣例加大五、大六：`gradeUtils`、`orders-rpc.sql`、trigger、年級篩選；9/1 升級到大六為止，已畢業不升，未啟用的登記也跟著升
- [x] 系學會費：`students.dues_paid`，沒繳擋送單；匯入帶入，後台可改、可批次標
- [x] 匯入班級與會費：Excel 填「日媒四乙」「碩媒一甲」，優先於學號推算
- [x] 罰金在退押金時填（2026-11-08）：歸還只記東西回來；整張單還完在「退押金」填罰金，從押金扣，超過＝退 0、差額記欠繳，「收罰款」收清才算結束；部分歸還不分批退；學生 Profile 看得到待繳金額
- [x] 雷切機一年級要上傳核可證明，押金照收；每次 2 小時、證件由學會現場看
- [x] 設備、組合、教室的英文名稱（2026-11-07，supabase/item-en-names.sql）：後台可編輯，EN 模式的型錄、清單、訂單明細顯示，空白退回中文。設備先帶入第一版翻譯，待學會校對。延期視窗的品項名仍是中文
- [ ] 會員管理加「已畢業」分頁（2026-11-06 Bernard 考慮中）：取代工具列的「已畢業」切換，方便找回誤標的人（恢復在學現行已可做）
- [x] 以老師名義借用（2026-11-06 決議，取代押證件方案）：四種類型都適用，借用資訊選個人／老師名義，老師名義填老師名稱＋上傳證明（JPG／PNG／PDF）、押金歸零、不押證件，
      後台訂單頁「名義」欄看名稱與檔案。押金歸零由 `submit_orders` 驗證，證明檔放私有 bucket `proofs`（只有本人與 admin 能讀）。押金上限不放寬
- [x] F 區（2026-11-07 確認細節）：SVG 的 E1–E6 每格原本是中庭一塊加走廊長條一塊，長條獨立成 F1–F6（`#A5NF001`–`006`），押金 1,000；中庭的 E1–E6 與 E7–E11 不動。2026-11-08 定 F1–F6 算在中庭（`area='square'`），不另列一區
- [x] Order 頁使用說明補「現金交易不找零」（2026-10-03，畫面＋PDF 收據兩處）
- [x] **訪客瀏覽**（2026-10-20；2026-10-31 改導登入）：登入頁「訪客登入」→ 型錄；UI 全保留、可選日期看可借數量，
      按加入清單才擋——導去登入頁（`useCart.loginPath`，帶 `redirect_url`），登入後回原頁並還原選取
      （設備數量／整組、空間分類／區塊／專案許可存 sessionStorage `sccd_pending_*`；日期本來就在 localStorage）。
      `ProtectedRoute` 同機制（原本導去不存在的 `/login`、回跳參數遺失，已修）
- [x] 前台中／EN 切換（2026-10-20）：`stores/langStore`＋`useT`／`tr`，提示文字中英兩版各自維護、server 錯誤英文對照 `utils/serverErrors.ts`；
      後台與 PDF 收據不切換。同批：登入頁改單欄直排、Header／Footer 改 icon、Info 單一 lightbox（/about 刪除）

## 階段 4：品質（可並行）

- [x] 測試基礎：vitest 已建置（`timeUtils`／`gradeUtils`／`useCart`／`useCartValidation`／`bundleUtils`／`memberImport`／`serverErrors`／`supabase`，
      8 檔 78 案例，`npm test`）；後續有新規則再補對應案例
- [x] **安全修正（2026-10-03）**：`user_role()` 未登入回傳 NULL，後台 RPC 的 `<> 'admin'` 檢查被跳過
      （只帶 anon key 即可呼叫收押金／歸還／取消等 9 支）→ 改回傳 `'anon'`（supabase/user-role-fix.sql，已執行並驗證擋下）
- [x] **後台登入期限（2026-11-06）**：admin 登入起算固定 12 小時、不續期（後台在學會共用電腦上用），前端到期導回登入頁、
      server 端 `user_role()` 同步失效（supabase/admin-session-limit.sql，待執行）；登出改 `scope: 'local'`，只登出這台。
      **2FA**：帳密或 Google 登入後還要輸入驗證器 App 的 6 位數驗證碼（Supabase TOTP，免費；`MfaGate`），`user_role()` 要求 `aal2`。
      ~~後台同時只留一台~~（2026-11-08 拿掉，改分權，見下一項）
- [x] **後台分權（2026-11-08）**：最高權限 `sccdsa` 整個後台；學會成員用自己的帳號，只能用「值班」，經手人強制記本人，登入滿 12 小時要重登，可多裝置同時登入（supabase/operator-access.sql）。
      值班 RPC 開頭 `operator_handler`，值班頁讀資料走 `operator_*` RPC，不開 `orders`／`students` RLS。核對單的 Apps Script 改查 `backend_access`
- [ ] Tech debt：拆大檔（2026-11-01：`ProfilePage` 800、`CartList` 765、`SpacePage` 751、`EquipmentGrid` 736、`DatePickerBar` 717、`RentalListPage` 606 行）、
      `DateSelectionContext`（406 行）拆成設備／空間兩個、CSS 雙軌漸進遷移（舊 `css/*.css` 剩 1,120 行，九個檔都還在 main.tsx 載入）
- [x] 設備圖片（2026-10-03）：前台清單／購物車原本寫死延長線圖，改讀設備 `image_url`（`equipmentService.imageSrc`，
      未上傳才用預設圖）——圖片之後由後台設備管理上傳即生效
- [x] 清理一輪（2026-10-04）：刪死碼（舊 equipment-data.json、localStorage 通知 key、未用的 RPC 包裝與 SQL `extend_my_order`／`admin_mark_returned`）；
      修 bug：購物車日期格式混用（ISO／YYYY-MM-DD，續訂後加購被誤擋）、改日期對話框大量設備／團體空間最早起租日顛倒、
      教室押金寫死 5,000、公休日快取不失效、購物車可調數量／缺貨判斷未扣他人訂單（改同型錄可借數量，`useCartReserved`）；**submit_orders 補 server 端檢查**：押金單價改讀資料表（原信任前端傳值）、
      下架／未開放擋單、類型配對、數量（小量 ≤ 9、大量／團體 ≥ 10、正整數、不重複）、日期與天數上限、大量設備 3 天前（orders-rpc.sql 需重貼）
- [ ] 清理待辦（2026-10-04 審查）：
      登入後年級是快照（9/1 升級或後台改了要重登）；押金 cap 5,000／9 件／10 件／14・30 天等常數散在多處；
      種類／狀態標籤副本（種類已收斂到 `adminUi.orderKind`、前台走 `t()`；狀態標籤 `ProfilePage.statusInfo` 與後台仍各一份）；舊多單購物車相容碼；~~使用說明 GuideDialog 與規則不符~~（2026-10-04 依新版使用說明修正兩處：3 天前限大量設備、押金上限空間／設備各 5,000）
- [ ] `ProfilePage` 狀態圓點（`ProfilePage.tsx:706` 的 TODO）——等 Bernard 定 Profile 樣式再做
- [ ] **UI 一致性複查（Bernard 2026-10-27 提）**：全站再檢查一次按鈕樣式（前台／後台的實心、外框、文字鈕、icon 鈕各自用在哪，
      `adminUi` 的 `actionBtn`／`toolBtn`／`textBtn`／`iconFillBtn` 與前台 Extend 樣式是否對齊）與顏色的分類
      （狀態色、警示色、成功色等各代表什麼、哪裡用，收斂成一份對照後寫進 CLAUDE.md 程式風格規則）
      **進度**：按鈕狀態 2026-10-31 已定（`components/common/btn.ts` 的 `BTN`／`BTN_TOOL`：hover 整顆 50%、停用 20%，前台 21 檔套用）；
      英文字距 2026-10-27／11-01 定案並全站補齊（含 EN 模式全域規則，CLAUDE.md）；**剩**顏色分類對照、後台按鈕與前台對齊

## 階段 5：RWD 與手機版（純前端）

範圍（Bernard 2026-11-06 定）：**後台只做桌面 RWD，不做手機版**（手機難操作，用電腦即可）；**前台先做 RWD，再調手機版面**。
標準見 CLAUDE.md「手機版（RWD）標準」一節。舊手機選單（`mobile-menu.css`、Header 的 mobile-menu）已刪，Header／Footer 全寬度共用同一套。

### 後台：桌面 RWD（待人工確認：後台有 2FA，自動截圖進不去）

- [ ] 最窄到 1280px 不出現頁面級橫向卷軸，後台各頁逐頁檢查（2026-11-06 的自動截圖停在 2FA 畫面，尚未真的驗過）
- [ ] 訂單頁操作區（收押金／歸還／退押金／操作四欄，2026-11-07 名義移到收押金前）已固定在右側、左邊一條線分開，未實測：確認表頭同時黏住、四欄之間沒有重疊或縫、整列 hover 底色一致
- [ ] 會員頁 `min-w-[1200px]` 要不要固定欄位：等實際用起來再決定

### 前台第一步：RWD（2026-11-06 完成）

- [x] `h-screen` 改 `h-dvh`（6 頁）
- [x] Equipment／Space／RentalList 拿掉 `hidden md:*`；日期列改佔實際高度，頁面不再靠 `pb-20` 留位
- [x] 左欄固定比例在 `lg` 以下重新排列（分類移到上方、清單頁摘要併入同一欄、Profile 選單橫排）
- [x] `EquipmentGrid`／`ClassroomList` 容器 < 940px 改卡片（`card:` 變體），原本 1350px 以下要橫向捲動的問題一併解決
- [x] 日曆數字隨容器縮放（`cqw`），窄寬度雙月不互撞；矮螢幕設備頁左欄可捲動，圖例不被裁掉

### 前台第二步：手機版面（2026-11-06 完成，待實機驗收）

- [x] 手機導覽與 Footer（icon 鈕觸控面積 44px，`TAP`）
- [x] 設備分類＋Legend、日期列（兩列）、手機單月日曆（`hooks/useIsMobile`）
- [x] Space 地圖：`lg` 以下加格子清單（共用地圖的選取邏輯，階段 5.5 鍵盤操作可沿用）；hover 資訊不需替代，點一下直接進該區
- [x] Profile 訂單卡與明細、清單頁品項列、InfoDialog、通知面板
- [x] 手機字級獨立（`src/index.css` 覆寫 token，輸入框固定 16px）
- [x] 手機收合：設備卡片（高度約 175px → 90px）、圖例、日期列、使用教學段落
- [ ] 對話框實測：Confirm／借用資訊已看過；`DateEditDialog`／`ExtendDialog`／`ModifyOrderDialog` 有調整但還沒用真實訂單開過
- [ ] PDF 收據在手機下載的行為
- [ ] 實機驗收（iPhone Safari、Android Chrome；目前只測過 Chrome 模擬）

## 階段 5.5：無障礙（至少鍵盤可操作；純前端，可與階段 5 並行，上線前完成）

**範圍（2026-11-09 定）**：上線前只做焦點外框、Toast 的 aria-live、對話框焦點管理；日曆、A5F 地圖的鍵盤操作與其餘項目排到上線後。

目標：不碰滑鼠，只用 Tab／Shift+Tab／Enter／Space／方向鍵／Esc 走完前台「登入 → 選日期 → 加設備與空間 → 送單 → Profile 延期／修改」
與後台「收押金 → 點交 → 歸還」；焦點永遠看得見。讀屏（NVDA／VoiceOver）能唸出按鈕用途與狀態變化是加分，不是門檻。
現況（2026-11-02 掃過一輪）：後台 `Select` 已有完整鍵盤操作（↑↓／Enter／Esc／Tab、可搜尋）、9 個對話框接 Esc、`Collapse` 收合時 inert、
icon 鈕 aria-label 約 75 處、登入頁錯誤訊息 aria-live——但核心流程的幾個關鍵元件還是滑鼠專用。

- [ ] **可點的非按鈕元素改成鍵盤可達**（16 處 `<div>`／`<tr>`／`<th>` 掛 onClick，優先順序依流程）：
      `Calendar` 日期格（`Calendar.tsx:260`，選日期是所有流程的第一步）、`ExtendDialog` 延期天數數字（304）、
      `ProfilePage` 訂單卡摘要列展開（441）、`DatePickerBar` 已選日期清單（565）、`EquipmentGrid`／`CartList`／`ClassroomList` 的圖片預覽縮圖、
      後台 `adminUi` 可排序表頭（242）、`AdminSpacesPage` 整列可點（263–291）、`AdminHoursPage` 月曆格（222）。
      原則：能改 `<button>` 就改（最省，不用自己補 role／tabIndex／onKeyDown）；表格列保留 `<tr>` 時改成列內放一顆按鈕
- [ ] **A5F 編號區地圖**（`SpaceAreaMap`）：格子是 SVG `<g>` 用 addEventListener 綁 click，完全沒有鍵盤路徑。
      做法二選一：每格補 `tabindex="0"` `role="button"` `aria-label="A501-3（可借）"`＋Enter／Space 觸發、方向鍵在格間移動；
      或旁邊給一份同資料的清單（手機版本來就需要，階段 5 可共用）。hover 的格子資訊提示要有 focus 版本
- [ ] **對話框**（10 個 createPortal 彈窗＋通知／連結下拉）：補 `role="dialog"` `aria-modal="true"` `aria-labelledby`（指到標題）；
      開啟時焦點移進去（第一個輸入框或 X）、Tab 困在裡面（focus trap）、關閉時焦點回到打開它的按鈕；
      `DateEditDialog`／`ExtendDialog`／`PartialDialog`／Header 通知／Footer 連結下拉補 Esc。可抽一個 `useDialogA11y(ref, onClose)` hook 給全部用
- [ ] **焦點可見**：`outline-none` 18 處、`focus-visible` 只有 4 處——大多數控制項被 Tab 到時看不出來。
      `src/index.css` base 層加全站 `:focus-visible { outline: 2px solid var(--color-white); outline-offset: 2px }`（滑鼠點不會出現，只有鍵盤），
      然後把沒有替代樣式的 `outline-none` 拿掉（輸入框 focus 變白框的那種可以留）。Calendar 日期格、地圖格、訂單卡的焦點樣式要另外設計（白框會跟選中白底打架）
- [ ] **狀態變化要唸得出來**：`Toast` 加 `role="status"` `aria-live="polite"`（錯誤的紅 Toast 用 `role="alert"`）；
      購物車數量徽章、「可借 n」變化、送單結果，鍵盤使用者看不到 Toast 也要能知道
- [ ] **語意與地標**：每頁一個 `<main>`（Equipment／Space／RentalList／Profile 已有，其餘補）、`<nav aria-label>`、頁面第一個 Tab 停靠點是「跳到主內容」連結（Header 固定在上方時尤其需要）；
      標題層級 h1→h2 不跳級；表單 `label` 都綁到輸入框（`htmlFor`／包起來）；icon-only 按鈕全部有 `aria-label`（複查剩下沒有的）
- [ ] **hover-only 互動要有 focus／鍵盤替代**（同手機版「觸控替代」條）：待繳押金 ⓘ tooltip、設備卡 hover 預覽、地圖格 hover 資訊、
      Profile 訂單卡 hover 反白——focus 時同樣顯示；Footer 頭像登出選單、通知下拉用 Tab 進得去、Esc 關得掉
- [ ] **對比**：`gray-light`（#a4a4a4）在黑底約 8:1，正文與輔助字都過 AA；`gray-mid`（#545454）在黑底約 2.3:1，只能給停用／佔位與分隔線，
      **不能用在要讀的資訊**（例：DatePickerBar 已選日期清單的「（已達上限）」、ExtendDialog 封鎖期數字是 text-gray-mid，要換 gray-light 或補文字說明）；
      有色底 chip 黑字（yellow／green／pink／orange／cyan 底）都過 AA，維持
- [ ] **拖曳排序的鍵盤替代**：後台文字內容的段落清單與積木用原生 DnD，鍵盤碰不到——面板內補 ↑↓ 鈕或方向鍵移動
- [ ] **驗收**：拔掉滑鼠走一遍上面兩條主流程（前台學生、後台 sccdsa）；Chrome Lighthouse Accessibility 前後台各頁 ≥ 90；
      NVDA 或 VoiceOver 走登入→送單一次，記下唸不出來的地方

## 階段 6：部署上線

- [ ] Hosting：**維持 Vercel**（`vercel.json` 已設好）＋環境變數管理（Supabase URL／anon key）；用免費 `vercel.app` 網址，不買網域、不做 Google 品牌審核（2026-11-07 定：系上內部用，登入畫面顯示 supabase 網址可接受）
- [ ] 正式資料填入：真實學號名單（會員管理 Excel 匯入＝預先登記 `login_allowlist`）、設備清單與庫存、空間資料
- [ ] **Google 登入一次性設定**（2026-11-10 確認 Supabase 已開 Google provider、接上 OAuth 用戶端，剩實測）：Google Cloud OAuth 用戶端＋Supabase Auth Google provider＋Redirect URLs（步驟 docs/google-login-setup.md）；
      實測 gm／gm1／gm2 三個網域、未登記帳號被擋、LINE／IG 內建瀏覽器提示
- [x] 登入頁預設 Google 登入，學號密碼退為小連結當備援（2026-11-09 定，學生與後台都用 Google）。Google 同意畫面維持 Testing 即可：只要 email、姓名等基本權限時，Google 不限 Test users，
      不用 Publish，也不用為此做隱私權頁（2026-11-07 查證，學校帳號未列 Test users 實測可登入）
- [ ] **後台改用學會 Gmail 登入**（2026-11-06 定，不做一人一帳號；2026-11-07 定 Google Cloud 先用 Bernard 個人 Gmail 建，後台不接個人 Gmail、先用學號密碼，學會 Gmail 2026-11-09 已取得，照文件「轉給學會 Gmail」轉過去；Google Cloud 還沒建的話直接用學會 Gmail 建）：同一組 Gmail 也是上面 Google Cloud 專案的擁有者；學生各用自己的學校帳號，不靠它。
      步驟見 docs/google-login-setup.md「後台用學會 Gmail 登入」：`sccdsa` 的 email 換成 Gmail，實測 Google 登入接到同一個帳號（`handle_new_user` trigger 只收學校網域，被當新帳號會擋下）。
      學號密碼保留當備援，兩條路都要過 2FA，所以共用電腦留著 Google 登入狀態也不會一鍵進後台；換屆清單在同一份文件「交接」。
      上線時一起做（2026-11-06 定，開發期不分帳號）：另一案是 Gmail 建新管理員帳號、`sccdsa` 留給開發者測試（Supabase 後台手動新增＋SQL 設管理員，不用改 trigger），上線時再選；
      值班的人一起重新綁定 2FA（docs/google-login-setup.md「交接」）
- [ ] **上線前決定要不要開回後台 2FA**（2026-11-07 先關閉）：關閉期間後台只靠帳密，共用電腦留著 Google 登入狀態可一鍵進後台。
      開回來的步驟見 `supabase/admin-session-limit.sql` 開頭；綁定要在驗證器 App 裡掃（iPhone 相機會跳到「密碼」App，不會出現驗證碼）
- [x] 字型自架（2026-10 底）：Inter／Noto Sans TC 改 `@fontsource` 套件、Material Symbols 只留 FILL 軸 woff2 放 `public/fonts`
      （index.html 內嵌 @font-face＋`icons-ready` 旗標，字型到齊前 icon 文字不露出），`vercel.json` 給 `/fonts` 一年快取
- ~~自訂 SMTP~~——**2026-11-09 定案不做**：一律 Google 登入，學生沒有密碼，不需要忘記密碼信
- [ ] 上線前驗收：照 [rental-rules.md](./rental-rules.md) 逐條走一遍真實流程

## 遠期構想（未排程）

- [ ] **做成 App**（2026-09-26 記）：Bernard 有意把平台做成手機 App。方向未定案——最低成本是 PWA（現有 React SPA 加 manifest + service worker 即可安裝到主畫面），進一步是 Capacitor 包殼上架，原生重寫成本最高。等手機版（階段 5）完成後再評估，屆時 RWD 成果可直接沿用。
