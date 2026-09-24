# SCCD Booking

實踐大學 SCCD（實踐媒體傳達設計系）設備與空間租借系統。學生可預約設備、教室、以及 A5F 編號區域空間。使用者介面為繁體中文。

## Stack

- **React 18** + TypeScript (strict mode) + Vite 5
- **React Router v7** — SPA 路由
- **Zustand** — 收藏（bookmark）狀態
- **Tailwind CSS v4** (`@tailwindcss/vite`) 共存於舊的 `css/*.css` 檔案
- **動畫**：GSAP（唯一動畫庫，舊的 framer-motion／animejs 已移除）
- **其他**：jspdf、html2canvas（僅 OrderPage 使用）

## 目錄結構

```
src/
  App.tsx                       # 路由配置
  main.tsx                      # 入口，全量載入舊 css/*.css
  pages/                        # 各個頁面（BookingPage、EquipmentPage、SpacePage 等；後台為 Admin*Page）
  components/
    ProtectedRoute.tsx、AdminRoute.tsx  # 登入／admin 路由守衛（僅 UX，真防線是 RLS）
    layouts/                    # Header、Footer、AdminLayout（後台側欄）
    equipment/                  # EquipmentGrid
    cart/                       # CartList、DateEditDialog
    common/                     # Toast、ConfirmDialog、BookingDetailsDialog
    space/                      # ClassroomList、SpaceAreaMap
    profile/                    # ExtendDialog
    admin/                      # 後台共用 UI 語彙（adminUi）、OrderActionDialog
  contexts/                     # AuthContext、DateSelectionContext
  hooks/                        # useCart、useConfirmDialog、useOrderSubmission、useCartValidation、useSuspension
  stores/bookmarkStore.ts       # Zustand 收藏 store
  services/                     # Supabase 存取層：supabase client、auth、equipment、space、orders、notifications、admin
  utils/                        # authTypes（認證型別）、authStorage、storageKeys、timeUtils、orderValidation（重複下單前端提示）、gradeUtils
  data/equipment-data.json      # 設備主資料（包含庫存、分類）
  types/equipment.ts
css/                            # 舊的樣式，由 main.tsx 全量 import
js/                             # 舊靜態版本的 JS（已不再由新架構使用，可逐步移除）
Images/、Icons/                 # 靜態資源（已移入 public/）
public/Area/                    # SVG 區域圖
legacy/                         # 遷移前備份（已 gitignore）
old-html-backup/                # 舊 HTML 備份（已 gitignore）
docs/rental-rules.md            # 租借規則單一事實來源（改租借邏輯前必讀）
docs/roadmap.md                 # 完成路線圖（依性質分類的待辦＋已完成紀錄）
docs/order-lifecycle.md         # 訂單生命週期情境（逐項定案紀錄）
supabase/                       # 資料庫 SQL（schema、seed、RPC、pg_cron 排程、RLS）
docs/supabase-backend-plan.md   # 後端定案與接線規劃（Supabase）
docs/bookmark-system.md         # 收藏系統設計文檔
```

## 常用指令

```bash
npm run dev        # Vite dev server，port 3000，自動開瀏覽器
npm run build      # tsc 型別檢查 + vite build → dist/
npm run preview    # 預覽 production build
npx tsc --noEmit   # 僅型別檢查，不產生檔案
npm test           # vitest 單元測試（timeUtils／useCart／useCartValidation／orderValidation）
```

## 遷移狀態（重要背景）

此專案正在從純 HTML/JS 靜態站點遷移到 React SPA。歷史上根目錄曾有 `booking.html`、`login.html`、`equipment.html` 等多頁，對應 `js/*.js`。目前：

- **已遷移**：Home、Booking、BookingResources、Equipment、Space、RentalList、Profile、Order、About、ResetPassword
- **已刪除**：所有根目錄的 `*.html`、多數 `js/*.js`（git status 中列為 D）
- **新入口**：`index.html` → `src/main.tsx` → `App.tsx`
- **SPA fallback**：`vite.config.ts` 的 `appType: 'spa'` 確保 `/space`、`/equipment` 等路徑 fallback 到 `index.html`
- **下一步**：前台已接 Supabase、後台已起步；剩餘工作見下方「後端與尚未完成」一節與 `docs/roadmap.md`。

