/* ===== Equipment 頁面專用 JavaScript ===== */

// 設備 ID 對應映射表（HTML中的順序對應data.js中的ID）
const EQUIPMENT_ID_MAP = [
    'speaker-clamp-light',    // 第一個卡片：黑色喇叭夾燈
    'extension-cord',         // 第二個卡片：三孔六座延長線
    'led-light',              // 第三個卡片：長桿筒狀夾燈
    'folding-table',          // 第四個卡片：H字牆
    'projector',              // 第五個卡片：便攜式投影機
    'electric-screwdriver',   // 第六個卡片：鋁梯
    'heat-gun',               // 第七個卡片：雷射切割機
    'hdmi-cable',             // 第八個卡片：品字電源線
    'ring-light',             // 第九個卡片：米家檯燈
    'professional-easel',     // 第十個卡片：專業畫板
    'wireless-microphone',    // 第十一個卡片：電腦螢幕
    'utility-knife-set'       // 第十二個卡片：大型購物推車
];

// 更新設備卡片名稱
async function updateEquipmentCardNames() {
    if (!window.cartManager || !window.cartManager.isEquipmentLoaded) {
        if (window.cartManager) {
            await window.cartManager.init();
        } else {
            console.warn('Cart manager not available');
            return;
        }
    }

    const equipmentCards = document.querySelectorAll('.equipment-card');
    
    equipmentCards.forEach((card, index) => {
        const equipmentId = EQUIPMENT_ID_MAP[index];
        const equipmentData = window.cartManager.getEquipmentById(equipmentId);
        
        if (equipmentData) {
            // 更新卡片名稱
            const nameElement = card.querySelector('.text-lg');
            if (nameElement) {
                nameElement.textContent = equipmentData.name;
            }
            
            // 更新類別
            const categoryElement = card.querySelector('.text-sm[style*="color: #cccccc"]');
            if (categoryElement) {
                categoryElement.textContent = equipmentData.category;
            }
            
            // 更新狀態顯示 - 動態狀態
            const availableQty = window.cartManager.getAvailableQuantity(equipmentData.id);
            const displayStatus = availableQty <= 0 ? '已借出' : '有現貨';
            const displayColor = availableQty <= 0 ? '#ff448a' : '#00ff80';
            
            const statusElement = card.querySelector('span[style*="color: #00ff80"], span[style*="color: #ff448a"]');
            if (statusElement) {
                statusElement.textContent = displayStatus;
                statusElement.style.color = displayColor;
            }
            
            // 更新data-category和data-status屬性
            card.setAttribute('data-category', equipmentData.category);
            card.setAttribute('data-status', displayStatus);
            
            // 更新圖片
            const imageElement = card.querySelector('img');
            if (imageElement && equipmentData.mainImage) {
                imageElement.src = equipmentData.mainImage;
                imageElement.alt = equipmentData.name;
            }
            
            // 更新書籤的 data-equipment 屬性
            const bookmarkBtn = card.querySelector('.bookmark-btn');
            if (bookmarkBtn) {
                bookmarkBtn.setAttribute('data-equipment', equipmentData.name);
            }
            
            // 更新連結的href
            const linkElement = card.querySelector('a');
            if (linkElement) {
                linkElement.href = `equipment-detail.html?id=${equipmentId}`;
            }
        } else {
            console.warn(`Equipment data not found for ID: ${equipmentId}`);
        }
    });
}

// 手機版搜尋列滾動效果
function initMobileSearchScrollEffect() {
  if (window.innerWidth <= 767) {
    const mobileSearch = document.getElementById('mobile-search');
    let lastScrollTop = 0;
    
    if (mobileSearch) {
      window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
          // 向下滾動 - fade out
          mobileSearch.classList.add('fade-out');
        } else {
          // 向上滾動 - fade in
          mobileSearch.classList.remove('fade-out');
        }
        
        lastScrollTop = scrollTop;
      });
    }
  }
}

