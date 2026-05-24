import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, RefreshCw, SlidersHorizontal, FileSpreadsheet } from 'lucide-react'
import { SearchInput } from '@/components/SearchInput'
import { useDebouncedApiSearch } from '@/hooks/useDebouncedApiSearch'
import { ProductImportModal } from '@/components/products/ProductImportModal'
import {
  productsService,
  getProductImageUrl,
  type Product,
  type ModifierGroup,
  type Category,
  type CreateProductInput,
} from '@/services/products.service'
import { SearchableSelect } from '@/components/SearchableSelect'
import { PageShell } from '@/components/layout/PageShell'
import { PortalModal } from '@/components/ui/PortalModal'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

const PREPARATION_AREAS = [
  { value: '', label: 'Sin área' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'bar', label: 'Bar' },
  { value: 'barra', label: 'Barra' },
  { value: 'postres', label: 'Postres' },
  { value: 'otro', label: 'Otro' },
]

const IGV_AFFECTATION_OPTIONS = [
  { code: '10', label: '10 - Gravado IGV' },
  { code: '20', label: '20 - Exonerado' },
  { code: '30', label: '30 - Inafecto' },
  { code: '40', label: '40 - Exportación' },
]

function isGravadoIgv(code: string): boolean {
  const c = String(code || '').trim()
  return !['20', '21', '30', '31', '32', '33', '34', '35', '36', '40'].includes(c)
}

