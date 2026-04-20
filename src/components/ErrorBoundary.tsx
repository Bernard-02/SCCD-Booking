/**
 * 錯誤邊界組件
 * 捕捉 React 組件錯誤，防止整個應用崩潰
 */

import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)

    // 呼叫自定義錯誤處理
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 發送錯誤報告（可串接 Sentry 等服務）
    this.reportError(error, errorInfo)
  }

  reportError(_error: Error, _errorInfo: React.ErrorInfo) {
    // 預留：串接 Sentry 等錯誤追蹤服務
  }

  render() {
    if (this.state.hasError) {
      // 使用自定義 fallback 或預設 UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
            <h2 className="font-chinese text-red-400 text-content mb-3">發生錯誤</h2>
            <p className="font-chinese text-zinc-400 text-small mb-4">
              很抱歉，此組件發生錯誤。已自動切換回舊版本。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-white hover:bg-zinc-200 text-black font-chinese text-small px-6 py-2 rounded-lg transition-colors"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
