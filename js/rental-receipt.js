/* ===== 租借收據頁面專用 JavaScript ===== */

// 清空購物車（租借完成後）
function clearCartAfterRental() {
  window.cartManager.clearCart();
}

// 生成租借資訊
function generateRentalInfo() {
  // 檢查 URL 是否有 rental_id 參數
  const urlParams = new URLSearchParams(window.location.search);
  const rentalId = urlParams.get('rental_id');

  let rentalNumber, startDate, endDate;

  if (rentalId) {
    // 從租借歷史中讀取數據
    const rentalData = getRentalDataById(rentalId);
    if (rentalData) {
      rentalNumber = rentalData.orderNumber;
      startDate = formatDate(new Date(rentalData.startDate));
      endDate = formatDate(new Date(rentalData.endDate));
    } else {
      // 找不到租借記錄，使用默認值
      rentalNumber = '#2025001';
      const today = new Date();
      const returnDate = new Date(today);
      returnDate.setDate(today.getDate() + 3);
      startDate = formatDate(today);
      endDate = formatDate(returnDate);
    }
  } else {
    // 新租借：使用全域訂單號碼管理器生成新的租借號
    if (window.GlobalOrderNumberManager) {
      rentalNumber = window.GlobalOrderNumberManager.generateNextOrderNumber();
    } else {
      rentalNumber = generateRentalNumber();
    }

    // 保存當前租借號碼供後續使用
    localStorage.setItem('currentRentalNumber', rentalNumber);

    // 從 localStorage 讀取選擇的租借日期
    const savedDates = localStorage.getItem('selectedRentalDates');
    if (savedDates) {
      try {
        const dateData = JSON.parse(savedDates);
        const startDateObj = new Date(dateData.startDate);
        const endDateObj = new Date(dateData.endDate);

        startDate = formatDate(startDateObj);
        endDate = formatDate(endDateObj);
      } catch (error) {
        console.error('無法解析保存的日期資料:', error);
        const today = new Date();
        const returnDate = new Date(today);
        returnDate.setDate(today.getDate() + 3);

        startDate = formatDate(today);
        endDate = formatDate(returnDate);
      }
    } else {
      const today = new Date();
      const returnDate = new Date(today);
      returnDate.setDate(today.getDate() + 3);

      startDate = formatDate(today);
      endDate = formatDate(returnDate);
    }
  }

  // 更新租借號 - 手機版和桌面版
  const mobileRentalNumber = document.getElementById('rental-number');
  const desktopRentalNumber = document.getElementById('rental-number-desktop');
  if (mobileRentalNumber) mobileRentalNumber.textContent = rentalNumber;
  if (desktopRentalNumber) desktopRentalNumber.textContent = rentalNumber;

  // 更新租借日期 - 手機版和桌面版
  const mobileRentalDates = document.getElementById('rental-dates');
  const desktopRentalDates = document.getElementById('rental-dates-desktop');
  if (mobileRentalDates) mobileRentalDates.textContent = `${startDate}  -  ${endDate}`;
  if (desktopRentalDates) desktopRentalDates.textContent = `${startDate}  -  ${endDate}`;
}

// 根據 rental_id 獲取租借數據
function getRentalDataById(rentalId) {
  // 獲取當前登入用戶
  if (typeof window.AuthStorage === 'undefined' || !window.AuthStorage.isLoggedIn()) {
    return null;
  }

  const loginData = window.AuthStorage.getLoginData();
  if (!loginData || !loginData.student) {
    return null;
  }

  const storageKey = `sccd_rental_history_${loginData.student.studentId}`;

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const rentals = JSON.parse(stored);
    return rentals.find(rental => rental.id === rentalId);
  } catch (error) {
    console.error('獲取租借數據錯誤:', error);
    return null;
  }
}

