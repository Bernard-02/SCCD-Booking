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
  
  // 檢查是否為教室項目
  const isClassroom = item.category === 'classroom' || item.id.startsWith('A5');
  
  div.innerHTML = `
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
    </div>
    
    <!-- 設備/教室資訊 -->
    <div class="space-y-2 info-container">
      <div> <!-- Info top part wrapper -->
        <h3 class="text-small-title font-['Inter',_sans-serif] font-medium text-white text-left">${item.name}</h3>
        
        <div class="text-left mt-2">
          <span class="text-small-title font-['Inter',_sans-serif] font-normal text-white tracking-wide" data-unit-price="${item.deposit || item.price || 0}" data-total-price="${(item.deposit || item.price || 0) * (item.quantity || 1)}" data-equipment-id="${item.id}">NT ${((item.deposit || item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
        </div>
        
        ${!isClassroom ? `
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
  
  // 為卡片添加點擊事件
  div.addEventListener('click', function(e) {
    // 如果點擊的是數量按鈕或刪除按鈕，不執行跳轉
    if (e.target.closest('.quantity-btn') || e.target.closest('.remove-btn') || e.target.closest('.mobile-delete-btn')) {
      return;
    }
    
    if (isClassroom) {
      // 教室卡片跳轉到 classroom.html
      window.location.href = 'classroom.html';
    } else {
      // 設備跳轉到詳情頁面
      window.location.href = `equipment-detail.html?id=${item.id}`;
    }
  });
  
  return div;
}

// 增加數量 - 只適用於設備，教室不允許修改數量
function increaseQuantity(equipmentId) {
  const cart = window.cartManager.getCart();
  const item = cart.find(item => item.id === equipmentId);
  
  // 檢查是否為教室項目
  const isClassroom = item && (item.category === 'classroom' || item.id.startsWith('A5'));
  
  if (item && !isClassroom) {
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

// 更新摘要
function updateSummary() {
  const cart = window.cartManager.getCart();
  const emptyMessage = document.getElementById('empty-message');
  const checkbox = document.getElementById('terms-checkbox');
  const mobileCheckbox = document.getElementById('mobile-terms-checkbox');
  const rentalBtn = document.getElementById('rental-btn');
  const mobileRentalBtn = document.getElementById('mobile-rental-btn');
  let totalItems = 0;
  let totalDeposit = 0;
  
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
      rentalBtn.disabled = true;
      rentalBtn.classList.add('opacity-30', 'cursor-not-allowed');
      rentalBtn.classList.remove('opacity-100', 'cursor-pointer');
    }
    if (mobileRentalBtn) {
      mobileRentalBtn.disabled = true;
      mobileRentalBtn.classList.add('opacity-30', 'cursor-not-allowed');
      mobileRentalBtn.classList.remove('opacity-100', 'cursor-pointer');
    }
  } else {
    // 隱藏空清單提示
    if (emptyMessage) emptyMessage.classList.add('hide');
    
    // 恢復checkbox可用狀態
    if (checkbox) checkbox.disabled = false;
    if (mobileCheckbox) mobileCheckbox.disabled = false;
    
    cart.forEach(item => {
      const quantity = item.quantity || 1;
      const price = item.deposit || item.price || 0;
      totalItems += quantity;
      totalDeposit += price * quantity;
    });
    
    // 根據checkbox狀態設定button（檢查任一個checkbox）
    const isChecked = (checkbox && checkbox.checked) || (mobileCheckbox && mobileCheckbox.checked);
    
    if (rentalBtn) {
      if (isChecked) {
        rentalBtn.disabled = false;
        rentalBtn.classList.remove('opacity-30', 'cursor-not-allowed');
        rentalBtn.classList.add('opacity-100', 'cursor-pointer');
      } else {
        rentalBtn.disabled = true;
        rentalBtn.classList.add('opacity-30', 'cursor-not-allowed');
        rentalBtn.classList.remove('opacity-100', 'cursor-pointer');
      }
    }
    
    if (mobileRentalBtn) {
      if (isChecked) {
        mobileRentalBtn.disabled = false;
        mobileRentalBtn.classList.remove('opacity-30', 'cursor-not-allowed');
        mobileRentalBtn.classList.add('opacity-100', 'cursor-pointer');
      } else {
        mobileRentalBtn.disabled = true;
        mobileRentalBtn.classList.add('opacity-30', 'cursor-not-allowed');
        mobileRentalBtn.classList.remove('opacity-100', 'cursor-pointer');
      }
    }
  }
  
  // 更新所有相關數量顯示
  const cartTitleCount = document.getElementById('cart-title-count');
  const totalItemsElement = document.getElementById('total-items');
  const mobileTotalItemsElement = document.getElementById('mobile-total-items');
  const totalDepositElement = document.getElementById('total-deposit');
  const mobileTotalDepositElement = document.getElementById('mobile-total-deposit');
  
  if (cartTitleCount) cartTitleCount.textContent = totalItems;
  if (totalItemsElement) totalItemsElement.textContent = totalItems;
  if (mobileTotalItemsElement) mobileTotalItemsElement.textContent = totalItems;
  if (totalDepositElement) totalDepositElement.textContent = formatCurrency(totalDeposit);
  if (mobileTotalDepositElement) mobileTotalDepositElement.textContent = formatCurrency(totalDeposit);
}

