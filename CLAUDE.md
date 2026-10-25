# SCCD Booking

實踐大學 SCCD（實踐媒體傳達設計系）設備與空間租借系統。學生可預約設備、教室、以及 A5F 編號區域空間。使用者介面為繁體中文。

## Stack

- **React 18** + TypeScript (strict mode) + Vite 5
- **React Router v7** — SPA 路由
- **Zustand** — 收藏（bookmark）狀態、介面語言（`stores/langStore.ts`）
- **Tailwind CSS v4** (`@tailwindcss/vite`) 共存於舊的 `css/*.css` 檔案
- **動畫**：GSAP（唯一動畫庫，舊的 framer-motion／animejs 已移除）
- **其他**：jspdf、html2canvas（僅 Profile 訂單下載收據用，點下載時才動態載入：`components/profile/OrderReceipt.tsx`）

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
    profile/                    # ExtendDialog
    admin/                      # 後台共用 UI 語彙（adminUi）、OrderActionDialog
  contexts/                     # AuthContext、DateSelectionContext
  hooks/                        # useCart、useConfirmDialog、useOrderSubmission、useCartValidation
  stores/bookmarkStore.ts       # Zustand 收藏 store
  stores/langStore.ts           # 前台中／EN 切換（useT），後台只有中文
  services/                     # Supabase 存取層（supabase client、auth、orders、equipment、space、admin…）
  utils/                        # authTypes、authStorage、storageKeys、timeUtils、gradeUtils
  data/contactInfo.ts           # 系學會聯絡資訊（設備資料已改由 Supabase equipment 表提供）
  types/equipment.ts
css/                            # 舊的樣式，由 main.tsx 全量 import
public/                         # 靜態資源（Area SVG 區域圖、Images、Icons）
supabase/                       # 資料庫 SQL（schema、RPC、pg_cron、各次變更；在 Supabase SQL Editor 執行）
legacy/                         # 遷移前備份（已 gitignore）
old-html-backup/                # 舊 HTML 備份（已 gitignore）
docs/rental-rules.md            # 租借規則單一事實來源（改租借邏輯前必讀）
docs/roadmap.md                 # 完成路線圖（階段 1-6 與任務清單）
docs/supabase-backend-plan.md   # 後端定案與接線規劃（Supabase）
docs/sa-discussion.md           # 待與系學會討論的規則（開會用，決議後回寫 rental-rules）
docs/google-login-setup.md      # 學校 Google 登入的 Google Cloud／Supabase 一次性設定步驟
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
`legacy/` 與 `old-html-backup/` 為遷移前備份（已 gitignore）。

## 認證流程

- **登入狀態**：`localStorage.sccd_login_data`（記住我）或 `sessionStorage.sccd_login_data`（僅此次）；
  Supabase 憑證（`sb-*`）也跟著放同一邊（`services/supabase.ts` 自訂 storage＋`persistAuth`），沒勾記住我關分頁即真的登出
- **過期**：閒置效期 30 天——每次開 app 把 `loginTime` 續成現在，`loginTime + expiresIn < now` 才過期，過期連 Supabase 一起登出；
  app 資料在但 Supabase 憑證已沒了也視為登出
- **登入實作**（2026-10-24 改學校 Google 帳號）：學生按「使用學校 Google 帳號登入」→ `signInWithGoogle` 導去 Google →
  跳回首頁由 `HomePage` 呼叫 `AuthContext.finishGoogleLogin` 撈 profile；資格在 DB trigger 把關（`supabase/google-login.sql`：
  網域 gm／gm1／gm2.usc.edu.tw，**且學號或 Email 要先在後台會員管理「新增會員」登記過**＝`login_allowlist`，`members-v2.sql`，2026-10-25 改封閉名單，不再依學號格式自動放行），
  第一次登入自動建學生資料（年級／班別由學號給初值、姓名用 Google 名字）。不另寄驗證信——Google 登入本身即驗證。
  學號＋密碼（`supabaseLogin`）給後台帳號 `sccdsa` 與有密碼的帳號；**Google Cloud／Supabase 尚未設定完成，登入頁目前預設顯示學號密碼表單**
  （`HomePage` 的 `PASSWORD_MODE_DEFAULT`，設定好後改回 false，密碼表單退為「學號密碼登入」連結）。LINE／IG 內建瀏覽器會被 Google 擋，登入頁會提示。
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
| `sccd_favorites_equipment` / `sccd_favorites_classroom` | 舊的收藏 key（legacy-bridge 使用） |
| `sccd_admin_handler` | 後台上次選擇的值班經手人（`ADMIN_HANDLER_KEY`） |
| `sccd_google_pending` | sessionStorage：Google 登入進行中（值＝記住我 1／0），跳回首頁後即刪 |
| `sccd_lang` | 前台介面語言（`zh`／`en`，zustand persist） |

