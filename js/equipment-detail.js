/* ===== Equipment Detail 頁面專用 JavaScript ===== */

// Copyright 彩蛋效果 - 打字機風格
document.addEventListener('DOMContentLoaded', function() {
  // 初始化設備頁面
  initializeEquipmentPage();
});

// 設備詳情頁面邏輯
async function initializeEquipmentPage() {
  // 初始化購物車管理器
  await window.cartManager.init();
  
  // 從URL參數獲取設備ID
  const urlParams = new URLSearchParams(window.location.search);
  const equipmentId = urlParams.get('id');
  
  if (!equipmentId) {
    // 如果沒有設備ID，重定向到設備列表
    window.location.href = 'equipment.html';
    return;
  }
  
  // 獲取設備數據
  const equipment = window.cartManager.getEquipmentById(equipmentId);
  
  if (!equipment) {
    // 如果找不到設備，顯示錯誤或重定向
    alert('找不到該設備信息');
    window.location.href = 'equipment.html';
    return;
  }
  
  // 更新頁面內容
  updateEquipmentDisplay(equipment);
  
  // 設置圖片放大功能
  setupImageEnlargement();
  
  // 設置數量選擇器
  setupQuantitySelector();
  
  // 設置加入清單功能
  setupAddToCart(equipmentId);
  
  // 設置按鈕動畫
  setupButtonAnimation();
  
  // 設置庫存監聽器
  setupInventoryListener(equipmentId);

  // 設置返回按鈕
  setupBackButton();
  
  // 設置分類和狀態點擊導航
  setupCategoryStatusNavigation(equipment);
}

function updateEquipmentDisplay(equipment) {
  // 更新頁面標題
  document.getElementById('page-title').textContent = `${equipment.name} - SCCD 媒傳系平台`;
  
  // 更新主要圖片
  document.querySelectorAll('.js-main-image').forEach(el => {
    el.src = equipment.mainImage || equipment.image;
    el.alt = equipment.name;
  });
  
  // 更新設備信息 - 動態狀態
  const availableQty = window.cartManager.getAvailableQuantity(equipment.id);
  const displayStatus = availableQty <= 0 ? '已借出' : '有現貨';
  const displayColor = availableQty <= 0 ? '#ff448a' : '#00ff80';
  
  document.querySelectorAll('.js-equipment-status').forEach(el => {
    el.textContent = displayStatus;
    el.style.color = displayColor;
  });
  document.querySelectorAll('.js-equipment-category').forEach(el => el.textContent = equipment.category);
  document.querySelectorAll('.js-equipment-name').forEach(el => el.textContent = equipment.name);
  
  // 使用預定義的原始庫存數量（不是可用數量）
  document.querySelectorAll('.js-equipment-stock').forEach(el => {
    el.textContent = equipment.originalQuantity || 0;
  });
  
  // 顯示購物車中的數量
  const cartQty = window.cartManager.getCartQuantity(equipment.id);
  document.querySelectorAll('.js-cart-quantity-display').forEach(el => {
    el.textContent = `(已在清單數量: ${cartQty})`;
  });
  
  document.querySelectorAll('.js-equipment-deposit').forEach(el => el.textContent = `NT ${equipment.deposit}`);
  
  // 更新設備規格
  document.querySelectorAll('.js-equipment-model').forEach(el => el.textContent = equipment.model || '未提供');
  document.querySelectorAll('.js-equipment-brand').forEach(el => el.textContent = equipment.brand || '未提供');
  document.querySelectorAll('.js-equipment-condition').forEach(el => el.textContent = equipment.condition || '良好');
  
  // 更新設備描述
  document.querySelectorAll('.js-equipment-description').forEach(el => {
    el.textContent = equipment.description || '此設備目前沒有提供詳細描述。如有任何問題，請聯繫管理員。';
  });
  
  // 更新breadcrumb中的設備名稱
  document.getElementById('breadcrumb-equipment-name').textContent = equipment.name;
  
  // 設置bookmark按鈕的設備名稱
  document.querySelectorAll('.js-bookmark-btn').forEach(el => el.setAttribute('data-equipment', equipment.name));
  
  // 更新按鈕狀態
  updateAddToCartButton(equipment);
  
  // 更新數量選擇器的庫存狀態
  if (window.updateStockDisplay) {
    window.updateStockDisplay();
  }
}

