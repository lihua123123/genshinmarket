import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  selected?: boolean
}

// 通用卡片组件：白色圆角、轻微阴影、hover 上浮
export default function Card({ children, onClick, className = '', selected = false }: CardProps) {
  return (
    <div
      className={`card ${selected ? 'card-selected' : ''} ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  )
}