// 生成租借號 (#年份+單號)
function generateRentalNumber() {
  const currentYear = new Date().getFullYear();
  
  // 從 localStorage 獲取當年的計數器
  const yearKey = `rentalCounter_${currentYear}`;
  let currentCount = parseInt(localStorage.getItem(yearKey)) || 0;
  
  // 增加計數器
  currentCount++;
  localStorage.setItem(yearKey, currentCount.toString());
  
  // 格式化單號為3位數（例如：001, 002, 999）
  const formattedCount = currentCount.toString().padStart(3, '0');
  
  return `#${currentYear}${formattedCount}`;
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// 載入設備摘要
function loadEquipmentSummary() {
  const equipmentList = document.getElementById('equipment-summary-list');
  const equipmentListMobile = document.getElementById('equipment-summary-list-mobile');

  // 從localStorage獲取租借時的購物車數據
  const rentalData = localStorage.getItem('rentalCartData');
  let cart = [];

  if (rentalData) {
    cart = JSON.parse(rentalData);
  }

  let equipmentDeposit = 0;
  let spaceDeposit = 0;

  cart.forEach(item => {
    // 桌面版設備項目
    if (equipmentList) {
      const itemElement = createSummaryItem(item);
      equipmentList.appendChild(itemElement);
    }

    // 手機版設備項目
    if (equipmentListMobile) {
      const mobileItemElement = createMobileSummaryItem(item);
      equipmentListMobile.appendChild(mobileItemElement);
    }

    // 分類計算押金（區域項目算空間，其他算設備）
    const itemTotal = item.deposit * item.quantity;
    if (item.category === 'area' || item.category === 'classroom') {
      spaceDeposit += itemTotal;
    } else {
      equipmentDeposit += itemTotal;
    }
  });

  // 應用押金上限：設備最高5000，空間最高5000
  equipmentDeposit = Math.min(equipmentDeposit, 5000);
  spaceDeposit = Math.min(spaceDeposit, 5000);

  const totalDeposit = equipmentDeposit + spaceDeposit;

  // 更新總押金和分類押金顯示
  updateDepositDisplay(equipmentDeposit, spaceDeposit, totalDeposit);
}

// 更新押金顯示（桌面版和手機版）
function updateDepositDisplay(equipmentDeposit, spaceDeposit, totalDeposit) {
  const desktopDepositAmount = document.getElementById('total-deposit-amount');
  const mobileDepositAmount = document.getElementById('total-deposit-amount-mobile');

  // 更新總押金
  const formattedAmount = `NT ${totalDeposit.toLocaleString()}`;
  if (desktopDepositAmount) desktopDepositAmount.textContent = formattedAmount;
  if (mobileDepositAmount) mobileDepositAmount.textContent = formattedAmount;

  // 如果兩種都有，顯示分類押金
  if (equipmentDeposit > 0 && spaceDeposit > 0) {
    insertDepositBreakdown(equipmentDeposit, spaceDeposit);
  }
}

// 插入押金分類顯示（在押金總額上方）
function insertDepositBreakdown(equipmentDeposit, spaceDeposit) {
  // 桌面版
  const desktopDepositAmount = document.getElementById('total-deposit-amount');
  if (desktopDepositAmount) {
    const breakdownDiv = document.createElement('div');
    breakdownDiv.className = 'my-3 space-y-1';
    breakdownDiv.innerHTML = `
      <div class="text-tiny text-white">
        <span class="font-chinese">設備押金：</span><span class="font-english">NT ${equipmentDeposit.toLocaleString()}</span>
      </div>
      <div class="text-tiny text-white">
        <span class="font-chinese">空間押金：</span><span class="font-english">NT ${spaceDeposit.toLocaleString()}</span>
      </div>
    `;
    // 插入到押金總額的上方
    desktopDepositAmount.parentElement.insertBefore(breakdownDiv, desktopDepositAmount);
  }

  // 手機版
  const mobileDepositAmount = document.getElementById('total-deposit-amount-mobile');
  if (mobileDepositAmount) {
    const breakdownDiv = document.createElement('div');
    breakdownDiv.className = 'mb-4 space-y-2';
    breakdownDiv.innerHTML = `
      <div class="text-tiny text-white">
        <span class="font-chinese">設備押金：</span><span class="font-english">NT ${equipmentDeposit.toLocaleString()}</span>
      </div>
      <div class="text-tiny text-white">
        <span class="font-chinese">空間押金：</span><span class="font-english">NT ${spaceDeposit.toLocaleString()}</span>
      </div>
    `;
    // 插入到押金總額的上方
    mobileDepositAmount.parentElement.insertBefore(breakdownDiv, mobileDepositAmount);
  }
}

// 創建摘要項目元素 (桌面版)
function createSummaryItem(item) {
  const div = document.createElement('div');
  div.className = 'summary-item flex items-center';
  div.style.cssText = 'height: 130px;';

  // 判斷是否為空間項目
  const isArea = item.category === 'area';
  const isClassroom = item.category === 'classroom' || (item.id && item.id.startsWith('A5'));

  // 空間圖片映射（與 rental-list.js 一致）
  const areaImageMap = {
    'square': 'Images/Square.webp',
    'corridor': 'Images/Corridor.webp',
    'glass-wall': 'Images/Glass Wall.webp',
    'pillar': 'Images/Pillar.webp',
    'front-terrace': '',
    'back-terrace': ''
  };

  const areaColorMap = {
    'front-terrace': '#4CAF50',
    'back-terrace': '#2196F3'
  };

  // 決定圖片來源
  let imageSrc = item.image || item.mainImage;

  if (isArea && item.areaKey) {
    imageSrc = areaImageMap[item.areaKey] || imageSrc;
  }

  // 判斷是否需要用顏色替代圖片
  const useColorBlock = isArea && item.areaKey && !areaImageMap[item.areaKey];
  const backgroundColor = useColorBlock ? (areaColorMap[item.areaKey] || '#565656') : '';

  let imageSection = '';
  if (useColorBlock) {
    imageSection = `
    <div class="flex items-center justify-center" style="width: 120px;">
      <div style="height: 96px; width: 76.8px; background-color: ${backgroundColor}; display: flex; align-items: center; justify-content: center;">
        <span class="text-white text-sm font-medium">區域</span>
      </div>
    </div>`;
  } else {
    imageSection = `
    <div class="flex items-center justify-center" style="width: 120px;">
      <div style="height: 96px; width: 76.8px;">
        <img src="${imageSrc}" alt="${isArea ? '空間' : isClassroom ? '教室' : '設備'}圖片" class="w-full h-full object-cover">
      </div>
    </div>`;
  }

  div.innerHTML = `
    ${imageSection}

    <!-- 設備/空間資訊和押金 -->
    <div class="flex-1 flex justify-between items-center ml-6">
      <!-- 左邊：名稱和數量 -->
      <div>
        <h3 class="text-xl font-['Inter',_sans-serif] font-medium tracking-wide text-white mb-3">${item.name}</h3>
        <div class="flex items-center space-x-4">
          <span class="text-base font-['Noto_Sans_TC',_sans-serif]" style="color: #cccccc;">數量</span>
          <span class="text-base font-['Inter',_sans-serif] text-white">${item.quantity}</span>
        </div>
      </div>

      <!-- 右邊：押金 -->
      <div class="text-right">
        <span class="text-2xl font-['Inter',_sans-serif] font-normal tracking-wide text-white">NT ${(item.deposit * item.quantity).toLocaleString()}</span>
      </div>
    </div>
  `;

  return div;
}

// 創建手機版摘要項目元素
function createMobileSummaryItem(item) {
  const li = document.createElement('li');
  li.className = 'flex items-center justify-between';

  // 判斷是否為空間項目
  const isArea = item.category === 'area';
  const isClassroom = item.category === 'classroom' || (item.id && item.id.startsWith('A5'));

  // 空間圖片映射（與桌面版一致）
  const areaImageMap = {
    'square': 'Images/Square.webp',
    'corridor': 'Images/Corridor.webp',
    'glass-wall': 'Images/Glass Wall.webp',
    'pillar': 'Images/Pillar.webp',
    'front-terrace': '',
    'back-terrace': ''
  };

  const areaColorMap = {
    'front-terrace': '#4CAF50',
    'back-terrace': '#2196F3'
  };

  // 決定圖片來源
  let imageSrc = item.image || item.mainImage;

  if (isArea && item.areaKey) {
    imageSrc = areaImageMap[item.areaKey] || imageSrc;
  }

  // 判斷是否需要用顏色替代圖片
  const useColorBlock = isArea && item.areaKey && !areaImageMap[item.areaKey];
  const backgroundColor = useColorBlock ? (areaColorMap[item.areaKey] || '#565656') : '';

  let imageSection = '';
  if (useColorBlock) {
    imageSection = `
      <div style="width: 60px; height: 72px; background-color: ${backgroundColor}; display: flex; align-items: center; justify-content: center;">
        <span class="text-white text-xs font-medium">區域</span>
      </div>`;
  } else {
    imageSection = `
      <div style="width: 60px; height: 72px;">
        <img src="${imageSrc}" alt="${isArea ? '空間' : isClassroom ? '教室' : '設備'}圖片" class="w-full h-full object-cover">
      </div>`;
  }

  li.innerHTML = `
    <!-- 左邊：設備/空間資訊 -->
    <div class="flex items-center gap-5">
      ${imageSection}
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-['Inter',_sans-serif] font-medium text-white">${item.name}</h3>
        <div class="flex items-center gap-2">
          <div class="text-xs" style="color: #cccccc;">數量</div>
          <div class="text-xs text-white">${item.quantity}</div>
        </div>
      </div>
    </div>

    <!-- 右邊：押金 -->
    <div class="text-right">
      <span class="text-sm font-['Inter',_sans-serif] text-white">NT ${(item.deposit * item.quantity).toLocaleString()}</span>
    </div>
  `;

  return li;
}

// 設定下載按鈕
function setupDownloadButton() {
  const downloadBtn = document.getElementById('download-btn');
  const downloadBtnMobile = document.getElementById('download-btn-mobile');
  
  function handleDownload() {
    // 暫時只顯示提示，之後可以實作真實的下載功能
    alert('下載功能將在未來版本中實現');
  }
  
  if (downloadBtn) {
    downloadBtn.addEventListener('click', handleDownload);
  }
  
  if (downloadBtnMobile) {
    downloadBtnMobile.addEventListener('click', handleDownload);
  }
}

// 更新購物車數量顯示
function updateCartCount() {
  // 收據頁面購物車應該是空的
  const cartCount = document.getElementById('cart-count');
  const mobileCartCount = document.getElementById('mobile-cart-count');
  
  if (cartCount) cartCount.textContent = '0';
  if (mobileCartCount) mobileCartCount.textContent = '0';
}

// 添加租借記錄到歷史
function addRentalToHistory() {
  // 檢查是否為新租借（沒有 rental_id 參數）
  const urlParams = new URLSearchParams(window.location.search);
  const rentalId = urlParams.get('rental_id');

  // 如果已有 rental_id，表示是查看歷史記錄，不需要添加
  if (rentalId) {
    console.log('查看歷史記錄，不添加新租借');
    return;
  }

  // 檢查用戶是否登入
  if (typeof window.AuthStorage === 'undefined' || !window.AuthStorage.isLoggedIn()) {
    console.warn('用戶未登入，無法添加租借記錄');
    return;
  }

  const loginData = window.AuthStorage.getLoginData();
  if (!loginData || !loginData.student) {
    console.warn('無法獲取用戶資料');
    return;
  }

  // 獲取當前租借號碼
  const rentalNumber = localStorage.getItem('currentRentalNumber');
  if (!rentalNumber) {
    console.error('無法獲取租借號碼');
    return;
  }

  // 檢查是否已經添加過此租借記錄（避免重複添加）
  const addedKey = `rental_added_${rentalNumber}`;
  if (localStorage.getItem(addedKey)) {
    console.log('此租借記錄已添加，跳過');
    return;
  }

  // 從 localStorage 讀取租借日期
  const savedDates = localStorage.getItem('selectedRentalDates');
  let startDate, endDate, dueDate;

  if (savedDates) {
    try {
      const dateData = JSON.parse(savedDates);
      startDate = new Date(dateData.startDate).getTime();
      endDate = new Date(dateData.endDate).getTime();
      dueDate = endDate; // 到期日等於歸還日
    } catch (error) {
      console.error('無法解析保存的日期資料:', error);
      const today = new Date();
      const returnDate = new Date(today);
      returnDate.setDate(today.getDate() + 3);
      startDate = today.getTime();
      endDate = returnDate.getTime();
      dueDate = endDate;
    }
  } else {
    const today = new Date();
    const returnDate = new Date(today);
    returnDate.setDate(today.getDate() + 3);
    startDate = today.getTime();
    endDate = returnDate.getTime();
    dueDate = endDate;
  }

  // 從 localStorage 讀取租借的設備
  const rentalData = localStorage.getItem('rentalCartData');
  let items = [];
  if (rentalData) {
    try {
      const cart = JSON.parse(rentalData);
      items = cart.map(item => item.name);
    } catch (error) {
      console.error('無法解析租借設備資料:', error);
    }
  }

  // 初始化 RentalHistoryManager
  if (!window.RentalHistoryManager) {
    console.error('RentalHistoryManager 未載入');
    return;
  }

  const rentalHistoryManager = new window.RentalHistoryManager();
  rentalHistoryManager.init(loginData.student);

  // 使用當前顯示的租借號碼創建記錄
  // addRentalRecord 會使用全域訂單號碼管理器，但我們要確保使用頁面上顯示的號碼
  const rentals = rentalHistoryManager.getRentalHistoryData();

  // 直接構建租借記錄對象
  const newRental = {
    id: rentalNumber.replace('#', 'rental_'),
    orderNumber: rentalNumber,
    startDate: startDate,
    endDate: endDate,
    dueDate: dueDate,
    status: window.RENTAL_STATUS.ONGOING,
    items: items
  };

  // 添加到租借列表並保存
  rentals.unshift(newRental);
  rentalHistoryManager.saveRentalHistoryData(rentals);

  console.log('✅ 已添加租借記錄:', newRental);

  // 標記此租借記錄已添加
  localStorage.setItem(addedKey, 'true');
}

// 初始化收據頁面
function initRentalReceiptPage() {
  clearCartAfterRental();
  generateRentalInfo();
  loadEquipmentSummary();
  setupDownloadButton();
  updateCartCount();
  addRentalToHistory(); // 添加租借記錄到歷史
}

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initRentalReceiptPage();
}); 