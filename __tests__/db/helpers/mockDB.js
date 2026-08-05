/**
 * mockDB — 模拟 wx.cloud.database() 返回对象
 *
 * 用法：
 *   const db = createMockDB({ places: [ {...}, ... ] })
 *   db.collection('checkin_records')  // → mockCollection 实例
 *   db.command                    // → command 对象
 *   db.Geo.Point(lng, lat)      // → { type:'Point', coordinates:[lng,lat] }
 *   db.serverDate()               // → new Date('2025-01-01T00:00:00.000Z')
 */

const { createMockCollection } = require('./mockCollection')

// 默认 mock 数据（各集合的初始数据，可按测试需要覆盖）
const DEFAULT_DATA = {
  want_list:        [],
  collected_list:   [],
  checkin_records:  [],
  routes:           [],
  user_added_shops: [],
  users:            [],
  places:           [],
}

/**
 * 创建 mockDB 实例
 * @param {Object} [initialData] - 按集合名覆盖初始数据，如 { places: [{...}] }
 * @returns {Object} mockDB 实例
 */
function createMockDB(initialData = {}) {
  const data = { ...DEFAULT_DATA, ...initialData }

  // 为每个集合名称创建独立的 mockCollection 实例
  const collections = {}

  function getCollection(name) {
    if (!collections[name]) {
      collections[name] = createMockCollection(data[name] || [])
    }
    return collections[name]
  }

  // ─── 测试辅助 ───────────────────────────
  function __resetAll() {
    Object.values(collections).forEach(c => c.__reset())
    // 重新注入初始数据
    Object.entries(data).forEach(([k, v]) => {
      if (collections[k]) collections[k].__setData(v)
    })
  }

  function __setCollectionData(name, arr) {
    if (!collections[name]) getCollection(name)
    collections[name].__setData(arr)
  }

  function __getCollectionData(name) {
    if (!collections[name]) return []
    return collections[name].__getData()
  }

  // ─── command 对象（覆盖 places.js 的 geoNear / ne 用法）─────
  const command = {
    geoNear: jest.fn((opts) => ({ geoNear: opts })),
    ne:      jest.fn((val) => ({ $ne: val })),
  }

  // ─── Geo 对象 ─────────────────────────────────────
  const Geo = {
    Point: jest.fn((lng, lat) => ({
      type:        'Point',
      coordinates: [lng, lat],
    })),
  }

  // ─── serverDate 模拟 ──────────────────────────────
  function serverDate() {
    return new Date('2025-01-01T00:00:00.000Z')
  }

  return {
    // 集合操作
    collection: jest.fn((name) => getCollection(name)),

    // 命令
    command,
    Geo,

    // 服务端时间
    serverDate,

    // 辅助（测试用）
    __resetAll,
    __setCollectionData,
    __getCollectionData,
    _collections: collections,  // 暴露给测试直接访问
  }
}

module.exports = { createMockDB }
