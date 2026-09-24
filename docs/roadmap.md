# 完成路線圖（Roadmap）

> 距離可上線，剩下的工作**依性質分類**（2026-09 重整）。業務規則見 [rental-rules.md](./rental-rules.md)；
> 訂單情境定案紀錄見 [order-lifecycle.md](./order-lifecycle.md)；後端用 **Supabase**（Auth + PostgreSQL + RLS）。
>
> 現況：前台全流程已接 Supabase；規則補完（原階段 3）全部完成；管理後台進行中；手機版與部署未開始。
> 已完成的項目收在文末「已完成紀錄」。

## 建議順序

1. **🐞 驗收與 Bug**（桌面版整體跑一遍）——地基確認無誤再往上蓋
2. **🗣 流程討論**與 **🛠 後台功能**並行——討論定案一項，後台就做一項
3. **📱 UI／手機版**——純前端，任何時候都可插空做
4. **🧹 程式品質**——隨手做，不擋上線
5. **🚀 部署上線**

分類符號：🗣 需團隊討論（流程／規則，不是寫程式能解決的）、🛠 功能開發、🐞 驗收／Bug、📱 UI、🧹 程式品質、🚀 部署。

---

## 🗣 流程討論（需與團隊定案，定案後回填 order-lifecycle.md）

- [ ] **大量單事後加設備**（情境 3 例外）：admin 後台代改，還是讓原下單學生自己在前台加？
- [ ] **大單的部分歸還／部分延期拆分規則**（情境 5-2）：押金怎麼拆（小單已定案，大單 RPC 目前先擋）
- [ ] **前台要不要讓學生選「哪些延期、哪些原日歸還」**（情境 5-5）：還是一律到學會由 admin 拆單
- [ ] **損壞賠償**（情境 5-6）：輕微／嚴重分級、賠錢／買新品／扣押金的認定方式（已定：不因損壞停權）
- [ ] **購物車與日期選擇是否跟帳號走**（跨裝置同步）：目前存在瀏覽器，不擋上線
- [ ] **驗收時發現的規則疑問**：跑下方 🐞 驗收時遇到「程式照做了但不確定規則對不對」的，記在這裡

## 🛠 功能開發：管理後台（`/admin`）

後台是**自己寫的 `/admin` 頁面**（同 repo、同部署、同視覺），側欄分區（`AdminLayout`）；
視覺沿用 `components/admin/adminUi.tsx`。權限真防線在 Supabase RLS，`AdminRoute` 只是 UX。
**編輯政策**（情境 9）：軟性欄位（原因／班級／老師）可就地改，硬性資料（日期／品項／狀態／押金）一律走專用動作按鈕（各一顆有把關的 RPC）。

已規則定案、可以直接做的（依日常使用頻率排）：

- [ ] **代取消**：in-progress 學生要取消須到學會處理（情境 2），admin 取消並記錄退押金
- [ ] **代客延期**：不受前台「僅乙次」與前三天限制（情境 9-2）
- [ ] **軟性欄位就地編輯**：原因／班級／老師
- [ ] **帳號狀態調整**：改 `account_level`，含解除停權、老師通融（情境 9-4）
- [ ] **手動建單**：電話／現場預約，admin 代學生下單（情境 9-7）
- [ ] **庫存管理**：設備新增／下架（`is_active`）／調整數量（情境 11）
- [ ] **助教直借（`staff` 角色）**：一般前台流程，但免押金、送出即 in-progress、仍守先來後到（情境 10）
- [ ] **部分歸還／部分延期拆單（小單）**：`parent_order_id`＋`refunded` 欄位（情境 5；大單待 🗣 定案）

## 🐞 驗收與 Bug

### 桌面版整體驗收（先於手機版）

測試工具：三個測試帳號（阿志／小美／大明）開不同瀏覽器互相搶。

- [ ] 兩人同時搶同一格空間／最後一件設備（一成一敗、敗方訊息清楚、購物車保留可重送）
- [ ] 訂單送出後改日期重送（Exist Cart 過期時段就地修復 → 新時段的佔用計算正確）
- [ ] pending 逾 24 工作時自動取消（pg_cron `cancel_expired_pending`）後佔用確實釋放、掃描空窗內顯示一致
- [ ] 延期後的新歸還日是否正確影響後續時段的佔用
- [ ] 同帳號多分頁／多裝置操作購物車與送單
- [ ] 大量訂單（滿 10 件、班級老師必填）與團體空間（免押金上限）全流程
- [ ] 後台：收押金 → 歸還（含逾期罰款預填）→ 學生端狀態與通知同步
- [ ] 忘記密碼信到學校信箱的實測（redirect 白名單、改完新密碼登入）

### 已知問題

