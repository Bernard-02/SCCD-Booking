# SCCD Booking

實踐大學 SCCD（實踐媒體傳達設計系）設備與空間租借系統。學生可預約設備、教室、以及 A5F 編號區域空間。使用者介面為繁體中文。

## Stack

- **React 18** + TypeScript (strict mode) + Vite 5
- **React Router v7** — SPA 路由
- **Zustand** — 收藏（bookmark）狀態、介面語言（`stores/langStore.ts`）
- **Tailwind CSS v4** (`@tailwindcss/vite`) 共存於舊的 `css/*.css` 檔案
- **動畫**：原生 CSS（transition、`@keyframes`，共用的在 `css/animations.css`），不裝動畫庫（2026-11-06 定；gsap 從沒被 import 過，已移除）
- **其他**：jspdf、html2canvas（Profile 收據用，按下去才動態載入：`utils/pdf.ts`）

## 目錄結構

```
src/
  App.tsx                       # 路由配置
  main.tsx                      # 入口，全量載入舊 css/*.css
  pages/                        # 各個頁面（前台 Equipment／Space／RentalList…、後台 Admin*Page）
  components/
    layouts/                    # Header、Footer、MainLayout
    equipment/                  # 實際使用的 EquipmentCard / EquipmentGrid
    cart/                       # CartList、DateEditDialog
    common/                     # Toast、ConfirmDialog、BookingDetailsDialog
    space/                      # ClassroomList、SpaceAreaMap
    profile/                    # ExtendDialog、ChangePickupDialog（公休改取件日）
    admin/                      # 後台共用 UI 語彙（adminUi）、OrderActionDialog、MfaGate（2FA 關卡）
  contexts/                     # AuthContext、DateSelectionContext
  hooks/                        # useCart、useConfirmDialog、useOrderSubmission、useCartValidation
  stores/bookmarkStore.ts       # Zustand 收藏 store
  stores/langStore.ts           # 前台中／EN 切換（useT），後台只有中文
  services/                     # Supabase 存取層（supabase client、auth、orders、equipment、space、admin…）
  utils/                        # authTypes、authStorage、storageKeys、timeUtils、gradeUtils
  data/contactInfo.ts           # 系學會聯絡資訊的項目與順序（文字從 site_content 讀）
  data/siteContent.ts           # 後台可改的欄位型文字＋內建預設（關於／聯絡方式／延期規則）
  data/siteSections.ts          # 段落型說明頁（使用教學／系學會）的內建段落與積木種類；後台拖曳排序、滑入面板編輯
  types/equipment.ts
css/                            # 舊的樣式，由 main.tsx 全量 import
public/                         # 靜態資源（Area SVG 區域圖、Images、Icons）
supabase/                       # 資料庫 SQL（schema、RPC、pg_cron、各次變更；在 Supabase SQL Editor 執行）
docs/rental-rules.md            # 租借規則單一事實來源（改租借邏輯前必讀）
docs/roadmap.md                 # 完成路線圖（階段 1-6 與任務清單）
docs/supabase-backend-plan.md   # 後端定案與接線規劃（Supabase）
docs/sa-discussion.md           # 待與系學會討論的規則（開會用，決議後回寫 rental-rules）
docs/google-login-setup.md      # 學校 Google 登入的 Google Cloud／Supabase 一次性設定步驟
docs/drive-upload-setup.md      # 大量訂單核對單存學會 Drive 的 Apps Script 部署步驟
docs/bookmark-system.md         # 收藏系統設計文檔
```

## 常用指令

```bash
npm run dev        # Vite dev server，port 3000，自動開瀏覽器
npm run build      # tsc 型別檢查 + vite build → dist/
npm run preview    # 預覽 production build
npx tsc --noEmit   # 僅型別檢查，不產生檔案
npm test           # vitest 單元測試（timeUtils／gradeUtils／useCart／useCartValidation）
```

## 遷移背景