// 手機版篩選器 Bottom Sheet
function initMobileFilters() {
  // 僅在手機版執行
  if (window.innerWidth > 767) {
      return;
  }

  const filtersBtn = document.getElementById('mobile-filters-btn');
  const bottomSheet = document.getElementById('filters-bottom-sheet');
  const overlay = document.getElementById('filters-overlay');
  const applyBtn = document.getElementById('apply-filters-btn');
  const clearBtn = document.getElementById('clear-filters-btn');
  const categoryButtons = document.querySelectorAll('.mobile-filter-category');
  const statusButtons = document.querySelectorAll('#mobile-status-available, #mobile-status-unavailable');
  const handle = document.getElementById('bottom-sheet-handle');

  if (!filtersBtn || !bottomSheet || !overlay || !applyBtn || !handle) return;

  let selectedCategories = [];
  let selectedStatus = '有現貨';

  // 從 DOM 更新篩選狀態
  function updateStateFromDOM() {
      selectedCategories = Array.from(categoryButtons)
          .filter(btn => btn.classList.contains('font-bold'))
          .map(btn => btn.dataset.category);
      
      const activeStatusBtn = Array.from(statusButtons).find(btn => btn.classList.contains('font-bold'));
      if (activeStatusBtn) {
          selectedStatus = activeStatusBtn.dataset.status;
      }
  }

  // 開啟與關閉 Bottom Sheet
  function openBottomSheet() {
      bottomSheet.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
  }

  function closeBottomSheet() {
      bottomSheet.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      // 清除內聯 transform 樣式，讓 CSS 過渡效果生效
      bottomSheet.style.transform = '';
  }

  filtersBtn.addEventListener('click', openBottomSheet);
  overlay.addEventListener('click', closeBottomSheet);
  
  applyBtn.addEventListener('click', () => {
      updateStateFromDOM();
      applyMobileFilters(selectedCategories, selectedStatus);
      closeBottomSheet();
  });

  // 篩選器按鈕邏輯
  categoryButtons.forEach(button => {
      button.addEventListener('click', function() {
          const isSelected = this.classList.contains('font-bold');
          this.classList.toggle('font-bold', !isSelected);
          this.classList.toggle('font-normal', isSelected);
      });
  });

  statusButtons.forEach(button => {
      button.addEventListener('click', function() {
          if (this.classList.contains('font-bold')) return;
          statusButtons.forEach(btn => {
              btn.classList.remove('font-bold');
              btn.classList.add('font-normal');
          });
          this.classList.add('font-bold');
          this.classList.remove('font-normal');
      });
  });
  
  if (clearBtn) {
      clearBtn.addEventListener('click', () => {
          categoryButtons.forEach(btn => {
              btn.classList.remove('font-bold');
              btn.classList.add('font-normal');
          });
          statusButtons.forEach(btn => {
              const isAvailable = btn.dataset.status === '有現貨';
              btn.classList.toggle('font-bold', isAvailable);
              btn.classList.toggle('font-normal', !isAvailable);
          });
      });
  }

  // 拖曳功能
  let isDragging = false;
  let startY = 0;
  let currentTranslateY = 0;

  const dragStart = (e) => {
      isDragging = true;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      bottomSheet.style.transition = 'none'; // 拖曳時禁用過渡
  };

  const dragMove = (e) => {
      if (!isDragging) return;
      const currentY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = currentY - startY;
      currentTranslateY = Math.max(0, deltaY); // 只允許向下拉
      bottomSheet.style.transform = `translateY(${currentTranslateY}px)`;
  };

  const dragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      bottomSheet.style.transition = ''; // 重新啟用過渡
      const sheetHeight = bottomSheet.offsetHeight;
      if (currentTranslateY > sheetHeight * 0.3) {
          closeBottomSheet(); // 如果拖曳超過30%則關閉
      } else {
          bottomSheet.style.transform = ''; // 否則彈回原位
      }
      currentTranslateY = 0;
  };
  
  if (handle) {
      handle.addEventListener('touchstart', dragStart, { passive: true });
      handle.addEventListener('touchmove', dragMove, { passive: true });
      handle.addEventListener('touchend', dragEnd);
  }
}

