import { useCallback } from 'react'
import { toast } from 'sonner'
import { useBranch } from '@/contexts/BranchContext'
import { READ_ONLY_MESSAGE } from '@/lib/branch/viewMode'

/**
 * Guarda central del modo consulta ("todas las sucursales").
 *
 * - `readOnly`: true en modo consulta; úselo para ocultar/deshabilitar acciones operativas.
 * - `guardWrite()`: devuelve true si se puede escribir; en modo consulta avisa y devuelve false
 *   (`if (!guardWrite()) return` al inicio de un handler que escribe).
 *
 * La red de seguridad real es el interceptor de axios (rechaza toda escritura en este modo); este hook
 * evita ofrecer el botón y da un aviso inmediato.
 */
export function useBranchWriteGuard() {
  const { isAllBranches } = useBranch()
  const guardWrite = useCallback((): boolean => {
    if (!isAllBranches) return true
    toast.warning(READ_ONLY_MESSAGE, { id: 'branch-read-only' })
    return false
  }, [isAllBranches])
  return { readOnly: isAllBranches, guardWrite, message: READ_ONLY_MESSAGE }
}