原本是純 HTML/JS 靜態站（根目錄 `*.html`＋`js/*.js`），已全部遷移成 React SPA 並刪除舊檔。
入口 `index.html` → `src/main.tsx` → `App.tsx`；`vite.config.ts` 的 `appType: 'spa'` 讓 `/space` 等路徑 fallback 到 `index.html`。
遷移前備份（`legacy/`、`old-html-backup/`）2026-10-27 已刪，舊站原貌在 commit `3e86295`。

## 認證流程

- **登入狀態**：`localStorage.sccd_login_data`（記住我）或 `sessionStorage.sccd_login_data`（僅此次）；
  Supabase 憑證（`sb-*`）也跟著放同一邊（`services/supabase.ts` 自訂 storage＋`persistAuth`），沒勾記住我關分頁即真的登出
- **過期**：閒置效期 30 天——每次開 app 把 `loginTime` 續成現在，`loginTime + expiresIn < now` 才過期，過期連 Supabase 一起登出；
  app 資料在但 Supabase 憑證已沒了也視為登出。**admin 例外**（2026-11-06，後台在學會共用電腦上用）：登入起算固定 12 小時、不續期，分頁開著也會到期
  （`authStorage.isLoginExpired`＋`AdminLayout` 每分鐘檢查，導回 `/?expired=1` 顯示提示）；真正的防線在 `user_role()`（`supabase/admin-session-limit.sql`，看 `auth.sessions.created_at`）。
  **後台 2FA**（2026-11-07 先關閉：`AdminRoute` 的 `MFA_ENABLED`＋`supabase/admin-session-limit.sql` 的 aal 那行，上線前決定要不要開回來，見 roadmap）：帳密或 Google 登入後由 `AdminRoute` 的 `components/admin/MfaGate` 接手（Supabase TOTP，免費；第一次顯示 QR 綁定，之後輸入 6 位數驗證碼），`user_role()` 要求 JWT `aal2`，只過第一步拿不到後台權限。
  **後台分權**（2026-11-08）：最高權限＝`role=admin`（`sccdsa`），整個後台；學會成員＝會員管理標「系學會」（`staff_members`，`students.role` 仍是 student，借東西的規則照舊）用自己的帳號，只能用側欄「值班」（訂單、A5F 編號區、通知），不限同時登入的裝置數。
  判斷都在 `supabase/operator-access.sql`：`backend_access()`（admin／operator／expired／none，學會成員同樣登入滿 12 小時失效）、值班 RPC 開頭的 `operator_handler`（學會成員的經手人強制記本人）、值班頁讀資料走 `operator_*` RPC。**不要為了值班頁開 `orders`／`students` 的 RLS**：`fetchMyOrders` 靠 RLS 篩，開了學會成員自己的訂單頁會撈到所有人的單。前端 `AdminRoute`（`AdminOnly` 包「設定」路由）與 `AdminLayout` 依 `role` 隱藏「設定」，學會成員從 Profile 左選單「後台」進來。
  登出用 `scope: 'local'` 只登出這台。後台帳號改用學會 Gmail 登入、換屆交接見 `docs/google-login-setup.md`
- **登入實作**（2026-10-24 改學校 Google 帳號）：學生按「使用學校 Google 帳號登入」→ `signInWithGoogle` 導去 Google →
  跳回首頁由 `HomePage` 呼叫 `AuthContext.finishGoogleLogin` 撈 profile；資格在 DB trigger 把關（`supabase/google-login.sql`：
  網域 gm／gm1／gm2.usc.edu.tw，**且學號或 Email 要先在後台會員管理「新增會員」登記過**＝`login_allowlist`，`members-v2.sql`，2026-10-25 改封閉名單，不再依學號格式自動放行），
  第一次登入自動建學生資料（年級／班別由學號給初值、姓名用 Google 名字）。不另寄驗證信——Google 登入本身即驗證。
  登入頁預設 Google（學生與後台都走這條，2026-11-09 定），學號＋密碼（`supabaseLogin`）退為「學號密碼登入」小連結當備援；不做 SMTP、沒有忘記密碼，`sccdsa` 的密碼到 Supabase 後台重設。
  Supabase 已開 Google provider、接上 OAuth 用戶端（2026-11-10 確認），**還沒用真實帳號實測**（docs/google-login-setup.md「E. 測試」）。LINE／IG 內建瀏覽器會被 Google 擋，登入頁會提示。
  舊的 mock 登入已移除，認證共用型別留在 `utils/authTypes.ts`