// 生成手機版設備卡片
function generateMobileEquipmentCards() {
  const desktopCards = document.querySelectorAll('.equipment-card');
  const mobileGrid = document.getElementById('mobile-equipment-grid');
  
  if (mobileGrid) {
    mobileGrid.innerHTML = '';
    
    desktopCards.forEach((card, index) => {
      const category = card.getAttribute('data-category');
      const status = card.getAttribute('data-status');
      const link = card.querySelector('a');
      const imageElement = card.querySelector('a img');
      
      // 從設備管理器獲取最新的設備資料
      const equipmentId = EQUIPMENT_ID_MAP[index];
      let categoryText = category;
      let nameText = '設備名稱';
      
      if (equipmentId && window.cartManager && window.cartManager.isEquipmentLoaded) {
        const equipmentData = window.cartManager.getEquipmentById(equipmentId);
        if (equipmentData) {
          categoryText = equipmentData.category;
          nameText = equipmentData.name;
        }
      } else {
        // 如果無法從設備管理器獲取，則從 DOM 獲取
        const categoryElement = card.querySelector('.mt-5 .text-sm');
        const nameElement = card.querySelector('.text-lg, .text-xl');
        if (categoryElement) categoryText = categoryElement.textContent;
        if (nameElement) nameText = nameElement.textContent;
      }
      
      // Skip card if essential elements are missing to prevent errors
      if (!link || !imageElement) {
        console.warn('Skipping a malformed equipment card during mobile generation.', card);
        return;
      }

      const imgSrc = imageElement.src;
      
      const mobileCard = document.createElement('div');
      mobileCard.className = 'mobile-equipment-card';
      mobileCard.setAttribute('data-category', category);
      mobileCard.setAttribute('data-status', status);
      
      mobileCard.innerHTML = `
        <a href="${link.href}" class="equipment-image">
          <img src="${imgSrc}" alt="Equipment" class="w-full h-full object-cover">
        </a>
        <div class="equipment-info">
          <div class="equipment-details">
            <div class="equipment-category">${categoryText}</div>
            <div class="equipment-name">${nameText}</div>
          </div>
          <div class="equipment-bookmark">
            <img src="Icons/Bookmark Sharp Regular.svg" alt="Bookmark" class="w-4 h-4 cursor-pointer hover:opacity-70 transition-opacity bookmark-btn" data-equipment="${nameText}">
          </div>
        </div>
      `;
      
      mobileGrid.appendChild(mobileCard);
    });
    
    // 動態生成卡片後，重新初始化收藏按鈕狀態
    if (window.refreshBookmarkStates) {
      window.refreshBookmarkStates();
    }
  }
}

