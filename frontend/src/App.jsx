import { Routes, Route } from 'react-router-dom'
import { AdminAuthProvider } from './hooks/useAdminAuth'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        <footer className="mt-auto py-8 text-center text-xs text-slate-400">
          Social Pulse — data refreshes automatically on a schedule. Click any post to view it on its native platform.
        </footer>
      </div>
    </AdminAuthProvider>
  )
}
