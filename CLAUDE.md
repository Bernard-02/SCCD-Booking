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
  hooks/                        # useCart、useConfirmDialog
  stores/bookmarkStore.ts       # Zustand 收藏 store
  services/                     # Firebase 示例（尚未啟用）
  utils/                        # testAuthData（mock 登入）、timeUtils、orderValidation
  types/equipment.ts
css/                            # 舊的樣式，由 main.tsx 全量 import
js/                             # 舊靜態版本的 JS（已不再由新架構使用，可逐步移除）
Images/、Icons/                 # 靜態資源
public/Area/                    # SVG 區域圖
equipment-data.json             # 設備主資料（包含庫存、分類）
legacy/                         # 遷移前備份（已 gitignore）
old-html-backup/                # 舊 HTML 備份（尚未 gitignore）
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

`legacy/` 存放遷移前備份並已 gitignore；`old-html-backup/` 是額外備份，尚未加入 gitignore。

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

## 日期選擇邏輯

`DateSelectionContext` 同時管理「設備日期」與「空間日期」，各自又有 `littleDates`（小量）與 `massDates`（大量）兩組。`bookingType` 可為 `little`、`mass-personal`、`mass-group`。超過 24 小時未送單會自動清除過期的日期選擇。

## 已知 Tech Debt

- **過大頁面／元件**：`CartList.tsx`（944 行）、`RentalListPage.tsx`（937 行）、`OrderPage.tsx`（804 行）、`SpacePage.tsx`（751 行）可拆分 hook。
- **Bundle 過大**（~982KB）：`jspdf` + `html2canvas` 只用在 `OrderPage`，可配合 `React.lazy` 做路由層 code-splitting。
- **`DateSelectionContext` 複雜度**：一個 context 同時管設備／空間日期，可拆成兩個 context 降低耦合與 re-render。
- **CSS 雙軌並行**：Tailwind v4 與舊 `css/*.css`（3868 行）共存，長期可漸進遷移。
- **Storage key 命名混用**：`sccd_login_data`（底線）、`sccd-rental-cart`（連字號）、`booking_receipts_*` 格式不一，建議抽 `storageKeys.ts` 常數並統一。

## 程式風格規則

- 註解以繁體中文為主，符合既有慣例。
- 檔頭常有 `/** 功能說明 */` 區塊註解。
- 路徑 alias：`@/*` → `src/*`、`@legacy/*` → `./*`（後者已不再需要）。
- TypeScript 設定為 `strict: true`，並啟用 `noUnusedLocals` 與 `noUnusedParameters`，build 時型別錯誤會擋住。
