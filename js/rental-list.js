/* ===== 租借清單頁面專用 JavaScript ===== */

// 租借按鈕動畫功能
function setupRentalButtonAnimation() {
  const button = document.getElementById('rental-btn');
  
  // hero-cta 樣式的按鈕不需要額外的 JavaScript 動畫
  // CSS 中已經定義了 hover 效果
  if (button && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // 只需要確保按鈕在啟用時可以正常 hover
    // 禁用狀態時不應該有 hover 效果
    const originalPointerEvents = window.getComputedStyle(button).pointerEvents;
    
    // 監聽按鈕狀態變化
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
          if (button.disabled) {
            button.style.pointerEvents = 'none';
          } else {
            button.style.pointerEvents = originalPointerEvents;
          }
        }
      });
    });
    
    observer.observe(button, { attributes: true });
  }
}

// 動態調整租借摘要位置
function adjustSummaryPosition() {
  const footer = document.querySelector('footer');
  const cart = window.cartManager.getCart();
  
  // 如果購物車為空，不調整任何位置，讓 footer 回到原本位置
  if (cart.length === 0) {
    return;
  }
  
  // 這個頁面沒有租借摘要，所以不需要調整位置
  // 保持 footer 在原本的位置
}

// 從購物車管理器載入設備項目
function loadCartItems() {
  const equipmentList = document.getElementById('equipment-list');
  const cart = window.cartManager.getCart();
  
  // 清除現有項目（除了空清單提示）
  const existingItems = equipmentList.querySelectorAll('.equipment-card');
  existingItems.forEach(item => item.remove());
  
  // 創建網格容器
  let gridContainer = equipmentList.querySelector('.equipment-grid');
  if (!gridContainer) {
    gridContainer = document.createElement('div');
    gridContainer.className = 'equipment-grid';
    equipmentList.appendChild(gridContainer);
  } else {
    // 清空現有項目
    gridContainer.innerHTML = '';
  }
  
  // 添加購物車中的項目
  cart.forEach(item => {
    const itemElement = createEquipmentItem(item);
    gridContainer.appendChild(itemElement);
  });
}