`legacy/` 與 `old-html-backup/` 皆為遷移前備份，兩者都已 gitignore。

## 認證流程

- **登入狀態**：`localStorage.sccd_login_data`（記住我）或 `sessionStorage.sccd_login_data`（僅此次）
- **過期**：`loginTime + expiresIn < now` 即視為過期，自動清除
- **登入實作**：`AuthContext` 走 `services/authService.ts` 的 `supabaseLogin`（學號→email→Supabase Auth）；
  舊的 mock 登入（`testAuthData.ts`／`mockApiLogin`）已移除，認證共用型別留在 `utils/authTypes.ts`
- **保護路由**：`/profile` 包在 `ProtectedRoute`；`/admin/*` 包在 `AdminRoute`（admin 登入自動導向 `/admin`）；其他路由公開
- **角色**：`students.role` 為 `student`／`admin`／`staff`（staff＝助教直借，尚未實作）

## Storage Key 對照

| Key | 用途 |
|---|---|
| `sccd_login_data` | 登入資料（同時存於 local + session） |
| `sccd-rental-cart` | 購物車（注意 `-` 不是 `_`） |
| `sccd_equipment_dates` | 設備日期選擇（24h 過期） |
| `sccd_space_dates` | 空間日期選擇（24h 過期） |
| `sccd_bookmarks` 或 `sccd_bookmarks_{studentId}` | 收藏（依是否登入） |
| `sccd_favorites_equipment` / `sccd_favorites_classroom` | 舊的收藏 key（legacy-bridge 使用） |
| `sccd_notifications_{studentId\|guest}` | 通知（`notificationsKey`） |
| `sccd_read_notifications_{studentId\|guest}` | 已讀通知（`readNotificationsKey`） |
| `sccd_admin_handler` | 後台上次選擇的值班經手人（`ADMIN_HANDLER_KEY`） |
| `sccd_admin_order_cols` | 後台訂單表格欄位順序（`ADMIN_ORDER_COLS_KEY`） |

## 日期選擇邏輯

`DateSelectionContext` 同時管理「設備日期」與「空間日期」，各自又有 `littleDates`（小量）與 `massDates`（大量）兩組。`bookingType` 可為 `little`、`mass-personal`、`mass-group`。超過 24 小時未送單會自動清除過期的日期選擇。

## 租借規則（改租借邏輯前必讀）

業務規則的單一事實來源是 **`docs/rental-rules.md`**——包含三種 bookingType 在設備／空間頁的 UI 對應表、押金「即時擋 vs 結算 cap」分工、數量與天數上限、逾期罰款等，以及每條規則在程式裡的位置。規則的權威來源（系學會使用說明 Google 文件）連結也在該文件開頭。

最容易踩的坑：空間頁的 Group 團體對應 `mass-group`、設備頁的 Mass 大量對應 `mass-personal`，兩者押金與豁免邏輯不同——動這些判斷前先讀 rental-rules.md 第 1、4 節。

## 後端（Supabase，已接線）與尚未完成 → 見 docs/roadmap.md

整體現況（2026-09 更新）：**後端接線已完成**——登入（學號→email→Auth）、訂單（`submit_orders` RPC transaction）、庫存扣減、空間佔用、通知、延期全部走 **Supabase**（Auth + PostgreSQL + RLS）。資料庫端 SQL 在 `supabase/`（schema、seed、auth-setup、orders-rpc、auto-cancel／auto-overdue／account-suspension 排程、rental-blackouts、staff-members），前端統一走 `src/services/`。環境變數 `.env`（範本 `.env.example`）。

