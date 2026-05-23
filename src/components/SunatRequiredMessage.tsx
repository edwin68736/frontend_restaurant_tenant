import { FileText } from 'lucide-react'

export default function SunatRequiredMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-rest-100 flex items-center justify-center mb-4">
        <FileText size={32} className="text-rest-600" />
      </div>
      <h3 className="text-lg font-bold text-stone-800 mb-2">Facturación electrónica no habilitada</h3>
      <p className="text-stone-600 text-sm">
        Para usar facturación (boletas y facturas electrónicas) debe actualizar su plan para habilitar la facturación electrónica.
      </p>
      <p className="text-stone-500 text-xs mt-3">
        Mientras tanto, puede emitir <strong>Notas de venta</strong>. La habilitación se gestiona desde el panel de administración del tenant.
      </p>
    </div>
  )
}
