// 租借歷史管理器 - 負責處理租借歷史的所有邏輯

// 租借狀態常量
const RENTAL_STATUS = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  OVERDUE: 'overdue'
};

// 全域訂單號碼管理器（所有用戶共用）
class GlobalOrderNumberManager {
  constructor() {
    this.storageKey = 'sccd_global_order_counter';
  }

  // 獲取當前訂單號碼
  getCurrentOrderNumber() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      console.error('獲取全域訂單號碼錯誤:', error);
      return 0;
    }
  }

  // 生成下一個訂單號碼並遞增計數器
  generateNextOrderNumber() {
    const currentNumber = this.getCurrentOrderNumber();
    const nextNumber = currentNumber + 1;

    try {
      localStorage.setItem(this.storageKey, nextNumber.toString());
    } catch (error) {
      console.error('保存全域訂單號碼錯誤:', error);
    }

    return this.formatOrderNumber(nextNumber);
  }

  // 格式化訂單號碼
  formatOrderNumber(number) {
    const year = new Date().getFullYear();
    const paddedNumber = number.toString().padStart(3, '0');
    return `#${year}${paddedNumber}`;
  }

  // 設置訂單號碼（用於初始化或重置）
  setOrderNumber(number) {
    try {
      localStorage.setItem(this.storageKey, number.toString());
    } catch (error) {
      console.error('設置全域訂單號碼錯誤:', error);
    }
  }
}

// 創建全域實例
const globalOrderNumberManager = new GlobalOrderNumberManager();

// 逾期警告常量
const DUE_WARNING = {
  CRITICAL_DAYS: 3, // 3天內顯示紅色警告
  CRITICAL_HOURS: 24 // 24小時內顯示小時倒計時
};

class RentalHistoryManager {
  constructor() {
    this.storageKey = null;
    this.currentUser = null;
  }

  // 初始化租借歷史管理器
  init(userData) {
    this.currentUser = userData;
    this.storageKey = `sccd_rental_history_${userData.studentId}`;
  }

