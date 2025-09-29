/**
 * Google Calendar風格教室時間表管理系統
 * 負責生成24小時制的教室課程時間表，使用絕對定位的課程區塊
 * 支持15分鐘精度的時間段顯示
 */

class ClassroomSchedule {
  constructor() {
    this.classrooms = ['A503', 'A507', 'A508'];
    this.timeSlots = this.generateTimeSlots();
    this.scheduleData = this.generateCourseData();
    this.hourHeight = 48; // 每小時的像素高度
    this.minuteHeight = this.hourHeight / 60; // 每分鐘的像素高度 (0.8px per minute)

    this.init();
  }

  /**
   * 初始化時間表
   */
  init() {
    this.renderTimeAxis();
    this.renderGrid();
    this.renderCourseBlocks();
    this.updateClassroomStatus();
    this.startStatusUpdater();
  }

  /**
   * 生成24小時時間段 (從00:00開始到23:00，第一行為空)
   */
  generateTimeSlots() {
    const slots = [];
    // 添加24個時間段，第一個為空，然後是01:00到23:00
    for (let hour = 0; hour < 24; hour++) {
      slots.push(hour);
    }
    return slots;
  }

  /**
   * 生成課程數據
   * 使用新的數據格式，支持分鐘級精度
   * 之後可以替換為從後端API獲取真實數據
   */
  generateCourseData() {
    // 模擬課程數據，使用新的數據格式
    return [
      {
        id: 1,
        classroom: 'A503',
        title: '大一基礎攝影',
        startTime: '09:00',
        endTime: '12:00',
        type: 'course'
      },
      {
        id: 2,
        classroom: 'A503',
        title: '影像後製技術',
        startTime: '14:30',
        endTime: '16:15',
        type: 'course'
      },
      {
        id: 3,
        classroom: 'A507',
        title: '新聞寫作',
        startTime: '08:00',
        endTime: '10:00',
        type: 'course'
      },
      {
        id: 4,
        classroom: 'A507',
        title: '大二主軸課程',
        startTime: '13:00',
        endTime: '17:00',
        type: 'course'
      },
      {
        id: 5,
        classroom: 'A507',
        title: '進階剪輯',
        startTime: '19:30',
        endTime: '21:45',
        type: 'course'
      },
      {
        id: 6,
        classroom: 'A508',
        title: '媒體企劃',
        startTime: '10:15',
        endTime: '12:00',
        type: 'course'
      },
      {
        id: 7,
        classroom: 'A508',
        title: '廣播節目製作',
        startTime: '15:00',
        endTime: '18:00',
        type: 'course'
      }
    ];
  }

  /**
   * 渲染時間軸
   */
  renderTimeAxis() {
    const timeAxis = document.getElementById('time-axis');
    if (!timeAxis) return;

    timeAxis.innerHTML = '';

    // 設置時間軸容器高度 (24小時: 第一行空白 + 01:00-23:00)
    const totalHeight = this.timeSlots.length * this.hourHeight;
    timeAxis.style.height = totalHeight + 'px';

    // 生成時間標記
    this.timeSlots.forEach((hour, index) => {
      const timeMarkContainer = document.createElement('div');
      timeMarkContainer.className = 'time-mark';
      timeMarkContainer.style.top = (index * this.hourHeight) + 'px';

      const timeSpan = document.createElement('span');

      // 第一行（index 0）為空，第二行（index 1）顯示01:00，以此類推
      if (index === 0) {
        timeSpan.textContent = ''; // 第一行空白
      } else {
        timeSpan.textContent = String(index).padStart(2, '0') + ':00';
      }

      timeMarkContainer.appendChild(timeSpan);
      timeAxis.appendChild(timeMarkContainer);
    });
  }

  /**
   * 渲染網格背景
   */
  renderGrid() {
    const scheduleGrid = document.getElementById('schedule-grid');
    if (!scheduleGrid) return;

    scheduleGrid.innerHTML = '';

    // 設置網格容器高度 (24小時: 第一行空白 + 01:00-23:00)
    const totalHeight = this.timeSlots.length * this.hourHeight;
    scheduleGrid.style.height = totalHeight + 'px';

    // 生成網格單元格
    this.timeSlots.forEach((hour, hourIndex) => {
      this.classrooms.forEach((classroom, classroomIndex) => {
        const gridCell = document.createElement('div');
        gridCell.className = 'grid-cell';
        gridCell.style.height = this.hourHeight + 'px';
        gridCell.style.gridColumn = (classroomIndex + 1);
        gridCell.style.gridRow = (hourIndex + 1);

        scheduleGrid.appendChild(gridCell);
      });
    });
  }

