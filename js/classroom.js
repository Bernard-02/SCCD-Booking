// Classroom 頁面專用 JavaScript

let currentSelectedClassroom = 'a503';
let classroomErrorCounts = {}; // 追蹤每個教室的錯誤通知次數

// 教室圖片對應
const classroomImages = {
  'a503': 'Images/A503.png',
  'a507': 'Images/A507.png',
  'a508': 'Images/A508.jpg'
};

// 教室資料
const classroomData = {
  'a503': {
    id: 'classroom-a503',
    name: 'A503 教室',
    category: 'classroom',
    deposit: 5000,
    image: 'Images/A503.png'
  },
  'a507': {
    id: 'classroom-a507',
    name: 'A507 教室', 
    category: 'classroom',
    deposit: 5000,
    image: 'Images/A507.png'
  },
  'a508': {
    id: 'classroom-a508',
    name: 'A508 教室',
    category: 'classroom', 
    deposit: 5000,
    image: 'Images/A508.jpg'
  }
};

function toggleAccordion(classroomId) {
  // 如果點擊的是已經打開的教室，就關閉它
  if (currentSelectedClassroom === classroomId) {
    closeAccordion(classroomId);
    currentSelectedClassroom = null;
    updateButtonState();
    return;
  }
  
  // 關閉當前打開的教室
  if (currentSelectedClassroom) {
    closeAccordion(currentSelectedClassroom);
  }
  
  // 延遲打開新選擇的教室，讓關閉動畫先完成
  setTimeout(() => {
    openAccordion(classroomId);
    currentSelectedClassroom = classroomId;
    updateClassroomImage(classroomId);
    updateButtonState();
  }, 200);
}

function openAccordion(classroomId) {
  // 桌面版元素
  const content = document.getElementById(`content-${classroomId}`);
  const contentInner = content ? content.querySelector('.accordion-content-inner') : null;
  const icon = document.getElementById(`icon-${classroomId}`);
  
  // 手機版元素
  const contentMobile = document.getElementById(`content-${classroomId}-mobile`);
  const contentInnerMobile = contentMobile ? contentMobile.querySelector('.accordion-content-inner') : null;
  const iconMobile = document.getElementById(`icon-${classroomId}-mobile`);
  
  // 處理桌面版
  if (content && contentInner && icon) {
    // 先設置內容顯示以計算高度
    gsap.set(contentInner, { opacity: 0 });
    content.classList.add('expanded');
    gsap.set(content, { height: 'auto' });
    const autoHeight = content.offsetHeight;
    gsap.set(content, { height: 0 });
    
    // 使用GSAP動畫展開
    const tl = gsap.timeline();
    tl.to(content, {
      height: autoHeight,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => {
        gsap.set(content, { height: 'auto' });
      }
    })
    .to(contentInner, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    }, "-=0.2");
    
    // 改變圖標為 "-"
    icon.innerHTML = '<line x1="5" y1="15" x2="25" y2="15" stroke="white" stroke-width="1"/>';
    icon.classList.remove('plus');
  }
  
  // 處理手機版
  if (contentMobile && contentInnerMobile && iconMobile) {
    // 先設置內容顯示以計算高度
    gsap.set(contentInnerMobile, { opacity: 0 });
    contentMobile.classList.add('expanded');
    gsap.set(contentMobile, { height: 'auto' });
    const autoHeightMobile = contentMobile.offsetHeight;
    gsap.set(contentMobile, { height: 0 });
    
    // 使用GSAP動畫展開
    const tl = gsap.timeline();
    tl.to(contentMobile, {
      height: autoHeightMobile,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => {
        gsap.set(contentMobile, { height: 'auto' });
      }
    })
    .to(contentInnerMobile, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    }, "-=0.2");
    
    // 改變圖標為 "-"
    iconMobile.innerHTML = '<line x1="5" y1="15" x2="25" y2="15" stroke="white" stroke-width="1"/>';
    iconMobile.classList.remove('plus');
  }
}

function closeAccordion(classroomId) {
  // 桌面版元素
  const content = document.getElementById(`content-${classroomId}`);
  const contentInner = content ? content.querySelector('.accordion-content-inner') : null;
  const icon = document.getElementById(`icon-${classroomId}`);
  
  // 手機版元素
  const contentMobile = document.getElementById(`content-${classroomId}-mobile`);
  const contentInnerMobile = contentMobile ? contentMobile.querySelector('.accordion-content-inner') : null;
  const iconMobile = document.getElementById(`icon-${classroomId}-mobile`);
  
  // 處理桌面版
  if (content && contentInner && icon) {
    // 使用GSAP動畫收起
    const tl = gsap.timeline();
    tl.to(contentInner, {
      opacity: 0,
      duration: 0.2,
      ease: "power2.out"
    })
    .to(content, {
      height: 0,
      duration: 0.4,
      ease: "power2.out",
      onComplete: () => {
        content.classList.remove('expanded');
      }
    }, "-=0.1");
    
    // 改變圖標為 "+"
    icon.innerHTML = '<line x1="5" y1="15" x2="25" y2="15" stroke="white" stroke-width="1"/><line x1="15" y1="5" x2="15" y2="25" stroke="white" stroke-width="1"/>';
    icon.classList.add('plus');
  }
  
  // 處理手機版
  if (contentMobile && contentInnerMobile && iconMobile) {
    // 使用GSAP動畫收起
    const tl = gsap.timeline();
    tl.to(contentInnerMobile, {
      opacity: 0,
      duration: 0.2,
      ease: "power2.out"
    })
    .to(contentMobile, {
      height: 0,
      duration: 0.4,
      ease: "power2.out",
      onComplete: () => {
        contentMobile.classList.remove('expanded');
      }
    }, "-=0.1");
    
    // 改變圖標為 "+"
    iconMobile.innerHTML = '<line x1="5" y1="15" x2="25" y2="15" stroke="white" stroke-width="1"/><line x1="15" y1="5" x2="15" y2="25" stroke="white" stroke-width="1"/>';
    iconMobile.classList.add('plus');
  }
}