// 創建設備項目元素
function createEquipmentItem(item) {
  const div = document.createElement('div');
  div.className = 'equipment-card';
  
  // 檢查是否為教室項目或區域項目
  const isClassroom = item.category === 'classroom' || item.id.startsWith('A5');
  const isArea = item.category === 'area';
  
  let imageSection = '';
  if (!isArea) {
    // 只有非區域項目才顯示圖片
    imageSection = `
    <!-- 設備/教室圖片 -->
    <div class="relative mb-6 image-container" onclick="goToDetailPage('${item.id}')">
      <div class="w-full h-84">
        <img src="${item.image || item.mainImage}" alt="${isClassroom ? '教室' : '設備'}圖片" class="w-full h-full object-cover">
      </div>
      
      <!-- 刪除按鈕 (Desktop) -->
      <div class="remove-btn" onclick="event.stopPropagation(); removeItem('${item.id}')">
        <svg viewBox="0 0 20 20">
          <line x1="4" y1="4" x2="16" y2="16" stroke="black" stroke-width="1"/>
          <line x1="16" y1="4" x2="4" y2="16" stroke="black" stroke-width="1"/>
        </svg>
      </div>
    </div>`;
  } else {
    // 區域項目顯示相應圖片
    const areaImageMap = {
      'square': 'Images/Square.webp',
      'corridor': 'Images/Corridor.webp',
      'glass-wall': 'Images/Glass Wall.webp',
      'pillar': 'Images/Pillar.webp',
      'front-terrace': '', // 沒有圖片，用顏色替代
      'back-terrace': ''   // 沒有圖片，用顏色替代
    };
    
    const areaColorMap = {
      'front-terrace': '#4CAF50', // 綠色
      'back-terrace': '#2196F3'   // 藍色
    };
    
    const imagePath = areaImageMap[item.areaKey] || '';
    const backgroundColor = areaColorMap[item.areaKey] || '#565656';
    
    if (imagePath) {
      // 有圖片的區域
      imageSection = `
      <!-- 區域項目圖片 -->
      <div class="relative mb-6 image-container" onclick="goToDetailPage('${item.id}')">
        <div class="w-full h-84">
          <img src="${imagePath}" alt="區域圖片" class="w-full h-full object-cover">
        </div>
        
        <!-- 刪除按鈕 (Desktop) -->
        <div class="remove-btn" onclick="event.stopPropagation(); removeItem('${item.id}')">
          <svg viewBox="0 0 20 20">
            <line x1="4" y1="4" x2="16" y2="16" stroke="black" stroke-width="1"/>
            <line x1="16" y1="4" x2="4" y2="16" stroke="black" stroke-width="1"/>
          </svg>
        </div>
      </div>`;
    } else {
      // 沒有圖片的區域，用顏色替代
      imageSection = `
      <!-- 區域項目色塊 -->
      <div class="relative mb-6" onclick="goToDetailPage('${item.id}')">
        <div class="w-full h-84 flex items-center justify-center" style="background-color: ${backgroundColor}">
          <span class="text-white text-lg font-medium">區域租借</span>
        </div>
        
        <!-- 刪除按鈕 (Desktop) -->
        <div class="remove-btn" onclick="event.stopPropagation(); removeItem('${item.id}')">
          <svg viewBox="0 0 20 20">
            <line x1="4" y1="4" x2="16" y2="16" stroke="black" stroke-width="1"/>
            <line x1="16" y1="4" x2="4" y2="16" stroke="black" stroke-width="1"/>
          </svg>
        </div>
      </div>`;
    }
  }
  
  div.innerHTML = `
    ${imageSection}
    
    <!-- 設備/教室/區域資訊 -->
    <div class="space-y-2 info-container">
      <div> <!-- Info top part wrapper -->
        <h3 class="text-small-title font-['Inter',_sans-serif] font-medium text-white text-left">${item.name}</h3>
        
        <div class="text-left mt-2">
          <span class="text-small-title font-['Inter',_sans-serif] font-normal text-white tracking-wide" data-unit-price="${item.deposit || item.price || 0}" data-total-price="${(item.deposit || item.price || 0) * (item.quantity || 1)}" data-equipment-id="${item.id}">NT ${((item.deposit || item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
        </div>
        
        ${!isClassroom && !isArea ? `
        <div class="flex items-center justify-start space-x-3 mt-4">
          <svg class="quantity-btn ${(item.quantity || 1) === 1 ? 'disabled' : ''}" viewBox="0 0 20 20" onclick="event.stopPropagation(); decreaseQuantity('${item.id}')" style="width: 20px; height: 20px;">
            <line x1="4" y1="10" x2="16" y2="10" stroke="white" stroke-width="1"/>
          </svg>
          <span class="text-header font-['Inter',_sans-serif] font-normal text-white min-w-[1.5rem] text-center" data-quantity="${item.quantity || 1}" data-equipment-id="${item.id}">${item.quantity || 1}</span>
          <svg class="quantity-btn" viewBox="0 0 20 20" onclick="event.stopPropagation(); increaseQuantity('${item.id}')" style="width: 20px; height: 20px;">
            <line x1="10" y1="4" x2="10" y2="16" stroke="white" stroke-width="1"/>
            <line x1="4" y1="10" x2="16" y2="10" stroke="white" stroke-width="1"/>
          </svg>
        </div>
                       ` : `
               <div class="mt-4">
                 <span class="text-breadcrumb font-['Inter',_sans-serif]" style="color: #cccccc">數量 | 1</span>
               </div>
               `}
      </div>
      <button class="mobile-delete-btn" onclick="removeItem('${item.id}')">DELETE</button>
    </div>
  `;
  
  // 不再為整個卡片添加點擊事件，只有圖片區域可點擊
  
  return div;
}

// 增加數量 - 只適用於設備，教室不允許修改數量
function increaseQuantity(equipmentId) {
  const cart = window.cartManager.getCart();
  const item = cart.find(item => item.id === equipmentId);

  // 檢查是否為教室項目
  const isClassroom = item && (item.category === 'classroom' || item.id.startsWith('A5'));

  if (item && !isClassroom) {
    // 允許無限添加設備，顯示時會限制在5000
    window.cartManager.updateQuantity(equipmentId, item.quantity + 1);
  }
}

// 減少數量 - 只適用於設備，教室不允許修改數量
function decreaseQuantity(equipmentId) {
  const cart = window.cartManager.getCart();
  const item = cart.find(item => item.id === equipmentId);
  
  // 檢查是否為教室項目
  const isClassroom = item && (item.category === 'classroom' || item.id.startsWith('A5'));
  
  if (item && !isClassroom && item.quantity > 1) {
    window.cartManager.updateQuantity(equipmentId, item.quantity - 1);
  }
}