function setupImageEnlargement() {
  const imageContainers = document.querySelectorAll('.js-equipment-image-container');
  const overlay = document.getElementById('image-overlay');
  const enlargedImage = document.getElementById('enlarged-image');
  
  // 創建或獲取 tooltip 元素
  let tooltip = document.querySelector('.image-tooltip');
  if (!tooltip && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      tooltip = document.createElement('div');
      tooltip.className = 'image-tooltip';
      tooltip.textContent = '點擊放大檢視';
      document.body.appendChild(tooltip);
      gsap.set(tooltip, { x: 0, y: 0, opacity: 0 });
  }

  imageContainers.forEach(container => {
      const mainImage = container.querySelector('.js-main-image');
      if (!mainImage) return;

      if (tooltip) {
          const showTooltip = () => gsap.to(tooltip, { opacity: 1, duration: 0.2, ease: "power2.out" });
          const hideTooltip = () => gsap.to(tooltip, { opacity: 0, duration: 0.2, ease: "power2.out" });
          const moveTooltip = (e) => {
              const tooltipWidth = tooltip.offsetWidth;
              const x = e.clientX - (tooltipWidth / 2);
              const y = e.clientY - 20;
              gsap.to(tooltip, { x: x, y: y, duration: 0.3, ease: "power2.out" });
          };
          container.addEventListener('mouseenter', showTooltip);
          container.addEventListener('mouseleave', hideTooltip);
          container.addEventListener('mousemove', moveTooltip);
      }

      container.addEventListener('click', function() {
          enlargedImage.src = mainImage.src;
          enlargedImage.alt = mainImage.alt;
          overlay.classList.remove('hidden');
          overlay.classList.add('flex');
          document.body.style.overflow = 'hidden';
          if (tooltip) gsap.to(tooltip, { opacity: 0, duration: 0.2, ease: "power2.out" });
      });
  });

  if (overlay) {
      overlay.addEventListener('click', function(e) {
          if (e.target === overlay || e.target === enlargedImage.parentElement) {
              overlay.classList.add('hidden');
              overlay.classList.remove('flex');
              document.body.style.overflow = 'auto';
          }
      });
  }
  
  document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
          overlay.classList.add('hidden');
          overlay.classList.remove('flex');
          document.body.style.overflow = 'auto';
      }
  });
}