// 應用手機版篩選器
function applyMobileFilters(categories, status) {
  const mobileCards = document.querySelectorAll('.mobile-equipment-card');
  
  mobileCards.forEach(card => {
    const cardCategory = card.getAttribute('data-category');
    const cardStatus = card.getAttribute('data-status');
    
    const categoryMatch = categories.length === 0 || categories.includes(cardCategory);
    const statusMatch = cardStatus === status;
    
    if (categoryMatch && statusMatch) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// 手機版搜尋欄互動效果
function initMobileSearchInteraction() {
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchLabel = document.getElementById('mobileSearchLabel');
  
  if (mobileSearchInput && mobileSearchLabel) {
    // 當hover或focus時顯示cursor，label變灰並右移
    function showCursor() {
      mobileSearchLabel.style.color = '#d4d4d8'; // text-zinc-300
      mobileSearchLabel.style.transform = 'translateX(8px)';
    }
    
    // 當離開且沒有輸入時恢復原狀
    function hideCursor() {
      if (mobileSearchInput.value === '') {
        mobileSearchLabel.style.color = '#ffffff';
        mobileSearchLabel.style.transform = 'translateX(0)';
      }
    }
    
    // 當有輸入時隱藏label
    function toggleLabel() {
      if (mobileSearchInput.value !== '') {
        mobileSearchLabel.style.display = 'none';
      } else {
        mobileSearchLabel.style.display = 'block';
      }
    }
    
    // 事件監聽器
    mobileSearchInput.addEventListener('focus', showCursor);
    mobileSearchInput.addEventListener('blur', hideCursor);
    mobileSearchInput.addEventListener('input', toggleLabel);
  }
}

// 初始化手機版
function initMobileVersion() {
  if (window.innerWidth <= 767) {
    generateMobileEquipmentCards();
    // 預設顯示有現貨的項目
    applyMobileFilters([], '有現貨');
  }
  
  // 無論是否手機版，都初始化收藏狀態
  if (window.refreshBookmarkStates) {
    setTimeout(() => {
      window.refreshBookmarkStates();
    }, 200);
  }
}

// 搜尋欄互動效果
function initSearchInteraction() {
  const searchInput = document.getElementById('searchInput');
  const searchLabel = document.getElementById('searchLabel');
  
  if (!searchInput || !searchLabel) return;
  
  // 當hover或focus時顯示cursor，label變灰並右移
  function showCursor() {
    searchLabel.style.color = '#d4d4d8'; // text-zinc-300
    searchLabel.style.transform = 'translateX(8px)';
  }
  
  // 當離開且沒有輸入時恢復原狀
  function hideCursor() {
    if (searchInput.value === '') {
      searchLabel.style.color = '#ffffff';
      searchLabel.style.transform = 'translateX(0)';
    }
  }
  
  // 當有輸入時隱藏label
  function toggleLabel() {
    if (searchInput.value !== '') {
      searchLabel.style.display = 'none';
    } else {
      searchLabel.style.display = 'block';
    }
  }
  
  // 事件監聽器
  searchInput.addEventListener('mouseenter', showCursor);
  searchInput.addEventListener('blur', hideCursor);
  searchInput.addEventListener('mouseleave', function() {
    if (document.activeElement !== searchInput) {
      hideCursor();
    }
  });
  searchInput.addEventListener('input', toggleLabel);
}

// 設備卡片進場動畫
function initEquipmentCardAnimations() {
  const equipmentCards = document.querySelectorAll('.equipment-card');
  const animatedRows = new Set(); // 記錄已經動畫過的行
  
  // 計算並設置每張卡片的行號
  function calculateRowNumbers() {
    if (window.innerWidth < 768) return; // 只在桌面版執行
    
    const visibleCards = Array.from(equipmentCards).filter(card => 
      window.getComputedStyle(card).display !== 'none'
    );
    
    // 強制重排以確保位置準確
    visibleCards.forEach(card => card.offsetHeight);
    
    let currentRow = 0;
    let lastTop = -1;
    
    visibleCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardTop = Math.round(rect.top + window.scrollY);
      
      if (index > 0 && Math.abs(cardTop - lastTop) > 10) {
        currentRow++;
      }
      
      card.setAttribute('data-row', currentRow);
      lastTop = cardTop;
    });
  }
  
  // 初始化行號並觸發所有動畫
  setTimeout(() => {
    calculateRowNumbers();
    
    // 觸發所有可見卡片的動畫
    triggerAllVisibleAnimations();
  }, 100);
  
  // 觸發所有可見卡片的進場動畫
  function triggerAllVisibleAnimations() {
    animatedRows.clear();
    
    // 獲取所有可見的行，按順序處理
    const visibleCards = Array.from(equipmentCards).filter(card => 
      window.getComputedStyle(card).display !== 'none'
    );
    
    // 按行號分組
    const rowGroups = {};
    visibleCards.forEach(card => {
      const row = parseInt(card.getAttribute('data-row'));
      if (!rowGroups[row]) {
        rowGroups[row] = [];
      }
      rowGroups[row].push(card);
    });
    
    // 按行號順序觸發動畫
    Object.keys(rowGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach((rowNumber, rowIndex) => {
      const rowCards = rowGroups[rowNumber];
      
      // 每一行延遲300ms，行內卡片間隔150ms
      rowCards.forEach((card, cardIndex) => {
        setTimeout(() => {
          card.classList.add('animate-in');
        }, (rowIndex * 300) + (cardIndex * 150) + 200);
      });
      
      animatedRows.add(parseInt(rowNumber));
    });
  }
  
  // 當篩選後重新計算行號和重新觸發動畫
  window.recalculateRows = function() {
    // 先等待300ms讓背景處理完成
    setTimeout(() => {
      calculateRowNumbers();
      triggerAllVisibleAnimations();
    }, 300);
  };
}

// 顯示Toast提示
function showToast(message) {
  // 檢查是否已有toast，如果有則移除
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // 創建新的toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  // 創建內部的p元素
  const p = document.createElement('p');
  p.textContent = message;
  toast.appendChild(p);
  
  document.body.appendChild(toast);
  
  // 檢查是否為手機版
  const isMobile = window.innerWidth <= 767;
  
  if (isMobile) {
    // 手機版動畫（已由CSS處理定位）
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
    toast.style.transform = 'translateY(20px)';
    
    // 顯示通知（從底部浮上來的效果）
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0px)';
    }, 50);
    
    // 2秒後開始消失動畫
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
    }, 2000);
  } else {
    // 桌面版動畫（原有邏輯）
    toast.style.bottom = '7.5rem';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%) translateY(50px)';
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
    
    // 顯示通知（從底部浮上來的效果）
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0px)';
    }, 50);
    
    // 2秒後開始消失動畫
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 2000);
  }
  
  // 動畫完成後完全隱藏並移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 2500);
}

