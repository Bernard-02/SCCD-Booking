// Google Apps Script 後台代碼
// 請將此代碼複製到 Google Apps Script 中

// =================
// 配置設定
// =================

// 請替換成您的 Google Sheets ID
const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEETS_ID_HERE';

// 工作表名稱
const SHEETS = {
  EQUIPMENT: '設備清單',
  ORDERS: '訂單記錄', 
  USERS: '用戶資料',
  INVENTORY: '庫存記錄',
  BOOKINGS: '預約記錄'
};

// =================
// 主要 API 函數
// =================

function doGet(e) {
  const action = e.parameter.action;
  
  try {
    switch(action) {
      case 'getEquipment':
        return createResponse(getEquipment());
      case 'getEquipmentById':
        return createResponse(getEquipmentById(e.parameter.id));
      case 'getOrders':
        return createResponse(getOrders(e.parameter.userId));
      case 'getUserProfile':
        return createResponse(getUserProfile(e.parameter.userId));
      default:
        return createResponse(null, 'Invalid action', false);
    }
  } catch (error) {
    return createResponse(null, error.toString(), false);
  }
}

function doPost(e) {
  const action = e.parameter.action;
  
  try {
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    switch(action) {
      case 'createOrder':
        return createResponse(createOrder(data));
      case 'updateOrderStatus':
        return createResponse(updateOrderStatus(data.orderId, data.status));
      case 'createUser':
        return createResponse(createUser(data));
      case 'updateInventory':
        return createResponse(updateInventory(data));
      case 'createBooking':
        return createResponse(createBooking(data));
      default:
        return createResponse(null, 'Invalid action', false);
    }
  } catch (error) {
    return createResponse(null, error.toString(), false);
  }
}

// =================
// 設備管理函數
// =================

function getEquipment() {
  const sheet = getSheet(SHEETS.EQUIPMENT);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const equipment = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) { // 確保有 ID
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      equipment.push(item);
    }
  }
  
  return equipment;
}

function getEquipmentById(equipmentId) {
  const sheet = getSheet(SHEETS.EQUIPMENT);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === equipmentId) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      return item;
    }
  }
  
  return null;
}

function updateInventory(data) {
  const { equipmentId, quantityChange, operation } = data;
  const sheet = getSheet(SHEETS.EQUIPMENT);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // 找到設備行
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === equipmentId) {
      const currentQuantity = values[i][4] || 0; // 假設數量在第5列
      let newQuantity;
      
      if (operation === 'rent') {
        newQuantity = currentQuantity - quantityChange;
      } else if (operation === 'return') {
        newQuantity = currentQuantity + quantityChange;
      } else {
        newQuantity = quantityChange;
      }
      
      // 更新數量
      sheet.getRange(i + 1, 5).setValue(newQuantity);
      
      // 記錄庫存變動
      logInventoryChange(equipmentId, currentQuantity, newQuantity, operation);
      
      return { success: true, newQuantity: newQuantity };
    }
  }
  
  return { success: false, message: '設備未找到' };
}

// =================
// 訂單管理函數
// =================

function createOrder(orderData) {
  const sheet = getSheet(SHEETS.ORDERS);
  const orderId = generateOrderId();
  const timestamp = new Date();
  
  const orderRow = [
    orderId,
    orderData.userId,
    orderData.userName,
    orderData.userEmail,
    orderData.userPhone,
    JSON.stringify(orderData.items),
    orderData.totalAmount,
    orderData.rentalDates.start,
    orderData.rentalDates.end,
    '待審核', // 狀態
    timestamp,
    '', // 審核人員
    '', // 備註
    orderData.purpose || '', // 使用目的
    orderData.location || '' // 使用地點
  ];
  
  sheet.appendRow(orderRow);
  
  // 更新庫存
  orderData.items.forEach(item => {
    updateInventory({
      equipmentId: item.id,
      quantityChange: item.quantity,
      operation: 'rent'
    });
  });
  
  return {
    orderId: orderId,
    status: '待審核',
    timestamp: timestamp
  };
}

function getOrders(userId = null) {
  const sheet = getSheet(SHEETS.ORDERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const orders = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) { // 確保有訂單ID
      if (!userId || row[1] === userId) { // 如果沒有指定用戶或用戶ID匹配
        const order = {};
        headers.forEach((header, index) => {
          if (header === '商品清單' && row[index]) {
            order[header] = JSON.parse(row[index]);
          } else {
            order[header] = row[index];
          }
        });
        orders.push(order);
      }
    }
  }
  
  return orders;
}

function updateOrderStatus(orderId, newStatus, reviewer = '') {
  const sheet = getSheet(SHEETS.ORDERS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orderId) {
      sheet.getRange(i + 1, 10).setValue(newStatus); // 狀態欄位
      sheet.getRange(i + 1, 12).setValue(reviewer); // 審核人員欄位
      sheet.getRange(i + 1, 16).setValue(new Date()); // 更新時間欄位
      
      return { success: true, orderId: orderId, newStatus: newStatus };
    }
  }
  
  return { success: false, message: '訂單未找到' };
}