## 日期選擇邏輯

`DateSelectionContext` 同時管理「設備日期」與「空間日期」，各自又有 `littleDates`（小量）與 `massDates`（大量）兩組。`bookingType` 可為 `little`、`mass-personal`、`mass-group`。超過 24 小時未送單會自動清除過期的日期選擇。

## 租借規則（改租借邏輯前必讀）

業務規則的單一事實來源是 **`docs/rental-rules.md`**——包含三種 bookingType 在設備／空間頁的 UI 對應表、押金「即時擋 vs 結算 cap」分工、數量與天數上限、逾期罰款等，以及每條規則在程式裡的位置。規則的權威來源（系學會使用說明 Google 文件）連結也在該文件開頭。

最容易踩的坑：空間頁的 Group 團體對應 `mass-group`、設備頁的 Mass 大量對應 `mass-personal`，兩者押金與豁免邏輯不同——動這些判斷前先讀 rental-rules.md 第 1、4 節。

## 後端（Supabase，已接線）與尚未完成 → 見 docs/roadmap.md

整體現況（2026-07）：**階段 1 後端接線已完成**——登入（學號→email→Auth）、訂單（`submit_orders` RPC transaction）、庫存扣減、空間佔用、通知、延期全部走 **Supabase**（Auth + PostgreSQL + RLS）。資料庫端 SQL 在 `supabase/`（schema、seed、auth-setup、orders-rpc），前端統一走 `src/services/`（supabase client、equipment、space、orders、notifications、auth）。環境變數 `.env`（範本 `.env.example`）。

**改後端注意**：規則把關（庫存互斥、空間衝突、押金、流水號）都在 `submit_orders` RPC 的 transaction 內，前端檢查只是 UX；動資料表結構（含改名）前先全域搜尋引用。剩餘階段（管理後台 → 規則補完 → 品質 → 手機版 → 部署）與任務清單在 **`docs/roadmap.md`**。摘要：

- **階段 2 管理後台**：進行中。自建 `/admin`（`AdminLayout` 側欄兩組〔小字組名＋icon 膠囊，同前台 Profile；後台只有中文；左上「SCCDSA Booking 後台」＋今天日期，與各頁標題同高（pt-10，不跟前台 Header 對齊）〕：值班＝訂單（上方各狀態數量，原總覽 2026-10-24 拿掉）／A5F 編號區（原名空間地圖，教室不列）；設定＝設備管理／空間管理／會員管理〔含系學會＝經手人名單〕／營業時間〔2026-10-26 改版：左「假期 & 休息日」月曆整合休息日／法定假日（自動匯入）／寒暑假封鎖，點日期開小視窗新增或刪除；右值班時間表 週一～五 × 午班／晚班、每格 1～3 位系學會，編輯→確定一次寫入；規則見 docs/admin-hours.md〕）已上線——訂單全覽、收押金、整單歸還＋罰款、值班經手人追溯、公休日／封鎖維護皆完成；代客延期、拆單、代取消、助教直借、畢業生停用亦已完成（清單見 roadmap.md；手動建單 2026-10-04 定案不做）。admin 帳號學號 `sccdsa`。
- **階段 3 規則補完**：原四項已完成（2026-09）——空間 30 天大四／碩士例外、A508 限大二以上、重複下單 server 端、寒暑假封鎖（server 擋單＋前端日曆灰化）；之後補的延期不得延入封鎖期、同類型限一單、修改已送出設備單也已完成。剩遠期單阻擋（待學會定細則）。grade 慣例見 rental-rules.md「年級限制」。
- **階段 4 品質**：測試已有基礎（vitest：`timeUtils`／`useCart`／`useCartValidation`，`npm test`）；tech debt、零散 TODO 仍在。
- **訂單生命週期**：情境 1／6／7（逾時取消、逾期標記罰款、停權）已定案實作——pg_cron 三排程，見 `docs/order-lifecycle.md`。
- **階段 5 手機版**：Equipment／Space／RentalList／Profile 等頁目前只有桌機版，標準見下方「手機版（RWD）標準」；等桌面版驗收（階段 1.5）確認後再做。
- **階段 6 部署**：維持 Vercel（`vercel.json`）＋環境變數、正式資料填入。