// 初始化按鈕狀態
function updateButtonState(checked) {
  // 桌面版按鈕
  const rentalBtn = document.getElementById('rental-btn');
  if (rentalBtn) {
    if (checked) {
      rentalBtn.disabled = false;
      rentalBtn.classList.remove('opacity-30', 'cursor-not-allowed');
      rentalBtn.classList.add('opacity-100', 'cursor-pointer');
    } else {
      rentalBtn.disabled = true;
      rentalBtn.classList.add('opacity-30', 'cursor-not-allowed');
      rentalBtn.classList.remove('opacity-100', 'cursor-pointer');
    }
  }
  
  // 手機版按鈕
  const mobileRentalBtn = document.getElementById('mobile-rental-btn');
  if (mobileRentalBtn) {
    if (checked) {
      mobileRentalBtn.disabled = false;
      mobileRentalBtn.classList.remove('opacity-30', 'cursor-not-allowed');
      mobileRentalBtn.classList.add('opacity-100', 'cursor-pointer');
    } else {
      mobileRentalBtn.disabled = true;
      mobileRentalBtn.classList.add('opacity-30', 'cursor-not-allowed');
      mobileRentalBtn.classList.remove('opacity-100', 'cursor-pointer');
    }
  }
}

// 處理租借按鈕點擊
function handleRentalClick(button, checkbox) {
  if (!button.disabled && checkbox.checked) {
    // 保存當前購物車數據到localStorage
    const currentCart = window.cartManager.getCart();
    localStorage.setItem('rentalCartData', JSON.stringify(currentCart));
    
    // 清除舊的租借號，讓收據頁面生成新的
    localStorage.removeItem('currentRentalNumber');
    
    // 清除暫存的日期選擇
    localStorage.removeItem('tempSelectedDates');
    
    // 跳轉到租借收據頁面
    window.location.href = 'rental-receipt.html';
  }
}

// 跳轉到詳情頁面
function goToDetailPage(itemId) {
  // 阻止事件冒泡
  event.stopPropagation();
  
  // 檢查是否為教室項目
  if (itemId.startsWith('A5')) {
    // 教室項目跳轉到教室頁面
    window.location.href = 'classroom.html';
    return;
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
    rentalBtn.addEventListener('click', function() {
      handleRentalClick(this, checkbox);
    });
  }
  
  if (mobileRentalBtn && mobileCheckbox) {
    mobileRentalBtn.addEventListener('click', function() {
      handleRentalClick(this, mobileCheckbox);
    });
  }
  
  // 監聽購物車更新事件
  window.addEventListener('cartUpdated', function(event) {
    loadCartItems();
    updateSummary();
  });
}

// 暴露給全域
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeItem = removeItem;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initRentalListPage();
}); 