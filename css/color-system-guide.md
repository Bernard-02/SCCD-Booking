# SCCD Booking 顏色系統指南

## 概述
為了確保網站視覺一致性和易於維護，我們在 `css/common.css` 中定義了一套完整的顏色系統。

## 顏色變數定義

### 主要品牌色
- `--color-primary`: #000000 (黑色 - 主背景)
- `--color-white`: #ffffff (白色 - 主文字)

### 狀態色
- `--color-success`: #00ff80 (綠色 - 有現貨、成功狀態)
- `--color-error`: #ff448a (粉紅色 - 已借出、錯誤狀態)
- `--color-warning`: #ffaa00 (橙色 - 警告狀態)

### 灰階系統
- `--color-gray-light`: #cccccc (淺灰 - 副標題、標籤)
- `--color-gray-medium`: #888888 (中灰 - 輔助文字)
- `--color-gray-dark`: #777777 (深灰 - 禁用狀態)

### 背景色
- `--color-bg-overlay`: rgba(0, 0, 0, 0.75) (半透明黑色覆蓋)
- `--color-bg-toast`: #ffffff (Toast 背景)
- `--color-bg-toast-error`: #ffd9e0 (Toast 錯誤背景)

### 邊框色
- `--color-border-default`: #ffffff (預設邊框)
- `--color-border-focus`: #cccccc (聚焦邊框)

### 選取色
- `--color-selection-bg`: #f7f7f7 (選取背景)
- `--color-selection-text`: #000000 (選取文字)

## 使用方法

### 在 CSS 中使用變數
```css
.my-element {
  color: var(--color-success);
  background-color: var(--color-primary);
  border: 1px solid var(--color-border-default);
}
```

### 使用工具類別
我們也提供了預定義的工具類別：

#### 文字顏色
- `.text-success` - 成功狀態文字
- `.text-error` - 錯誤狀態文字
- `.text-warning` - 警告狀態文字
- `.text-gray-light` - 淺灰文字
- `.text-gray-medium` - 中灰文字
- `.text-gray-dark` - 深灰文字

#### 背景顏色
- `.bg-success` - 成功狀態背景
- `.bg-error` - 錯誤狀態背景
- `.bg-warning` - 警告狀態背景
- `.bg-overlay` - 半透明覆蓋背景

#### 邊框顏色
- `.border-success` - 成功狀態邊框
- `.border-error` - 錯誤狀態邊框
- `.border-warning` - 警告狀態邊框
- `.border-gray-light` - 淺灰邊框
- `.border-default` - 預設邊框
- `.border-focus` - 聚焦邊框

### 在 HTML 中使用
```html
<!-- 使用工具類別 -->
<span class="text-success">有現貨</span>
<span class="text-error">已借出</span>

<!-- 使用內聯樣式（不推薦，但可用於動態設定） -->
<span style="color: var(--color-success)">有現貨</span>
```

### 在 JavaScript 中使用
```javascript
// 獲取顏色值
const successColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-success');

// 動態設定顏色
element.style.color = 'var(--color-success)';
```

## 建議
1. **優先使用 CSS 變數**：避免硬編碼顏色值
2. **使用工具類別**：對於常見的顏色需求，直接使用提供的工具類別
3. **保持一致性**：新增顏色時，請先檢查是否可以使用現有變數
4. **擴展系統**：如需新顏色，請在 `common.css` 的 `:root` 中定義，並添加相應的工具類別

## 遷移現有代碼
將現有的硬編碼顏色值替換為 CSS 變數：

### 替換對照表
- `#00ff80` → `var(--color-success)`
- `#ff448a` → `var(--color-error)`
- `#cccccc` → `var(--color-gray-light)`
- `#777777` → `var(--color-gray-dark)`
- `#ffffff` → `var(--color-white)`
- `#000000` → `var(--color-primary)`

這樣可以確保：
- 顏色統一管理
- 易於主題切換
- 更好的可維護性
- 設計系統的一致性