- **保護路由**：目前僅 `/profile` 包在 `ProtectedRoute` 中，其他路由都是公開的

## Storage Key 對照

| Key | 用途 |
|---|---|
| `sccd_login_data` | 登入資料（同時存於 local + session） |
| `sccd-rental-cart_{studentId}` | 購物車，依學號分開（注意前綴 `-` 不是 `_`）；訪客沒有購物車（`cartHelpers.cartKey`） |
| `sccd_booking_details_{studentId}` | 購物車各單的借用資訊（同上依學號分開） |
| `sccd_equipment_dates` | 設備日期選擇（24h 過期） |
| `sccd_space_dates` | 空間日期選擇（24h 過期） |
| `sccd_bookmarks` 或 `sccd_bookmarks_{studentId}` | 收藏（依是否登入） |
| `sccd_admin_handler` | 後台上次選擇的值班經手人（`ADMIN_HANDLER_KEY`） |
| `sccd_google_pending` | sessionStorage：Google 登入進行中（值＝記住我 1／0），跳回首頁後即刪 |
| `sccd_lang` | 前台介面語言（`zh`／`en`，zustand persist） |
| `sccd_catalog_entered` | sessionStorage：型錄頁卡片進場動畫這個分頁已播過，再進來不重播 |

## 日期選擇邏輯

`DateSelectionContext` 同時管理「設備日期」與「空間日期」，各自又有 `littleDates`（小量）與 `massDates`（大量）兩組。`bookingType` 可為 `little`、`mass-personal`、`mass-group`。超過 24 小時未送單會自動清除過期的日期選擇。

## 租借規則（改租借邏輯前必讀）

業務規則的單一事實來源是 **`docs/rental-rules.md`**——包含三種 bookingType 在設備／空間頁的 UI 對應表、押金「即時擋 vs 結算 cap」分工、數量與天數上限、逾期罰款等，以及每條規則在程式裡的位置。規則的權威來源（系學會使用說明 Google 文件）連結也在該文件開頭。

最容易踩的坑：空間頁的 Group 團體對應 `mass-group`、設備頁的 Mass 大量對應 `mass-personal`，兩者押金與豁免邏輯不同——動這些判斷前先讀 rental-rules.md 第 1、4 節。

## 後端（Supabase，已接線）與尚未完成 → 見 docs/roadmap.md

整體現況（2026-07）：**階段 1 後端接線已完成**——登入（學號→email→Auth）、訂單（`submit_orders` RPC transaction）、庫存扣減、空間佔用、通知、延期全部走 **Supabase**（Auth + PostgreSQL + RLS）。資料庫端 SQL 在 `supabase/`（schema、seed、auth-setup、orders-rpc），前端統一走 `src/services/`（supabase client、equipment、space、orders、notifications、auth）。環境變數 `.env`（範本 `.env.example`）。

**改後端注意**：規則把關（庫存互斥、空間衝突、押金、流水號、會費、一類別一張）都在 `submit_orders` RPC 的 transaction 內，前端檢查只是 UX；動資料表結構（含改名）前先全域搜尋引用。plpgsql 的 `if` 條件裡 `case` 要加括號，不然第一個 `then` 會被當成 if 的 then。剩餘階段（管理後台 → 規則補完 → 品質 → 手機版 → 部署）與任務清單在 **`docs/roadmap.md`**。摘要：

