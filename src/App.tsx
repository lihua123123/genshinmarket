import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { MarketServerProvider } from './context/MarketServerContext'
import LockScreen from './components/LockScreen'
import RegisterScreen from './components/RegisterScreen'
import Layout from './components/Layout'
import MyPage from './pages/MyPage'
import MarketPage from './pages/MarketPage'
import ItemDetailPage from './pages/ItemDetailPage'
import TradePage from './pages/TradePage'
import TradeHistoryPage from './pages/TradeHistoryPage'

// 应用门控：锁屏 → 注册/登录 → 主界面
function Gate() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('unlocked') === 'true')
  const { currentUser } = useAuth()

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />
  if (!currentUser) return <RegisterScreen />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/my" replace />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/market/item/:itemName" element={<ItemDetailPage />} />
        <Route path="/trade" element={<TradePage />} />
        <Route path="/trades" element={<TradeHistoryPage />} />
        <Route path="*" element={<Navigate to="/my" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MarketServerProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </MarketServerProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
