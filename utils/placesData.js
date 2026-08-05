/**
 * 统一数据访问层
 * 云端 places 集合 + localStorage 缓存
 * 
 * 加载策略：
 *   Phase 0: 读本地缓存 → 命中则秒开
 *   Phase 1: 无缓存时，拉默认城市 20 条
 *   Phase 2: 后台拉全量 → 合并 → 存缓存 → 通知页面
 * 
 * 使用方式：
 *   const placesData = require('./placesData')
 *   await placesData.init()            // 启动时初始化
 *   placesData.onUpdate(() => { ... })  // 监听数据变更
 *   const spots = placesData.getSpots() // 同步调用
 */

const cloudData = require('./cloudData')

// 转换为统一格式：确保每条数据都有 lat/lng 字段
function normalizeLocation(place) {
  const p = { ...place }
  if (place.location && place.location.coordinates && place.location.coordinates.length >= 2) {
    p.lng = place.location.coordinates[0]
    p.lat = place.location.coordinates[1]
  }
  return p
}

// ============================================================
// 缓存配置
// ============================================================

const CACHE_KEY = 'places_cache'       // localStorage key
const CACHE_VERSION = 1                // 缓存版本，结构变更时递增使旧缓存失效
const DEFAULT_CITY = '广州'            // 兜底城市

/**
 * 加载当前城市的首屏数据（20 条）。
 * 由 app.js 在定位完成（whenDistrictReady 回调）后调用，传入真实当前城市。
 * 仅在尚无全量数据时生效，避免用 20 条覆盖已有的全量缓存。
 * @param {string} city - 当前城市短名（如 '深圳'），为空时回退默认城市
 */
async function loadCityFirstScreen(city) {
  // 已有全量数据（缓存命中或 Phase 2 已完成）时，不再用 20 条覆盖
  if (_fullReady && _allPlacesCache && _allPlacesCache.length > 0) return

  const firstCity = (city && String(city).replace(/市$|自治州$|盟$/, '').trim()) || DEFAULT_CITY
  console.log('[placesData] 首屏加载当前城市:', firstCity)
  try {
    let cityData = await cloudData.getPlacesByCity(firstCity, 20)
    // 当前城市查不到数据时，回退拉默认城市，避免首屏空白
    if ((!cityData || cityData.length === 0) && firstCity !== DEFAULT_CITY) {
      console.warn('[placesData] 当前城市', firstCity, '无数据，回退加载', DEFAULT_CITY)
      cityData = await cloudData.getPlacesByCity(DEFAULT_CITY, 20)
    }
    const normalized = (cityData || []).map(normalizeLocation)
    _fillCache(normalized)
    _initialized = true

    console.log('[placesData] 首屏加载完成 -', firstCity + ':', _allPlacesCache.length,
                '景点:', _spotsCache.length, '美食:', _foodsCache.length)

    _resolveReady()
    // 通知页面用当前城市数据刷新（全量回来前的首屏兜底）
    _fireOnUpdate()
  } catch (err) {
    console.error('[placesData] 首屏加载失败', err)
    if (!_initialized) {
      _fillCache([])
      _initialized = true
      _resolveReady()
    }
  }
}

/**
 * 序列化前剥离不可 JSON 化的 GeoPoint 对象（已有 lat/lng 兜底）
 */
function _stripGeoPoint(place) {
  const p = { ...place }
  delete p.location  // GeoPoint 对象不可序列化
  return p
}

/**
 * 保存全量数据到本地缓存
 */
function _saveCache(places) {
  try {
    const payload = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: places.map(_stripGeoPoint)
    }
    wx.setStorageSync(CACHE_KEY, payload)
    console.log('[placesData] 缓存已保存, 条数:', places.length)
  } catch (err) {
    console.warn('[placesData] 缓存保存失败（可能超限）:', err.message)
  }
}

/**
 * 读取本地缓存，返回 null 表示无可用缓存
 */
function _loadCache() {
  try {
    const payload = wx.getStorageSync(CACHE_KEY)
    if (!payload || !payload.data) return null
    if (payload.version !== CACHE_VERSION) {
      console.log('[placesData] 缓存版本不匹配，已失效')
      return null
    }
    const age = Date.now() - payload.timestamp
    console.log('[placesData] 命中本地缓存, 条数:', payload.data.length, '年龄:', Math.round(age / 1000) + 's')
    return payload.data
  } catch (err) {
    console.warn('[placesData] 缓存读取失败:', err.message)
    return null
  }
}