// 設置數量選擇器功能
function setupQuantitySelector() {
  const quantitySelect = document.getElementById('quantity-select');
  const quantityInput = document.getElementById('quantity-input');
  const dropdownArrow = document.getElementById('dropdown-arrow');

  if (!quantitySelect) return;

  // 從URL參數獲取設備ID
  const urlParams = new URLSearchParams(window.location.search);
  const equipmentId = urlParams.get('id');

  // 檢查是否有保存的狀態
  const savedState = localStorage.getItem(`quantity-selector-state-${equipmentId}`);
  const initialCustomInput = savedState ? JSON.parse(savedState).isCustomInput : false;

  // 將變量設為全局可訪問
  window.quantitySelectorState = {
    currentQuantity: 1,
    isCustomInput: initialCustomInput, // 使用保存的狀態
    maxStock: 10,
    quantitySelect: quantitySelect,
    quantityInput: quantityInput,
    dropdownArrow: dropdownArrow
  };

  let { currentQuantity, isCustomInput, maxStock } = window.quantitySelectorState;
  
  // 初始化庫存限制和下拉選單狀態
  function initializeStock() {
    const urlParams = new URLSearchParams(window.location.search);
    const equipmentId = urlParams.get('id');

    if (equipmentId && window.cartManager && window.quantitySelectorState) {
      // 使用可用數量（原始數量 - 已加入購物車的數量）作為選擇限制
      window.quantitySelectorState.maxStock = window.cartManager.getAvailableQuantity(equipmentId);

      // 根據庫存更新下拉選單選項狀態
      const options = window.quantitySelectorState.quantitySelect.querySelectorAll('option');
      options.forEach(option => {
        const value = option.value;
        if (value === '10+') {
          // 10+ 選項根據可用庫存是否大於9來決定是否可選（因為10+最小是10）
          option.disabled = window.quantitySelectorState.maxStock <= 9;
        } else {
          const numValue = parseInt(value);
          option.disabled = numValue > window.quantitySelectorState.maxStock;
        }
      });
    }
  }
  
  // 處理下拉選單變化
  quantitySelect.addEventListener('change', function() {
    const value = this.value;

    if (value === '10+') {
      // 切換到自由輸入模式
      window.quantitySelectorState.isCustomInput = true;
      quantitySelect.classList.add('hidden');
      quantityInput.classList.remove('hidden');
      dropdownArrow.classList.add('hidden');
      quantityInput.focus();
      window.quantitySelectorState.currentQuantity = 10; // 預設為10
      quantityInput.value = window.quantitySelectorState.currentQuantity;
      quantityInput.max = window.quantitySelectorState.maxStock;

      // 保存狀態到localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const equipmentId = urlParams.get('id');
      if (equipmentId) {
        localStorage.setItem(`quantity-selector-state-${equipmentId}`, JSON.stringify({
          isCustomInput: true,
          currentQuantity: window.quantitySelectorState.currentQuantity
        }));
      }
    } else {
      // 使用下拉選單的值
      window.quantitySelectorState.isCustomInput = false;
      window.quantitySelectorState.currentQuantity = parseInt(value);

      // 清除保存的狀態
      const urlParams = new URLSearchParams(window.location.search);
      const equipmentId = urlParams.get('id');
      if (equipmentId) {
        localStorage.removeItem(`quantity-selector-state-${equipmentId}`);
      }
    }
  });
  
    // 處理自由輸入變化
  if (quantityInput) {
    quantityInput.addEventListener('input', function() {
      let value = parseInt(this.value);

      // 限制輸入範圍 - 允許小於10的數字
      if (isNaN(value) || value < 1) {
        value = 1;
        this.value = value;
      } else if (value > window.quantitySelectorState.maxStock) {
        value = window.quantitySelectorState.maxStock;
        this.value = value;
      }

      window.quantitySelectorState.currentQuantity = value;

      // 更新localStorage中的狀態
      const urlParams = new URLSearchParams(window.location.search);
      const equipmentId = urlParams.get('id');
      if (equipmentId && window.quantitySelectorState.isCustomInput) {
        localStorage.setItem(`quantity-selector-state-${equipmentId}`, JSON.stringify({
          isCustomInput: true,
          currentQuantity: value
        }));
      }
    });
    
    // 失去焦點時的處理 - 允許小於10的數字保持在輸入模式
    quantityInput.addEventListener('blur', function() {
      const value = parseInt(this.value);
      // 如果輸入無效值，設置為最小值1
      if (isNaN(value) || value < 1) {
        this.value = 1;
        window.quantitySelectorState.currentQuantity = 1;
      } else {
        // 保持在輸入模式，無論值是大於還是小於10
        window.quantitySelectorState.currentQuantity = Math.min(value, window.quantitySelectorState.maxStock);
        this.value = window.quantitySelectorState.currentQuantity;
      }

      // 更新localStorage中的狀態
      const urlParams = new URLSearchParams(window.location.search);
      const equipmentId = urlParams.get('id');
      if (equipmentId && window.quantitySelectorState.isCustomInput) {
        localStorage.setItem(`quantity-selector-state-${equipmentId}`, JSON.stringify({
          isCustomInput: true,
          currentQuantity: window.quantitySelectorState.currentQuantity
        }));
      }
    });
  }
  
  // 初始化
  initializeStock();

  // 如果有保存的狀態，應用它
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    if (parsedState.isCustomInput) {
      // 顯示自定義輸入框
      quantitySelect.classList.add('hidden');
      quantityInput.classList.remove('hidden');
      dropdownArrow.classList.add('hidden');
      quantityInput.value = parsedState.currentQuantity;
      window.quantitySelectorState.currentQuantity = parsedState.currentQuantity;
    }
  }

  // 導出函數供外部使用
  window.getCurrentQuantity = function() {
    return window.quantitySelectorState ? window.quantitySelectorState.currentQuantity : 1;
  };

  window.resetQuantity = function() {
    if (window.quantitySelectorState) {
      window.quantitySelectorState.currentQuantity = 1;
      window.quantitySelectorState.isCustomInput = false;
      window.quantitySelectorState.quantitySelect.classList.remove('hidden');
      window.quantitySelectorState.quantityInput.classList.add('hidden');
      window.quantitySelectorState.dropdownArrow.classList.remove('hidden');
      window.quantitySelectorState.quantitySelect.value = '1';
      initializeStock(); // 重新初始化庫存狀態

      // 清除保存的狀態
      const urlParams = new URLSearchParams(window.location.search);
      const equipmentId = urlParams.get('id');
      if (equipmentId) {
        localStorage.removeItem(`quantity-selector-state-${equipmentId}`);
      }
    }
  };
  
  // 更新庫存顯示的函數
  window.updateStockDisplay = function() {
    initializeStock();

    // 確保當前選擇的數量不會超過新的可用庫存
    if (window.getCurrentQuantity && window.quantitySelectorState) {
      const currentQty = window.getCurrentQuantity();
      const urlParams = new URLSearchParams(window.location.search);
      const equipmentId = urlParams.get('id');

      if (equipmentId && window.cartManager) {
        const availableQty = window.cartManager.getAvailableQuantity(equipmentId);
        if (currentQty > availableQty) {
          // 如果當前選擇的數量超過可用庫存，重置為最大可用數量
          if (availableQty > 0) {
            // 如果是在輸入模式，更新輸入框的值
            if (window.quantitySelectorState.isCustomInput &&
                window.quantitySelectorState.quantityInput &&
                !window.quantitySelectorState.quantityInput.classList.contains('hidden')) {
              window.quantitySelectorState.quantityInput.value = availableQty;
            } else if (window.quantitySelectorState.quantitySelect &&
                       !window.quantitySelectorState.quantitySelect.classList.contains('hidden')) {
              // 如果是在下拉選單模式，選擇最接近的選項
              const options = Array.from(window.quantitySelectorState.quantitySelect.options);
              const validOption = options
                .filter(option => parseInt(option.value) <= availableQty)
                .sort((a, b) => parseInt(b.value) - parseInt(a.value))[0];

              if (validOption) {
                window.quantitySelectorState.quantitySelect.value = validOption.value;
              }
            }
            window.quantitySelectorState.currentQuantity = Math.min(currentQty, availableQty);
          }
        }
      }
    }
  };
}