function updateClassroomImage(classroomId) {
  const image = document.getElementById('classroom-image');
  if (image) {
    image.src = classroomImages[classroomId];
    image.alt = `${classroomId.toUpperCase()} 教室`;
  }
}

function updateButtonState() {
  const button = document.getElementById('add-classroom-btn');
  if (!button) return;
  
  if (!currentSelectedClassroom) {
    // 沒有選中教室時，按鈕可用
    button.classList.remove('button-disabled');
    return;
  }
  
  const cart = window.cartManager.getCart();
  const classroom = classroomData[currentSelectedClassroom];
  const isClassroomInCart = cart.find(item => item.id === classroom.id);
  const errorCount = classroomErrorCounts[currentSelectedClassroom] || 0;
  
  // 只有當前教室已在購物車中且錯誤次數達到2次時才禁用
  if (isClassroomInCart && errorCount >= 2) {
    button.classList.add('button-disabled');
  } else {
    button.classList.remove('button-disabled');
  }
}

function addClassroomToCart() {
  const button = document.getElementById('add-classroom-btn');
  
  // 檢查按鈕是否已被禁用
  if (button && button.classList.contains('button-disabled')) {
    return;
  }
  
  if (!currentSelectedClassroom) {
    showNotification('請先選擇一間教室！', 'error');
    return;
  }
  
  const classroom = classroomData[currentSelectedClassroom];
  const cart = window.cartManager.getCart();
  
  // 檢查當前選中的教室是否已經在購物車中
  const existingClassroom = cart.find(item => item.id === classroom.id);
  
  if (existingClassroom) {
    // 增加當前教室的錯誤計數
    classroomErrorCounts[currentSelectedClassroom] = (classroomErrorCounts[currentSelectedClassroom] || 0) + 1;
    showNotification('教室只有一個啦...不能重複添加！', 'error');
    
    // 更新按鈕狀態
    updateButtonState();
    return;
  }
  
  // 如果教室不在購物車中，可以正常添加
  const success = window.cartManager.addToCart({
    id: classroom.id,
    name: classroom.name,
    category: classroom.category,
    deposit: classroom.deposit,
    mainImage: classroom.image
  });
  
  if (success) {
    showNotification(`${classroom.name}已成功加入租借清單！`);
    // 成功添加後更新按鈕狀態
    updateButtonState();
  } else {
    // 添加失敗（可能是系統錯誤）
    showNotification('添加失敗，請重試！', 'error');
  }
}

function showNotification(message, type = 'success') {
  // 使用全域的 showToast 函數
  if (window.showToast) {
    window.showToast(message, type);
  } else if (window.showBookmarkToast) {
    // 回退到 showBookmarkToast
    window.showBookmarkToast(message, type);
  } else {
    // 最後回退到 alert
    alert(message);
  }
}

// showToast 函數現在由 common.js 提供



// 初始化頁面
document.addEventListener('DOMContentLoaded', function() {
  // 默認展開 A503
  openAccordion('a503');
  

  
  // 為圖標添加hover效果 - 只在桌面版
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const icons = document.querySelectorAll('.expand-icon');
    icons.forEach(icon => {
      icon.addEventListener('mouseenter', function() {
        if (this.classList.contains('plus')) {
          gsap.to(this, {
            rotation: 90,
            duration: 0.3,
            ease: "power2.out"
          });
        }
      });
      
      icon.addEventListener('mouseleave', function() {
        if (this.classList.contains('plus')) {
          gsap.to(this, {
            rotation: 0,
            duration: 0.3,
            ease: "power2.out"
          });
        }
      });
    });
  }
  
  // 按鈕動畫效果 - 只在桌面版
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const button = document.getElementById('add-classroom-btn');
    const buttonFill = button ? button.querySelector('.button-bg-fill') : null;
    
    if (button && buttonFill) {
      button.addEventListener('mouseenter', function() {
        // 不包含disabled類時才執行動畫
        if (!this.classList.contains('button-disabled')) {
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
        // 不包含disabled類時才執行動畫
        if (!this.classList.contains('button-disabled')) {
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
});

// 全局函數，供 HTML 調用
window.toggleAccordion = toggleAccordion;
window.addClassroomToCart = addClassroomToCart; 