// 移除項目
function removeItem(equipmentId) {
  // 找到對應的設備卡片元素
  const equipmentCards = document.querySelectorAll('.equipment-card');
  let targetCard = null;
  
  equipmentCards.forEach(card => {
    const quantitySpan = card.querySelector(`[data-equipment-id="${equipmentId}"]`);
    if (quantitySpan) {
      targetCard = card;
    }
  });
  
  if (targetCard) {
    // 添加淡出動畫class
    targetCard.classList.add('fade-out');
    
    // 等待動畫完成後執行實際刪除
    setTimeout(() => {
      window.cartManager.removeFromCart(equipmentId);
    }, 500); // 0.5秒後執行刪除
  } else {
    // 如果找不到對應卡片，直接執行刪除
    window.cartManager.removeFromCart(equipmentId);
  }
}

// 格式化貨幣
function formatCurrency(amount) {
  return `NT ${amount.toLocaleString()}`;
}

// 獲取當前設備押金總額（排除教室和空間）
function getCurrentEquipmentDeposit() {
  const cart = window.cartManager.getCart();
  let equipmentDeposit = 0;

  cart.forEach(item => {
    // 檢查是否為設備項目（排除教室和空間）
    const isEquipment = !(item.category === 'classroom' || item.id.startsWith('A5'));
    if (isEquipment) {
      const quantity = item.quantity || 1;
      const price = item.deposit || item.price || 0;
      equipmentDeposit += price * quantity;
    }
  });

  // 應用5000上限
  return Math.min(equipmentDeposit, 5000);
}



