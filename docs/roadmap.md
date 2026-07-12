# 完成路線圖（Roadmap）

> 距離可上線，剩下的階段與任務。整體現況：**前端流程完整（mock 跑得通），沒有真實後端**。
> 業務規則見 [rental-rules.md](./rental-rules.md)；後端已定案用 **Firebase**（Auth + DB）。
> 階段 1 → 2 → 3 有依賴順序；階段 4 可與任何階段並行。

## 階段 1：Firebase 後端接線（最大缺口）

前端接口都已抽好（`AuthProvider` 的 `authService` prop、`utils/storageKeys.ts`），接線時換掉 mock 函式即可，不必重構。

- [ ] Firebase 專案建立：Auth（學號帳號）＋ Firestore（DB 種類待最終確認）
- [ ] 登入換掉 `mockApiLogin`（`utils/testAuthData.ts`），注入真實 `authService`
- [ ] 忘記密碼：Firebase 自助重設流程
- [ ] 學生資料模型：補**年級／學制欄位**（階段 3 的天數例外、A508 限制都靠它）
- [ ] 設備資料與庫存上 Firestore：借出**真實扣庫存**（`EquipmentGrid.tsx` TODO「需接入實際預訂數據」）
- [ ] 空間佔用：`mockAreaBlocksData`（`SpaceAreaMap.tsx`）換成真實預約資料，多人可見彼此衝突
- [ ] 送單：`useOrderSubmission` 改寫伺服器；receipts／notifications 脫離 localStorage
- [ ] 通知：Header 的 `mockNotifications` 換真實來源
- [ ] 決定購物車與日期選擇是否跟帳號走（跨裝置同步）

## 階段 2：管理後台（目前完全沒有）

- [ ] 訂單審核與押金繳交確認（繳押金後預約才成立的狀態機）
- [ ] 交接／歸還／逾期標記
- [ ] 逾期罰款計算：19:01 起算、第 1 日 100、每日翻倍（週末節假日不計）、上限押金總額、滿 6 日視為未完成清潔歸還
- [ ] 逾期天數累計 → 帳號 6 級狀態與停權（滿 5 天停權；前端 `ProfilePage` 目前寫死 level 0）
- [ ] 庫存管理（新增／下架／調整數量）

## 階段 3：規則補完（依賴階段 1 的資料模型）

- [ ] 空間 14 天例外：四年級、碩士班放寬到 30 天（`DatePickerBar` 的 `maxDays` 依 `currentUser` 判斷）
- [ ] A508 教室限大二以上（`SpacePage.handleClassroomAdd` 擋大一）
- [ ] 停權帳號：擋登入或擋送單
- [ ] 延期「歸還日前三天提出」改為程式強制（目前只是文案）
- [ ] 重複下單、庫存衝突改由 server 端把關（目前只有前端檢查）

## 階段 4：品質（可並行）

- [ ] 測試：`npm test` 是 stub、零測試。優先蓋 `useCart`／`useCartValidation`（規則最密集、最容易回歸）
- [ ] Tech debt：拆 700 行大檔（`CartList`、`OrderPage`、`SpacePage`、`RentalListPage`）、`DateSelectionContext` 拆成設備／空間兩個、CSS 雙軌漸進遷移
- [ ] 零散 TODO：延長線佔位圖（`EquipmentGrid.tsx:184`）、`ProfilePage` 狀態圓點

## 階段 5：部署上線

- [ ] Hosting（順理成章是 Firebase Hosting）＋環境變數管理
- [ ] 正式資料填入：真實學號名單、設備清單與庫存、空間資料
- [ ] 上線前驗收：照 [rental-rules.md](./rental-rules.md) 逐條走一遍真實流程