- **階段 2 管理後台**：進行中。自建 `/admin`（`AdminLayout` 側欄兩組〔小字組名＋icon 膠囊，同前台 Profile；後台只有中文；左上「SCCDSA／Booking 後台」兩行＋今天日期，與各頁標題同高（pt-10，不跟前台 Header 對齊）〕：值班＝訂單（上方各狀態數量，原總覽 2026-10-24 拿掉）／A5F 編號區（原名空間地圖，教室不列）／通知（2026-11-02 從左上鈴鐺改成獨立頁 `/admin/notifications`：清單由 AdminLayout 抓、Outlet context 傳入，標題右「全部已讀」鈕；側欄 icon 有未讀粉紅點）；設定＝設備管理／空間管理／會員管理〔含系學會＝經手人名單〕／文字內容〔2026-11-02 加、11-03 段落化：使用教學／系學會＝段落清單拖曳排序＋右側滑入面板改標題與積木（`site_sections` 表，`supabase/site-sections.sql`，整頁一次儲存）；關於／聯絡方式／延期規則仍是固定欄位（`site_content`），清空＝回內建〕／營業時間〔2026-10-26 改版：左「假期 & 休息日」月曆整合休息日／法定假日（自動匯入）／寒暑假封鎖，點日期開小視窗新增或刪除；右值班時間表 週一～五 × 午班／晚班、每格 1～5 位系學會（還沒啟用的也能排，`supabase/pending-staff.sql`），編輯→確定一次寫入；規則見 docs/admin-hours.md〕）已上線——訂單全覽、收押金、整單歸還＋罰款、值班經手人追溯、公休日／封鎖維護皆完成；代客延期、拆單、代取消、助教直借、畢業生停用亦已完成（清單見 roadmap.md；手動建單 2026-10-04 定案不做）。admin 帳號學號 `sccdsa`。
  後台通知（2026-11-02）：學生送單／改品項／延期／取消由 `orders` trigger 發給 admin（`supabase/admin-notifications.sql`），
  側欄鈴鐺（`NotificationPanel` 與前台共用）點一則跳 `/admin/orders?student=學號`。
- **階段 3 規則補完**：已完成。2026-11-07 落地學會決議（`supabase/rules-2026-11.sql`，執行順序在檔頭）：起租日最遠 30 天、一類別一張、設備天數依年級（大五大六）、已繳未取件自動取消＋退押金、公休改取件日、公休分時段、老師名義與證明檔（私有 bucket `proofs`）、系學會費、罰款由學會填、F 區。grade 慣例見 rental-rules.md「年級限制」。
- **階段 4 品質**：測試已有基礎（vitest：`timeUtils`／`useCart`／`useCartValidation`，`npm test`）；tech debt、零散 TODO 仍在。
- **訂單生命週期**：情境 1／6／7（逾時取消、逾期標記罰款、停權）已定案實作——pg_cron 三排程，見 `docs/order-lifecycle.md`。公休集合（`fetchClosedDates`）裡，整天＝日期、只休一班＝`日期:noon`／`日期:evening`（`timeUtils.closedKey`）。
- **部分時段可借用**（2026-11-02）：設備卡（含整組，看零件逐日）／地圖格／教室依「你選的區間逐日夠不夠」分綠／橘／粉（設備看卡片上填的數量，最好的一天可借幾件＝數量上限；同類型有未歸還單時日期列會清掉已存的日期），橘的點加入開 `components/common/PartialDialog`
  選一段（依日期順序、預設第一段），該類日期改成那段、清單同類品項一起改（同類型限一單，不開第二張）。SQL：`partial-availability.sql`（兩支逐日 RPC；沒執行時前端自動退回整段判定）。
- **階段 5 RWD 與手機版**：前台 RWD 與手機版面 2026-11-06 完成（Equipment／Space／RentalList／Profile、導覽、日期列、地圖格子清單），待實機驗收；後台只做桌面 RWD，不做手機版，1280px 待人工確認。標準見下方「手機版（RWD）標準」，清單見 roadmap.md。
- **階段 5.5 無障礙**（2026-11-02 加）：至少鍵盤可操作——Calendar 日期格／地圖格／訂單卡等 16 處可點非按鈕元素、對話框焦點管理、全站 focus-visible、Toast aria-live；清單見 roadmap.md。
- **階段 6 部署**：維持 Vercel（`vercel.json`）＋環境變數、正式資料填入。

## 手機版（RWD）標準

