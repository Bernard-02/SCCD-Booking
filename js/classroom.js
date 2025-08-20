// Classroom 頁面專用 JavaScript

// 教室資料 - 與新版卡片選擇邏輯兼容
const classroomData = {
  'A503': {
    id: 'A503',
    name: 'A503 教室',
    category: 'classroom',
    deposit: 5000,
    image: 'Images/A503.webp'
  },
  'A507': {
    id: 'A507',
    name: 'A507 教室', 
    category: 'classroom',
    deposit: 5000,
    image: 'Images/A507.webp'
  },
  'A508': {
    id: 'A508',
    name: 'A508 教室',
    category: 'classroom', 
    deposit: 5000,
    image: 'Images/A508.webp'
  }
};





// ===== 新版卡片選擇邏輯 =====

// 切換教室選擇狀態
function toggleClassroomSelection(element, classroomName) {
  // 如果教室已在 cart 中，點擊會從 cart 中移除
  if (element.classList.contains('in-cart')) {
    console.log(`${classroomName} 已在清單中，點擊將從清單中移除`);
    removeClassroomFromCart(element, classroomName);
    return true;
  }
  
  // 切換選中狀態
  element.classList.toggle('selected');
  
  // 更新 ADD 按鈕文字和狀態
  updateAddButtonText();
  
  console.log(`${classroomName} ${element.classList.contains('selected') ? '已選中' : '已取消選中'}`);
  return true;
}

// 從購物車中移除教室
function removeClassroomFromCart(element, classroomName) {
  if (!window.cartManager) {
    console.error('CartManager not found');
    showNotification('系統錯誤：購物車管理器未載入', 'error');
    return;
  }
  
  // 從購物車中移除
  const success = window.cartManager.removeFromCart(classroomName);
  
  if (success) {
    // 移除成功，更新卡片狀態
    element.classList.remove('in-cart');
    element.classList.remove('selected');
    
    // 恢復狀態文字
    const statusText = element.querySelector('.classroom-status-text');
    if (statusText) {
      statusText.textContent = '可租借';
      statusText.style.color = '#00ff80';
    }
    
    // 更新 ADD 按鈕
    updateAddButtonText();
    
    showNotification(`${classroomName} 教室已從清單中移除`, 'success');
    console.log(`${classroomName} 已從購物車中移除`);
  } else {
    showNotification('移除失敗，請重試', 'error');
    console.error(`Failed to remove ${classroomName} from cart`);
  }
}

// 獲取所有選中且不在 cart 中的教室
function getSelectedClassrooms() {
  const selectedClassrooms = [];
  
  // 檢查每個教室卡片是否被選中
  if (document.querySelector('.classroom-card-1.selected:not(.in-cart)')) {
    selectedClassrooms.push('A503');
  }
  if (document.querySelector('.classroom-card-2.selected:not(.in-cart)')) {
    selectedClassrooms.push('A507');
  }
  if (document.querySelector('.classroom-card-3.selected:not(.in-cart)')) {
    selectedClassrooms.push('A508');
  }
  
  return selectedClassrooms;
}

// 更新 ADD 按鈕文字和狀態
function updateAddButtonText() {
  const selectedCount = document.querySelectorAll('.classroom-card.selected:not(.in-cart)').length;
  const addBtnText = document.getElementById('add-btn-text');
  const addBtnHidden = document.getElementById('add-btn-hidden');
  const addBtn = document.getElementById('add-classroom-btn');
  
  if (!addBtnText || !addBtnHidden || !addBtn) return;
  
  // 檢查是否所有教室都已在 cart 中
  const allClassrooms = document.querySelectorAll('.classroom-card');
  const classroomsInCart = document.querySelectorAll('.classroom-card.in-cart');
  const allInCart = allClassrooms.length === classroomsInCart.length;
  
  if (selectedCount === 0 || allInCart) {
    addBtnText.textContent = '(ADD)';
    addBtnHidden.textContent = '(ADD)';
    addBtn.classList.add('add-btn-disabled');
  } else {
    addBtnText.textContent = `(ADD ${selectedCount})`;
    addBtnHidden.textContent = `(ADD ${selectedCount})`;
    addBtn.classList.remove('add-btn-disabled');
  }
}