/**
 * 清除本地缓存
 */
function _clearCache() {
  try {
    wx.removeStorageSync(CACHE_KEY)
  } catch (e) { /* ignore */ }
}

// ============================================================
// 内存状态
// ============================================================

let _allPlacesCache = null
let _spotsCache = null
let _foodsCache = null
let _placesMapCache = null  // id -> place
let _initialized = false
let _fullReady = false          // 全量数据是否就绪
let _readyResolve = null        // whenReady() 的 resolve
let _fullReadyResolve = null    // whenFullyReady() 的 resolve
let _fullReadyCallbacks = []    // 全量就绪回调队列
let _onUpdateCallbacks = []     // 数据变更回调（每次 merge 后触发）
let _initPromise = null         // 防止重复 init

// ============================================================
// 初始化（三阶段：缓存 → 首屏 → 全量）
// ============================================================

async function init(force = false) {
  // 防止并发重复调用
  if (_initPromise && !force) return _initPromise
  _initPromise = _doInit(force)
  return _initPromise
}

async function _doInit(force) {
  if (_initialized && !force) return

  // force 刷新时清除缓存和状态
  if (force) {
    _clearCache()
    _initialized = false
    _fullReady = false
    _readyResolve = null
    _fullReadyResolve = null
    _fullReadyCallbacks = []
  }

  // ── Phase 0: 尝试读本地缓存 ──
  const cached = !force && _loadCache()
  if (cached && cached.length > 0) {
    const normalized = cached.map(normalizeLocation)
    _fillCache(normalized)
    _initialized = true
    _fullReady = true

    console.log('[placesData] Phase 0 (缓存) 完成 - 全部:', _allPlacesCache.length,
                '景点:', _spotsCache.length, '美食:', _foodsCache.length)

    // 缓存已有全量数据，两个 ready 都立即触发
    _resolveReady()
    _resolveFullReady()

    // 后台刷新全量数据（跳过 Phase 1）
    _backgroundRefresh()
    return
  }

  // ── Phase 1: 无缓存，先用空数据放行 ready（页面可渲染），
  // 当前城市的首屏 20 条由 app 定位完成后调用 loadCityFirstScreen 单独加载，
  // 全量数据在后台拉取。 ──
  _fillCache([])
  _initialized = true
  _resolveReady()

  console.log('[placesData] Phase 1（无缓存）已放行，等待定位后加载当前城市首屏，全量后台拉取...')

  // ── Phase 2: 后台拉全量 ──
  _backgroundRefresh()
}

/**
 * 后台拉取全量数据并合并（不阻塞 Phase 0/1 的 ready）
 */
async function _backgroundRefresh() {
  try {
    await _fetchFullAndMerge()
  } catch (err) {
    console.warn('[placesData] 后台刷新失败:', err.message)
  }
}

/**
 * 拉取全量 → 合并 → 存缓存 → 通知
 */
async function _fetchFullAndMerge() {
  console.log('[placesData] Phase 2：加载全量数据...')
  const all = await cloudData.getAllPlaces()
  const allNormalized = (all || []).map(normalizeLocation)
  _mergeCache(allNormalized)
  _fullReady = true

  console.log('[placesData] Phase 2 完成 - 全部:', _allPlacesCache.length,
              '景点:', _spotsCache.length, '美食:', _foodsCache.length)

  // 持久化缓存
  _saveCache(_allPlacesCache)

  // 唤醒等待
  _resolveFullReady()

  // 通知所有监听数据变更的页面
  _fireOnUpdate()
}

// ============================================================
// 内部辅助
// ============================================================

function _fillCache(normalized) {
  _allPlacesCache = normalized
  _spotsCache = normalized.filter(p => p.type === 'spot')
  _foodsCache = normalized.filter(p => p.type === 'food')
  _placesMapCache = null
}

function _mergeCache(allNormalized) {
  const merged = [...allNormalized]
  _allPlacesCache.forEach(p => {
    if (!allNormalized.find(n => n.id === p.id)) {
      merged.push(p)
    }
  })
  _fillCache(merged)
}

function _resolveReady() {
  if (_readyResolve) { _readyResolve(); _readyResolve = null }
}

function _resolveFullReady() {
  if (_fullReadyResolve) { _fullReadyResolve(); _fullReadyResolve = null }
  _fullReadyCallbacks.forEach(cb => cb())
  _fullReadyCallbacks = []
}