// 更新摘要
function updateSummary() {
  const cart = window.cartManager.getCart();
  const emptyMessage = document.getElementById('empty-message');
  const checkbox = document.getElementById('terms-checkbox');
  const mobileCheckbox = document.getElementById('mobile-terms-checkbox');
  const rentalBtn = document.getElementById('rental-btn');
  const mobileRentalBtn = document.getElementById('mobile-rental-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');
  let totalItems = 0;
  let rawEquipmentDeposit = 0; // 原始設備押金（用於計算）
  let classroomSpaceDeposit = 0; // 教室和空間押金
  let displayDeposit = 0; // 實際顯示的押金

  // 檢查是否有設備項目
  if (cart.length === 0) {
    // 顯示空清單提示
    if (emptyMessage) emptyMessage.classList.remove('hide');

    // 禁用checkbox和button
    if (checkbox) {
      checkbox.disabled = true;
      checkbox.checked = false;
    }
    if (mobileCheckbox) {
      mobileCheckbox.disabled = true;
      mobileCheckbox.checked = false;
    }

    if (rentalBtn) {
      rentalBtn.classList.add('disabled');
    }
    if (mobileRentalBtn) {
      mobileRentalBtn.classList.add('disabled');
    }
    
    // 禁用 CLEAR ALL 按鈕
    if (clearAllBtn) {
      clearAllBtn.classList.add('disabled');
    }
  } else {
    // 隱藏空清單提示
    if (emptyMessage) emptyMessage.classList.add('hide');

    cart.forEach(item => {
      const quantity = item.quantity || 1;
      const price = item.deposit || item.price || 0;
      totalItems += quantity;

      // 分離設備和教室/空間押金
      const isEquipment = !(item.category === 'classroom' || item.category === 'area' || item.id.startsWith('A5'));
      if (isEquipment) {
        rawEquipmentDeposit += price * quantity;
      } else {
        classroomSpaceDeposit += price * quantity;
      }
    });

    // 計算顯示押金：設備押金上限5000 + 空間押金上限5000
    const cappedEquipmentDeposit = Math.min(rawEquipmentDeposit, 5000);
    const cappedSpaceDeposit = Math.min(classroomSpaceDeposit, 5000);
    displayDeposit = cappedEquipmentDeposit + cappedSpaceDeposit;

    // 根據條件設定按鈕狀態（不再檢查押金上限）
    const isChecked = (checkbox && checkbox.checked) || (mobileCheckbox && mobileCheckbox.checked);
    const canRent = isChecked;

    if (rentalBtn) {
      if (canRent) {
        rentalBtn.classList.remove('disabled');
      } else {
        rentalBtn.classList.add('disabled');
      }
    }

    if (mobileRentalBtn) {
      if (canRent) {
        mobileRentalBtn.classList.remove('disabled');
      } else {
        mobileRentalBtn.classList.add('disabled');
      }
    }
    
    // 啟用 CLEAR ALL 按鈕（當有項目時）
    if (clearAllBtn) {
      clearAllBtn.classList.remove('disabled');
    }
  }

  // 更新所有相關數量顯示
  const cartTitleCount = document.getElementById('cart-count-title');
  const totalItemsElement = document.getElementById('total-items');
  const mobileTotalItemsElement = document.getElementById('mobile-total-items');
  const totalDepositElement = document.getElementById('total-deposit');
  const mobileTotalDepositElement = document.getElementById('mobile-total-deposit');

  // 押金詳細顯示元素
  const depositBreakdown = document.getElementById('deposit-breakdown');
  const mobileDepositBreakdown = document.getElementById('mobile-deposit-breakdown');
  const equipmentDepositElement = document.getElementById('equipment-deposit');
  const spaceDepositElement = document.getElementById('space-deposit');
  const mobileEquipmentDepositElement = document.getElementById('mobile-equipment-deposit');
  const mobileSpaceDepositElement = document.getElementById('mobile-space-deposit');

  if (cartTitleCount) cartTitleCount.textContent = `(${totalItems})`;
  if (totalItemsElement) totalItemsElement.textContent = totalItems;
  if (mobileTotalItemsElement) mobileTotalItemsElement.textContent = totalItems;
  if (totalDepositElement) totalDepositElement.textContent = formatCurrency(displayDeposit);
  if (mobileTotalDepositElement) mobileTotalDepositElement.textContent = formatCurrency(displayDeposit);

  // 顯示/隱藏押金詳細
  const hasEquipment = rawEquipmentDeposit > 0;
  const hasSpace = classroomSpaceDeposit > 0;
  const showBreakdown = hasEquipment && hasSpace;

  if (depositBreakdown) {
    depositBreakdown.style.display = showBreakdown ? 'block' : 'none';
  }
  if (mobileDepositBreakdown) {
    mobileDepositBreakdown.style.display = showBreakdown ? 'block' : 'none';
  }

  // 更新押金詳細數值
  if (showBreakdown) {
    const cappedEquipmentDeposit = Math.min(rawEquipmentDeposit, 5000);
    const cappedSpaceDeposit = Math.min(classroomSpaceDeposit, 5000);
    
    if (equipmentDepositElement) equipmentDepositElement.textContent = formatCurrency(cappedEquipmentDeposit);
    if (spaceDepositElement) spaceDepositElement.textContent = formatCurrency(cappedSpaceDeposit);
    if (mobileEquipmentDepositElement) mobileEquipmentDepositElement.textContent = formatCurrency(cappedEquipmentDeposit);
    if (mobileSpaceDepositElement) mobileSpaceDepositElement.textContent = formatCurrency(cappedSpaceDeposit);
  }


}

// 初始化按鈕狀態
function updateButtonState(checked) {
  // 桌面版按鈕
  const rentalBtn = document.getElementById('rental-btn');
  if (rentalBtn) {
    if (checked) {
      rentalBtn.classList.remove('disabled');
    } else {
      rentalBtn.classList.add('disabled');
    }
  }
  
  // 手機版按鈕
  const mobileRentalBtn = document.getElementById('mobile-rental-btn');
  if (mobileRentalBtn) {
    if (checked) {
      mobileRentalBtn.classList.remove('disabled');
    } else {
      mobileRentalBtn.classList.add('disabled');
    }
  }
}

// 處理租借按鈕點擊
function handleRentalClick(button, checkbox) {
  console.log('Book按鈕被點擊了'); // Debug
  console.log('按鈕disabled狀態:', button.classList.contains('disabled')); // Debug
  console.log('Checkbox checked狀態:', checkbox.checked); // Debug

  // 檢查是否為disabled狀態
  if (button.classList.contains('disabled')) {
    console.log('按鈕是disabled狀態，無法點擊');
    return false; // 阻止點擊
  }

  // 檢查登入狀態
  if (!window.checkLoginStatus()) {
    console.log('用戶未登入，跳轉到登入頁面');
    window.redirectToLogin('請先登入以進行租借');
    return false;
  }

  if (checkbox.checked) {
    console.log('開始處理租借流程');
    // 保存當前購物車數據到localStorage
    const currentCart = window.cartManager.getCart();
    localStorage.setItem('rentalCartData', JSON.stringify(currentCart));

    // 清除舊的租借號，讓收據頁面生成新的
    localStorage.removeItem('currentRentalNumber');

    // 清除暫存的日期選擇
    localStorage.removeItem('tempSelectedDates');
    localStorage.removeItem('dateSelectionTime');

    // 更新租借流程狀態：已完成訂購
    if (window.rentalProgressManager) {
        window.rentalProgressManager.completeBookingConfirmation();
    }

    // 跳轉到租借收據頁面
    window.location.href = 'rental-receipt.html';
  } else {
    console.log('用戶未勾選同意條款');
  }
}

