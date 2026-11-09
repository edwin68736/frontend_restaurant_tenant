import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { AdvancedParseResult, AdvancedTotals } from '@/utils/restaurantProductAdvancedImport'

/** Resumen previo a importar (importación avanzada de platos): errores por hoja/fila o lo que se hará. */
export function AdvancedSummary({
  adv,
  preview,
  previewing,
  branchName,
}: {
  adv: AdvancedParseResult
  preview: AdvancedTotals | null
  previewing: boolean
  branchName: string
}) {
  const warningsBlock =
    adv.warnings.length > 0 ? (
      <ul className="text-xs text-amber-800 border border-amber-200 bg-amber-50/60 rounded-xl p-2 space-y-0.5">
        {adv.warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    ) : null

  if (adv.errors.length > 0) {
    const bySheet = new Map<string, typeof adv.errors>()
    for (const e of adv.errors) bySheet.set(e.sheet, [...(bySheet.get(e.sheet) ?? []), e])
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 p-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>
            <strong>{adv.errors.length}</strong> error(es). Corrige el Excel y vuelve a cargarlo.
          </p>
        </div>
        <div className="max-h-56 overflow-y-auto border border-red-200 bg-red-50/50 rounded-xl p-2 space-y-2 text-xs text-red-800">
          {[...bySheet.entries()].map(([sheet, list]) => (
            <div key={sheet}>
              <p className="font-semibold">Hoja {sheet}</p>
              <ul className="space-y-0.5">
                {list.slice(0, 40).map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `Fila ${e.row}: ` : ''}
                    {e.message}
                  </li>
                ))}
                {list.length > 40 && <li>… y {list.length - 40} más</li>}
              </ul>
            </div>
          ))}
        </div>
        {warningsBlock}
      </div>
    )
  }
  if (adv.items.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 p-3 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p>No hay platos para importar.</p>
      </div>
    )
  }
  if (previewing || !preview) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-600 py-4">
        <Loader2 className="w-4 h-4 animate-spin text-rest-600" />
        Calculando resumen con el servidor (no se guarda nada)…
      </div>
    )
  }
  if (preview.failed.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 p-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>
            El servidor detectó <strong>{preview.failed.length}</strong> plato(s) con error. Corrige el Excel y vuelve
            a cargarlo (todavía no se guardó nada).
          </p>
        </div>
        <ul className="text-xs text-red-800 max-h-56 overflow-y-auto border border-red-200 bg-red-50/50 rounded-xl p-2 space-y-1">
          {preview.failed.slice(0, 40).map((f, i) => (
            <li key={i}>
              Plato de la fila {f.row} ({f.name}): {f.error}
            </li>
          ))}
          {preview.failed.length > 40 && <li>… y {preview.failed.length - 40} más</li>}
        </ul>
        {warningsBlock}
      </div>
    )
  }

  const deactivated =
    preview.presentations.deactivated +
    preview.modOptions.deactivated +
    preview.modLinks.removed +
    preview.comboGroups.deactivated
  const lines: { label: string; rows: number | string; c: number; u: number | string; d: number | string }[] = [
    { label: 'Presentaciones', rows: adv.counts.presentations, ...pick(preview.presentations) },
    { label: 'Grupos de extras (globales)', rows: '—', c: preview.modGroups.created, u: preview.modGroups.updated, d: '—' },
    { label: 'Opciones de extras', rows: adv.counts.extraOptions, ...pick(preview.modOptions) },
    { label: 'Extras vinculados a platos', rows: adv.counts.extraLinks, c: preview.modLinks.created, u: '—', d: preview.modLinks.removed },
    { label: 'Grupos de combo', rows: adv.counts.comboRows, ...pick(preview.comboGroups) },
  ]
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-800 p-3 text-sm">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-semibold">Resumen antes de importar (sucursal {branchName})</p>
          <p className="mt-0.5">
            Se crean <strong>{preview.created}</strong> plato(s), se modifican <strong>{preview.updated}</strong>
            {deactivated > 0 ? (
              <>
                {' '}
                y se desactivarán o desvincularán <strong>{deactivated}</strong> elemento(s) que ya no aparecen en el
                Excel.
              </>
            ) : (
              <>; no se desactiva ningún elemento.</>
            )}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto border border-stone-200 rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-stone-50">
            <tr>
              {['', 'Filas en Excel', 'Se crean', 'Se modifican', 'Se desactivan / quitan'].map((h) => (
                <th key={h} className="text-left px-2 py-2 font-semibold text-stone-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-stone-100">
              <td className="px-2 py-1.5 font-medium">Platos</td>
              <td className="px-2 py-1.5">{adv.counts.products}</td>
              <td className="px-2 py-1.5">{preview.created}</td>
              <td className="px-2 py-1.5">{preview.updated}</td>
              <td className="px-2 py-1.5">—</td>
            </tr>
            {lines.map((l) => (
              <tr key={l.label} className="border-t border-stone-100">
                <td className="px-2 py-1.5 font-medium">{l.label}</td>
                <td className="px-2 py-1.5">{l.rows}</td>
                <td className="px-2 py-1.5">{l.c}</td>
                <td className="px-2 py-1.5">{l.u}</td>
                <td className={`px-2 py-1.5 ${typeof l.d === 'number' && l.d > 0 ? 'text-amber-700 font-semibold' : ''}`}>
                  {l.d}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {warningsBlock}
      <p className="text-xs text-stone-500">
        Lo desactivado no se borra (los pedidos históricos conservan su detalle). Si el resumen no es lo que
        esperabas, cierra sin importar.
      </p>
    </div>
  )
}

function pick(t: { created: number; updated: number; deactivated: number }) {
  return { c: t.created, u: t.updated, d: t.deactivated }
}

/** Resultado final de la importación avanzada de platos. */
export function AdvancedDone({ result }: { result: AdvancedTotals }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm">
      <p className="font-medium text-emerald-800">
        Importación finalizada: {result.created} plato(s) creado(s), {result.updated} actualizado(s)
        {result.failed.length > 0 && `, ${result.failed.length} con error`}.
      </p>
      <p className="text-xs text-emerald-800 mt-1">
        Presentaciones: {result.presentations.created} nuevas / {result.presentations.updated} modificadas /{' '}
        {result.presentations.deactivated} quitadas · Extras: {result.modOptions.created} opciones nuevas,{' '}
        {result.modLinks.created} vínculos nuevos, {result.modLinks.removed} quitados · Combos:{' '}
        {result.comboGroups.created} grupos nuevos, {result.comboGroups.updated} modificados,{' '}
        {result.comboGroups.deactivated} quitados
      </p>
      {result.failed.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-700 space-y-1">
          {result.failed.map((f, i) => (
            <li key={i}>
              Fila {f.row} ({f.name}): {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
