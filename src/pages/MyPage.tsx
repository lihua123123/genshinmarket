import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { Item } from '../types'
import { parseCSV } from '../utils/csvImport'
import Card from '../components/Card'
import Modal from '../components/Modal'
import Tag from '../components/Tag'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { MOON_CARD_DESCRIPTION, PRESET_CATEGORIES, getPresetNames } from '../data/cards'

// 我的页面：当前用户的道具管理（含搜索、添加、CSV导入、批量操作）
export default function MyPage() {
  const { currentUser } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // 当前展开的类别（我的道具采用"类别 → 道具"层级展示）
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // 添加道具表单
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ category: '', item_name: '', quantity: 1 })

  // 编辑数量
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [editQty, setEditQty] = useState(0)

  // 批量操作
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const loadItems = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      setItems(await api.getItems(currentUser.id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setSelected(new Set())
    setActiveCategory(null)
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // 类别汇总（第一层：展示所有已有道具的类别卡片，数量反映进入后展示的条目总数）
  const categorySummary = useMemo(() => {
    // 各类别已拥有的真实条目
    const realMap = new Map<string, { count: number; totalQty: number }>()
    const realNamesPerCat = new Map<string, Set<string>>()
    for (const i of items) {
      const cur = realMap.get(i.category) || { count: 0, totalQty: 0 }
      cur.count++
      cur.totalQty += i.quantity
      realMap.set(i.category, cur)
      if (!realNamesPerCat.has(i.category)) realNamesPerCat.set(i.category, new Set())
      realNamesPerCat.get(i.category)!.add(i.item_name)
    }
    // 展示条目数 = 该类别预设数量 + 不在预设中的真实条目数（因为进入后会把预设未拥有条目也展示出来）
    const result: { category: string; count: number; totalQty: number }[] = []
    for (const [category, v] of realMap) {
      const presetSet = new Set(getPresetNames(category))
      const realNames = realNamesPerCat.get(category)!
      let extra = 0
      for (const n of realNames) if (!presetSet.has(n)) extra++
      result.push({ category, count: presetSet.size + extra, totalQty: v.totalQty })
    }
    return result
  }, [items])

  // 类别视图：按搜索过滤类别
  const shownCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    return categorySummary.filter(c => !q || c.category.toLowerCase().includes(q))
  }, [categorySummary, search])

  // 道具视图：当前类别下的所有道具（含数量为0），并按预设顺序将未拥有与已拥有混合排列
  const categoryItems = useMemo(() => {
    if (!activeCategory) return []
    const q = search.trim().toLowerCase()
    const realItems = items.filter(i => i.category === activeCategory)
    const realByName = new Map(realItems.map(i => [i.item_name, i]))
    const presetNames = getPresetNames(activeCategory)
    const combined: Item[] = []
    const seen = new Set<string>()
    // 按预设顺序，未拥有（虚拟）与已拥有（真实）混合排列
    for (const name of presetNames) {
      if (realByName.has(name)) {
        combined.push(realByName.get(name)!)
      } else {
        combined.push({
          id: 0, // id 0 表示"尚未添加"的虚拟条目，保存数量时走新增接口
          user_id: currentUser?.id ?? 0,
          category: activeCategory,
          item_name: name,
          quantity: 0,
          tags: ['寻找'],
          created_at: '',
          updated_at: ''
        })
      }
      seen.add(name)
    }
    // 追加不在预设中的已有道具（用户自定义）
    for (const it of realItems) {
      if (!seen.has(it.item_name)) combined.push(it)
    }
    return combined.filter(
      i =>
        !q ||
        i.item_name.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [items, activeCategory, search, currentUser])

  // 添加道具时的可选类别：预设类别 + 当前用户已有类别（支持下拉选择 + 输入搜索）
  const availableCategories = useMemo(() => {
    const set = new Set<string>(PRESET_CATEGORIES)
    items.forEach(i => set.add(i.category))
    return Array.from(set)
  }, [items])

  // 名称候选：预设名称（月谕圣牌/材料分类）+ 该类别下已有名称
  const availableNames = useMemo(() => {
    const cat = form.category.trim()
    if (!cat) return []
    const preset = getPresetNames(cat)
    const existing = items.filter(i => i.category === cat).map(i => i.item_name)
    return Array.from(new Set([...preset, ...existing]))
  }, [form.category, items])

  // 添加道具
  const submitAdd = async () => {
    if (!form.category.trim() || !form.item_name.trim()) {
      toast.error('类别和名称不能为空')
      return
    }
    try {
      await api.addItem({
        user_id: currentUser!.id,
        category: form.category,
        item_name: form.item_name,
        quantity: Number(form.quantity) || 0
      })
      toast.success('道具已添加')
      setAddOpen(false)
      setForm({ category: '', item_name: '', quantity: 1 })
      loadItems()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // CSV 导入
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length === 0) {
        toast.error('CSV 内容为空或格式不正确')
        return
      }
      const res = await api.importCsv(currentUser!.id, rows)
      toast.success(`成功导入 ${res.added} 个道具（已自动去重）`)
      loadItems()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      e.target.value = ''
    }
  }

  // 切换"余货"标签（仅数量 > 1 时允许）
  const toggleYuhuo = async (item: Item) => {
    if (item.quantity <= 1) {
      toast.error('数量大于1时才能标记"余货"')
      return
    }
    try {
      const tags = item.tags.includes('余货')
        ? item.tags.filter(t => t !== '余货')
        : [...item.tags, '余货']
      const updated = await api.updateItem(item.id, { tags })
      setItems(prev => prev.map(i => (i.id === item.id ? updated : i)))
      toast.success(item.tags.includes('余货') ? '已移除"余货"标签' : '已标记"余货"')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // 编辑数量（虚拟条目 id=0 时调用新增接口创建/合并数量）
  const saveEdit = async () => {
    if (!editItem) return
    try {
      if (editItem.id === 0) {
        await api.addItem({
          user_id: currentUser!.id,
          category: editItem.category,
          item_name: editItem.item_name,
          quantity: editQty
        })
        toast.success('已添加')
      } else {
        const updated = await api.updateItem(editItem.id, { quantity: editQty })
        setItems(prev => prev.map(i => (i.id === editItem.id ? updated : i)))
        toast.success('数量已更新')
      }
      setEditItem(null)
      loadItems()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // 删除单个
  const removeItem = async (item: Item) => {
    try {
      await api.deleteItem(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('已删除')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // 批量删除
  const batchDelete = async () => {
    setBatchDeleteOpen(false)
    try {
      for (const id of selected) await api.deleteItem(id)
      toast.success(`已删除 ${selected.size} 个道具`)
      setSelected(new Set())
      loadItems()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // 批量添加标签
  const batchTag = async (tag: string) => {
    try {
      for (const id of selected) {
        const item = items.find(i => i.id === id)
        if (!item) continue
        const tags = item.tags.includes(tag) ? item.tags : [...item.tags, tag]
        await api.updateItem(id, { tags })
      }
      toast.success(`已为 ${selected.size} 个道具添加"${tag}"标签`)
      setSelected(new Set())
      loadItems()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (!currentUser) return null

  return (
    <div className="page">
      <div className="page-header">
        <h2>我的道具</h2>
        <div className="toolbar">
          <input
            className="input search-input"
            placeholder="🔍 搜索类别 / 名称 / 标签"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            📄 CSV导入
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFileChange} />
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            ＋ 添加道具
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="batch-bar">
          <span>已选 {selected.size} 项</span>
          <button className="btn btn-small" onClick={() => batchTag('余货')}>
            批量标记余货
          </button>
          <button className="btn btn-small" onClick={() => batchTag('寻找')}>
            批量标记寻找
          </button>
          <button className="btn btn-small btn-danger" onClick={() => setBatchDeleteOpen(true)}>
            批量删除
          </button>
          <button className="btn btn-small" onClick={() => setSelected(new Set())}>
            取消选择
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : activeCategory ? (
        // 第二层：该类别下的所有具体道具（含数量为0）
        <>
          <div className="breadcrumb">
            <span className="crumb" onClick={() => setActiveCategory(null)}>
              我的道具
            </span>
            <span className="crumb-sep">/</span>
            <span className="crumb active">{activeCategory}</span>
          </div>
          {categoryItems.length === 0 ? (
            <div className="empty">该类别下暂无道具</div>
          ) : (
            <div className="card-grid">
              {categoryItems.map(item => {
                const isVirtual = item.id === 0
                return (
                  <Card
                    key={isVirtual ? `v-${item.item_name}` : item.id}
                    selected={selected.has(item.id)}
                    className="item-card"
                  >
                    <div className="item-card-top">
                      <span className="item-category">{item.category}</span>
                      {isVirtual ? (
                        <span className="virtual-badge">未拥有</span>
                      ) : (
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                          选择
                        </label>
                      )}
                    </div>
                    <div className="item-name-row">
                      {/* 预留空间：道具图标与颜色分级（icon/color 字段后续补充） */}
                      <div
                        className={`item-icon ${item.color ? 'has-color' : ''}`}
                        style={item.color ? { background: item.color } : undefined}
                      >
                        {item.icon ? <img src={item.icon} alt={item.item_name} /> : '🃏'}
                      </div>
                      <h3 className="item-name">{item.item_name}</h3>
                    </div>
                    <div className="item-tags">
                      {item.tags.map(t => (
                        <Tag key={t} label={t} />
                      ))}
                    </div>
                    <div className="item-qty">
                      数量：<strong>{item.quantity}</strong>
                      {item.tags.includes('余货') && (
                        <span className="yuhuo-amount">（余货 {Math.max(0, item.quantity - 1)}）</span>
                      )}
                    </div>
                    <div className="item-actions">
                      {!isVirtual && (
                        <button className="btn btn-small" onClick={() => toggleYuhuo(item)}>
                          {item.tags.includes('余货') ? '取消余货' : '标记余货'}
                        </button>
                      )}
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() => {
                          setEditItem(item)
                          setEditQty(item.quantity)
                        }}
                      >
                        {isVirtual ? '添加数量' : '改数量'}
                      </button>
                      {!isVirtual && (
                        <button className="btn btn-small btn-danger" onClick={() => removeItem(item)}>
                          删除
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      ) : shownCategories.length === 0 ? (
        <div className="empty">
          {items.length === 0
            ? '还没有道具，点击"添加道具"或"CSV导入"开始吧'
            : '没有匹配的类别'}
        </div>
      ) : (
        // 第一层：道具类别卡片
        <>
          <h2>道具类别</h2>
          <p className="muted">点击类别查看该类别下的所有道具（含数量为0）</p>
          <div className="card-grid">
            {shownCategories.map(c => (
              <Card
                key={c.category}
                onClick={() => setActiveCategory(c.category)}
                className="category-card"
              >
                <h3>{c.category}</h3>
                <p className="muted">{c.count} 个道具</p>
                <span className="card-arrow">→</span>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* 类别 / 名称候选列表（供 datalist 使用，支持下拉选择 + 输入搜索） */}
      <datalist id="item-category-options">
        {availableCategories.map(c => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="item-name-options">
        {availableNames.map(n => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {/* 添加道具弹窗 */}
      <Modal open={addOpen} title="添加道具" onClose={() => setAddOpen(false)}>
        <div className="form-group">
          <label>道具类别</label>
          <input
            className="input"
            list="item-category-options"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            placeholder="选择或输入类别，如：月谕圣牌"
          />
          <p className="muted field-hint">
            可下拉选择，也可直接输入搜索（{availableCategories.length} 个候选项）
          </p>
        </div>
        {form.category.trim() === '月谕圣牌' && (
          <div className="moon-info">
            <strong>📖 关于月谕圣牌</strong>
            <p>{MOON_CARD_DESCRIPTION}</p>
          </div>
        )}
        <div className="form-group">
          <label>道具名称</label>
          <input
            className="input"
            list="item-name-options"
            value={form.item_name}
            onChange={e => setForm({ ...form, item_name: e.target.value })}
            placeholder={
              form.category.trim() === '月谕圣牌' ? '选择或输入圣牌名称' : '选择或输入道具名称'
            }
          />
          {getPresetNames(form.category.trim()).length > 0 ? (
            <p className="muted field-hint">
              已提供 {getPresetNames(form.category.trim()).length} 个名称供选择/搜索
            </p>
          ) : (
            <p className="muted field-hint">可下拉选择已有名称，也可直接输入新名称</p>
          )}
        </div>
        <div className="form-group">
          <label>数量</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.quantity}
            onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </div>
        <div className="confirm-actions">
          <button className="btn" onClick={() => setAddOpen(false)}>
            取消
          </button>
          <button className="btn btn-primary" onClick={submitAdd}>
            添加
          </button>
        </div>
      </Modal>

      {/* 编辑数量弹窗 */}
      <Modal open={!!editItem} title="修改数量" onClose={() => setEditItem(null)}>
        {editItem && (
          <>
            <p className="muted">
              {editItem.category} · {editItem.item_name}
            </p>
            <div className="form-group">
              <label>数量</label>
              <input
                className="input"
                type="number"
                min={0}
                value={editQty}
                onChange={e => setEditQty(Number(e.target.value))}
              />
            </div>
            <div className="confirm-actions">
              <button className="btn" onClick={() => setEditItem(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>
                保存
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={batchDeleteOpen}
        message={`确定删除选中的 ${selected.size} 个道具吗？此操作不可撤销。`}
        onConfirm={batchDelete}
        onCancel={() => setBatchDeleteOpen(false)}
        confirmText="删除"
      />
    </div>
  )
}