**改後端注意**：規則把關（庫存互斥、空間衝突、押金、流水號、重複下單、寒暑假封鎖、停權）都在 `submit_orders` RPC 的 transaction 內，前端檢查只是 UX；RPC 以 `raise exception` 回傳中文原因，前端直接顯示給使用者，所以訊息要寫成學生看得懂的話。動資料表結構（含改名）前先全域搜尋引用。

**剩餘工作依性質分類，完整清單在 `docs/roadmap.md`**（2026-09 重整）：

- **🗣 流程討論**（需與團隊定案）：大量單事後加設備、大單拆分規則、前台部分延期介面、損壞賠償分級、購物車跨裝置同步。
- **🛠 後台功能**（規則已定、可直接做）：代取消、代客延期、軟性欄位就地編輯、帳號狀態調整、手動建單、庫存管理、助教直借（staff）、小單拆單。
- **🐞 驗收與 Bug**：桌面版整體驗收（三個測試帳號互搶等場景）尚未跑；已知：設備頁無「部分可借」狀態。
- **📱 UI／手機版**：Equipment／Space／RentalList／Order／Profile／Footer 及大型對話框仍只有桌機版。
- **🧹 程式品質**：拆大檔、`DateSelectionContext` 拆分、CSS 雙軌（見下方 Tech Debt）。
- **🚀 部署**：Vercel＋環境變數、正式資料填入、照 rental-rules 逐條驗收。

已完成：後端接線、訂單生命週期排程（情境 1／6／7）、規則補完（30 天例外、A508、停權、延期前三天、重複下單、寒暑假封鎖）、後台的訂單全覽／收押金／歸還罰款／經手人／公休日／封鎖。

## 手機版（RWD）標準

- **斷點**：以 Tailwind 的 `md`（768px）為手機／桌機唯一分界，不另設自訂斷點。
- **模式**：複雜頁面採「同頁兩份 JSX」——桌機 `hidden md:block`／`md:flex`、手機 `md:hidden`（參考 `BookingPage`、`HomePage`、`BookingResourcesPage` 既有做法）；簡單版面優先用響應式 class 寫成單份 JSX（參考 `AboutPage`）。
- **日曆**：`Calendar` 已有 `isMobile` prop（單月顯示），手機版直接傳 `isMobile={true}`。
- **觸控**：hover-only 的互動（tooltip、hover 預覽）必須有觸控替代；可點擊目標最小 44×44px。
- **驗證寬度**：手機以 375px 為基準寬度檢查，橫向不得出現頁面級卷軸。

## 已知 Tech Debt

- **過大頁面／元件**：`SpacePage.tsx`（826 行）、`CartList.tsx`（746 行）、`OrderPage.tsx`（743 行）、`RentalListPage.tsx`（736 行）、`ProfilePage.tsx`（713 行）仍可續拆 hook。
- **`DateSelectionContext` 複雜度**：一個 context 同時管設備／空間日期，可拆成兩個 context 降低耦合與 re-render。
- **CSS 雙軌並行**：Tailwind v4 與舊 `css/*.css`（約 1600 行）共存，長期可漸進遷移。
- **零散 TODO**：延長線佔位圖、設備部分可借（黃色 partial）狀態（`EquipmentGrid.tsx`）、`ProfilePage` 狀態圓點。
- ~~**Bundle 過大**~~：已用 `React.lazy` 做路由層 code-splitting（`App.tsx`），`jspdf`+`html2canvas` 隨 `OrderPage` 分離出 initial bundle。
- ~~**Storage key 命名混用**~~：已抽 `utils/storageKeys.ts`（receipts／notifications）與 `utils/authStorage.ts`（登入）集中管理。

## 程式風格規則

- 註解以繁體中文為主，符合既有慣例。
- 檔頭常有 `/** 功能說明 */` 區塊註解。
- 路徑 alias：`@/*` → `src/*`、`@legacy/*` → `./*`（後者已不再需要）。
- TypeScript 設定為 `strict: true`，並啟用 `noUnusedLocals` 與 `noUnusedParameters`，build 時型別錯誤會擋住。
