/**
 * mockCollection — 模拟微信云数据库 Collection 对象
 *
 * 每个 createMockCollection() 调用返回全新实例，测试之间完全隔离。
 * 支持链式调用：where().orderBy().skip().limit().get()
 * 支持文档操作：doc(id).get / update / remove
 * 支持集合操作：add({data}) / remove()（where 后批量删）
 *
 * 用法：
 *   const coll = createMockCollection([{_id:'1', name:'foo'}])
 *   coll.__setData([...])   // 重置数据
 *   coll.__getData()         // 读取当前数据
 */

/**
 * 工厂函数：创建独立的 mockCollection 实例
 * @param {Array} [initialData=[]]
 * @returns {Object}
 */
function createMockCollection(initialData = []) {
  // ─── 实例级状态（每个实例独立）────────────
  let _data = Array.isArray(initialData) ? initialData.map(d => ({...d})) : []
  let _whereFilter = null
  let _skip = 0
  let _limit = 0
  let _orderByField = null
  let _orderByDir = 'desc'

  // ─── 等值过滤 ─────────────────────────────
  function _matchFilter(item, filter) {
    if (!filter || typeof filter !== 'object') return true
    return Object.entries(filter).every(([key, val]) => {
      if (val && typeof val === 'object' && val.$ne !== undefined) {
        return item[key] !== val.$ne
      }
      return item[key] === val
    })
  }

  function _applyWhere(data) {
    if (!_whereFilter) return data
    return data.filter(item => _matchFilter(item, _whereFilter))
  }

  // ─── 排序（在 get() 时执行）────────────────
  function _applyOrderBy(data) {
    if (!_orderByField) return data
    return [...data].sort((a, b) => {
      const va = a[_orderByField]
      const vb = b[_orderByField]
      if (va == null && vb == null) return 0
      if (va == null) return _orderByDir === 'desc' ? 1 : -1
      if (vb == null) return _orderByDir === 'desc' ? -1 : 1
      if (va < vb) return _orderByDir === 'desc' ? 1 : -1
      if (va > vb) return _orderByDir === 'desc' ? -1 : 1
      return 0
    })
  }

  // ─── 链式方法（返回自身）────────────────────
  const instance = {
    where(filter) {
      _whereFilter = filter
      return instance
    },

    orderBy(field, dir = 'desc') {
      _orderByField = field
      _orderByDir = dir
      return instance
    },

    skip(n) {
      _skip = n
      return instance
    },

    limit(n) {
      _limit = n
      return instance
    },

    // ─── 终止方法 ───────────────────────────
    async get() {
      let result = _applyOrderBy(_applyWhere([..._data]))
      const skip = _skip || 0
      const limit = _limit || result.length
      _skip = 0
      _limit = 0
      _whereFilter = null
      _orderByField = null
      _orderByDir = 'desc'
      return { data: result.slice(skip, skip + limit) }
    },

    doc(id) {
      const self = this
      return {
        async get() {
          const item = _data.find(d => String(d._id) === String(id)) || null
          return { data: item }
        },
        async update({ data: patch }) {
          const idx = _data.findIndex(d => String(d._id) === String(id))
          if (idx >= 0) {
            _data[idx] = { ..._data[idx], ...patch }
            return { stats: { updated: 1 } }
          }
          return { stats: { updated: 0 } }
        },
        async remove() {
          const idx = _data.findIndex(d => String(d._id) === String(id))
          if (idx >= 0) {
            _data.splice(idx, 1)
            return { stats: { removed: 1 } }
          }
          return { stats: { removed: 0 } }
        },
      }
    },

    async add({ data }) {
      const _id = 'mock_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
      const record = { _id, ...data }
      _data.push(record)
      return { _id }
    },

    async remove() {
      // 集合级 remove（where 后调用，DAL 中用此方式删多条）
      const toRemove = _applyWhere([..._data])
      const removed = toRemove.length
      const ids = new Set(toRemove.map(d => d._id))
      _data = _data.filter(d => !ids.has(d._id))
      _whereFilter = null
      return { stats: { removed } }
    },

    // ─── 测试辅助 ───────────────────────────
    __setData(arr) {
      _data = Array.isArray(arr) ? arr.map(d => ({...d})) : []
      _whereFilter = null
    },

    __getData() {
      return _data.map(d => ({...d}))
    },

    __reset() {
      _data = []
      _whereFilter = null
      _skip = 0
      _limit = 0
      _orderByField = null
      _orderByDir = 'desc'
    },
  }

  return instance
}

module.exports = { createMockCollection }