## 手機版（RWD）標準

- **斷點**：以 Tailwind 的 `md`（768px）為手機／桌機唯一分界，不另設自訂斷點。
- **模式**：複雜頁面採「同頁兩份 JSX」——桌機 `hidden md:block`／`md:flex`、手機 `md:hidden`（參考 `BookingResourcesPage` 既有做法）；簡單版面優先用響應式 class 寫成單份 JSX（參考 `HomePage` 登入頁）。
- **日曆**：`Calendar` 已有 `isMobile` prop（單月顯示），手機版直接傳 `isMobile={true}`。
- **觸控**：hover-only 的互動（tooltip、hover 預覽）必須有觸控替代；可點擊目標最小 44×44px。
- **驗證寬度**：手機以 375px 為基準寬度檢查，橫向不得出現頁面級卷軸。

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
- **提示文字（Toast、ConfirmDialog、alert、錯誤訊息）一律中英兩版、各自維護**（2026-10-23 定）：
  元件內用 `t(英, 中)`、ConfirmDialog 的 `messageEn`；hook／service／事件裡用 `tr(英, 中)`（`stores/langStore`，讀當下語言）。
  SQL `raise exception` 維持中文，英文在 `utils/serverErrors.ts` 對照——**新增或修改學生會看到的 server 錯誤時，那裡要一起加英文**。
  新寫的提示文字直接附英文；既有英文由使用者校稿後可直接改。
- 檔頭常有 `/** 功能說明 */` 區塊註解。
- 路徑 alias：`@/*` → `src/*`、`@legacy/*` → `./*`（後者已不再需要）。
- TypeScript 設定為 `strict: true`，並啟用 `noUnusedLocals` 與 `noUnusedParameters`，build 時型別錯誤會擋住。
- **hover 一律即時變化，不加 fade**（2026-10-23 定）：hover 變色／變透明不要寫 `transition-colors`、`transition-opacity`、`transition`；
  非 hover 的動畫照常（展開收合、刪除淡出、選取模式位移、chevron 旋轉、圖片 hover 放大這類 transform）。
- **灰字 hover 變色一律加 `!`**：舊 `css/colors.css` 的 `.text-gray-scale*` 帶 `!important` 且不在 Tailwind layer，
  一般的 `hover:text-white` 永遠蓋不過（只會看到其他 hover 效果如變粗）——寫 `hover:!text-white`、`group-hover:!text-white`。
- **圓角三級**（2026-10-22 定）：`rounded-lg` 8px＝按鈕、chip、左側選單膠囊；
  `rounded-xl` 12px＝Toast、tooltip（待繳押金 ⓘ）、地圖說明框與覆蓋提示；
  `rounded-2xl` 16px＝彈窗（ConfirmDialog／InfoDialog 等 lightbox）與下拉選單、訂單卡片，以及登入頁高 56px 以上的大按鈕／輸入框。
- **前面有 icon 的按鈕／選項，icon 那側 padding 少 4px**（例：`pl-3 pr-4`，參考 ProfilePage 左側選單）：
  Material Symbols 的圖形四周自帶約 2–4px 留白，數值等距看起來會偏寬；同 Material 3 按鈕規格（有 icon 側 16dp、另一側 24dp）。
  補償放在外框 padding，不要用 icon 負邊距。
- **舊 `css/*.css` 不可再定義與 Tailwind 同名的 class**（如 `.cursor-pointer`、`.opacity-30`）：未分層的規則永遠蓋過
  Tailwind 的 `disabled:`／`hover:` 變體（2026-10-22 停用按鈕仍顯示 pointer 即此因，booking.css 已刪）。
