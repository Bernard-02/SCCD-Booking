# SCCD Booking Toast 系統文檔

## 概述
此文檔記錄了SCCD Booking平台的Toast通知系統設計和使用規範。

## Toast樣式規範

### 1. 正常版本 (預設)
- **背景色**: `#ffffff` (白色)
- **文字色**: `#000000` (黑色)
- **用途**: 一般通知、成功操作、提示信息
- **CSS類**: `.toast` (預設樣式)

### 2. 錯誤版本
- **背景色**: `#ffd9e0` (淺紅色)
- **文字色**: `#ff448a` (紅色)
- **用途**: 錯誤提示、操作失敗
- **CSS類**: `.toast.error`

## CSS定義位置
所有Toast樣式已在 `css/common.css` 第137-191行定義，包含：
- 基礎樣式 (`.toast`)
- 錯誤樣式 (`.toast.error`)
- 動畫效果 (`.show`, `.fade-out`)
- 響應式支援 (桌面版和手機版)

## 使用方式

### JavaScript調用
```javascript
// 正常版本 (白色底，黑色字)
showToast('操作成功', 'success');

// 錯誤版本 (淺紅色底，紅色字)
showToast('操作失敗', 'error');
```

### 標準實現
```javascript
function showStandardToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';

    // 只有錯誤類型才添加error類
    if (type === 'error') {
        toast.classList.add('error');
    }

    const p = document.createElement('p');
    p.textContent = message;
    toast.appendChild(p);

    document.body.appendChild(toast);

    // 使用CSS動畫類
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('fade-out');
    }, 2000);
    setTimeout(() => toast.remove(), 2500);
}
```

## 具體使用場景

### 收藏功能
- **未登入點擊收藏**: 正常版本，訊息："請先登入以使用收藏功能"
- **添加收藏成功**: 正常版本，訊息："XXX 已加入收藏夾！"
- **移除收藏成功**: 正常版本，訊息："XXX 已從收藏夾中移除！"
- **收藏操作錯誤**: 錯誤版本，顯示具體錯誤信息

### 其他功能
- **一般成功操作**: 使用正常版本
- **錯誤或失敗操作**: 使用錯誤版本

## 重要注意事項

1. **不要自定義樣式**: 所有Toast都應使用`common.css`中定義的樣式
2. **統一調用方式**: 使用標準的`showToast(message, type)`格式
3. **類型限制**: 只有`'success'`(預設)和`'error'`兩種類型
4. **響應式**: CSS已處理桌面版和手機版的不同顯示效果

## 檔案位置
- **CSS樣式**: `css/common.css` (第137-191行)
- **JavaScript實現**:
  - `js/bookmark.js` (showStandardToast方法)
  - `js/equipment.js` (showToast函數)
  - `js/ui-animations.js` (ToastManager.show方法)

## 全局Toast函數
設備頁面使用的全局`window.showToast`函數定義在`js/ui-animations.js`第198行：
```javascript
window.showToast = ToastManager.show;
```

## 修正問題記錄
- **問題**: equipment.html中的toast顯示錯誤樣式
- **原因**: `js/ui-animations.js`中的`ToastManager.show`覆蓋了全局`showToast`函數，但沒有使用標準CSS樣式
- **解決**: 修正`ToastManager.show`方法，使用`common.css`中定義的`.show`和`.fade-out`動畫類

## 更新歷史
- 2025-01-XX: 修正ui-animations.js中的ToastManager，統一使用標準CSS樣式
- 2025-01-XX: 建立標準化Toast系統，統一使用CSS樣式
- 之前版本: 各自實現自定義樣式（已棄用）