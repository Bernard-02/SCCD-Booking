/**
 * Firebase 認證服務範例
 * 這是一個範例文件，展示如何整合 Firebase Authentication
 *
 * 使用方式：
 * 1. 安裝 Firebase: npm install firebase
 * 2. 在 Firebase Console 創建專案並獲取配置
 * 3. 將此文件重命名為 firebaseAuthService.ts
 * 4. 在 App.tsx 中使用: <AuthProvider authService={firebaseAuthService}>
 */

import { AuthService } from '../contexts/AuthContext'
import { Student, LoginResult } from '../utils/testAuthData'

// Firebase 配置（從 Firebase Console 獲取）
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_AUTH_DOMAIN",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_STORAGE_BUCKET",
//   messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//   appId: "YOUR_APP_ID"
// }

// 初始化 Firebase
// import { initializeApp } from 'firebase/app'
// import {
//   getAuth,
//   signInWithEmailAndPassword,
//   signOut,
//   onAuthStateChanged,
//   User as FirebaseUser
// } from 'firebase/auth'
//
// const app = initializeApp(firebaseConfig)
// const auth = getAuth(app)

// 將 Firebase User 轉換為我們的 Student 類型
// const mapFirebaseUserToStudent = async (firebaseUser: FirebaseUser): Promise<Student> => {
//   // 從 Firestore 或其他數據庫獲取完整的學生資料
//   // const db = getFirestore(app)
//   // const studentDoc = await getDoc(doc(db, 'students', firebaseUser.uid))
//   // const studentData = studentDoc.data()
//
//   // 範例返回值
//   return {
//     studentId: firebaseUser.uid,
//     name: firebaseUser.displayName || '未命名',
//     email: firebaseUser.email || '',
//     phone: firebaseUser.phoneNumber,
//     department: '媒體傳達設計系',
//     className: '待設定',
//     year: '待設定',
//     passwordHash: '',
//     isFirstLogin: false,
//     emailVerified: firebaseUser.emailVerified,
//     createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
//     lastLogin: firebaseUser.metadata.lastSignInTime || null
//   }
// }

// Firebase 認證服務實現
export const firebaseAuthService: AuthService = {
  // 登入
  login: async (_email: string, _password: string): Promise<LoginResult> => {
    try {
      // const userCredential = await signInWithEmailAndPassword(auth, email, password)
      // const firebaseUser = userCredential.user
      // const student = await mapFirebaseUserToStudent(firebaseUser)
      // const token = await firebaseUser.getIdToken()

      // return {
      //   success: true,
      //   student,
      //   token,
      //   expiresIn: 3600000 // 1小時（Firebase token 會自動刷新）
      // }

      // 範例返回（實際應該是上面註解的代碼）
      return {
        success: false,
        message: 'Firebase 尚未配置'
      }
    } catch (error: any) {
      console.error('Firebase 登入錯誤:', error)

      // Firebase 錯誤代碼映射
      const errorCode = error.code
      let message = '登入失敗'
      let sccdErrorCode = 'UNKNOWN_ERROR'

      switch (errorCode) {
        case 'auth/user-not-found':
          message = '帳號不存在'
          sccdErrorCode = 'STUDENT_NOT_FOUND'
          break
        case 'auth/wrong-password':
          message = '密碼錯誤'
          sccdErrorCode = 'WRONG_PASSWORD'
          break
        case 'auth/invalid-email':
          message = 'Email 格式錯誤'
          break
        case 'auth/user-disabled':
          message = '帳號已被停用'
          sccdErrorCode = 'ACCOUNT_LOCKED'
          break
        case 'auth/too-many-requests':
          message = '嘗試次數過多，請稍後再試'
          sccdErrorCode = 'ACCOUNT_LOCKED'
          break
      }

      return {
        success: false,
        message,
        errorCode: sccdErrorCode
      }
    }
  },

  // 登出
  logout: async (): Promise<void> => {
    try {
      // await signOut(auth)
    } catch (error) {
      console.error('Firebase 登出錯誤:', error)
      throw error
    }
  },

  // 獲取當前用戶
  getCurrentUser: async (): Promise<Student | null> => {
    // const firebaseUser = auth.currentUser
    // if (!firebaseUser) return null
    // return await mapFirebaseUserToStudent(firebaseUser)
    return null
  },

  // 監聽認證狀態變化
  onAuthStateChanged: (callback: (user: Student | null) => void) => {
    // const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    //   if (firebaseUser) {
    //     const student = await mapFirebaseUserToStudent(firebaseUser)
    //     callback(student)
    //   } else {
    //     callback(null)
    //   }
    // })
    //
    // return unsubscribe

    // 範例返回（實際應該是上面註解的代碼）
    callback(null)
    return () => {}
  }
}

// 導出配置函數（可選）
// export const initializeFirebaseAuth = () => {
//   // 可以在這裡進行額外的初始化
//   return firebaseAuthService
// }