function _fireOnUpdate() {
  _onUpdateCallbacks.forEach(cb => {
    try { cb() } catch (e) { console.warn('[placesData] onUpdate 回调异常:', e) }
  })
}

// ============================================================
// 就绪等待 & 事件监听
// ============================================================

/**
 * 等待首屏数据就绪（Phase 0/1 完成即触发）
 */
function whenReady() {
  if (_initialized) return Promise.resolve()
  return new Promise(resolve => { _readyResolve = resolve })
}

/**
 * 等待全量数据就绪（Phase 2 完成或缓存命中）
 */
function whenFullyReady(callback) {
  if (_fullReady) {
    if (callback) callback()
    return Promise.resolve()
  }
  const p = new Promise(resolve => { _fullReadyResolve = resolve })
  if (callback) _fullReadyCallbacks.push(callback)
  return p
}

/**
 * 监听数据变更（每次全量合并后触发，包括后台刷新）
 * 页面级监听，页面卸载时应 offUpdate 取消
 */
function onUpdate(callback) {
  _onUpdateCallbacks.push(callback)
}

function offUpdate(callback) {
  _onUpdateCallbacks = _onUpdateCallbacks.filter(cb => cb !== callback)
}

function isReady() {
  return _initialized && !!_allPlacesCache
}

function isFullyReady() {
  return _fullReady
}

// ============================================================
// 同步 getter（需先 init / whenReady）
// ============================================================

function getAllPlaces() {
  return _allPlacesCache || []
}

function getSpots(city) {
  const spots = _spotsCache || []
  if (city) return spots.filter(s => s.city === city)
  return spots
}

function getFoods(city) {
  const foods = _foodsCache || []
  if (city) return foods.filter(f => f.city === city)
  return foods
}

function getPlaceById(id) {
  if (!_placesMapCache) {
    _placesMapCache = {}
    const all = _allPlacesCache || []
    all.forEach(p => { _placesMapCache[p.id] = p })
  }
  return _placesMapCache[id] || null
}

function getPlaceByName(name) {
  const all = _allPlacesCache || []
  return all.find(p => p.name === name) || null
}

function searchPlaces(keyword, type) {
  const lowerKeyword = keyword.toLowerCase()
  const all = _allPlacesCache || []
  return all.filter(p => {
    if (type && p.type !== type) return false
    if (p.name && p.name.toLowerCase().includes(lowerKeyword)) return true
    if (p.tags && p.tags.some(t => t.toLowerCase().includes(lowerKeyword))) return true
    if (p.desc && p.desc.toLowerCase().includes(lowerKeyword)) return true
    if (p.category && p.category.toLowerCase().includes(lowerKeyword)) return true
    return false
  })
}

function getCategories(type) {
  const places = type === 'spot' ? getSpots() : getFoods()
  const categories = new Set()
  places.forEach(p => { if (p.category) categories.add(p.category) })
  return Array.from(categories)
}

function getCities(type) {
  const all = _allPlacesCache || []
  const places = type ? (type === 'spot' ? getSpots() : getFoods()) : all
  const cities = new Set()
  places.forEach(p => { if (p.city) cities.add(p.city) })
  return Array.from(cities)
}

// ============================================================
// 兼容旧接口
// ============================================================

function getSnakePortShops() {
  return getFoods('深圳').filter(f =>
    f.district === '蛇口' || (f.address && f.address.includes('蛇口'))
  )
}

function getShopNameMap() {
  const map = {}
  getFoods().forEach(f => { map[f.id] = f.name })
  return map
}

function getShenzhenFoods() { return getFoods('深圳') }
function getShenzhenSpots() { return getSpots('深圳') }

// ============================================================
// 导出
// ============================================================

module.exports = {
  init,
  loadCityFirstScreen,
  whenReady,
  whenFullyReady,
  onUpdate,
  offUpdate,
  isReady,
  isFullyReady,
  
  getAllPlaces,
  getSpots,
  getFoods,
  getPlaceById,
  getPlaceByName,
  searchPlaces,
  getCategories,
  getCities,
  
  getSnakePortShops,
  getShopNameMap,
  getShenzhenFoods,
  getShenzhenSpots,
  
  get spots() { return getSpots() },
  get foods() { return getFoods() },
  get shops() { return getSnakePortShops() },
  get shopNameMap() { return getShopNameMap() }
}