  /**
   * 渲染課程區塊
   */
  renderCourseBlocks() {
    const courseBlocksContainer = document.getElementById('course-blocks');
    if (!courseBlocksContainer) return;

    courseBlocksContainer.innerHTML = '';

    // 設置課程區塊容器高度 (24小時: 第一行空白 + 01:00-23:00)
    const totalHeight = this.timeSlots.length * this.hourHeight;
    courseBlocksContainer.style.height = totalHeight + 'px';

    // 為每個教室創建一個column container
    this.classrooms.forEach((classroom, classroomIndex) => {
      const columnContainer = document.createElement('div');
      columnContainer.className = 'classroom-column';
      columnContainer.style.position = 'relative';
      columnContainer.style.height = '100%';

      const courses = this.getCourseBlocksForClassroom(classroom);

      courses.forEach(course => {
        const courseBlock = this.createCourseBlock(course);
        columnContainer.appendChild(courseBlock);
      });

      courseBlocksContainer.appendChild(columnContainer);
    });
  }

  /**
   * 獲取特定教室的課程區塊數據
   */
  getCourseBlocksForClassroom(classroom) {
    // 從新的數據格式中篩選特定教室的課程
    return this.scheduleData.filter(course => course.classroom === classroom);
  }

  /**
   * 創建課程區塊元素
   */
  createCourseBlock(course) {
    const block = document.createElement('div');
    block.className = 'course-block';

    // 解析開始和結束時間
    const startMinutes = this.timeToMinutes(course.startTime);
    const endMinutes = this.timeToMinutes(course.endTime);

    // 計算位置和大小 (第一行空白，但課程卡片要對齊到正確的時間位置)
    const top = startMinutes * this.minuteHeight;
    const height = (endMinutes - startMinutes) * this.minuteHeight - 6; // 底部留6px間隙

    // 設置樣式 - 現在在column container內，可以使用width 100%
    block.style.top = top + 'px';
    block.style.height = height + 'px';
    block.style.width = 'calc(100% - 20px)';
    block.style.marginRight = '10px';

    // 設置內容
    const courseName = document.createElement('div');
    courseName.className = 'course-name';
    courseName.textContent = course.title;

    const courseTime = document.createElement('div');
    courseTime.className = 'course-time';
    courseTime.textContent = `${course.startTime} - ${course.endTime}`;

    block.appendChild(courseName);
    block.appendChild(courseTime);

    // 設置提示
    block.title = `${course.classroom} - ${course.title}\n${courseTime.textContent}`;

    return block;
  }

  /**
   * 將時間字符串轉換為從00:00開始的分鐘數
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 從API獲取真實數據
   * 這是為未來後端整合預留的方法
   */
  async fetchCourseData(date) {
    try {
      // 這裡應該調用實際的API
      // const response = await fetch(`/api/classroom-courses?date=${date}`);
      // const data = await response.json();
      // return data;

      // 目前返回模擬數據
      return this.generateCourseData();
    } catch (error) {
      console.error('獲取教室課程數據失敗:', error);
      return this.generateCourseData(); // 失敗時使用模擬數據
    }
  }

  /**
   * 更新課程數據
   */
  updateScheduleData(newData) {
    this.scheduleData = newData;
    this.renderCourseBlocks();
  }

  /**
   * 檢查教室在特定時間是否空閒
   */
  isClassroomAvailable(classroom, timeString) {
    const targetMinutes = this.timeToMinutes(timeString);

    // 檢查是否有課程在此時間進行
    const conflictingCourse = this.scheduleData.find(course => {
      if (course.classroom !== classroom) return false;

      const startMinutes = this.timeToMinutes(course.startTime);
      const endMinutes = this.timeToMinutes(course.endTime);

      return targetMinutes >= startMinutes && targetMinutes < endMinutes;
    });

    return !conflictingCourse;
  }

  /**
   * 獲取所有空閒的教室（當前時間）
   */
  getAvailableClassrooms() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const available = [];

    this.classrooms.forEach(classroom => {
      if (this.isClassroomAvailable(classroom, currentTime)) {
        available.push(classroom);
      }
    });

    return available;
  }

  /**
   * 獲取特定教室的當日課程表
   */
  getClassroomDailyCourses(classroom) {
    return this.scheduleData.filter(course => course.classroom === classroom);
  }

  /**
   * 更新所有教室的狀態標籤
   */
  updateClassroomStatus() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.classrooms.forEach(classroom => {
      const statusElement = document.getElementById(`status-${classroom}`);
      if (!statusElement) return;

      const isAvailable = this.isClassroomAvailable(classroom, currentTime);

      if (isAvailable) {
        statusElement.className = "font-chinese text-tiny font-medium text-success transition-colors duration-300";
        statusElement.textContent = '可租借';
      } else {
        statusElement.className = "font-chinese text-tiny font-medium text-error transition-colors duration-300";
        statusElement.textContent = '使用中';
      }
    });
  }

  /**
   * 啟動狀態更新定時器，每分鐘更新一次狀態
   */
  startStatusUpdater() {
    // 立即更新一次
    this.updateClassroomStatus();

    // 每分鐘更新一次狀態
    setInterval(() => {
      this.updateClassroomStatus();
    }, 60000); // 60秒
  }
}

// 頁面載入完成後初始化教室時間表
document.addEventListener('DOMContentLoaded', function() {
  // 確保DOM元素存在後再初始化
  if (document.getElementById('schedule-container')) {
    window.classroomSchedule = new ClassroomSchedule();
  }
});

// 導出給其他模組使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClassroomSchedule;
}