- **範圍**（2026-11-06 定）：前台先做 RWD，再調手機版面；後台只做桌面 RWD，不做手機版。
- **斷點**：以 Tailwind 的 `md`（768px）為手機／桌機分界，桌面內的寬度差異用內建 `lg`／`xl`，不另設自訂斷點。Equipment／Space／日期列的左欄版面 `lg` 以上才有，以下分類移到上方；清單頁摘要 `lg` 以下併入同一欄。
- **寫法**：手機覆寫一律用 `max-md:`／`max-lg:`，桌機 class 不動（改動最小、不會誤傷桌機）。Tailwind v4 的 `hover:` 只在有滑鼠的裝置生效，不用另外處理觸控黏住。
- **清單列**：`EquipmentGrid`／`ClassroomList` 用 `card:` 變體（`src/index.css`，容器 < 940px 改卡片），看容器寬不看視窗。父層要有 `@container`，且不要放在含 `fixed` 子元素（全螢幕圖片）的外層，container 會變成 fixed 的定位基準。
- **模式**：優先用響應式 class 寫成單份 JSX（參考 `HomePage` 登入頁）。差太多的區塊才用「同頁兩份 JSX」——桌機 `hidden md:block`／`md:flex`、手機 `md:hidden`（參考 `BookingResourcesPage`）；`hidden` 只是 CSS 隱藏，兩份都會 mount，自己抓資料的元件（如 `EquipmentGrid`）不要用這招，改用 `matchMedia` 只 mount 一份。
- **字級**（2026-11-06 定）：手機另有一組字級，在 `src/index.css` 的 `@media` 覆寫 token（18／20／24／28／40），12／14／16 內文不動；元件照寫 `text-*` 就好，排版真的塞不下才加 `max-md:text-*`。手機輸入框固定 16px，否則 iOS 聚焦會放大整頁。
- **收合**（2026-11-06 定）：桌機一次呈現、手機可收起的內容用 `Collapse` 的 `below="md"`／`"lg"`（純 CSS，以上永遠展開）。目前有圖例（標題列「狀態」鈕）、使用教學段落、日期列（選完日期自動收，只留起訖日與類型）；設備卡片用 `card:` 變體收合，一次展開一張，收著仍可直接加入清單。**警示、缺貨與送出條件不收**，學生要看得到為什麼不能送出。
- **日曆**：`Calendar` 內部用 `hooks/useIsMobile`，手機自動單月，呼叫端不用傳 prop。排列差異用 CSS 就好，`useIsMobile` 只給渲染內容不同的地方。
- **觸控**：hover-only 的互動（tooltip、hover 預覽）必須有觸控替代；可點擊目標最小 44×44px，icon 鈕接 `TAP`（`components/common/btn.ts`，撐大點擊範圍但版面不變）。A5F 地圖格子手機上點不到（玻璃牆最窄 2.4px），`lg` 以下由 `SpacePage` 的格子清單代替，雙指縮放用瀏覽器原生。
- **驗證寬度**：手機以 375px 為基準寬度檢查，後台以 1280px 為最窄桌面寬度，橫向都不得出現頁面級卷軸。自動截圖不要登入 `sccdsa` 開 `/admin`：2FA 未綁定時每次載入都會重建未驗證的 factor，後台版面由人工確認。

## 已知 Tech Debt

- **過大頁面／元件**：`ProfilePage`、`SpacePage`、`RentalListPage`、`DatePickerBar`、`CartList` 皆 700–820 行，做手機版動到時順手拆 hook。
- **`DateSelectionContext` 複雜度**：一個 context 同時管設備／空間日期，可拆成兩個 context 降低耦合與 re-render。
- **CSS 雙軌並行**：Tailwind v4 與舊 `css/*.css`（約 1470 行）共存，長期可漸進遷移。
- ~~**Bundle 過大**~~：已用 `React.lazy` 做路由層 code-splitting（`App.tsx`），`jspdf`+`html2canvas` 改在下載收據時動態 import。
- ~~**Storage key 命名混用**~~：已抽 `utils/storageKeys.ts`（receipts／notifications）與 `utils/authStorage.ts`（登入）集中管理。

## 程式風格規則