// 將選中的教室加入購物車
function addSelectedClassroomsToCart() {
  const selectedClassrooms = getSelectedClassrooms();
  
  if (selectedClassrooms.length === 0) {
    return;
  }
  
  console.log('Adding classrooms to cart:', selectedClassrooms);
  
  // 確保 CartManager 存在
  if (!window.cartManager) {
    console.error('CartManager not found');
    showNotification('系統錯誤：購物車管理器未載入', 'error');
    return;
  }
  
  // 將每個選中的教室加入購物車
  let addedCount = 0;
  selectedClassrooms.forEach(classroom => {
    const classroomItem = {
      id: classroom,
      name: `${classroom} 教室`,
      category: 'classroom',
      deposit: 5000,
      mainImage: classroomData[classroom]?.image || `Images/${classroom}.webp`, // 使用 mainImage 格式
      image: classroomData[classroom]?.image || `Images/${classroom}.webp` // 也保留 image 以防萬一
    };
    
    console.log('Adding classroom item:', classroomItem);
    
    try {
      // 使用 addToCart 方法，它會自動路由到 addClassroomToCart
      const success = window.cartManager.addToCart(classroomItem);
      if (success) {
        addedCount++;
        console.log(`Successfully added ${classroom} to cart`);
      } else {
        console.warn(`Failed to add ${classroom} to cart - might already exist`);
      }
    } catch (error) {
      console.error('Error adding classroom to cart:', error);
    }
  });
  
  if (addedCount > 0) {
    // 顯示成功訊息
    if (addedCount === 1) {
      showNotification(`${selectedClassrooms[0]} 教室已加入清單`, 'success');
    } else {
      showNotification(`${selectedClassrooms.slice(0, addedCount).join('、')} 等 ${addedCount} 間教室已加入清單`, 'success');
    }
    
    // 將已加入的教室標記為 in-cart 並清除選中狀態
    selectedClassrooms.slice(0, addedCount).forEach(classroom => {
      let card;
      if (classroom === 'A503') {
        card = document.querySelector('.classroom-card-1');
      } else if (classroom === 'A507') {
        card = document.querySelector('.classroom-card-2');
      } else if (classroom === 'A508') {
        card = document.querySelector('.classroom-card-3');
      }
      
      if (card) {
        card.classList.remove('selected');
        card.classList.add('in-cart');
        // 更新狀態文字
        const statusText = card.querySelector('.classroom-status-text');
        if (statusText) {
          statusText.textContent = '已在清單中';
          statusText.style.color = '#00ff80';
        }
        // 顯示圖片和押金資訊
        card.classList.add('selected');
      }
    });
    
    // 重置按鈕文字
    updateAddButtonText();
  } else {
    showNotification('加入清單失敗，請重試', 'error');
  }
}

// 檢查教室是否在 cart 中
function isClassroomInCart(classroomId) {
  if (!window.cartManager) return false;
  
  const cart = window.cartManager.getCart();
  return cart.some(item => 
    item.id === classroomId || 
    item.name === `${classroomId} 教室` ||
    (item.category === 'classroom' && item.id === classroomId)
  );
}

// 更新卡片的 cart 狀態
function updateClassroomCartStatus() {
  // 使用類別選擇器來識別教室卡片，而不是依賴 onclick 屬性
  const classroomMappings = [
    { selector: '.classroom-card-1', id: 'A503' },
    { selector: '.classroom-card-2', id: 'A507' },
    { selector: '.classroom-card-3', id: 'A508' }
  ];
  
  classroomMappings.forEach(({ selector, id }) => {
    const card = document.querySelector(selector);
    if (card) {
      const statusText = card.querySelector('.classroom-status-text');
      
      if (isClassroomInCart(id)) {
        // 如果已在購物車中，設定為 in-cart 狀態
        card.classList.add('in-cart');
        card.classList.add('selected'); // 顯示圖片和押金資訊
        // 更改狀態文字為「已在清單中」
        if (statusText) {
          statusText.textContent = '已在清單中';
          statusText.style.color = '#00ff80';
        }
      } else {
        // 如果不在購物車中，只移除 in-cart 狀態，保留用戶手動選中的 selected 狀態
        card.classList.remove('in-cart');
        // 只有當卡片不是用戶手動選中時才移除 selected 狀態
        // 這裡我們不自動移除 selected，讓用戶控制選中狀態
        
        // 恢復原始文字「可租借」（只有在不是 in-cart 狀態時）
        if (statusText && statusText.textContent === '已在清單中') {
          statusText.textContent = '可租借';
          statusText.style.color = '#00ff80';
        }
      }
    }
  });
  updateAddButtonText();
}

