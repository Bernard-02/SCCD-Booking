/* ===== 租借收據頁面專用 JavaScript ===== */

// 清空購物車（租借完成後）
function clearCartAfterRental() {
  window.cartManager.clearCart();
}

// 生成租借資訊
function generateRentalInfo() {
  // 檢查是否已有儲存的租借號
  let rentalNumber = localStorage.getItem('currentRentalNumber');
  
  if (!rentalNumber) {
    // 如果沒有，生成新的租借號並儲存
    rentalNumber = generateRentalNumber();
    localStorage.setItem('currentRentalNumber', rentalNumber);
  }
  
  // 更新租借號 - 手機版和桌面版
  const mobileRentalNumber = document.getElementById('rental-number');
  const desktopRentalNumber = document.getElementById('rental-number-desktop');
  if (mobileRentalNumber) mobileRentalNumber.textContent = rentalNumber;
  if (desktopRentalNumber) desktopRentalNumber.textContent = rentalNumber;
  
  // 生成條碼 - 手機版和桌面版
  const mobileBarcode = document.getElementById('barcode');
  const desktopBarcode = document.getElementById('barcode-desktop');
  
  if (mobileBarcode) {
    JsBarcode("#barcode", rentalNumber, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: false,
      background: "transparent",
      lineColor: "white",
      margin: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      marginBottom: 0
    });
  }
  
  if (desktopBarcode) {
    JsBarcode("#barcode-desktop", rentalNumber, {
      format: "CODE128",
      width: 2,
      height: 60,
      displayValue: false,
      background: "transparent",
      lineColor: "white",
      margin: 0,
      marginLeft: 0,
      marginRight: 0,
      marginTop: 0,
      marginBottom: 0
    });
  }

  // 從 localStorage 讀取選擇的租借日期
  let startDate, endDate;
  
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
      // 回退到預設日期（當前日期+3天）
      const today = new Date();
      const returnDate = new Date(today);
      returnDate.setDate(today.getDate() + 3);
      
      startDate = formatDate(today);
      endDate = formatDate(returnDate);
    }
  } else {
    // 如果沒有保存的日期，使用預設日期（當前日期+3天）
    const today = new Date();
    const returnDate = new Date(today);
    returnDate.setDate(today.getDate() + 3);
    
    startDate = formatDate(today);
    endDate = formatDate(returnDate);
  }
  
  // 更新租借日期 - 手機版和桌面版
  const mobileRentalDates = document.getElementById('rental-dates');
  const desktopRentalDates = document.getElementById('rental-dates-desktop');
  if (mobileRentalDates) mobileRentalDates.textContent = `${startDate}  -  ${endDate}`;
  if (desktopRentalDates) desktopRentalDates.textContent = `${startDate}  -  ${endDate}`;
}

// 生成隨機租借號
function generateRentalNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
  
  let totalDeposit = 0;

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
    
    totalDeposit += item.deposit * item.quantity;
  });

  // 更新總押金 - 桌面版和手機版
  const desktopDepositAmount = document.getElementById('total-deposit-amount');
  const mobileDepositAmount = document.getElementById('total-deposit-amount-mobile');
  const formattedAmount = `NT${totalDeposit.toLocaleString()}`;
  
  if (desktopDepositAmount) desktopDepositAmount.textContent = formattedAmount;
  if (mobileDepositAmount) mobileDepositAmount.textContent = formattedAmount;
}

// 創建摘要項目元素 (桌面版)
function createSummaryItem(item) {
  const div = document.createElement('div');
  div.className = 'summary-item flex items-center';
  div.style.cssText = 'height: 150px;';
  
  div.innerHTML = `
    <!-- 設備圖片 -->
    <div class="flex items-center justify-center" style="width: 120px;">
      <div style="height: 96px; width: 76.8px;">
        <img src="${item.image}" alt="設備圖片" class="w-full h-full object-cover">
      </div>
    </div>
    
    <!-- 設備資訊和押金 -->
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
        <span class="text-2xl font-['Inter',_sans-serif] font-normal tracking-wide text-white">NT${(item.deposit * item.quantity).toLocaleString()}</span>
      </div>
    </div>
  `;
  
  return div;
}

// 創建手機版摘要項目元素
function createMobileSummaryItem(item) {
  const li = document.createElement('li');
  li.className = 'flex items-center justify-between';
  
  li.innerHTML = `
    <!-- 左邊：設備資訊 -->
    <div class="flex items-center gap-5">
      <div style="width: 60px; height: 72px;">
        <img src="${item.image}" alt="設備圖片" class="w-full h-full object-cover">
      </div>
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
      <span class="text-sm font-['Inter',_sans-serif] text-white">NT${(item.deposit * item.quantity).toLocaleString()}</span>
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

// 初始化收據頁面
function initRentalReceiptPage() {
  clearCartAfterRental();
  generateRentalInfo();
  loadEquipmentSummary();
  setupDownloadButton();
  updateCartCount();
}

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initRentalReceiptPage();
}); 