- 註解以繁體中文為主，符合既有慣例。
- **前台文字中英分開**：不要再寫「Login 登入」並列，一律 `const t = useT()` 後 `{t('Login', '登入')}`（也可傳 JSX）；
  Footer 的 language icon 切換、預設中文。後台 `/admin` 與 PDF 收據不切換。
  設備、組合、教室的名稱用 `useItemName()`（`equipmentService`，依 id 查 `en_name`，空白退回中文）：訂單與購物車存的是中文名快照，不要直接顯示 `item.name`。
- **提示文字（Toast、ConfirmDialog、alert、錯誤訊息）一律中英兩版、各自維護**（2026-10-23 定）：
  元件內用 `t(英, 中)`、ConfirmDialog 的 `messageEn`；hook／service／事件裡用 `tr(英, 中)`（`stores/langStore`，讀當下語言）。
  SQL `raise exception` 維持中文，英文在 `utils/serverErrors.ts` 對照——**新增或修改學生會看到的 server 錯誤時，那裡要一起加英文**。
  新寫的提示文字直接附英文；既有英文由使用者校稿後可直接改。
- **說明文字不寫死在元件裡**（2026-11-02 定，2026-11-03 分兩層）：
  段落型頁（ⓘ 使用教學／系學會）走 `site_sections`——一頁一串段落，一段＝標題＋一串積木（段落／編號條列／項目＋說明／連結／聯絡方式，存 `blocks` jsonb）；
  後台段落清單拖曳排序、點一列右側滑入面板改標題與積木（積木也拖曳、增刪），標題顯示時自動編號；內建段落在 `data/siteSections.ts`，前台 `SectionsContent` 用 `useSiteSections(page)`。
  欄位型（關於／聯絡方式／延期規則）走 `site_content`：在 `data/siteContent.ts` 加 key（含中英內建預設），元件用 `useSiteContent()`；條列用 `zipLines`。
  Toast／錯誤訊息等綁行為的提示文字不走這套。
- 檔頭常有 `/** 功能說明 */` 區塊註解。
- 路徑 alias：`@/*` → `src/*`。
- TypeScript 設定為 `strict: true`，並啟用 `noUnusedLocals` 與 `noUnusedParameters`，build 時型別錯誤會擋住。
- **hover 一律即時變化，不加 fade**（2026-10-23 定）：hover 變色／變透明不要寫 `transition-colors`、`transition-opacity`、`transition`；
  非 hover 的動畫照常（展開收合、刪除淡出、選取模式位移、chevron 旋轉、圖片 hover 放大這類 transform）。
- **按鈕狀態一律接 `BTN`**（`components/common/btn.ts`，2026-10-31 定，前後台同）：hover 整顆 50%、停用整顆 20%，不另寫 hover／disabled class；
  **hover 50% 只給沒有 active 狀態的 CTA；灰底鈕（`bg-gray-dark`）接 `BTN_INVERT`，hover 直接顯示 active 的樣子＝白底黑字**（2026-11-09 定：`toolBtn`／`textBtn`、`filled` 下拉、日期鈕、分頁膠囊、`BTN_TOOL`；停用同 20%，開著／選中時也是白底黑字）；灰框的表單下拉同理，hover＝展開時的白框；
  工具鈕（icon＋文字灰底 chip）加 `BTN_TOOL`；多選／分類膠囊走 `navItemCls`（未選中 hover 白字＋white/10 底）。
  **線框鈕（白線白字）接 `BTN_OUTLINE`，hover 反白＝白底黑字**（2026-11-02 定；整顆變淡會像快停用）：借的是「選中」的白底黑字語彙，
  所以只給動作型（後台 `actionBtn`、購物車「＋ 新增」、型錄 − ＋），toggle 不用；連結版（登入頁兩張卡）自己寫 `hover:bg-white hover:border-white hover:text-black`。
  **有 active 狀態的按鈕，active 時不加 hover**（2026-11-02 定）：選中的膠囊、目前所在頁的 icon（Footer /profile 頭像、Header /cart）、
  開著下拉／彈出清單的開關鈕（Header 通知鈴、Footer 連結）——寫 `${active ? 'cursor-pointer' : BTN}`；沒有 active 狀態的按鈕照常接 `BTN`；
  `<a>` 沒有 :enabled 直接寫 `hover:opacity-50`；仍可點、點了跳提示的 aria-disabled 鈕自己寫 `opacity-20 cursor-not-allowed`。Profile 訂單卡整列 hover 反白是卡片不是按鈕，維持。