// 監聽 cart 變化
function setupCartListener() {
  // 監聽 cartUpdated 事件
  window.addEventListener('cartUpdated', updateClassroomCartStatus);
  
  // 定期檢查 cart 狀態（備用方案），降低頻率避免干擾用戶操作
  setInterval(updateClassroomCartStatus, 5000); // 從 1 秒改為 5 秒
}

// 顯示通知
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notification-text');
  
  if (notification && notificationText) {
    notificationText.textContent = message;
    
    // 清除之前的動畫類別
    notification.classList.remove('show', 'fade-out');
    notification.style.display = 'block';
    
    // 統一使用白色背景
    notification.style.backgroundColor = 'white';
    notification.style.color = 'black';
    
    // 短暫延遲後顯示（確保 CSS 過渡效果正常）
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 3秒後開始 fade out 動畫
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('fade-out');
      
      // fade out 動畫完成後隱藏元素
      setTimeout(() => {
        notification.style.display = 'none';
        notification.classList.remove('fade-out');
      }, 300);
    }, 3000);
  } else {
    console.log(`Notification: ${message} (${type})`);
  }
}

// 初始化頁面
document.addEventListener('DOMContentLoaded', function() {
  console.log('Classroom.js loaded - new card-based design');
  
  // 監聽動畫完成事件
  const classroomCards = document.querySelectorAll('.classroom-card.card-slide-in');
  classroomCards.forEach(card => {
    card.addEventListener('animationend', function(e) {
      if (e.animationName === 'slideInFromRight') {
        this.classList.add('animation-complete');
      }
    });
  });
  
  // 添加點擊事件監聽器，替代 inline onclick
  setupClickEventListeners();
  
  // 等待 CartManager 載入
  const initClassroomLogic = () => {
    if (window.cartManager) {
      console.log('CartManager found, initializing classroom logic');
      updateAddButtonText();
      updateClassroomCartStatus();
      setupCartListener();
    } else {
      console.log('CartManager not found, retrying...');
      setTimeout(initClassroomLogic, 100);
    }
  };
  
  initClassroomLogic();
});

// 設置點擊事件監聽器
function setupClickEventListeners() {
  // A503 教室卡片
  const a503Card = document.querySelector('.classroom-card-1');
  if (a503Card) {
    a503Card.addEventListener('click', function() {
      toggleClassroomSelection(this, 'A503');
    });
  }
  
  // A507 教室卡片
  const a507Card = document.querySelector('.classroom-card-2');
  if (a507Card) {
    a507Card.addEventListener('click', function() {
      toggleClassroomSelection(this, 'A507');
    });
  }
  
  // A508 教室卡片
  const a508Card = document.querySelector('.classroom-card-3');
  if (a508Card) {
    a508Card.addEventListener('click', function() {
      toggleClassroomSelection(this, 'A508');
    });
  }
  
  // ADD 按鈕
  const addBtn = document.getElementById('add-classroom-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function(e) {
      e.preventDefault();
      addSelectedClassroomsToCart();
    });
  }
  
  // 防止收藏夾按鈕觸發卡片點擊事件
  document.querySelectorAll('.bookmark-btn').forEach(bookmarkBtn => {
    bookmarkBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      // 這裡可以添加收藏功能
      console.log('Bookmark clicked for:', this.dataset.equipment);
    });
  });
}

// 全局函數，供 HTML 調用（保持向後兼容）
window.toggleClassroomSelection = toggleClassroomSelection;
window.addSelectedClassroomsToCart = addSelectedClassroomsToCart;
window.updateClassroomCartStatus = updateClassroomCartStatus; 