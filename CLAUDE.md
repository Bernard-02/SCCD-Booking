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
  pages/                        # 各個頁面（BookingPage、EquipmentPage、SpacePage 等）
  components/
    layouts/                    # Header、Footer、MainLayout
    equipment/                  # 實際使用的 EquipmentCard / EquipmentGrid
    cart/                       # CartList、DateEditDialog
    common/                     # Toast、ConfirmDialog、BookingDetailsDialog
    space/                      # ClassroomList、SpaceAreaMap
    profile/                    # ExtendDialog
  contexts/                     # AuthContext、DateSelectionContext
  hooks/                        # useCart、useConfirmDialog、useOrderSubmission、useCartValidation
  stores/bookmarkStore.ts       # Zustand 收藏 store
  services/                     # 空資料夾（保留給未來真實後端，目前無檔案）
  utils/                        # testAuthData（mock 登入）、authStorage、storageKeys、timeUtils、orderValidation
  data/equipment-data.json      # 設備主資料（包含庫存、分類）
  types/equipment.ts
css/                            # 舊的樣式，由 main.tsx 全量 import
js/                             # 舊靜態版本的 JS（已不再由新架構使用，可逐步移除）
Images/、Icons/                 # 靜態資源（已移入 public/）
public/Area/                    # SVG 區域圖
legacy/                         # 遷移前備份（已 gitignore）
old-html-backup/                # 舊 HTML 備份（已 gitignore）
docs/rental-rules.md            # 租借規則單一事實來源（改租借邏輯前必讀）
docs/roadmap.md                 # 完成路線圖（階段 1-5 與任務清單）
docs/bookmark-system.md         # 收藏系統設計文檔
```

## 常用指令

```bash
npm run dev        # Vite dev server，port 3000，自動開瀏覽器
npm run build      # tsc 型別檢查 + vite build → dist/
npm run preview    # 預覽 production build
npx tsc --noEmit   # 僅型別檢查，不產生檔案
```

## 遷移狀態（重要背景）

此專案正在從純 HTML/JS 靜態站點遷移到 React SPA。歷史上根目錄曾有 `booking.html`、`login.html`、`equipment.html` 等多頁，對應 `js/*.js`。目前：

- **已遷移**：Home、Booking、BookingResources、Equipment、Space、RentalList、Profile、Order
- **已刪除**：所有根目錄的 `*.html`、多數 `js/*.js`（git status 中列為 D）
- **新入口**：`index.html` → `src/main.tsx` → `App.tsx`
- **SPA fallback**：`vite.config.ts` 的 `appType: 'spa'` 確保 `/space`、`/equipment` 等路徑 fallback 到 `index.html`
- **下一步**：前端流程已完整（mock 資料跑得通），尚未完成的是接真實後端 API 與管理後台——詳見「尚未完成」一節。

`legacy/` 與 `old-html-backup/` 皆為遷移前備份，兩者都已 gitignore。

## 認證流程

- **登入狀態**：`localStorage.sccd_login_data`（記住我）或 `sessionStorage.sccd_login_data`（僅此次）
- **過期**：`loginTime + expiresIn < now` 即視為過期，自動清除
- **mock 登入**：`src/utils/testAuthData.ts` 提供 `mockApiLogin`，由 `AuthContext` 使用
- **替換接口**：`AuthProvider` 接受可選的 `authService` prop（`AuthService` 介面），未來可注入 Firebase
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
| `booking_receipts_{studentId\|guest}` | 訂單收據（`storageKeys.ts` 的 `receiptsKey`） |
| `sccd_notifications_{studentId\|guest}` | 通知（`notificationsKey`） |
| `sccd_read_notifications_{studentId\|guest}` | 已讀通知（`readNotificationsKey`） |

## 日期選擇邏輯

`DateSelectionContext` 同時管理「設備日期」與「空間日期」，各自又有 `littleDates`（小量）與 `massDates`（大量）兩組。`bookingType` 可為 `little`、`mass-personal`、`mass-group`。超過 24 小時未送單會自動清除過期的日期選擇。

## 租借規則（改租借邏輯前必讀）

業務規則的單一事實來源是 **`docs/rental-rules.md`**——包含三種 bookingType 在設備／空間頁的 UI 對應表、押金「即時擋 vs 結算 cap」分工、數量與天數上限、逾期罰款等，以及每條規則在程式裡的位置。規則的權威來源（系學會使用說明 Google 文件）連結也在該文件開頭。

最容易踩的坑：空間頁的 Group 團體對應 `mass-group`、設備頁的 Mass 大量對應 `mass-personal`，兩者押金與豁免邏輯不同——動這些判斷前先讀 rental-rules.md 第 1、4 節。

## 尚未完成 → 見 docs/roadmap.md

整體現況：**前端流程完整，但所有資料都是 mock／只存 localStorage，沒有真實後端**。距離上線的完整階段拆解（Firebase 接線 → 管理後台 → 規則補完 → 品質 → 部署）與任務清單在 **`docs/roadmap.md`**。摘要：

- **階段 1 後端**（最大缺口）：後端定案用 **Firebase**（Auth + Firestore）。mock 清單：登入 `mockApiLogin`、庫存 `equipment-data.json`（借出不扣庫存）、空間佔用 `mockAreaBlocksData`、通知 `mockNotifications`、送單只寫 localStorage。接線介面已抽好（`authService` prop、`storageKeys.ts`），換掉 mock 函式即可。
- **階段 2 管理後台**：完全沒有。審核、押金確認、歸還標記、逾期罰款計算、帳號 6 級狀態（依累計逾期天數，滿 5 天停權）。
- **階段 3 規則補完**：需要學生年級欄位（空間 14 天的四年級／碩士例外、A508 限大二以上）。
- **階段 4 品質**：測試零覆蓋（優先蓋 `useCart`／`useCartValidation`）、tech debt、零散 TODO。
- **階段 5 部署**：Firebase Hosting、正式資料填入。

## 已知 Tech Debt

- **過大頁面／元件**：`CartList.tsx`（744 行）、`OrderPage.tsx`（737 行）、`SpacePage.tsx`（736 行）、`RentalListPage.tsx`（712 行）仍可續拆 hook。
- **`DateSelectionContext` 複雜度**：一個 context 同時管設備／空間日期，可拆成兩個 context 降低耦合與 re-render。
- **CSS 雙軌並行**：Tailwind v4 與舊 `css/*.css`（3868 行）共存，長期可漸進遷移。
- ~~**Bundle 過大**~~：已用 `React.lazy` 做路由層 code-splitting（`App.tsx`），`jspdf`+`html2canvas` 隨 `OrderPage` 分離出 initial bundle。
- ~~**Storage key 命名混用**~~：已抽 `utils/storageKeys.ts`（receipts／notifications）與 `utils/authStorage.ts`（登入）集中管理。

## 程式風格規則

- 註解以繁體中文為主，符合既有慣例。
- 檔頭常有 `/** 功能說明 */` 區塊註解。
- 路徑 alias：`@/*` → `src/*`、`@legacy/*` → `./*`（後者已不再需要）。
- TypeScript 設定為 `strict: true`，並啟用 `noUnusedLocals` 與 `noUnusedParameters`，build 時型別錯誤會擋住。
