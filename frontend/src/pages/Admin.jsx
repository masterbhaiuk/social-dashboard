import { useAdminAuth } from '../hooks/useAdminAuth'
import AdminLogin from '../components/AdminLogin'
import AdminPanel from '../components/AdminPanel'

export default function Admin() {
  const { isAdmin } = useAdminAuth()
  return isAdmin ? <AdminPanel /> : <AdminLogin />
}