  // 生成租借歷史頁面HTML內容
  getRentalHistoryContent() {
    const rentalData = this.getRentalHistoryData();
    const ongoingRentals = rentalData.filter(rental => rental.status === RENTAL_STATUS.ONGOING);
    const completedRentals = rentalData.filter(rental => rental.status === RENTAL_STATUS.COMPLETED);

    // 如果沒有任何租借記錄，顯示提示訊息
    if (rentalData.length === 0) {
      return `
        <div class="space-y-8">
          <div>
            <h2 class="font-chinese text-white text-medium-title">租借歷史</h2>
          </div>
          <div class="text-center py-16">
            <p class="font-chinese text-gray-scale3 text-content">尚無租借記錄</p>
            <p class="font-chinese text-gray-scale4 text-tiny mt-2">完成租借後，記錄會顯示在這裡</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="space-y-8">
        <div>
          <h2 class="font-chinese text-white text-medium-title">租借歷史</h2>
        </div>

        <!-- 進行中 -->
        ${ongoingRentals.length > 0 ? this.generateOngoingRentalsSection(ongoingRentals) : ''}

        <!-- 已完成 -->
        ${completedRentals.length > 0 ? this.generateCompletedRentalsSection(completedRentals) : ''}
      </div>
    `;
  }

  // 生成進行中的租借項目區塊
  generateOngoingRentalsSection(ongoingRentals) {
    return `
      <div>
        <h3 class="font-chinese text-white text-content mb-4">進行中</h3>
        <div class="space-y-0">
          ${ongoingRentals.map((rental, index) =>
            this.generateRentalItem(rental, index, ongoingRentals.length, true)
          ).join('')}
        </div>
      </div>
    `;
  }

  // 生成已完成的租借項目區塊
  generateCompletedRentalsSection(completedRentals) {
    return `
      <div>
        <h3 class="font-chinese text-white text-content mb-4">已完成</h3>
        <div class="space-y-0">
          ${completedRentals.map((rental, index) =>
            this.generateRentalItem(rental, index, completedRentals.length, false)
          ).join('')}
        </div>
      </div>
    `;
  }

  // 生成單個租借項目HTML
  generateRentalItem(rental, index, totalCount, isOngoing) {
    const hasBorder = index < totalCount - 1;
    const dueInfo = this.calculateDueInfo(rental.dueDate);
    const isOverdue = rental.status === RENTAL_STATUS.ONGOING && dueInfo.isOverdue;
    const hoverColor = isOverdue ? '#38040E' : 'var(--color-gray-scale5)';

    return `
      <div class="rental-item px-4 pt-6 pb-4 ${hasBorder ? 'border-b border-gray-scale5' : ''} transition-colors duration-200"
           data-rental-id="${rental.id}"
           style="cursor: pointer;"
           onmouseover="this.style.backgroundColor='${hoverColor}'"
           onmouseout="this.style.backgroundColor='transparent'">
        <!-- 上半部：租借單號和狀態 -->
        <div class="flex justify-between items-start mb-2">
          <span class="font-english text-white text-small-title">${rental.orderNumber}</span>
          <span class="font-chinese text-tiny" ${this.getStatusColorStyle(rental, dueInfo)}>
            ${this.getStatusText(rental, dueInfo)}
          </span>
        </div>

        <!-- 下半部：租借日期和操作按鈕 -->
        <div class="flex justify-between items-start">
          <span class="font-english text-gray-scale2 text-tiny">
            ${this.formatRentalDateRange(rental)}
          </span>
          ${this.generateActionButton(rental, isOngoing)}
        </div>
      </div>
    `;
  }

  // 獲取狀態文字和顏色
  getStatusText(rental, dueInfo) {
    if (rental.status === RENTAL_STATUS.COMPLETED) {
      // 檢查是否逾期完成（wasOverdue 標記）
      if (rental.wasOverdue) {
        return '已完成 (逾期)';
      }
      return '已完成';
    }
    return dueInfo.text;
  }

  // 獲取狀態顏色樣式
  getStatusColorStyle(rental, dueInfo) {
    if (rental.status === RENTAL_STATUS.COMPLETED) {
      return 'style="color: var(--color-success);"';
    }
    return dueInfo.needsRedColor ? 'style="color: var(--color-error);"' : '';
  }

  // 生成操作按鈕
  generateActionButton(rental, isOngoing) {
    // 檢查是否可以延期
    const canExtend = this.canExtendRental(rental);
    const isDisabled = !isOngoing || !canExtend;
    const disabledStyles = isDisabled ? ' disabled" disabled style="opacity: 0.5; cursor: not-allowed;"' : '"';

    return `
      <button class="page-button rental-extend-btn${disabledStyles} data-rental-id="${rental.id}">
        <div class="menu-item-wrapper">
          <span class="menu-text">(EXTEND)</span>
          <span class="menu-text-hidden">(EXTEND)</span>
        </div>
      </button>
    `;
  }

  // 設置租借歷史頁面事件監聽器
  setupEventListeners() {
    this.setupRentalItemClickEvents();
    this.setupExtendButtonEvents();
  }

  // 設置租借項目點擊事件
  setupRentalItemClickEvents() {
    const rentalItems = document.querySelectorAll('.rental-item');
    rentalItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // 如果點擊的是按鈕，不處理項目點擊
        if (e.target.closest('.rental-extend-btn')) {
          return;
        }

        const rentalId = item.dataset.rentalId;
        this.goToRentalReceipt(rentalId);
      });
    });
  }

  // 設置續借按鈕事件
  setupExtendButtonEvents() {
    const extendBtns = document.querySelectorAll('.rental-extend-btn:not(.disabled)');
    extendBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止觸發項目點擊事件
        const rentalId = btn.dataset.rentalId;
        this.handleExtendRental(rentalId);
      });
    });
  }

  // 獲取租借歷史數據
  getRentalHistoryData() {
    if (!this.storageKey) {
      console.warn('租借歷史管理器未初始化');
      return [];
    }

    let rentals = this.loadRentalsFromStorage();

    // 不再自動創建測試數據，保留用戶真實的租借記錄
    // 如果沒有數據，返回空陣列
    if (rentals.length === 0) {
      return [];
    }

    // 智能排序：進行中的按到期日排序，已完成的按單號降序
    return rentals.sort((a, b) => {
      const aIsOngoing = a.status === RENTAL_STATUS.ONGOING;
      const bIsOngoing = b.status === RENTAL_STATUS.ONGOING;

      // 兩者都是進行中 - 按到期日升序（最快到期的在前）
      if (aIsOngoing && bIsOngoing) {
        return a.dueDate - b.dueDate;
      }

      // 兩者都是已完成 - 按單號降序（新的在前）
      if (!aIsOngoing && !bIsOngoing) {
        // 從單號中提取數字進行比較（例如 #2025001 -> 2025001）
        const aNum = parseInt(a.orderNumber.replace('#', ''));
        const bNum = parseInt(b.orderNumber.replace('#', ''));
        return bNum - aNum;
      }

      // 一個進行中一個已完成 - 進行中的排在前面
      return aIsOngoing ? -1 : 1;
    });
  }

  // 從存儲加載租借數據
  loadRentalsFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('獲取租借歷史數據錯誤:', error);
      return [];
    }
  }

  // 創建測試租借數據
  createTestRentalData() {
    const createDate = (year, month, day) => new Date(year, month - 1, day).getTime();
    const now = Date.now();

    // 初始化全域訂單號碼（如果是第一次）
    const currentOrderNum = globalOrderNumberManager.getCurrentOrderNumber();
    if (currentOrderNum === 0) {
      globalOrderNumberManager.setOrderNumber(9);
    }

    // 生成9筆租借記錄
    const rentals = [];
    const today = new Date();

    for (let i = 1; i <= 9; i++) {
      const orderNumber = globalOrderNumberManager.formatOrderNumber(i);

      // 計算日期（從最舊到最新）
      const daysAgo = 9 - i;
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - daysAgo - 7); // 開始日期在更早之前

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() - daysAgo);

      // 前5筆是已完成，後4筆是進行中
      const isOngoing = i > 5;

      // 特殊處理：第6筆設為已逾期（進行中）
      let dueDate = endDate.getTime();
      if (i === 6) {
        // 設定到期日為2天前，這樣就是已逾期
        const overdueDueDate = new Date(today);
        overdueDueDate.setDate(overdueDueDate.getDate() - 2);
        dueDate = overdueDueDate.getTime();
      }

      // 特殊處理：第3筆設為已完成但逾期
      let wasOverdue = false;
      if (i === 3) {
        wasOverdue = true;
      }

      rentals.push({
        id: orderNumber.replace('#', 'rental_'),
        orderNumber: orderNumber,
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
        dueDate: dueDate,
        status: isOngoing ? RENTAL_STATUS.ONGOING : RENTAL_STATUS.COMPLETED,
        wasOverdue: wasOverdue,
        items: this.getTestItems(i)
      });
    }

    return rentals;
  }

  // 獲取測試租借物品
  getTestItems(index) {
    const itemSets = [
      ['Sony FX3 攝影機', '三腳架'],
      ['Canon R5 相機', '鏡頭組'],
      ['無線麥克風組'],
      ['LED燈組', '反光板'],
      ['Blackmagic 攝影機'],
      ['DJI Ronin 穩定器'],
      ['Rode 指向麥克風', '收音錄音器'],
      ['Godox 閃光燈組'],
      ['4K 監視器', 'HDMI線']
    ];
    return itemSets[index - 1] || ['租借設備'];
  }

  // 保存租借歷史數據
  saveRentalHistoryData(rentals) {
    if (!this.storageKey) {
      console.warn('租借歷史管理器未初始化');
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rentals));
    } catch (error) {
      console.error('保存租借歷史數據錯誤:', error);
    }
  }

  // 計算逾期信息 - 統一的邏輯處理
  calculateDueInfo(dueDate) {
    const now = Date.now();
    const diffMs = dueDate - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 已逾期
    if (diffMs <= 0) {
      return {
        text: '已逾期',
        needsRedColor: true,
        isOverdue: true
      };
    }

    // 需要紅色警告（3天內或已逾期）
    const needsRedColor = diffDays <= DUE_WARNING.CRITICAL_DAYS;

    // 小於24小時顯示小時
    if (diffHours < DUE_WARNING.CRITICAL_HOURS) {
      const hours = diffHours <= 1 ? 1 : diffHours;
      return {
        text: `距離逾期剩下${hours}小時`,
        needsRedColor,
        isOverdue: false
      };
    }

    // 顯示天數
    return {
      text: `距離逾期剩下${diffDays}天`,
      needsRedColor,
      isOverdue: false
    };
  }

  // 格式化租借日期範圍
  formatRentalDateRange(rental) {
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    const startDateStr = formatDate(rental.startDate);

    // 如果有延期，使用延期後的到期日作為歸還日，並添加「(已延期)」標註
    if (rental.hasExtended && rental.dueDate) {
      const extendedEndDateStr = formatDate(rental.dueDate);
      return `${startDateStr} - ${extendedEndDateStr} <span class="font-chinese">(已延期)</span>`;
    }

    // 否則使用原始的結束日期
    const endDateStr = formatDate(rental.endDate);
    return `${startDateStr} - ${endDateStr}`;
  }

  // 跳轉到租借清單頁面
  goToRentalReceipt(rentalId) {
    console.log('跳轉到租借清單:', rentalId);
    window.location.href = `rental-receipt.html?rental_id=${rentalId}`;
  }

  // 檢查是否可以延期
  canExtendRental(rental) {
    // 1. 如果已經逾期，不能延期
    const dueInfo = this.calculateDueInfo(rental.dueDate);
    if (dueInfo.isOverdue) {
      return false;
    }

    // 2. 如果已經延期過，不能再延期
    if (rental.hasExtended) {
      return false;
    }

    // 3. 必須在到期前3天才能延期（不含到期前3天內）
    const now = Date.now();
    const diffMs = rental.dueDate - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 如果剩餘天數 <= 3，不能延期
    if (diffDays <= 3) {
      return false;
    }

    return true;
  }

  // 處理續借請求
  handleExtendRental(rentalId) {
    const rentals = this.getRentalHistoryData();
    const rental = rentals.find(r => r.id === rentalId);

    if (!rental) {
      console.error('找不到租借記錄');
      return;
    }

    // 再次檢查是否可以延期
    if (!this.canExtendRental(rental)) {
      return;
    }

    // 顯示延期對話框
    this.showExtendDialog(rental);
  }

  // 顯示延期對話框
  showExtendDialog(rental) {
    const today = new Date();
    const dueDate = new Date(rental.dueDate);

    // 生成日期數字陣列（今天 + 原歸還日 + 後7天）
    const dates = this.generateExtendDates(today, dueDate);

    // 創建對話框 HTML
    const dialogHTML = `
      <div id="extend-dialog-overlay" class="fixed inset-0 z-50 flex items-center justify-center" style="background-color: rgba(0, 0, 0, 0.8);">
        <div id="extend-dialog" class="bg-black border border-white p-6 mx-4" style="background-color: #000; max-width: 800px; width: 90%;">
          <!-- 標題 -->
          <h2 class="font-chinese text-white text-content mb-4">延期規則</h2>

          <!-- 規則說明 -->
          <div class="mb-6">
            <div class="font-chinese text-white text-small-title space-y-1">
              <p>1. 延期申請需在原租借收據歸還日的前三天提出，且僅可以提出乙次申請。</p>
              <p>2. 延期天數是原歸還日往後開始計算，可最多延期7天。</p>
              <p class="text-gray-scale2 text-tiny mt-2">例：假設租借收據的原歸還日是1/20，您需要在1/17（含）之前提出延期申請。您可以自由選擇延期的天數，最多7天。若選擇延期7天，則新的歸還日會更改至1/27日。</p>
            </div>
          </div>

          <!-- 日期選擇器和狀態提示（置中） -->
          <div class="flex flex-col items-center mb-6">
            <!-- 日期選擇器 -->
            <div class="mb-3">
              <div id="date-selector" class="flex items-center">
                ${dates.map((date, index) => this.generateDateCell(date, index, dates.length)).join('')}
              </div>
            </div>

            <!-- 狀態提示 -->
            <div style="min-height: 18px;">
              <p id="extend-status" class="font-chinese text-white text-tiny">
                您已延期 <span id="extend-days-count">0</span> 天，新的歸還日是 <span id="new-return-date">--</span>。
              </p>
            </div>
          </div>

          <!-- 按鈕 -->
          <div class="flex justify-center gap-8">
            <button id="extend-discard-btn" class="page-button font-english" style="color: var(--color-error2);">
              <div class="menu-item-wrapper">
                <span class="menu-text">(DISCARD)</span>
                <span class="menu-text-hidden">(DISCARD)</span>
              </div>
            </button>
            <button id="extend-confirm-btn" class="page-button font-english text-white disabled" disabled style="opacity: 0.3;">
              <div class="menu-item-wrapper">
                <span class="menu-text">(EXTEND)</span>
                <span class="menu-text-hidden">(EXTEND)</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    `;

    // 插入對話框到頁面
    document.body.insertAdjacentHTML('beforeend', dialogHTML);

    // 設置事件監聽器
    this.setupExtendDialogEvents(rental, dates);
  }

  // 生成延期日期陣列
  generateExtendDates(today, dueDate) {
    const dates = [];

    // 第1個：今天
    dates.push({
      date: new Date(today),
      day: today.getDate(),
      type: 'today',
      disabled: true
    });

    // 第2個：原歸還日
    dates.push({
      date: new Date(dueDate),
      day: dueDate.getDate(),
      type: 'due',
      disabled: true
    });

    // 第3-9個：原歸還日後7天
    for (let i = 1; i <= 7; i++) {
      const extendDate = new Date(dueDate);
      extendDate.setDate(dueDate.getDate() + i);
      dates.push({
        date: extendDate,
        day: extendDate.getDate(),
        type: 'extend',
        disabled: false,
        extendDays: i
      });
    }

    return dates;
  }

  // 生成日期單元格
  generateDateCell(date, index) {
    const isFirst = index === 0;
    const isSecond = index === 1;
    const isDisabled = date.disabled;

    // padding 設定：用 padding 代替 margin 來創造間距
    let paddingStyle = '';
    if (isFirst) {
      paddingStyle = 'padding-right: 16px;'; // 第1個數字右側 padding
    } else if (isSecond) {
      paddingStyle = 'padding-left: 16px; padding-right: 8px;'; // 第2個數字左右 padding
    } else if (index > 1) {
      paddingStyle = 'padding-left: 8px; padding-right: 8px;'; // 其他數字左右 padding
    }

    // 第2個數字是綠色
    const colorStyle = isSecond ? 'color: #00FF80;' : 'color: white;';

    // class 設定（使用與 booking 日曆相同的 class）
    let cellClass = 'extend-date-item text-left font-semibold font-[\'Inter\',_sans-serif] tracking-tighter leading-none py-1 text-[3.5rem] relative';

    if (!isDisabled) {
      cellClass += ' cursor-pointer';
    }

    // 綠線 class
    if (isFirst) {
      cellClass += ' extend-line-start';
    } else if (isSecond) {
      cellClass += ' extend-line-end';
    } else if (index === 2) {
      // 第3個數字：左半邊綠線
      cellClass += ' extend-line-third';
    }

    const disabledStyle = isDisabled ? 'pointer-events: none;' : '';

    // 數字需要 wrapper 結構來實現 hover 動畫
    const innerHTML = `
      <div class="date-number-wrapper">
        <span class="date-number-text">${date.day}</span>
        <span class="date-number-hidden">${date.day}</span>
      </div>
    `;

    return `
      <div class="${cellClass}"
           data-index="${index}"
           data-extend-days="${date.extendDays || 0}"
           data-disabled="${isDisabled}"
           style="${colorStyle} ${paddingStyle} ${disabledStyle}">
        ${innerHTML}
      </div>
    `;
  }

  // 設置延期對話框事件
  setupExtendDialogEvents(rental, dates) {
    const overlay = document.getElementById('extend-dialog-overlay');
    const discardBtn = document.getElementById('extend-discard-btn');
    const confirmBtn = document.getElementById('extend-confirm-btn');
    const daysCountSpan = document.getElementById('extend-days-count');
    const newDateSpan = document.getElementById('new-return-date');

    let selectedIndex = null;
    let selectedDays = 0;

    // 獲取所有日期單元格
    const allCells = document.querySelectorAll('[data-index]');

    // Hover 預覽效果
    const showHoverPreview = (hoverIndex) => {
      // 只在未選擇狀態下顯示預覽
      if (selectedIndex !== null) return;

      // 只處理第3-8個數字的 hover
      if (hoverIndex < 2) return;

      allCells.forEach((cell) => {
        const cellIndex = parseInt(cell.dataset.index);

        // 移除之前的 hover 預覽
        cell.classList.remove('hover-preview', 'hover-preview-extend', 'hover-preview-end');

        if (cellIndex === 2) {
          // 第3個數字：如果 hover 在它或之後，顯示右半邊預覽
          if (hoverIndex >= 2) {
            cell.classList.add('hover-preview');
          }
        } else if (cellIndex > 2 && cellIndex < hoverIndex) {
          // 第3個之後到 hover 位置之前：完整半透明預覽 + 延伸
          cell.classList.add('hover-preview-extend');
        } else if (cellIndex === hoverIndex) {
          // hover 位置本身：完整半透明預覽（不延伸）
          cell.classList.add('hover-preview-end');
        }
      });
    };

    // 隱藏 hover 預覽
    const hideHoverPreview = () => {
      allCells.forEach(cell => {
        cell.classList.remove('hover-preview', 'hover-preview-extend', 'hover-preview-end');
      });
    };

    // 更新選擇狀態
    const updateSelection = (newIndex) => {
      allCells.forEach((cell) => {
        const cellIndex = parseInt(cell.dataset.index);

        // 移除所有選擇相關的 class
        cell.classList.remove('in-range-extend', 'end-date-extend');

        if (newIndex !== null) {
          if (cellIndex === 2 && newIndex > 2) {
            // 第3個數字在選中範圍內時：完整綠線（覆蓋原本的左半邊）
            cell.classList.add('in-range-extend');
          } else if (cellIndex > 2 && cellIndex < newIndex) {
            // 範圍內的數字：完整綠線
            cell.classList.add('in-range-extend');
          } else if (cellIndex === newIndex) {
            // 選中的數字：綠線 + 綠色數字
            cell.classList.add('end-date-extend');
          }
        }
      });
    };

    // 日期選擇事件（只有第3-8個可以選擇）
    allCells.forEach((cell) => {
      const cellIndex = parseInt(cell.dataset.index);
      const isDisabled = cell.dataset.disabled === 'true';

      // 只有第3-8個數字可以選擇
      if (cellIndex < 2 || isDisabled) return;

      // Hover 事件
      cell.addEventListener('mouseenter', () => {
        showHoverPreview(cellIndex);
      });

      cell.addEventListener('mouseleave', () => {
        hideHoverPreview();
      });

      // 點擊事件
      cell.addEventListener('click', () => {
        const extendDays = parseInt(cell.dataset.extendDays);

        // 如果點擊已選擇的日期，取消選擇
        if (selectedIndex === cellIndex) {
          selectedIndex = null;
          selectedDays = 0;
          updateSelection(null);

          // 更新狀態提示為初始狀態
          daysCountSpan.textContent = '0';
          newDateSpan.textContent = '--';

          // 禁用 EXTEND 按鈕
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.3';
          confirmBtn.classList.add('disabled');
        } else {
          // 選擇新日期
          selectedIndex = cellIndex;
          selectedDays = extendDays;
          updateSelection(cellIndex);

          // 更新狀態提示
          const newDueDate = new Date(rental.dueDate);
          newDueDate.setDate(newDueDate.getDate() + extendDays);
          daysCountSpan.textContent = extendDays;
          newDateSpan.textContent = `${newDueDate.getMonth() + 1} 月 ${newDueDate.getDate()} 日`;

          // 啟用 EXTEND 按鈕
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.classList.remove('disabled');
        }
      });
    });

    // DISCARD 按鈕
    discardBtn.addEventListener('click', () => {
      overlay.remove();
    });

    // EXTEND 按鈕
    confirmBtn.addEventListener('click', () => {
      if (selectedDays > 0) {
        this.confirmExtendRental(rental.id, selectedDays);
        overlay.remove();
      }
    });
  }

  // 計算新的到期日
  calculateNewDueDate(originalDueDate, extendDays) {
    const newDueDate = new Date(originalDueDate);
    newDueDate.setDate(newDueDate.getDate() + extendDays);
    return this.formatDate(newDueDate.getTime());
  }

  // 格式化日期
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  }

  // 確認延期
  confirmExtendRental(rentalId, extendDays) {
    const rentals = this.getRentalHistoryData();
    let extendedRental = null;

    const updatedRentals = rentals.map(rental => {
      if (rental.id === rentalId) {
        const newDueDate = new Date(rental.dueDate);
        newDueDate.setDate(newDueDate.getDate() + extendDays);

        extendedRental = {
          ...rental,
          dueDate: newDueDate.getTime(),
          hasExtended: true,
          extendedDays: extendDays
        };
        return extendedRental;
      }
      return rental;
    });

    this.saveRentalHistoryData(updatedRentals);

    // 創建「已延期」通知
    if (extendedRental && window.NotificationManager && this.currentUser) {
      const notificationManager = new window.NotificationManager();
      notificationManager.init(this.currentUser);
      notificationManager.addNotification(
        `您的租借單 ${extendedRental.orderNumber} 已延期，請以新的歸還日為主。`,
        'extended'
      );
      console.log('✅ 已創建通知: 租借單已延期');
    }

    // 重新載入頁面內容
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = this.getRentalHistoryContent();
    this.setupEventListeners();
  }

  // 添加新的租借記錄
  addRentalRecord(rentalData) {
    const rentals = this.getRentalHistoryData();

    // 使用全域訂單號碼管理器生成訂單號碼
    const orderNumber = globalOrderNumberManager.generateNextOrderNumber();

    const newRental = {
      id: orderNumber.replace('#', 'rental_'),
      orderNumber: orderNumber,
      startDate: rentalData.startDate,
      endDate: rentalData.endDate,
      dueDate: rentalData.dueDate || rentalData.endDate,
      status: rentalData.status || RENTAL_STATUS.ONGOING,
      items: rentalData.items || []
    };

    rentals.unshift(newRental);
    this.saveRentalHistoryData(rentals);
    return newRental;
  }

  // 更新租借狀態
  updateRentalStatus(rentalId, newStatus) {
    const rentals = this.getRentalHistoryData();
    const now = Date.now();

    const updatedRentals = rentals.map(rental => {
      if (rental.id === rentalId) {
        const updatedRental = { ...rental, status: newStatus };

        // 如果標記為完成，檢查是否逾期並計算逾期天數
        if (newStatus === RENTAL_STATUS.COMPLETED) {
          if (now > rental.dueDate) {
            // 計算逾期天數並保存為固定值
            const overdueDays = Math.floor((now - rental.dueDate) / (1000 * 60 * 60 * 24));
            updatedRental.wasOverdue = true;
            updatedRental.overdueDays = overdueDays;
          }
        }

        return updatedRental;
      }
      return rental;
    });

    this.saveRentalHistoryData(updatedRentals);
    return updatedRentals;
  }

  // 延長租借期限
  extendRentalPeriod(rentalId, newEndDate, newDueDate = null) {
    const rentals = this.getRentalHistoryData();
    const updatedRentals = rentals.map(rental =>
      rental.id === rentalId
        ? {
            ...rental,
            endDate: newEndDate,
            dueDate: newDueDate || newEndDate
          }
        : rental
    );

    this.saveRentalHistoryData(updatedRentals);
    return updatedRentals;
  }

  // 獲取特定狀態的租借記錄
  getRentalsByStatus(status) {
    const rentals = this.getRentalHistoryData();
    return rentals.filter(rental => rental.status === status);
  }

  // 獲取即將到期的租借記錄
  getUpcomingDueRentals(daysAhead = 3) {
    const rentals = this.getRentalsByStatus(RENTAL_STATUS.ONGOING);
    const cutoffTime = Date.now() + (daysAhead * 24 * 60 * 60 * 1000);

    return rentals.filter(rental => rental.dueDate <= cutoffTime);
  }

  // 獲取已逾期的租借記錄
  getOverdueRentals() {
    const rentals = this.getRentalsByStatus(RENTAL_STATUS.ONGOING);
    const now = Date.now();

    return rentals.filter(rental => rental.dueDate < now);
  }

  // 獲取租借統計信息
  getRentalStats() {
    const rentals = this.getRentalHistoryData();
    const ongoing = rentals.filter(r => r.status === RENTAL_STATUS.ONGOING);
    const completed = rentals.filter(r => r.status === RENTAL_STATUS.COMPLETED);
    const overdue = this.getOverdueRentals();

    return {
      total: rentals.length,
      ongoing: ongoing.length,
      completed: completed.length,
      overdue: overdue.length,
      upcomingDue: this.getUpcomingDueRentals().length
    };
  }

  // 計算用戶累計逾期天數（即時計算）
  calculateTotalOverdueDays() {
    const rentals = this.getRentalHistoryData();
    const now = Date.now();
    let totalOverdueDays = 0;

    rentals.forEach(rental => {
      if (rental.status === RENTAL_STATUS.COMPLETED && rental.overdueDays) {
        // 已完成的單子：使用固定的逾期天數
        totalOverdueDays += rental.overdueDays;
      } else if (rental.status === RENTAL_STATUS.ONGOING && rental.dueDate < now) {
        // 進行中且逾期的單子：即時計算逾期天數
        const overdueDays = Math.floor((now - rental.dueDate) / (1000 * 60 * 60 * 24));
        totalOverdueDays += overdueDays;
      }
    });

    return totalOverdueDays;
  }

  // 獲取用戶帳號狀態
  getAccountStatus() {
    // ========== 測試模式：強制返回逾期1天狀態 ==========
    // TODO: 測試完畢後請刪除此段代碼,並取消註解下面的真實計算邏輯
    return {
      level: 1,
      status: '您已累積逾期1天',
      description: '您還剩餘4天的機會，下次請準時歸還租借',
      color: 'warning',
      isSuspended: false,
      totalOverdueDays: 1
    };
    // ===================================================

    const totalOverdueDays = this.calculateTotalOverdueDays();

    // 根據累計逾期天數判定狀態
    if (totalOverdueDays >= 5) {
      return {
        level: 5,
        status: '您已累積嚴重逾期5天',
        description: '您的帳號已遭停權並不可再次使用，如有任何疑問請洽系學會',
        color: 'error',
        isSuspended: true,
        totalOverdueDays: totalOverdueDays
      };
    } else if (totalOverdueDays >= 4) {
      return {
        level: 4,
        status: '您已累積逾期4天',
        description: '您還剩餘1天的機會，下次請準時歸還租借',
        color: 'warning',
        isSuspended: false,
        totalOverdueDays: totalOverdueDays
      };
    } else if (totalOverdueDays >= 3) {
      return {
        level: 3,
        status: '您已累積逾期3天',
        description: '您還剩餘2天的機會，下次請準時歸還租借',
        color: 'warning',
        isSuspended: false,
        totalOverdueDays: totalOverdueDays
      };
    } else if (totalOverdueDays >= 2) {
      return {
        level: 2,
        status: '您已累積逾期2天',
        description: '您還剩餘3天的機會，下次請準時歸還租借',
        color: 'warning',
        isSuspended: false,
        totalOverdueDays: totalOverdueDays
      };
    } else if (totalOverdueDays >= 1) {
      return {
        level: 1,
        status: '您已累積逾期1天',
        description: '您還剩餘4天的機會，下次請準時歸還租借',
        color: 'warning',
        isSuspended: false,
        totalOverdueDays: totalOverdueDays
      };
    } else {
      return {
        level: 0,
        status: '準時',
        description: '您非常準時地歸還租借，沒有任何逾期記錄',
        color: 'success',
        isSuspended: false,
        totalOverdueDays: 0
      };
    }
  }
}

// 導出供其他文件使用
if (typeof window !== 'undefined') {
  window.RentalHistoryManager = RentalHistoryManager;
  window.RENTAL_STATUS = RENTAL_STATUS;
  window.GlobalOrderNumberManager = globalOrderNumberManager;
}