- **顏色只用 `src/index.css` `@theme` 的 token**（2026-11-01 定，前後台同一套；`--color-*: initial` 已關掉 Tailwind 預設色盤，寫 `text-zinc-400` 會沒效果、build 不擋）：
  黑白＋四階灰 `gray-light`（輔助文字）／`gray-mid`（線、框、佔位）／`gray-dark`（灰鈕、chip、tooltip、選單 hover 底，2026-11-02 加，前後台灰鈕同這個）／`gray-darker`（面板底）；狀態色 `green`／`pink`（品牌粉）／`error`／`yellow`／`orange`／`cyan`，意義表在 token 註解。
  不寫 hex、不寫 `text-[#…]`；inline style 用 `var(--color-xxx)`。透明層只給疊在別的東西上的（表格列 hover、鈕上的計數徽章、遮罩），只有 `white/10`、`white/50`、`black/80`；鈕／chip 本身的底是「一個東西」，用 `gray-dark` 不用 `white/10`；地圖可借用＝`green/50`。
  有色底的 chip 一律黑字。舊 `css/colors.css` 與 `.text-gray-scale*` 已刪，`hover:text-white` 不用再加 `!`。
- **圓角三級**（2026-10-22 定）：`rounded-lg` 8px＝按鈕、chip、左側選單膠囊（chip 一律用 `components/common/btn.ts` 的 `CHIP`：
  h-6／px-2.5／text-2xs，2026-11-01 收斂，前後台同；底色字色各處自己給，有 icon 加 `!pl-1.5 gap-1`）；
  `rounded-xl` 12px＝tooltip（待繳押金 ⓘ）、地圖說明框與覆蓋提示、後台大縮圖（Toast 2026-11-01 改 8px，表格小縮圖 6px 改 8px）；
  `rounded-2xl` 16px＝彈窗（ConfirmDialog／InfoDialog 等 lightbox）與下拉選單、訂單卡片，以及登入頁高 56px 以上的大按鈕／輸入框。
- **下拉選單一律用 `components/admin/adminUi` 的 `Select`，不寫原生 `<select>`**（2026-11-02 定，前後台同；原生展開的清單改不了樣式）：
  表單用預設（透明底灰框，跟容器底色）、工具列用 `filled`、卡片列裡的小下拉用 `size="xs"`，選項多的加 `searchable`。
- **前面有 icon 的按鈕／選項，icon 那側 padding 少 4px**（例：`pl-3 pr-4`，參考 ProfilePage 左側選單）：
  Material Symbols 的圖形四周自帶約 2–4px 留白，數值等距看起來會偏寬；同 Material 3 按鈕規格（有 icon 側 16dp、另一側 24dp）。
  補償放在外框 padding，不要用 icon 負邊距。
- **舊 `css/*.css` 不可再定義與 Tailwind 同名的 class**（如 `.cursor-pointer`、`.opacity-30`）：未分層的規則永遠蓋過
  Tailwind 的 `disabled:`／`hover:` 變體（2026-10-22 停用按鈕仍顯示 pointer 即此因，booking.css 已刪）。
- **英文字距**（2026-10-27 定，2026-11-01 補 EN 模式）：有英文就要有字距（Inter 官方 Dynamic Metrics，`src/index.css` 依字級 token 給 `--tracking-en`），中文不套。
  中文模式：純英數元素（含日期、金額、單號、學號、英數輸入框）一律寫 `font-english`；中英混排的容器標 `font-chinese`、裡面的英數再包 `font-english`。
  EN 模式：`html[lang="en"]` 全域套字距、不必逐個加；`font-chinese` 子樹與 icon 除外——所以會隨語言切換的文字（t／tr）不要標 `font-chinese`，
  `font-chinese` 只給 DB 中文資料與寫死的中文。後台 `AdminLayout` 把 `<html lang>` 固定 zh-TW。舊的 `font-['Inter',…]` 寫法已全數移除，不要再寫。
