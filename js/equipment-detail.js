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
  
  // 設置加入清單功能
  setupAddToCart(equipmentId);
  
  // 設置按鈕動畫
  setupButtonAnimation();
  
  // 設置庫存監聽器
  setupInventoryListener(equipmentId);
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
  
  // 使用動態計算的可用庫存數量
  document.querySelectorAll('.js-equipment-quantity').forEach(el => {
    const availableQty = window.cartManager.getAvailableQuantity(equipment.id);
    el.textContent = availableQty;
  });
  
  document.querySelectorAll('.js-equipment-deposit').forEach(el => el.textContent = `NT ${equipment.deposit}`);
  document.querySelectorAll('.js-equipment-description').forEach(el => el.textContent = equipment.description);
  
  // 更新breadcrumb中的設備名稱
  document.getElementById('breadcrumb-equipment-name').textContent = equipment.name;
  
  // 設置bookmark按鈕的設備名稱
  document.querySelectorAll('.js-bookmark-btn').forEach(el => el.setAttribute('data-equipment', equipment.name));
  
  // 更新按鈕狀態
  updateAddToCartButton(equipment);
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

function setupAddToCart(equipmentId) {
  document.querySelectorAll('.js-add-to-cart-btn').forEach(addBtn => {
    addBtn.addEventListener('click', function() {
      if (this.disabled) return; // 如果按鈕被禁用，直接返回
      
      const equipment = window.cartManager.getEquipmentById(equipmentId);
      
      if (!equipment) {
        if (window.showToast) {
          window.showToast('設備資料載入錯誤！');
        }
        return;
      }
      
      // 使用購物車管理器添加到購物車（自動處理庫存）
      const success = window.cartManager.addToCart(equipment);
      
      if (success) {
        // 立即更新購物車顯示
        window.cartManager.updateCartDisplay();
        
        // 更新頁面顯示
        updateEquipmentDisplay(equipment);
        
        if (window.showToast) {
          window.showToast(`${equipment.name}已成功加入租借清單！`);
        }
      } else {
        if (window.showToast) {
          window.showToast(`${equipment.name}庫存不足或已達上限！`);
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