interface ConfirmDialogProps {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
}

// 通用确认对话框
export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认'
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="modal-overlay">
      <div className="modal modal-small">
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          <div className="confirm-actions">
            <button className="btn" onClick={onCancel}>
              取消
            </button>
            <button className="btn btn-primary" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