// 監聽庫存變化，實時更新設備列表狀態
function setupInventoryUpdateListener() {
    let updateTimeout;
    
    function performUpdate() {
        // 清除之前的更新計時器，避免重複執行
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(async () => {
            await updateEquipmentCardNames();
            
            // 重新生成手機版卡片（如果在手機版）
            if (window.innerWidth <= 767) {
                generateMobileEquipmentCards();
                // 重新應用當前篩選狀態
                const currentStatus = document.querySelector('#mobile-status-available.font-bold') ? '有現貨' : '已借出';
                const selectedCategories = Array.from(document.querySelectorAll('.mobile-filter-category.font-bold'))
                    .map(btn => btn.dataset.category);
                applyMobileFilters(selectedCategories, currentStatus);
            }
            
            // 重新應用當前篩選（延遲確保狀態更新完成）
            setTimeout(() => {
                if (window.desktopFilter) {
                    window.desktopFilter.applyFilters();
                }
            }, 100);
        }, 200); // 200ms防抖
    }
    
    // 監聽購物車變化事件
    window.addEventListener('cartUpdated', performUpdate);
    
    // 監聽localStorage變化（跨頁面同步）
    window.addEventListener('storage', async (event) => {
        if (event.key === 'sccd-rental-cart') {
            // 重新載入購物車管理器
            if (window.cartManager) {
                await window.cartManager.init();
                performUpdate();
            }
        }
    });
}

// 主要初始化函數
async function initEquipmentPage() {
  // 首先初始化購物車管理器並更新設備卡片名稱（動態狀態）
  await updateEquipmentCardNames();
  
  initMobileSearchScrollEffect();
  initMobileFilters();
  initMobileSearchInteraction();
  initMobileVersion();
  initSearchInteraction();
  initEquipmentCardAnimations();
  setupInventoryUpdateListener();
  
  // 設定標誌表示設備數據已準備完成
  window.equipmentDataReady = true;
}

// 全域函數
window.generateMobileEquipmentCards = generateMobileEquipmentCards;
window.applyMobileFilters = applyMobileFilters;
window.showToast = showToast;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
  initEquipmentPage();
}); 