function setupAddToCart(equipmentId) {
  document.querySelectorAll('.js-add-to-cart-btn').forEach(addBtn => {
    addBtn.addEventListener('click', function() {
      if (this.disabled) return; // 如果按鈕被禁用，直接返回
      
      const equipment = window.cartManager.getEquipmentById(equipmentId);
      const quantity = window.getCurrentQuantity ? window.getCurrentQuantity() : 1;
      
      if (!equipment) {
        if (window.showToast) {
          window.showToast('設備資料載入錯誤！', 'error');
        }
        return;
      }
      
      // 檢查庫存是否足夠
      const availableQuantity = window.cartManager.getAvailableQuantity(equipment.id);
      if (quantity > availableQuantity) {
        if (window.showToast) {
          window.showToast(`庫存不足！僅剩 ${availableQuantity} 件可租借`, 'error');
        }
        return;
      }
      
      // 批量添加到購物車
      let successCount = 0;
      for (let i = 0; i < quantity; i++) {
        const success = window.cartManager.addToCart(equipment);
        if (success) {
          successCount++;
        } else {
          break; // 如果失敗就停止
        }
      }
      
      if (successCount > 0) {
        // 立即更新購物車顯示
        window.cartManager.updateCartDisplay();
        
        // 更新頁面顯示
        updateEquipmentDisplay(equipment);
        
        // 重置數量為1
        if (window.resetQuantity) window.resetQuantity();
        
        if (window.showToast) {
          window.showToast(`已成功加入 ${successCount} 件 ${equipment.name} 到租借清單！`, 'success');
        }
      } else {
        if (window.showToast) {
          window.showToast(`${equipment.name}庫存不足或已達上限！`, 'error');
        }
      }
    });
  });
}

// 更新加入清單按鈕狀態
function updateAddToCartButton(equipment) {
  if (!equipment) return;
  
  const hasStock = window.cartManager.hasStock(equipment.id);
  const availableQuantity = window.cartManager.getAvailableQuantity(equipment.id);
  
  document.querySelectorAll('.js-add-to-cart-btn').forEach(button => {
    if (!hasStock || availableQuantity <= 0) {
      // 禁用按鈕，但不更改文字
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.style.pointerEvents = 'none';
    } else {
      // 啟用按鈕
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.style.pointerEvents = 'auto';
    }
  });
}

// 設置庫存監聽器
function setupInventoryListener(equipmentId) {
  // 監聽購物車變化事件
  window.addEventListener('cartUpdated', (event) => {
    // 重新獲取最新的設備數據
    const equipment = window.cartManager.getEquipmentById(equipmentId);
    if (equipment) {
      // 更新顯示
      updateEquipmentDisplay(equipment);
    }
  });
  
  // 監聽localStorage變化（跨頁面同步）
  window.addEventListener('storage', async (event) => {
    if (event.key === 'sccd-rental-cart') {
      // 重新載入購物車管理器
      if (window.cartManager) {
        await window.cartManager.init();
        const equipment = window.cartManager.getEquipmentById(equipmentId);
        if (equipment) {
          updateEquipmentDisplay(equipment);
        }
      }
    }
  });
}

// 按鈕動畫效果
function setupButtonAnimation() {
  // 只在桌面版啟用 hover 動畫
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.js-add-to-cart-btn.button-animated').forEach(button => {
      const buttonFill = button.querySelector('.button-bg-fill');
      if (buttonFill) {
        button.addEventListener('mouseenter', function() {
          if (!this.disabled) {
            gsap.to(buttonFill, {
              height: '100%',
              duration: 0.5,
              ease: "power2.out"
            });
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
            this.classList.remove('white-text');
          }
        });
      }
    });
  }
}

// 返回按鈕功能
function setupBackButton() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      // 返回上一頁
      window.history.back();
    });
  }
}

// 設置分類和狀態的點擊導航功能
function setupCategoryStatusNavigation(equipment) {
  // 設置分類點擊事件
  document.querySelectorAll('.js-equipment-category').forEach(categoryEl => {
    categoryEl.addEventListener('click', function() {
      // 導航到equipment頁面並篩選該分類
      const category = equipment.category;
      window.location.href = `equipment.html?filter_category=${encodeURIComponent(category)}&filter_status=有現貨`;
    });
  });
}