- [ ] 設備頁沒有「部分可借」（黃色 partial）狀態：同一時段只剩部分數量時仍只顯示可借／不可借（`EquipmentGrid.tsx` TODO）

## 📱 UI／手機版

RWD 標準見 CLAUDE.md「手機版（RWD）標準」。已有手機版：Home、Booking、BookingResources、About、Header（mobile menu）。

- [ ] Equipment 設備頁手機版（目前 `hidden md:block`，手機無內容）
- [ ] Space 空間頁手機版（區域地圖 SVG 的觸控操作要特別設計）
- [ ] RentalList 清單頁手機版
- [ ] Order 訂單頁手機版（含 PDF 輸出的手機行為）
- [ ] Profile 頁手機版檢查（無 `md:` 斷點，需逐一驗證）
- [ ] Footer 手機版（目前 `hidden md:flex`）
- [ ] 對話框（DateEditDialog、GuideDialog 等 max-w 較大的）在小螢幕的呈現
- [ ] 後台手機版：是否需要？（值班多半用電腦，可先不做——🗣 順便確認）
- [ ] 小細節：延長線設備缺實際圖片（`EquipmentGrid.tsx` 佔位圖）、`ProfilePage` 訂單狀態圓點

## 🧹 程式品質（不擋上線）

- [ ] 拆 700 行以上的大檔：`SpacePage`、`CartList`、`OrderPage`、`RentalListPage`、`ProfilePage`
- [ ] `DateSelectionContext` 拆成設備／空間兩個 context
- [ ] 舊 `css/*.css` 漸進遷移到 Tailwind
- [ ] 新規則補對應 vitest 案例（目前：`timeUtils`／`useCart`／`useCartValidation`／`orderValidation`）

## 🚀 部署上線

- [ ] Hosting：**維持 Vercel**（`vercel.json` 已設好）＋環境變數（Supabase URL／anon key）
- [ ] Supabase：`supabase/*.sql` 全部在正式專案執行過、pg_cron 三排程確認在跑
- [ ] 正式資料填入：真實學號名單、設備清單與庫存、空間資料、本屆幹部名單
- [ ] 上線前驗收：照 [rental-rules.md](./rental-rules.md) 逐條走一遍真實流程

---

## 已完成紀錄

### 後端接線（原階段 1，2026-07）

資料庫端 SQL 都在 `supabase/`，前端統一走 `src/services/`。送單 `submit_orders` RPC 為單一 transaction，
庫存與空間衝突於伺服器端鎖列檢查；押金與流水號伺服器端計算；RLS 為權限真防線。

- [x] Supabase 專案（Singapore）＋ `.env`；schema（students 三種 role、equipment、space、orders、order_items、notifications）＋RLS
- [x] 登入（學號→email→Auth）、忘記密碼自助重設、Profile 改密碼／手機
- [x] 設備 118 筆＋空間 130 筆入庫
- [x] 送單 RPC＋庫存扣減＋空間佔用＋延期（`extend_my_order`）；Profile 讀真實訂單、Header 讀真實通知
- [x] 收尾（2026-09）：移除 localStorage receipts 雙寫；重複下單前端提示改讀 Supabase 訂單；
      送單失敗時顯示伺服器回傳的具體原因（原本一律「送出失敗，請再試一次」）

### 訂單生命週期（pg_cron）

- [x] 情境 1：逾 24 工作時未繳押金自動取消
- [x] 情境 6：逾期自動標記與罰款試算
- [x] 情境 7：逾期滿 6 營業日自動停權（擋送單、不擋登入）

### 規則補完（原階段 3）

- [x] 空間 30 天例外（大四、碩士）、A508 限大二以上、停權擋送單
- [x] 延期「歸還日前三天提出」程式強制、延期撞期檢查
- [x] 重複下單、庫存衝突改由 server 端把關
- [x] 寒暑假封鎖：server 端＋前端日曆灰化

### 管理後台（已上線部分）

- [x] 訂單全覽（搜尋、篩選、全欄排序、欄位拖曳）
- [x] 確認收押金（`admin_mark_paid`）、整單歸還＋逾期罰款確認（`admin_mark_returned`）
- [x] 總覽 dashboard：訂單概況、使用中空間、待繳押金倒數、違規帳號
- [x] 值班經手人追溯（`paid_by`／`returned_by`）＋幹部名單維護（`staff_members`）
- [x] 公休日／寒暑假封鎖維護
- ~~公告~~（2026-07 定案不做：公告一律發 Facebook）

### 品質

- [x] vitest 建置；路由層 code-splitting；storage key 集中管理
- [x] `package.json` 補上 `@testing-library/dom`（`@testing-library/react` 的 peer dependency，乾淨環境原本 `npm test` 會缺）