function generateEan13(): string {
  const raw = `${Date.now()}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
  const base12 = raw.slice(-12).replace(/\D/g, '').padStart(12, '0').slice(0, 12)
  let sum = 0
  for (let i = 0; i < base12.length; i++) {
    const digit = Number(base12[i])
    sum += (i % 2 === 0 ? 1 : 3) * digit
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return `${base12}${checkDigit}`
}

const emptyForm = (): CreateProductInput => ({
  name: '',
  code: '',
  description: '',
  sale_price: 0,
  unit: 'NIU',
  has_modifiers: false,
  modifier_group_ids: [],
  category_id: null,
  preparation_area: '',
  manage_stock: false,
  igv_affectation_type: '10',
  price_includes_igv: true,
})

export default function ProductosPage() {
  const navigate = useNavigate()
  const { canAccess } = useAuth()
  const { activeBranchId } = useBranch()
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  const [areaFilter, setAreaFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<CreateProductInput>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({})
  const [imageBustByProductId, setImageBustByProductId] = useState<Record<number, number>>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const categoryModalInputRef = useRef<HTMLInputElement>(null)

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const closeProductModal = () => {
    setModal(null)
    setEditing(null)
    setCategoryModalOpen(false)
    setNewCategoryName('')
    setAddingCategory(false)
  }

  const catId = categoryFilter === '' ? undefined : categoryFilter
  const area = areaFilter === '' ? undefined : areaFilter

  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    loading,
    isSearching,
    refresh,
  } = useDebouncedApiSearch<{ data: Product[]; total: number }>({
    cacheScope: 'restaurant-productos',
    deps: [page, perPage, categoryFilter, areaFilter, activeBranchId],
    fetcher: (query, signal) =>
      productsService.list(query, true, page, perPage, catId, area, activeBranchId ?? undefined, { signal }),
    onSuccess: ({ data, total: t }) => {
      setProducts(data)
      setTotal(t)
      const withStock = data.filter((p) => p.manage_stock)
      if (withStock.length > 0) {
        productsService
          .getStockSummary(withStock.map((p) => p.id))
          .then(setStockByProductId)
          .catch(() => setStockByProductId({}))
      } else {
        setStockByProductId({})
      }
    },
    onError: () => {
      setProducts([])
      setTotal(0)
      setStockByProductId({})
    },
  })

  const getProductImageSrc = (p: Product): string => {
    const base = getProductImageUrl(p.image_url)
    if (!base) return ''
    const bust = imageBustByProductId[p.id]
    if (!bust) return base
    return `${base}${base.includes('?') ? '&' : '?'}v=${bust}`
  }

  const loadCategories = () => {
    productsService.listCategories().then(setCategories).catch(() => [])
  }

  useEffect(() => { loadCategories() }, [])

  const loadModifierGroups = () => {
    productsService.listModifierGroups().then(setModifierGroups).catch(() => [])
  }

  const openCreate = () => {
    setForm({ ...emptyForm(), code: generateEan13() })
    setEditing(null)
    setNewCategoryName('')
    setModal('create')
    loadModifierGroups()
    loadCategories()
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    productsService.get(p.id).then(({ data, modifier_group_ids }) => {
      setForm({
        name: data.name,
        code: data.code ?? '',
        description: (data as Product & { description?: string }).description ?? '',
        image_url: data.image_url ?? '',
        sale_price: data.sale_price,
        unit: 'NIU',
        has_modifiers: data.has_modifiers ?? false,
        modifier_group_ids: modifier_group_ids ?? [],
        category_id: data.category_id ?? null,
        preparation_area: (data as Product & { preparation_area?: string }).preparation_area ?? '',
        manage_stock: data.manage_stock ?? false,
        igv_affectation_type: data.igv_affectation_type ?? '10',
        price_includes_igv: data.price_includes_igv ?? true,
      })
      setNewCategoryName('')
      setModal('edit')
      loadModifierGroups()
    }).catch(() => toast.error('Error al cargar el producto'))
  }

  useEffect(() => {
    if (modal && categoryModalOpen) {
      setTimeout(() => categoryModalInputRef.current?.focus(), 0)
    }
  }, [modal, categoryModalOpen])

  const createCategory = async () => {
    if (!newCategoryName.trim()) return
    setAddingCategory(true)
    try {
      const cat = await productsService.createCategory(newCategoryName.trim())
      setCategories((c) => [...c, cat])
      setForm((f) => ({ ...f, category_id: cat.id }))
      setNewCategoryName('')
      setCategoryModalOpen(false)
      toast.success('Categoría creada')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setAddingCategory(false)
    }
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    const selectedFile = fileInputRef.current?.files?.[0] ?? null
    setSaving(true)
    try {
      if (modal === 'create') {
        const codeToSend = (form.code?.trim() ? form.code.trim() : generateEan13())
        const created = await productsService.create({
          ...form,
          name: form.name.trim(),
          code: codeToSend,
          description: form.description?.trim() ?? '',
          sale_price: Number(form.sale_price) || 0,
          category_id: form.category_id ?? null,
          preparation_area: form.preparation_area ?? '',
          manage_stock: form.manage_stock ?? false,
          igv_affectation_type: form.igv_affectation_type ?? '10',
          price_includes_igv: isGravadoIgv(form.igv_affectation_type ?? '10') ? form.price_includes_igv : false,
        })
        toast.success('Producto creado')
        closeProductModal()
        refresh()
        if (selectedFile && created?.id) {
          setUploadingImage(true)
          try {
            const image_url = await productsService.uploadImage(created.id, selectedFile)
            setProducts((prev) => prev.map((p) => (p.id === created.id ? { ...p, image_url } : p)))
            setImageBustByProductId((m) => ({ ...m, [created.id]: Date.now() }))
            toast.success('Imagen subida')
            refresh()
          } catch (e: unknown) {
            toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo subir la imagen')
          } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }
        }
      } else if (editing) {
        await productsService.update(editing.id, {
          ...form,
          name: form.name.trim(),
          code: form.code?.trim() ?? '',
          description: form.description?.trim() ?? '',
          sale_price: Number(form.sale_price) || 0,
          has_modifiers: form.has_modifiers,
          modifier_group_ids: form.modifier_group_ids,
          image_url: form.image_url ?? '',
          category_id: form.category_id ?? null,
          preparation_area: form.preparation_area ?? '',
          manage_stock: form.manage_stock ?? false,
          is_restaurant: true,
          igv_affectation_type: form.igv_affectation_type ?? '10',
          price_includes_igv: isGravadoIgv(form.igv_affectation_type ?? '10') ? form.price_includes_igv : false,
        })
        toast.success('Producto actualizado')
        closeProductModal()
        refresh()
        if (selectedFile) {
          setUploadingImage(true)
          try {
            const image_url = await productsService.uploadImage(editing.id, selectedFile)
            setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, image_url } : p)))
            setImageBustByProductId((m) => ({ ...m, [editing.id]: Date.now() }))
            toast.success('Imagen actualizada')
            refresh()
          } catch (e: unknown) {
            toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo subir la imagen')
          } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }
        }
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return
    try {
      await productsService.delete(p.id)
      toast.success('Producto eliminado')
            refresh()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <PageShell
      className="flex-1 min-h-0"
      title="Productos"
      actions={
        <>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          >
            <FileSpreadsheet size={16} /> Importar Excel
          </button>
          {canAccess('modificadores') && (
            <button
              type="button"
              onClick={() => navigate('/modificadores')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            >
              <SlidersHorizontal size={16} /> Modificadores
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rest-600 text-white rounded-xl text-sm font-medium hover:bg-rest-700 shadow-sm"
          >
            <Plus size={16} /> Agregar producto
          </button>
        </>
      }
    >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 mb-4 sm:mb-5">
          <SearchInput
            value={searchInput}
            onChange={(v) => {
              setSearchInput(v)
              setPage(1)
            }}
            isSearching={isSearching}
            placeholder="Buscar por nombre o código..."
            className="w-full sm:flex-1 sm:min-w-[260px] order-first"
            inputClassName="bg-white"
          />
          <div className="w-full sm:max-w-xs">
            <SearchableSelect
              value={categoryFilter === '' ? '' : categoryFilter}
              onChange={(v) => {
                setCategoryFilter(v == null || String(v) === '' ? '' : Number(v))
                setPage(1)
              }}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="Todas las categorías"
              searchable={categories.length > 8}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
            />
          </div>
          <div className="w-full sm:max-w-xs">
            <SearchableSelect
              value={areaFilter}
              onChange={(v) => {
                setAreaFilter(String(v ?? ''))
                setPage(1)
              }}
              options={[
                { value: '', label: 'Todas las áreas' },
                ...PREPARATION_AREAS.filter((a) => a.value).map((a) => ({ value: a.value, label: a.label })),
              ]}
              placeholder="Todas las áreas"
              searchable={PREPARATION_AREAS.length > 8}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
            />
          </div>
        </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-rest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700 w-14">Imagen</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700">Código</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700">Nombre</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700">Categoría</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700">Área</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-stone-700">Precio</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-stone-700">Stock</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700">Modificadores</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-stone-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-3 py-2">
                      <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0">
                        {p.image_url ? (
                          <img
                            src={getProductImageSrc(p)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400 text-lg font-bold">
                            {p.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-stone-600">{p.code || '—'}</td>
                    <td className="px-3 py-2 font-medium text-stone-800">{p.name}</td>
                    <td className="px-3 py-2 text-stone-600">{p.category_id ? (categoryMap[p.category_id] ?? '—') : '—'}</td>
                    <td className="px-3 py-2 text-stone-600">
                      {p.preparation_area
                        ? PREPARATION_AREAS.find((a) => a.value === p.preparation_area)?.label ?? p.preparation_area
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-rest-700">S/ {Number(p.sale_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      {p.manage_stock ? (
                        <span className="font-mono text-sm text-stone-800">
                          {typeof stockByProductId[p.id] === 'number' ? stockByProductId[p.id] : '—'}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.has_modifiers ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-rest-100 text-rest-800">Sí</span>
                      ) : (
                        <span className="text-stone-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-rest-600 hover:bg-rest-50"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
              {products.length === 0 && (
                <div className="text-center py-10 text-stone-400 text-sm">
                  No hay productos de restaurante. Agrega uno con el botón anterior.
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-stone-200 bg-stone-50/90 px-3 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-stone-600">
                  <label className="flex items-center gap-1.5">
                    <span className="text-stone-500">Mostrar</span>
                    <div className="w-[4.5rem]">
                      <SearchableSelect
                        value={perPage}
                        onChange={(v) => {
                          setPerPage(Number(v))
                          setPage(1)
                        }}
                        options={PER_PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
                        searchable={false}
                        className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white text-left flex items-center justify-between gap-1 min-h-0"
                      />
                    </div>
                    <span className="text-stone-500">por página</span>
                  </label>
                  {total > 0 ? (
                    <span className="text-stone-500">
                      Mostrando <span className="font-medium text-stone-700">{from}-{to}</span> de{' '}
                      <span className="font-medium text-stone-700">{total}</span> registros
                    </span>
                  ) : (
                    <span className="text-stone-400">Sin registros</span>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                      title="Anterior"
                    >
                      <ChevronLeft size={15} />
                      <span className="hidden sm:inline">Ant.</span>
                    </button>
                    <span className="text-xs text-stone-600 tabular-nums px-1 min-w-[4.5rem] text-center">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                      title="Siguiente"
                    >
                      <span className="hidden sm:inline">Sig.</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      <PortalModal open={!!modal} onClose={closeProductModal} className="max-w-3xl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <h3 className="font-bold text-stone-800">{modal === 'create' ? 'Agregar producto' : 'Editar producto'}</h3>
              <button onClick={closeProductModal} className="p-2 rounded-lg hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto min-h-0">
              {/* Imagen */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Imagen</label>
                {form.image_url && (
                  <div className="mb-2">
                    <img
                      src={getProductImageUrl(form.image_url)}
                      alt="Vista previa"
                      className="w-24 h-24 rounded-xl object-cover border border-stone-200"
                    />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full text-sm text-stone-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border file:border-stone-200 file:text-sm"
                />
                <p className="text-xs text-stone-400 mt-1">JPG, PNG o WebP. Máx. 5 MB. {modal === 'create' ? 'Se sube al guardar.' : 'Opcional para cambiar.'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="Ej. Lomo saltado"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Código (barras)</label>
                  <div className="flex w-full">
                    <input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      className="w-full border border-stone-200 rounded-l-xl rounded-r-none border-r-0 px-3 py-2 text-sm"
                      placeholder="Autogenerado"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, code: generateEan13() }))}
                      className="px-3 py-2 border border-stone-200 bg-stone-100 text-stone-700 rounded-r-xl rounded-l-none text-sm font-medium hover:bg-stone-200 shrink-0 inline-flex items-center gap-2"
                      title="Generar otro código"
                    >
                      <RefreshCw size={16} />
                      Generar
                    </button>
                  </div>
                </div>
              </div>

              {/* Categoría del producto (ej. Caldos, Bebidas) */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Categoría del producto</label>
                <div className="flex w-full">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      value={form.category_id == null ? '' : form.category_id}
                      onChange={(v) => {
                        const vv = v == null || String(v) === '' ? null : Number(v)
                        setForm((f) => ({ ...f, category_id: vv }))
                      }}
                      options={[
                        { value: '', label: 'Sin categoría' },
                        ...categories.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                      placeholder="Sin categoría"
                      searchable
                      className="w-full border border-stone-200 rounded-l-xl rounded-r-none border-r-0 px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                      menuClassName="rounded-xl"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategoryModalOpen(true)}
                    className="px-3 py-2 border border-stone-200 bg-stone-100 text-stone-700 rounded-r-xl rounded-l-none text-sm font-medium hover:bg-stone-200 shrink-0"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {/* Área de preparación (Cocina, Bar, Barra) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Área de preparación</label>
                  <SearchableSelect
                    value={form.preparation_area ?? ''}
                    onChange={(v) => setForm((f) => ({ ...f, preparation_area: String(v ?? '') || null }))}
                    options={PREPARATION_AREAS.map((a) => ({ value: a.value, label: a.label }))}
                    searchable={PREPARATION_AREAS.length > 8}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Precio venta (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.sale_price || ''}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: Number(e.target.value) || 0 }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Tipo de afectación IGV (SUNAT Cat. N°07) */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de afectación IGV</label>
                <SearchableSelect
                  value={form.igv_affectation_type ?? '10'}
                  onChange={(v) => {
                    const vv = String(v ?? '10')
                    setForm((f) => ({
                      ...f,
                      igv_affectation_type: vv,
                      price_includes_igv: isGravadoIgv(vv) ? (f.price_includes_igv ?? true) : false,
                    }))
                  }}
                  options={IGV_AFFECTATION_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
                  searchable={false}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-left flex items-center justify-between gap-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.manage_stock ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, manage_stock: e.target.checked }))}
                    className="rounded border-stone-300"
                  />
                  Controlar stock
                </label>
                {isGravadoIgv(form.igv_affectation_type ?? '10') ? (
                  <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={form.price_includes_igv ?? true}
                      onChange={(e) => setForm((f) => ({ ...f, price_includes_igv: e.target.checked }))}
                      className="rounded border-stone-300"
                    />
                    Precio incluye IGV
                  </label>
                ) : (
                  <div />
                )}
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.has_modifiers ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, has_modifiers: e.target.checked }))}
                    className="rounded border-stone-300"
                  />
                  Usar modificadores
                </label>
              </div>

              {form.has_modifiers && modifierGroups.length > 0 && (
                <div className="space-y-2 pl-1">
                  {modifierGroups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(form.modifier_group_ids ?? []).includes(g.id)}
                        onChange={(e) => {
                          const ids = form.modifier_group_ids ?? []
                          if (e.target.checked) setForm((f) => ({ ...f, modifier_group_ids: [...ids, g.id] }))
                          else setForm((f) => ({ ...f, modifier_group_ids: ids.filter((id) => id !== g.id) }))
                        }}
                        className="rounded border-stone-300"
                      />
                      <span className="text-sm">{g.name}</span>
                      {g.required && <span className="text-xs text-rest-600">(obligatorio)</span>}
                    </label>
                  ))}
                </div>
              )}
              {form.has_modifiers && modifierGroups.length === 0 && (
                <p className="text-xs text-stone-500">Crea grupos de modificadores desde el panel tenant (Productos).</p>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-stone-200">
              <button
                onClick={closeProductModal}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : uploadingImage ? 'Subiendo imagen...' : 'Guardar'}
              </button>
            </div>

          </div>
      </PortalModal>

      <PortalModal
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false)
          setNewCategoryName('')
        }}
        className="max-w-sm"
      >
        <div className="bg-white rounded-2xl shadow-xl w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-stone-200">
            <h4 className="font-bold text-stone-800">Agregar categoría</h4>
            <button
              type="button"
              onClick={() => { setCategoryModalOpen(false); setNewCategoryName('') }}
              className="p-2 rounded-lg hover:bg-stone-100"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
              <input
                ref={categoryModalInputRef}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej. Caldos"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCategoryModalOpen(false); setNewCategoryName('') }}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={createCategory}
                disabled={addingCategory || !newCategoryName.trim()}
                className="flex-1 py-2.5 bg-rest-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {addingCategory ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      </PortalModal>

      <ProductImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        categories={categories}
        onImported={() => {
          refresh()
          loadCategories()
        }}
      />
    </PageShell>
  )
}
