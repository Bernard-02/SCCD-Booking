/* ===== 租借清單頁面專用 JavaScript ===== */

// 租借按鈕動畫功能
function setupRentalButtonAnimation() {
  const button = document.getElementById('rental-btn');
  const buttonFill = button ? button.querySelector('.button-bg-fill') : null;
  
  if (button && buttonFill && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    button.addEventListener('mouseenter', function() {
      if (!this.disabled) {
        gsap.to(buttonFill, {
          height: '100%',
          duration: 0.5,
          ease: "power2.out"
        });
        
        // 文字顏色變化
        this.classList.add('white-text');
      }
    });
    
    button.addEventListener('mouseleave', function() {
      if (!this.disabled) {
        gsap.to(buttonFill, {
          height: '0%',
          duration: 0.5,
          ease: "power2.out"
        });
        
        // 文字顏色恢復
        this.classList.remove('white-text');
      }
    });
  }
}

// 動態調整租借摘要位置
function adjustSummaryPosition() {
  const footer = document.querySelector('footer');
  const rentalSummary = document.querySelector('.rental-summary');
  const mainScrollArea = document.querySelector('.main-scroll-area');
  
  if (footer && rentalSummary && mainScrollArea) {
    const footerHeight = footer.offsetHeight;
    const summaryHeight = rentalSummary.offsetHeight;

    if (window.innerWidth <= 767) {
      // Mobile: stack summary on footer
      rentalSummary.style.bottom = `${footerHeight}px`;
      mainScrollArea.style.paddingBottom = `${footerHeight -40}px`;
    } else {
      // Desktop: summary at bottom: 80px, over footer
      const desktopSummaryBottom = 60; // As per CSS for .rental-summary
      rentalSummary.style.bottom = `${desktopSummaryBottom}px`;
      mainScrollArea.style.paddingBottom = `${summaryHeight -60}px`; // 減少桌面版 padding
    }
  }
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
    gridContainer.className = 'equipment-grid grid grid-cols-4 gap-16';
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
  
  // 檢查是否為教室
  const isClassroom = item.category === 'classroom';
  
  div.innerHTML = `
    <!-- 設備圖片 -->
    <div class="relative mb-6 image-container">
      <div class="w-full h-96">
        <img src="${item.image}" alt="設備圖片" class="w-full h-full object-cover">
      </div>
      
      <!-- 刪除按鈕 (Desktop) -->
      <div class="remove-btn" onclick="removeItem('${item.id}')">
        <svg viewBox="0 0 20 20">
          <line x1="4" y1="4" x2="16" y2="16" stroke="black" stroke-width="1"/>
          <line x1="16" y1="4" x2="4" y2="16" stroke="black" stroke-width="1"/>
        </svg>
      </div>
    </div>
    
    <!-- 設備資訊 -->
    <div class="space-y-2 info-container">
      <div> <!-- Info top part wrapper -->
        <h3 class="text-sm font-['Inter',_sans-serif] font-medium text-white text-left">${item.name}</h3>
        
        <div class="text-left mt-2">
          <span class="text-sm font-['Inter',_sans-serif] font-normal text-white tracking-wide" data-unit-price="${item.deposit}" data-total-price="${item.deposit * item.quantity}" data-equipment-id="${item.id}">NT${(item.deposit * item.quantity).toLocaleString()}</span>
        </div>
        
        <div class="flex items-center justify-start space-x-3 mt-4">
          <svg class="quantity-btn ${item.quantity === 1 || isClassroom ? 'disabled' : ''}" viewBox="0 0 20 20" onclick="${isClassroom ? '' : `decreaseQuantity('${item.id}')`}" style="width: 20px; height: 20px;">
            <line x1="4" y1="10" x2="16" y2="10" stroke="white" stroke-width="1"/>
          </svg>
          <span class="text-base font-['Inter',_sans-serif] font-normal text-white min-w-[1.5rem] text-center" data-quantity="${item.quantity}" data-equipment-id="${item.id}">${item.quantity}</span>
          <svg class="quantity-btn ${isClassroom ? 'disabled' : ''}" viewBox="0 0 20 20" onclick="${isClassroom ? '' : `increaseQuantity('${item.id}')`}" style="width: 20px; height: 20px;">
            <line x1="4" y1="10" x2="16" y2="10" stroke="white" stroke-width="1"/>
            <line x1="10" y1="4" x2="10" y2="16" stroke="white" stroke-width="1"/>
          </svg>
        </div>
      </div>
      <button class="mobile-delete-btn" onclick="removeItem('${item.id}')">DELETE</button>
    </div>
  `;
  
  return div;
}

// 增加數量
function increaseQuantity(equipmentId) {
  const cart = window.cartManager.getCart();
  const item = cart.find(item => item.id === equipmentId);
  if (item && item.category !== 'classroom') {
    window.cartManager.updateQuantity(equipmentId, item.quantity + 1);
  }
}

// 減少數量
function decreaseQuantity(equipmentId) {
  const cart = window.cartManager.getCart();
  const item = cart.find(item => item.id === equipmentId);
  if (item && item.quantity > 1 && item.category !== 'classroom') {
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
  return `NT${amount.toLocaleString()}`;
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
      totalItems += item.quantity;
      totalDeposit += item.deposit * item.quantity;
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

  adjustSummaryPosition();
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
    
    // 跳轉到租借收據頁面
    window.location.href = 'rental-receipt.html';
  }
}

// 初始化頁面
function initRentalListPage() {
  loadCartItems();
  updateSummary();
  setupRentalButtonAnimation(); // 初始化按鈕動畫
  adjustSummaryPosition(); // 頁面載入時調整位置
  
  window.addEventListener('resize', adjustSummaryPosition); // 視窗大小改變時調整
  
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

  adjustSummaryPosition();
}

// 暴露給全域
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeItem = removeItem;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initRentalListPage();
}); 