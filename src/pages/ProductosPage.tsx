import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  RefreshCw,
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  ImagePlus,
  ScanBarcode,
} from 'lucide-react'
import { clsx } from 'clsx'
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
import { ProductPresentationsModal } from '@/components/products/ProductPresentationsModal'
import { PortalModal } from '@/components/ui/PortalModal'
import { PosBarcodeScannerModal } from '@/components/pos/PosBarcodeScannerModal'
import { isCapacitorNative } from '@/lib/app'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch, useOnBranchChange } from '@/contexts/BranchContext'

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

/** 2 columnas desde sm (tablets / celular grande); 1 columna solo en pantallas muy estrechas. */
const PRODUCT_FORM_GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-4'

const BTN_ACTION_EDIT =
  'inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0'
const BTN_ACTION_DELETE =
  'inline-flex items-center justify-center p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 shrink-0'

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
  has_variants: false,
  modifier_group_ids: [],
  presentations: [],
  category_id: null,
  preparation_area: '',
  manage_stock: false,
  igv_affectation_type: '10',
  price_includes_igv: true,
})

export default function ProductosPage() {
  const navigate = useNavigate()
  const { canAccess } = useAuth()
  const { activeBranchId, activeBranch } = useBranch()
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
  const [presentationsModalOpen, setPresentationsModalOpen] = useState(false)
  const [showInactiveOnly, setShowInactiveOnly] = useState(false)
  const [togglingActiveId, setTogglingActiveId] = useState<number | null>(null)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const categoryModalInputRef = useRef<HTMLInputElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [productBarcodeScannerOpen, setProductBarcodeScannerOpen] = useState(false)
  const useCameraBarcodeScanner = isCapacitorNative()

  const revokeImagePreview = useCallback(() => {
    setImagePreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const handleImageFileChange = () => {
    const file = fileInputRef.current?.files?.[0]
    revokeImagePreview()
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Seleccione una imagen JPG, PNG o WebP')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const closeProductModal = () => {
    setModal(null)
    setProductBarcodeScannerOpen(false)
    setEditing(null)
    setCategoryModalOpen(false)
    setNewCategoryName('')
    setAddingCategory(false)
    setShowMoreOptions(false)
    revokeImagePreview()
    if (fileInputRef.current) fileInputRef.current.value = ''
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
    deps: [page, perPage, categoryFilter, areaFilter, activeBranchId, showInactiveOnly],
    enabled: activeBranchId > 0,
    fetcher: (query, signal) =>
      productsService.list(
        query,
        true,
        page,
        perPage,
        catId,
        area,
        activeBranchId,
        !showInactiveOnly,
        showInactiveOnly,
        { signal },
      ),
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

  useEffect(() => () => revokeImagePreview(), [revokeImagePreview])

  useEffect(() => { loadCategories() }, [])

  useOnBranchChange(() => {
    setPage(1)
    setCategoryFilter('')
    setAreaFilter('')
    setShowInactiveOnly(false)
    refresh()
  })

  const loadModifierGroups = () => {
    productsService.listModifierGroups().then(setModifierGroups).catch(() => [])
  }

  const openCreate = () => {
    if (!activeBranchId) {
      toast.error('Seleccione una sucursal activa para crear productos')
      return
    }
    setForm({ ...emptyForm(), code: '' })
    setEditing(null)
    setNewCategoryName('')
    setShowMoreOptions(false)
    setProductBarcodeScannerOpen(false)
    setModal('create')
    loadModifierGroups()
    loadCategories()
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    Promise.all([productsService.get(p.id), productsService.listModifierGroups()])
      .then(([{ data, modifier_group_ids, presentations }, groups]) => {
        setModifierGroups(groups)
        let ids = modifier_group_ids ?? []
        if (data.has_modifiers && ids.length === 0 && groups.length > 0) {
          ids = groups.map((g) => g.id)
          toast.info(
            'Este producto no tenía grupos de extras vinculados. Se marcaron todos; revisa y pulsa Guardar.',
            { duration: 8000 },
          )
        }
        const desc = data.description?.trim() ?? ''
        const purchasePrice = data.purchase_price ?? 0
        setShowMoreOptions(!!desc || purchasePrice > 0)
        setForm({
          name: data.name,
          code: data.code ?? '',
          description: desc,
          purchase_price: purchasePrice > 0 ? purchasePrice : undefined,
          image_url: data.image_url ?? '',
          sale_price: data.sale_price,
          unit: 'NIU',
          has_modifiers: data.has_modifiers ?? false,
          has_variants: data.has_variants ?? false,
          presentations: (presentations ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            sale_price: Number(p.sale_price) || 0,
          })),
          modifier_group_ids: ids,
          category_id: data.category_id ?? null,
          preparation_area: (data as Product & { preparation_area?: string }).preparation_area ?? '',
          manage_stock: data.manage_stock ?? false,
          igv_affectation_type: data.igv_affectation_type ?? '10',
          price_includes_igv: data.price_includes_igv ?? true,
        })
        setNewCategoryName('')
        setModal('edit')
      })
      .catch(() => toast.error('Error al cargar el producto'))
  }

  useEffect(() => {
    if (modal && categoryModalOpen) {
      setTimeout(() => categoryModalInputRef.current?.focus(), 0)
    }
  }, [modal, categoryModalOpen])

  useEffect(() => {
    if (modal === 'create' && !categoryModalOpen) {
      const t = window.setTimeout(() => codeInputRef.current?.focus(), 80)
      return () => window.clearTimeout(t)
    }
  }, [modal, categoryModalOpen])

  const handleProductBarcodeScan = useCallback((raw: string) => {
    const code = String(raw ?? '').trim()
    if (!code) return
    setForm((f) => ({ ...f, code }))
    setProductBarcodeScannerOpen(false)
    toast.success('Código de barras capturado')
    window.setTimeout(() => codeInputRef.current?.focus(), 50)
  }, [])

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
    const presentationRows = (form.presentations ?? []).filter((p) => p.name.trim())
    if (form.has_variants && presentationRows.length === 0) {
      toast.error('Agrega al menos una presentación o desactiva «Presentaciones»')
      return
    }
    if (form.has_modifiers && (form.modifier_group_ids ?? []).length === 0) {
      toast.error('Selecciona al menos un grupo de extras o desactiva «Extras»')
      return
    }
    const presentationsPayload = form.has_variants
      ? presentationRows.map((p) => ({
          name: p.name.trim(),
          sale_price: Math.round((Number(p.sale_price) || 0) * 100) / 100,
        }))
      : []
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
          purchase_price:
            form.purchase_price != null && form.purchase_price > 0 ? form.purchase_price : undefined,
          sale_price: Number(form.sale_price) || 0,
          has_variants: form.has_variants && presentationsPayload.length > 0,
          presentations: presentationsPayload,
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
          purchase_price:
            form.purchase_price != null && form.purchase_price > 0 ? form.purchase_price : 0,
          sale_price: Number(form.sale_price) || 0,
          has_modifiers: form.has_modifiers,
          has_variants: form.has_variants && presentationsPayload.length > 0,
          presentations: presentationsPayload,
          modifier_group_ids: form.modifier_group_ids,
          image_url: form.image_url ?? '',
          category_id: form.category_id ?? null,
          preparation_area: form.preparation_area ?? '',
          manage_stock: form.manage_stock ?? false,
          is_restaurant: true,
          igv_affectation_type: form.igv_affectation_type ?? '10',
          price_includes_igv: isGravadoIgv(form.igv_affectation_type ?? '10') ? form.price_includes_igv : false,
        })
        const n = (form.modifier_group_ids ?? []).length
        toast.success(
          form.has_modifiers && n > 0
            ? `Producto actualizado (${n} grupo${n === 1 ? '' : 's'} vinculado${n === 1 ? '' : 's'})`
            : 'Producto actualizado',
        )
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

  const toggleActive = async (p: Product) => {
    setTogglingActiveId(p.id)
    try {
      const nextActive = await productsService.toggleActive(p.id)
      toast.success(nextActive ? 'Producto activado' : 'Producto desactivado')
      refresh()
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error')
    } finally {
      setTogglingActiveId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <PageShell
      className="flex-1 min-h-0"
      title="Productos"
      subtitle={
        activeBranch
          ? `Catálogo de la sucursal ${activeBranch.name}. Las categorías son compartidas en todas las sucursales.`
          : 'Seleccione una sucursal activa para administrar el catálogo.'
      }
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
          <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none rounded-xl border border-stone-200 bg-white px-3 py-2">
            <span className="text-xs font-medium text-stone-700 whitespace-nowrap">Solo inactivos</span>
            <button
              type="button"
              role="switch"
              aria-checked={showInactiveOnly}
              aria-label="Mostrar solo productos inactivos"
              onClick={() => {
                setShowInactiveOnly((v) => !v)
                setPage(1)
              }}
              className={clsx(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
                showInactiveOnly ? 'bg-amber-500' : 'bg-stone-300',
              )}
            >
              <span
                className={clsx(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  showInactiveOnly ? 'translate-x-5' : 'translate-x-1',
                )}
              />
            </button>
          </label>
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
                  <th className="text-left px-3 py-2 text-xs font-semibold text-stone-700 min-w-[8rem]">Descripción</th>
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
                  <tr
                    key={p.id}
                    className={clsx(
                      'border-b border-stone-100 hover:bg-stone-50/50',
                      !p.active && 'bg-stone-50/80 opacity-75',
                    )}
                  >
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
                    <td className="px-3 py-2 font-medium text-stone-800">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        {p.name}
                        {!p.active && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            Inactivo
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-stone-600 max-w-[14rem]">
                      {p.description?.trim() ? (
                        <span
                          className="text-xs line-clamp-2 leading-snug"
                          title={p.description.trim()}
                        >
                          {p.description.trim()}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">—</span>
                      )}
                    </td>
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
                      <div className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void toggleActive(p)}
                          disabled={togglingActiveId === p.id}
                          title={p.active ? 'Desactivar producto' : 'Activar producto'}
                          className={clsx(
                            'inline-flex items-center justify-center p-1.5 rounded-lg disabled:opacity-50 shrink-0',
                            p.active
                              ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200',
                          )}
                        >
                          {togglingActiveId === p.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : p.active ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className={BTN_ACTION_EDIT}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(p)}
                          className={BTN_ACTION_DELETE}
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
                  {!activeBranchId
                    ? 'Seleccione una sucursal activa en el encabezado para ver y administrar productos.'
                    : showInactiveOnly
                      ? 'No hay productos inactivos en esta sucursal.'
                      : 'No hay productos en esta sucursal. Agrega uno con el botón anterior.'}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-stone-200 bg-stone-50/90 px-3 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-stone-600">
                  <label className="flex items-center gap-1.5">
                    <span className="text-stone-500">Mostrar</span>
                    <select
                      value={perPage}
                      onChange={(e) => {
                        setPerPage(Number(e.target.value))
                        setPage(1)
                      }}
                      aria-label="Registros por página"
                      className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white text-stone-800 min-w-[4.5rem] cursor-pointer focus:outline-none focus:ring-2 focus:ring-rest-500/40"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
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
                <label className="block text-sm font-medium text-stone-700 mb-2">Imagen del producto</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="shrink-0">
                    <div
                      className={clsx(
                        'relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden',
                        imagePreviewUrl || form.image_url
                          ? 'border border-stone-200 bg-white shadow-sm ring-1 ring-stone-100'
                          : 'border-2 border-dashed border-stone-200 bg-stone-50/80',
                      )}
                    >
                      {imagePreviewUrl || form.image_url ? (
                        <img
                          src={imagePreviewUrl ?? getProductImageUrl(form.image_url)}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-stone-400">
                          <ImagePlus size={28} strokeWidth={1.5} className="opacity-60" />
                          <span className="text-[10px] leading-tight">Sin imagen</span>
                        </div>
                      )}
                      {imagePreviewUrl && (
                        <span className="absolute bottom-0 inset-x-0 bg-rest-600/90 text-white text-[10px] font-medium text-center py-0.5">
                          Nueva
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 w-full space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageFileChange}
                      className="block w-full text-sm text-stone-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border file:border-stone-200 file:bg-white file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-50"
                    />
                    <p className="text-xs text-stone-500 leading-relaxed">
                      JPG, PNG o WebP · máx. 5 MB.
                      {modal === 'create' ? ' Se sube al guardar el producto.' : ' Opcional para reemplazar la imagen actual.'}
                    </p>
                    {imagePreviewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          revokeImagePreview()
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-xs font-medium text-stone-500 hover:text-red-600"
                      >
                        Cancelar archivo seleccionado
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className={PRODUCT_FORM_GRID}>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Código (barras)</label>
                  <div className="flex w-full min-w-0">
                    <input
                      ref={codeInputRef}
                      value={form.code ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      className="min-w-0 flex-1 border border-stone-200 rounded-l-xl border-r-0 px-3 py-2 text-sm font-mono"
                      placeholder="Código de barras"
                      autoComplete="off"
                    />
                    {useCameraBarcodeScanner ? (
                      <button
                        type="button"
                        onClick={() => setProductBarcodeScannerOpen(true)}
                        className="px-2 py-2 border border-stone-200 border-l-0 bg-rest-50 text-rest-700 hover:bg-rest-100 shrink-0 inline-flex items-center justify-center"
                        title="Escanear con cámara"
                        aria-label="Escanear"
                      >
                        <ScanBarcode size={16} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, code: generateEan13() }))}
                      className="px-2.5 py-2 border border-stone-200 border-l-0 bg-stone-100 text-stone-700 rounded-r-xl text-xs font-medium hover:bg-stone-200 shrink-0 inline-flex items-center gap-1"
                      title="Generar código EAN-13"
                    >
                      <RefreshCw size={15} />
                      Generar
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="Ej. Lomo saltado"
                  />
                </div>
              </div>

              <div className={PRODUCT_FORM_GRID}>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Categoría del producto</label>
                  <div className="flex w-full min-w-0">
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
              </div>

              <div className={PRODUCT_FORM_GRID}>
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
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreOptions((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50"
                >
                  <span className="font-medium">Más opciones</span>
                  {showMoreOptions ? (
                    <ChevronDown size={16} className="text-stone-500 shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-stone-500 shrink-0" />
                  )}
                </button>
                {showMoreOptions && (
                  <div className="px-3 pb-3 pt-0 border-t border-stone-100">
                    <div className={PRODUCT_FORM_GRID}>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                          Descripción <span className="font-normal text-stone-400">(opcional)</span>
                        </label>
                        <textarea
                          value={form.description ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          placeholder="Ej. Plato típico con arroz y ensalada"
                          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">
                          Precio de compra (S/) <span className="font-normal text-stone-400">(opcional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={
                            form.purchase_price != null && form.purchase_price > 0
                              ? form.purchase_price
                              : ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value
                            setForm((f) => ({
                              ...f,
                              purchase_price: raw === '' ? undefined : Math.max(0, Number(raw) || 0),
                            }))
                          }}
                          placeholder="0.00"
                          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.has_variants ?? false}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        has_variants: e.target.checked,
                        presentations: e.target.checked ? f.presentations : [],
                      }))
                    }
                    className="rounded border-stone-300"
                  />
                  Presentaciones propias (tamaños / envases) en mesa/POS
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.has_modifiers ?? false}
                    onChange={(e) => {
                      const on = e.target.checked
                      setForm((f) => ({
                        ...f,
                        has_modifiers: on,
                        modifier_group_ids: on
                          ? modifierGroups.length > 0
                            ? modifierGroups.map((g) => g.id)
                            : (f.modifier_group_ids ?? [])
                          : [],
                      }))
                    }}
                    className="rounded border-stone-300"
                  />
                  Extras globales (grupos reutilizables) en mesa/POS
                </label>
              </div>

              {form.has_variants && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sky-900">Presentaciones</p>
                    <p className="text-xs text-sky-800/90 mt-0.5">
                      {(form.presentations ?? []).filter((p) => p.name.trim()).length > 0
                        ? `${(form.presentations ?? []).filter((p) => p.name.trim()).length} configurada(s): ${(form.presentations ?? [])
                            .filter((p) => p.name.trim())
                            .map((p) => p.name)
                            .join(', ')}`
                        : 'Sin presentaciones. Configúralas antes de guardar.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPresentationsModalOpen(true)}
                    className="shrink-0 min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700"
                  >
                    Gestionar presentaciones
                  </button>
                </div>
              )}

              {form.has_modifiers && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Vincula grupos de extras creados en{' '}
                    <button
                      type="button"
                      onClick={() => {
                        closeProductModal()
                        navigate('/modificadores')
                      }}
                      className="text-rest-700 font-semibold underline"
                    >
                      Modificadores
                    </button>
                    . Se suman al precio del producto o presentación.
                  </p>
                  {modifierGroups.length > 0 ? (
                    <div className="space-y-2">
                      {modifierGroups.map((g) => (
                        <label
                          key={g.id}
                          className="flex items-start gap-2 p-2 rounded-lg bg-white border border-amber-100"
                        >
                          <input
                            type="checkbox"
                            checked={(form.modifier_group_ids ?? []).includes(g.id)}
                            onChange={(e) => {
                              const ids = form.modifier_group_ids ?? []
                              if (e.target.checked)
                                setForm((f) => ({ ...f, modifier_group_ids: [...ids, g.id] }))
                              else
                                setForm((f) => ({
                                  ...f,
                                  modifier_group_ids: ids.filter((id) => id !== g.id),
                                }))
                            }}
                            className="rounded border-stone-300 mt-0.5"
                          />
                          <span className="text-sm">
                            <span className="font-medium text-stone-800">{g.name}</span>
                            <span className="block text-xs text-stone-500 mt-0.5">
                              Suma al precio{g.multi_select ? ' · varios' : ''}
                              {g.required ? ' · obligatorio' : ''}
                              {g.options?.length
                                ? ` · ${g.options.map((o) => o.name).join(', ')}`
                                : ' · sin opciones'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        closeProductModal()
                        navigate('/modificadores')
                      }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-rest-700 hover:text-rest-800"
                    >
                      <Layers size={16} />
                      Crear grupos de extras
                    </button>
                  )}
                  {form.has_modifiers && (form.modifier_group_ids ?? []).length === 0 && modifierGroups.length > 0 && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                      Marca al menos un grupo de extras.
                    </p>
                  )}
                </div>
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

      <ProductPresentationsModal
        open={presentationsModalOpen}
        productName={form.name.trim() || undefined}
        presentations={form.presentations ?? []}
        onClose={() => setPresentationsModalOpen(false)}
        onSave={(presentations) => setForm((f) => ({ ...f, presentations }))}
      />

      <PosBarcodeScannerModal
        open={productBarcodeScannerOpen}
        onClose={() => setProductBarcodeScannerOpen(false)}
        onScan={handleProductBarcodeScan}
        title="Código de barras"
        subtitle="Apunta al código del producto"
        footerHint="El código reemplazará el valor del campo al detectarlo"
      />
    </PageShell>
  )
}
