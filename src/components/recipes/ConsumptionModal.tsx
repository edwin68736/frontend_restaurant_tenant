import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SUPPLY_BTN_GHOST, SUPPLY_BTN_PRIMARY, SupplyModalShell } from '@/components/supplies/SupplyModalShell'
import { recipesService, type Checklist, type ConsumptionSettings, type StockPolicy } from '@/services/recipes.service'
import { unitLabel } from '@/utils/recipes'
import { apiError, formatQty } from '@/utils/supplies'

type Props = { branchId?: number; branchName: string; onClose: () => void }

function Section({ title, hint, items, tone = 'neutral' }: { title: string; hint: string; items: string[]; tone?: 'neutral' | 'warn' }) {
  const [open, setOpen] = useState(false)
  const alert = tone === 'warn' && items.length > 0
  return (
    <li className={clsx('rounded-xl border px-3 py-2', alert ? 'border-amber-200 bg-amber-50' : 'border-stone-200')}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        disabled={items.length === 0}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-stone-800">{title}</span>
          <span className="block text-[11px] text-stone-500">{hint}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-stone-700">
          {items.length}
          {items.length > 0 && <ChevronDown size={16} className={clsx('transition-transform', open && 'rotate-180')} aria-hidden />}
        </span>
      </button>
      {open && (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-stone-600">
          {items.map((name, i) => (
            <li key={`${name}-${i}`}>{name}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Encender o apagar el descuento de insumos al cobrar, con lo que conviene revisar antes. */
export function ConsumptionModal({ branchId, branchName, onClose }: Props) {
  const [settings, setSettings] = useState<ConsumptionSettings | null>(null)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [policy, setPolicy] = useState<StockPolicy>('allow')
  const [confirm, setConfirm] = useState<'on' | 'off' | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState('')

  const load = useCallback(() => {
    setFailed('')
    Promise.all([recipesService.consumption(), recipesService.checklist(branchId)])
      .then(([s, c]) => {
        setSettings(s)
        setPolicy(s.stock_policy)
        setChecklist(c)
      })
      .catch((e) => setFailed(apiError(e, 'No se pudo cargar la configuración del descuento')))
  }, [branchId])

  useEffect(load, [load])

  const save = async (consume: boolean, message: string) => {
    setSaving(true)
    try {
      const saved = await recipesService.saveConsumption({ consume, stock_policy: policy })
      setSettings(saved)
      setPolicy(saved.stock_policy)
      toast.success(message)
      setConfirm(null)
    } catch (e) {
      toast.error(apiError(e, 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  const on = !!settings?.consume
  const supply = (s: { name: string; stock: number; unit: string }) => `${s.name} (${formatQty(s.stock)} ${unitLabel(s.unit)})`

  return (
    <SupplyModalShell
      title="Descuento de insumos al cobrar"
      subtitle="Vale para toda la empresa"
      onClose={onClose}
      wide
      footer={
        settings && (
          <>
            <button type="button" className={SUPPLY_BTN_GHOST} onClick={onClose}>Cerrar</button>
            {on ? (
              <>
                <button type="button" className={SUPPLY_BTN_GHOST} disabled={saving} onClick={() => setConfirm('off')}>Apagar</button>
                {policy !== settings.stock_policy && (
                  <button type="button" className={SUPPLY_BTN_PRIMARY} disabled={saving} onClick={() => save(true, 'Cambios guardados')}>Guardar</button>
                )}
              </>
            ) : (
              <button
                type="button"
                className={SUPPLY_BTN_PRIMARY}
                disabled={saving || !checklist || checklist.dishes_with_recipe === 0}
                onClick={() => setConfirm('on')}
              >
                Encender descuento
              </button>
            )}
          </>
        )
      }
    >
      {failed ? (
        <div className="py-6 text-center text-sm text-stone-600">
          <p>{failed}</p>
          <button type="button" className={clsx(SUPPLY_BTN_GHOST, 'mt-3')} onClick={load}>Reintentar</button>
        </div>
      ) : !settings || !checklist ? (
        <p className="py-6 text-center text-sm text-stone-500">Cargando…</p>
      ) : (
        <div className="space-y-3">
          <p className={clsx('rounded-xl px-3 py-2 text-sm font-medium', on ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700')}>
            {on ? 'Encendido: al cobrar un plato con receta salen sus insumos.' : 'Apagado: las ventas no descuentan insumos.'}
          </p>

          <fieldset className="rounded-xl border border-stone-200 px-3 py-2">
            <legend className="px-1 text-xs font-medium text-stone-600">Si un insumo no alcanza</legend>
            <label className="flex items-start gap-2 py-1 text-sm text-stone-800">
              <input type="radio" name="stock-policy" className="mt-1" checked={policy === 'allow'} onChange={() => setPolicy('allow')} />
              <span>
                Vender igual y dejar el saldo en negativo
                <span className="block text-[11px] text-stone-500">Recomendado: la caja nunca se detiene; se avisa al pedir.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 py-1 text-sm text-stone-800">
              <input type="radio" name="stock-policy" className="mt-1" checked={policy === 'block'} onChange={() => setPolicy('block')} />
              <span>
                No dejar cobrar
                <span className="block text-[11px] text-stone-500">El cobro puede rechazarse con la comida ya servida.</span>
              </span>
            </label>
          </fieldset>

          <div>
            <p className="mb-1 text-xs font-medium text-stone-600">
              Revisión de {branchName || 'la sucursal activa'} · {checklist.dishes_with_recipe} platos o presentaciones con receta
            </p>
            <ul className="space-y-1.5">
              <Section
                tone="warn"
                title="Insumos sin stock"
                hint="Se venderán en negativo, o el cobro se rechazará si no se deja cobrar."
                items={checklist.supplies_without_stock.map(supply)}
              />
              <Section
                tone="warn"
                title="Insumos sin costo"
                hint="La venta quedará sin costo de receta."
                items={checklist.supplies_without_cost.map((s) => s.name)}
              />
              <Section
                tone="warn"
                title="Combos con componentes sin receta"
                hint="Descuentan lo que tiene receta; el combo queda sin costo."
                items={checklist.combos_incomplete.map((d) => d.name)}
              />
              <Section
                title="Platos que dejarán de descontar su propio stock"
                hint="Tienen control de stock y receta: pasan a descontar insumos."
                items={checklist.own_stock_replaced.map((d) => d.name)}
              />
              <Section
                title="Platos sin receta"
                hint="Siguen como hoy."
                items={checklist.dishes_without_recipe.map((d) => d.name)}
              />
            </ul>
            {checklist.dishes_with_recipe === 0 && (
              <p className="mt-2 text-xs text-red-600">Crea al menos una receta antes de encender el descuento.</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'on'}
        onClose={() => setConfirm(null)}
        onConfirm={() => save(true, 'Descuento encendido')}
        loading={saving}
        title="¿Encender el descuento?"
        confirmLabel="Encender"
        message="Desde el próximo cobro saldrán los insumos de cada plato con receta. Las ventas ya hechas no se descuentan. Se puede apagar en cualquier momento."
      />
      <ConfirmDialog
        open={confirm === 'off'}
        onClose={() => setConfirm(null)}
        onConfirm={() => save(false, 'Descuento apagado')}
        loading={saving}
        title="¿Apagar el descuento?"
        confirmLabel="Apagar"
        message="Las siguientes ventas no descontarán insumos y no se podrán descontar después. Anular una venta anterior sigue reponiendo lo que salió."
      />
    </SupplyModalShell>
  )
}
