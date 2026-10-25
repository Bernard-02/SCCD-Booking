/**
 * useConfirmDialog Hook
 * 方便地使用 ConfirmDialog 組件
 */

import { useState, useCallback, useMemo } from 'react'
import ConfirmDialog from '../components/common/ConfirmDialog'

interface ConfirmOptions {
  title: string
  titleEn?: string
  message: string
  messageEn?: string
  confirmText?: string
  confirmTextZh?: string
  cancelText?: string
  cancelTextZh?: string
  variant?: 'default' | 'danger'
}

export const useConfirmDialog = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: ''
  })
  const [resolver, setResolver] = useState<{
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setIsOpen(true)

    return new Promise<boolean>((resolve) => {
      setResolver({ resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    resolver?.resolve(true)
  }, [resolver])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    resolver?.resolve(false)
  }, [resolver])

  // useMemo：元件型別固定，父層因其他 state 重 render 時對話框不會被卸載重掛（fadeIn 重跑、看起來跳兩次）
  const ConfirmDialogComponent = useMemo(() => () => (
    <ConfirmDialog
      isOpen={isOpen}
      title={options.title}
      titleEn={options.titleEn}
      message={options.message}
      messageEn={options.messageEn}
      confirmText={options.confirmText}
      confirmTextZh={options.confirmTextZh}
      cancelText={options.cancelText}
      cancelTextZh={options.cancelTextZh}
      variant={options.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [isOpen, options, handleConfirm, handleCancel])

  return {
    confirm,
    ConfirmDialog: ConfirmDialogComponent
  }
}
