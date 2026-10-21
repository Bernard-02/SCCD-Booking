# SCCD Booking

實踐大學 SCCD（實踐媒體傳達設計系）設備與空間租借系統。學生可預約設備、教室、以及 A5F 編號區域空間。使用者介面為繁體中文。

## Stack

- **React 18** + TypeScript (strict mode) + Vite 5
- **React Router v7** — SPA 路由
- **Zustand** — 收藏（bookmark）狀態、介面語言（`stores/langStore.ts`）
- **Tailwind CSS v4** (`@tailwindcss/vite`) 共存於舊的 `css/*.css` 檔案
- **動畫**：GSAP（唯一動畫庫，舊的 framer-motion／animejs 已移除）
- **其他**：jspdf、html2canvas（僅 OrderPage 使用）

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

- **登入狀態**：`localStorage.sccd_login_data`（記住我）或 `sessionStorage.sccd_login_data`（僅此次）
- **過期**：`loginTime + expiresIn < now` 即視為過期，自動清除
- **登入實作**：`AuthContext` 走 `services/authService.ts` 的 `supabaseLogin`（學號→email→Supabase Auth）；
  舊的 mock 登入（`testAuthData.ts`／`mockApiLogin`）已移除，認證共用型別留在 `utils/authTypes.ts`
- **保護路由**：目前僅 `/profile` 包在 `ProtectedRoute` 中，其他路由都是公開的

## Storage Key 對照

| Key | 用途 |
|---|---|
| `sccd_login_data` | 登入資料（同時存於 local + session） |
| `sccd-rental-cart` | 購物車（注意 `-` 不是 `_`） |
| `sccd_equipment_dates` | 設備日期選擇（24h 過期） |
| `sccd_space_dates` | 空間日期選擇（24h 過期） |
| `sccd_bookmarks` 或 `sccd_bookmarks_{studentId}` | 收藏（依是否登入） |
| `sccd_favorites_equipment` / `sccd_favorites_classroom` | 舊的收藏 key（legacy-bridge 使用） |
| `sccd_admin_handler` | 後台上次選擇的值班經手人（`ADMIN_HANDLER_KEY`） |
| `sccd_lang` | 前台介面語言（`zh`／`en`，zustand persist） |
| `sccd_admin_order_cols` | 後台訂單表格欄位順序（`ADMIN_ORDER_COLS_KEY`） |

## 日期選擇邏輯

`DateSelectionContext` 同時管理「設備日期」與「空間日期」，各自又有 `littleDates`（小量）與 `massDates`（大量）兩組。`bookingType` 可為 `little`、`mass-personal`、`mass-group`。超過 24 小時未送單會自動清除過期的日期選擇。

## 租借規則（改租借邏輯前必讀）

業務規則的單一事實來源是 **`docs/rental-rules.md`**——包含三種 bookingType 在設備／空間頁的 UI 對應表、押金「即時擋 vs 結算 cap」分工、數量與天數上限、逾期罰款等，以及每條規則在程式裡的位置。規則的權威來源（系學會使用說明 Google 文件）連結也在該文件開頭。

最容易踩的坑：空間頁的 Group 團體對應 `mass-group`、設備頁的 Mass 大量對應 `mass-personal`，兩者押金與豁免邏輯不同——動這些判斷前先讀 rental-rules.md 第 1、4 節。

## 後端（Supabase，已接線）與尚未完成 → 見 docs/roadmap.md

整體現況（2026-07）：**階段 1 後端接線已完成**——登入（學號→email→Auth）、訂單（`submit_orders` RPC transaction）、庫存扣減、空間佔用、通知、延期全部走 **Supabase**（Auth + PostgreSQL + RLS）。資料庫端 SQL 在 `supabase/`（schema、seed、auth-setup、orders-rpc），前端統一走 `src/services/`（supabase client、equipment、space、orders、notifications、auth）。環境變數 `.env`（範本 `.env.example`）。

**改後端注意**：規則把關（庫存互斥、空間衝突、押金、流水號）都在 `submit_orders` RPC 的 transaction 內，前端檢查只是 UX；動資料表結構（含改名）前先全域搜尋引用。剩餘階段（管理後台 → 規則補完 → 品質 → 手機版 → 部署）與任務清單在 **`docs/roadmap.md`**。摘要：