// =================
// 用戶管理函數
// =================

function createUser(userData) {
  const sheet = getSheet(SHEETS.USERS);
  const timestamp = new Date();
  
  // 檢查用戶是否已存在
  const existingUser = getUserProfile(userData.userId);
  if (existingUser) {
    return { success: false, message: '用戶已存在' };
  }
  
  const userRow = [
    userData.userId,
    userData.name,
    userData.email,
    userData.phone,
    userData.studentId,
    userData.grade,
    userData.department || '媒體傳達設計學系',
    timestamp,
    '正常', // 狀態
    0, // 總租借次數
    0, // 違約次數
    userData.emergencyContact || '',
    userData.lineId || ''
  ];
  
  sheet.appendRow(userRow);
  
  return { success: true, userId: userData.userId };
}

function getUserProfile(userId) {
  const sheet = getSheet(SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === userId) {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = row[index];
      });
      return user;
    }
  }
  
  return null;
}

// =================
// 預約管理函數
// =================

function createBooking(bookingData) {
  const sheet = getSheet(SHEETS.BOOKINGS);
  const bookingId = generateBookingId();
  const timestamp = new Date();
  
  const bookingRow = [
    bookingId,
    bookingData.userId,
    bookingData.userName,
    bookingData.resourceType, // 'equipment' or 'space'
    bookingData.resourceId,
    bookingData.resourceName,
    bookingData.startTime,
    bookingData.endTime,
    bookingData.purpose,
    '待審核',
    timestamp,
    bookingData.notes || ''
  ];
  
  sheet.appendRow(bookingRow);
  
  return {
    bookingId: bookingId,
    status: '待審核',
    timestamp: timestamp
  };
}

// =================
// 輔助函數
// =================

function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    initializeSheet(sheet, sheetName);
  }
  
  return sheet;
}

function initializeSheet(sheet, sheetName) {
  let headers = [];
  
  switch(sheetName) {
    case SHEETS.EQUIPMENT:
      headers = ['設備ID', '設備名稱', '類別', '狀態', '數量', '押金', '描述', '圖片URL', '建立時間', '更新時間'];
      break;
    case SHEETS.ORDERS:
      headers = ['訂單ID', '用戶ID', '用戶姓名', '用戶信箱', '用戶電話', '商品清單', '總金額', '租借開始日期', '租借結束日期', '狀態', '建立時間', '審核人員', '備註', '使用目的', '使用地點', '更新時間'];
      break;
    case SHEETS.USERS:
      headers = ['用戶ID', '姓名', '信箱', '電話', '學號', '年級', '科系', '註冊時間', '狀態', '總租借次數', '違約次數', '緊急聯絡人', 'Line ID'];
      break;
    case SHEETS.INVENTORY:
      headers = ['記錄ID', '設備ID', '變動前數量', '變動後數量', '變動類型', '相關訂單ID', '時間', '備註'];
      break;
    case SHEETS.BOOKINGS:
      headers = ['預約ID', '用戶ID', '用戶姓名', '資源類型', '資源ID', '資源名稱', '開始時間', '結束時間', '使用目的', '狀態', '建立時間', '備註'];
      break;
  }
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function logInventoryChange(equipmentId, oldQuantity, newQuantity, operation, orderId = '') {
  const sheet = getSheet(SHEETS.INVENTORY);
  const recordId = generateId('INV');
  
  const logRow = [
    recordId,
    equipmentId,
    oldQuantity,
    newQuantity,
    operation,
    orderId,
    new Date(),
    `${operation}: ${oldQuantity} → ${newQuantity}`
  ];
  
  sheet.appendRow(logRow);
}

function generateOrderId() {
  return 'ORD' + new Date().getTime();
}

function generateBookingId() {
  return 'BKG' + new Date().getTime();
}

function generateId(prefix = 'ID') {
  return prefix + new Date().getTime();
}

function createResponse(data, message = '', success = true) {
  const response = {
    success: success,
    data: data,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// =================
// 測試函數
// =================

function testGetEquipment() {
  console.log(getEquipment());
}

function testCreateOrder() {
  const testOrder = {
    userId: 'TEST001',
    userName: '測試用戶',
    userEmail: 'test@example.com',
    userPhone: '0900-000-000',
    items: [
      { id: 'speaker-clamp-light', name: '黑色喇叭夾燈', quantity: 1, deposit: 500 }
    ],
    totalAmount: 500,
    rentalDates: {
      start: '2025-01-15',
      end: '2025-01-16'
    },
    purpose: '課程作業'
  };
  
  console.log(createOrder(testOrder));
} 