// 跳轉到詳情頁面
function goToDetailPage(itemId) {
  // 阻止事件冒泡
  event.stopPropagation();
  
  // 從購物車中找到對應項目
  const cart = window.cartManager.getCart();
  const item = cart.find(cartItem => cartItem.id === itemId);
  
  if (item) {
    if (item.category === 'area') {
      // 區域項目跳轉到該區域的平面圖頁面
      const areaKey = item.areaKey;
      window.location.href = `numbered-area.html?area=${areaKey}&from=rental-list`;
      return;
    } else if (item.category === 'classroom' || itemId.startsWith('A5')) {
      // 教室項目跳轉到教室頁面
      window.location.href = 'classroom.html';
      return;
    }
  }
  
  // 設備項目跳轉到設備詳情頁
  window.location.href = `equipment-detail.html?id=${itemId}`;
}

// 初始化頁面
function initRentalListPage() {
  loadCartItems();
  updateSummary();
  setupRentalButtonAnimation(); // 初始化按鈕動畫
  
  // 監聽checkbox變化
  const checkbox = document.getElementById('terms-checkbox');
  const mobileCheckbox = document.getElementById('mobile-terms-checkbox');
  const rentalBtn = document.getElementById('rental-btn');
  const mobileRentalBtn = document.getElementById('mobile-rental-btn');
  
  if (checkbox) {
    checkbox.addEventListener('change', function() {
      // 同步手機版checkbox
      if (mobileCheckbox) {
        mobileCheckbox.checked = this.checked;
      }
      updateButtonState(this.checked);
    });
  }
  
  if (mobileCheckbox) {
    mobileCheckbox.addEventListener('change', function() {
      // 同步桌面版checkbox
      if (checkbox) {
        checkbox.checked = this.checked;
      }
      updateButtonState(this.checked);
    });
  }
  
  // 租借按鈕點擊事件
  if (rentalBtn && checkbox) {
    console.log('桌面版Book按鈕事件監聽器已設置');
    rentalBtn.addEventListener('click', function(e) {
      e.preventDefault(); // 阻止a標籤的默認跳轉行為
      console.log('桌面版Book按鈕點擊事件觸發');
      handleRentalClick(this, checkbox);
    });
  } else {
    console.log('桌面版Book按鈕或checkbox未找到', { rentalBtn, checkbox });
  }

  if (mobileRentalBtn && mobileCheckbox) {
    console.log('手機版Book按鈕事件監聽器已設置');
    mobileRentalBtn.addEventListener('click', function(e) {
      e.preventDefault(); // 阻止a標籤的默認跳轉行為
      console.log('手機版Book按鈕點擊事件觸發');
      handleRentalClick(this, mobileCheckbox);
    });
  } else {
    console.log('手機版Book按鈕或checkbox未找到', { mobileRentalBtn, mobileCheckbox });
  }
  
  // 監聽購物車更新事件
  window.addEventListener('cartUpdated', function(event) {
    loadCartItems();
    updateSummary();
  });

  // CLEAR ALL 按鈕事件監聽器
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function(e) {
      e.preventDefault(); // 阻止默認行為
      
      // 如果按鈕被禁用，不執行任何操作
      if (this.classList.contains('disabled')) {
        return;
      }
      
      if (window.cartManager) {
        // 清空購物車
        window.cartManager.clearCart();
        // 立即更新頁面
        loadCartItems();
        updateSummary();
        // 觸發 cartUpdated 事件以同步其他頁面
        window.dispatchEvent(new CustomEvent('cartUpdated'));
      }
    });
  }
}

// 暴露給全域
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeItem = removeItem;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initRentalListPage();
}); 