/* ===== Copyright 彩蛋效果 JavaScript ===== */

// 初始化 Copyright 彩蛋效果
function initCopyrightEasterEgg() {
  const copyrightElement = document.querySelector('.copyright');
  const originalElement = document.querySelector('.copyright-original');
  const easterEggElement = document.getElementById('easter-egg-text');
  
  // 只在桌面版且有必要元素時啟用
  if (!copyrightElement || !originalElement || !easterEggElement) {
    return;
  }
  
  // 檢查是否為桌面版（支援 hover）
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }
  
  const originalText = originalElement.textContent;
  const targetText = "SHIH CHIEN COMMUNICATIONS DESIGN";
  const maxLength = Math.min(originalText.length, targetText.length);
  const truncatedTarget = targetText.substring(0, maxLength);
  
  let isHovering = false;
  let animationInterval = null;
  let currentStep = 0;
  let isAnimatingIn = false;
  let isAnimatingOut = false;
  
  // 隨機字符池
  const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?~+=_|\\/<>[]{}';
  
  function getRandomChar() {
    return randomChars[Math.floor(Math.random() * randomChars.length)];
  }
  
  function generateRandomString(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += getRandomChar();
    }
    return result;
  }
  
  function animateToTarget() {
    if (isAnimatingOut) return;
    isAnimatingIn = true;
    currentStep = 0;
    
    const totalSteps = Math.ceil(2000 / 50); // 2秒，每50ms一步
    const charsToReveal = Math.ceil(maxLength / totalSteps * 4); // 每步顯示的字符數
    
    easterEggElement.textContent = generateRandomString(maxLength);
    easterEggElement.style.opacity = '1';
    originalElement.style.opacity = '0';
    
    animationInterval = setInterval(() => {
      if (!isHovering || isAnimatingOut) {
        clearInterval(animationInterval);
        isAnimatingIn = false;
        return;
      }
      
      currentStep++;
      const revealedChars = Math.min(Math.floor(currentStep * charsToReveal), maxLength);
      
      let displayText = '';
      for (let i = 0; i < maxLength; i++) {
        if (i < revealedChars) {
          displayText += truncatedTarget[i] || ' ';
        } else {
          displayText += getRandomChar();
        }
      }
      
      easterEggElement.textContent = displayText;
      
      if (revealedChars >= maxLength) {
        clearInterval(animationInterval);
        isAnimatingIn = false;
        easterEggElement.textContent = truncatedTarget;
      }
    }, 50);
  }
  
  function animateToOriginal() {
    // 立即停止任何正在進行的動畫
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    
    isAnimatingIn = false;
    isAnimatingOut = true;
    currentStep = 0;
    
    const totalSteps = Math.ceil(300 / 30); // 0.3秒，每30ms一步
    
    animationInterval = setInterval(() => {
      currentStep++;
      const progress = currentStep / totalSteps;
      
      if (progress >= 1) {
        clearInterval(animationInterval);
        easterEggElement.style.opacity = '0';
        originalElement.style.opacity = '1';
        isAnimatingOut = false;
        animationInterval = null;
        return;
      }
      
      // 逐漸將當前顯示的文字變成隨機字符，最後回到原始狀態
      let displayText = '';
      for (let i = 0; i < maxLength; i++) {
        if (Math.random() < progress * 0.8) { // 80%機率變成隨機字符
          displayText += getRandomChar();
        } else {
          // 保持當前字符或目標字符
          const currentChar = easterEggElement.textContent[i];
          displayText += currentChar || getRandomChar();
        }
      }
      easterEggElement.textContent = displayText;
    }, 30);
  }
  
  // 添加事件監聽器
  copyrightElement.addEventListener('mouseenter', () => {
    isHovering = true;
    if (animationInterval) clearInterval(animationInterval);
    animateToTarget();
  });
  
  copyrightElement.addEventListener('mouseleave', () => {
    isHovering = false;
    animateToOriginal();
  });
}

// 全域函數，供其他頁面調用
window.initCopyrightEasterEgg = initCopyrightEasterEgg;

// 自動初始化
document.addEventListener('DOMContentLoaded', initCopyrightEasterEgg); 