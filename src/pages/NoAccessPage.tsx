import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function NoAccessPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-rest-100 flex items-center justify-center mb-4">
        <UtensilsCrossed className="w-8 h-8 text-rest-600" />
      </div>
      <h1 className="text-xl font-bold text-stone-800 mb-2">Sin acceso al módulo restaurante</h1>
      <p className="text-stone-500 text-center max-w-sm mb-6">
        No tienes un perfil operativo en el restaurante. Contacta al administrador para asignarte un tipo de empleado (Administrador, Cajero, Mozo, Cocinero, etc.) en Usuarios.
      </p>
      <p className="text-sm text-stone-400 mb-6">Conectado como: {user?.name ?? user?.email}</p>
      <button
        type="button"
        onClick={() => { logout(); navigate('/home') }}
        className="flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-300"
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </div>
  )
}
