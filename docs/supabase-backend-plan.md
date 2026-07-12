# Supabase 後端規劃

> 已定案（2026-07，取代原 firebase-backend-plan.md）。目前全站仍是 mock／localStorage。
> 任務 checklist 在 [roadmap.md](./roadmap.md) 階段 1；業務規則在 [rental-rules.md](./rental-rules.md)。

## 決定總覽

| 用途 | 用什麼 | 狀態 |
|---|---|---|
| 登入／會員／忘記密碼 | **Supabase Auth**（email + 密碼，自助重設） | 待接線 |
| 資料庫（設備／訂單／空間／學生狀態） | **Supabase PostgreSQL** + RLS | 待接線 |
| 圖片（設備照等） | **Supabase Storage**（資料表只存 URL） | 待接線 |
| 過渡期後台 | **Supabase Studio**（試算表式介面，人工審核頂替） | 現成 |
| 正式後台 | 自寫 `/admin` 頁面（roadmap 階段 2，等痛了再做） | 未動工 |
| 網站 Hosting | **維持 Vercel**（`vercel.json` 已設好，不搬家） | 現行 |

選 Supabase 而非 Firebase 的關鍵：關聯式資料形態（訂單↔品項↔學生↔庫存）、
**併發把關在資料庫層**（transaction／constraint 裁決搶最後一件庫存，不用自寫 Cloud Functions）、
RLS 列級權限、Studio 可當免費的 Excel 式過渡後台。

## 帳號與角色

- `role` 三種：`student`（現行規則）、`admin`（系學會幹部，用 `/admin`）、`staff`（系辦助教：
  前台直借，免押金免審核、不受學生規則限制）。**建 schema 時就要放 role 與年級／學制欄位**。
- **學號↔email 的坑**：現行登入綁學號（`mockApiLogin`），但 Supabase Auth 綁 email。
  接線前要決定 email 格式（建議直接用學校信箱），登入介面可維持「輸入學號」、
  內部查表轉 email 再呼叫 Auth。
- 忘記密碼：Supabase Auth `resetPasswordForEmail`，取代 HomePage「請聯繫系辦」靜態 Modal。

## 資料表草稿（建 schema 時細化）

```
students       學號(PK)、姓名、email、年級/學制、role、帳號狀態(6級)、累計逾期天數
equipment      id、名稱、分類、庫存量、押金、image_url
orders         訂單號、學號(FK)、起訖日、booking_type、狀態(待繳押金/租借中/逾期/已歸還/取消)、
               押金金額、已延期、借用資訊(原因/班級/老師)
order_items    訂單號(FK)、設備id 或 空間區塊id、數量
space_blocks   區塊id、區域、押金
notifications  id、學號(FK)、內容、已讀、時間
```

- 庫存扣減：以「orders 中生效期間重疊的 order_items 加總」即時計算，或觸發器維護；
  送單用 transaction 檢查＋寫入一次完成，防兩人同搶最後一件。
- RLS 基本政策：學生只能讀寫自己的 orders／notifications；equipment 全員可讀；
  只有 `admin` 可改訂單狀態；`staff` 建單走專屬政策（免審核）。

## 接線點（架構已預留，不必重構）

- 認證：`AuthProvider` 的 `authService` prop（`AuthService` 介面），換掉 `mockApiLogin` 即可。
- 前端 client：`src/services/supabase.ts`（`@supabase/supabase-js`），
  env：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（anon key 可公開；**service_role key 永不進前端**）。
- 待換 mock 清單：登入、設備庫存（`EquipmentGrid.tsx`）、空間佔用（`SpaceAreaMap.tsx`）、
  通知（Header）、送單（`useOrderSubmission`）。

## 建議接線順序（每步都可獨立驗證）

1. **設備資料入庫＋讀取**——`equipment-data.json` 匯入資料表，`EquipmentGrid` 改讀 Supabase（風險最低、立刻看得到成果）
2. **Auth 登入**——建 students 表＋學號↔email 對應，注入 `authService`；忘記密碼順帶完成
3. **送單寫入**——`useOrderSubmission` 改寫 orders／order_items；Profile 讀真實訂單
4. **庫存扣減與併發**——transaction 檢查；`EquipmentGrid` 可借數改為真實計算
5. **空間佔用**——`mockAreaBlocksData` 換成查詢生效訂單
6. **通知**——真實通知寫入與已讀