- **階段 2 管理後台**：進行中。自建 `/admin`（`AdminLayout` 側欄兩段：值班＝總覽／訂單／空間地圖；設定＝設備管理／空間管理／會員管理〔含系學會＝經手人名單〕／營業時間〔公休日（新增自動發全站公告 template＋通知受影響訂單）＋法定假日（自動匯入）＋寒暑假封鎖〕）已上線——訂單全覽、收押金、整單歸還＋罰款、值班經手人追溯、公休日／封鎖維護皆完成；代客延期、拆單、代取消、助教直借、畢業生停用亦已完成（清單見 roadmap.md；手動建單 2026-10-04 定案不做）。admin 帳號學號 `sccdsa`。
- **階段 3 規則補完**：原四項已完成（2026-09）——空間 30 天大四／碩士例外、A508 限大二以上、重複下單 server 端、寒暑假封鎖（server 擋單＋前端日曆灰化）；之後補的延期不得延入封鎖期、同類型限一單、修改已送出設備單也已完成。剩遠期單阻擋（待學會定細則）。grade 慣例見 rental-rules.md「年級限制」。
- **階段 4 品質**：測試已有基礎（vitest：`timeUtils`／`useCart`／`useCartValidation`，`npm test`）；tech debt、零散 TODO 仍在。
- **訂單生命週期**：情境 1／6／7（逾時取消、逾期標記罰款、停權）已定案實作——pg_cron 三排程，見 `docs/order-lifecycle.md`。
- **階段 5 手機版**：Equipment／Space／RentalList／Order 等頁目前只有桌機版，標準見下方「手機版（RWD）標準」；等桌面版驗收（階段 1.5）確認後再做。
- **階段 6 部署**：維持 Vercel（`vercel.json`）＋環境變數、正式資料填入。

## 手機版（RWD）標準

- **斷點**：以 Tailwind 的 `md`（768px）為手機／桌機唯一分界，不另設自訂斷點。
- **模式**：複雜頁面採「同頁兩份 JSX」——桌機 `hidden md:block`／`md:flex`、手機 `md:hidden`（參考 `BookingResourcesPage` 既有做法）；簡單版面優先用響應式 class 寫成單份 JSX（參考 `HomePage` 登入頁）。
- **日曆**：`Calendar` 已有 `isMobile` prop（單月顯示），手機版直接傳 `isMobile={true}`。
- **觸控**：hover-only 的互動（tooltip、hover 預覽）必須有觸控替代；可點擊目標最小 44×44px。
- **驗證寬度**：手機以 375px 為基準寬度檢查，橫向不得出現頁面級卷軸。

## 已知 Tech Debt

- **過大頁面／元件**：`ProfilePage`、`OrderPage`、`SpacePage`、`RentalListPage`、`DatePickerBar`、`CartList` 皆 700–820 行，做手機版動到時順手拆 hook。
- **`DateSelectionContext` 複雜度**：一個 context 同時管設備／空間日期，可拆成兩個 context 降低耦合與 re-render。
- **CSS 雙軌並行**：Tailwind v4 與舊 `css/*.css`（約 1470 行）共存，長期可漸進遷移。
- ~~**Bundle 過大**~~：已用 `React.lazy` 做路由層 code-splitting（`App.tsx`），`jspdf`+`html2canvas` 隨 `OrderPage` 分離出 initial bundle。
- ~~**Storage key 命名混用**~~：已抽 `utils/storageKeys.ts`（receipts／notifications）與 `utils/authStorage.ts`（登入）集中管理。

## 程式風格規則

- 註解以繁體中文為主，符合既有慣例。
- **前台文字中英分開**：不要再寫「Login 登入」並列，一律 `const t = useT()` 後 `{t('Login', '登入')}`（也可傳 JSX）；
  Footer 的 language icon 切換、預設中文。英文之後由使用者重寫，**不要自行機器翻譯**只有中文的字串（Toast、server 錯誤原因維持中文）。
  後台 `/admin` 與 PDF 收據不切換。
- 檔頭常有 `/** 功能說明 */` 區塊註解。
- 路徑 alias：`@/*` → `src/*`、`@legacy/*` → `./*`（後者已不再需要）。
- TypeScript 設定為 `strict: true`，並啟用 `noUnusedLocals` 與 `noUnusedParameters`，build 時型別錯誤會擋住。
- **灰字 hover 變色一律加 `!`**：舊 `css/colors.css` 的 `.text-gray-scale*` 帶 `!important` 且不在 Tailwind layer，
  一般的 `hover:text-white` 永遠蓋不過（只會看到其他 hover 效果如變粗）——寫 `hover:!text-white`、`group-hover:!text-white`。
