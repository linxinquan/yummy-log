/**
 * 数据迁移工具 — 将本地存储数据一次性写入云端数据库
 *
 * 使用方式：
 *   1. 在"我的"页面登录后自动检测并弹窗提示
 *   2. 在设置页提供"数据迁移"手动入口
 *
 * 注意：微信云数据库不支持批量 add，需要逐条写入。
 *       如果数据量较大（>50 条），建议分批次或让用户手动选择迁移范围。
 */

const { safeCall } = require('./base')
const wantListDal       = require('./wantList')
const collectedListDal  = require('./collectedList')
const checkinRecordsDal = require('./checkinRecords')
const routesDal         = require('./routes')
const userAddedShopsDal = require('./userAddedShops')

const util = require('../util')

// ─── 批量辅助 ─────────────────────────────────
// 微信云数据库有并发上限，以可控并发度分批写入
/**
 * 以指定并发度逐批执行异步任务
 * @param {Array}     items       - 待处理数据
 * @param {Function}  fn          - 异步处理函数 (item, index) => Promise
 * @param {number}    concurrency - 最大并发数（默认 5）
 * @param {Function}  [onItem]    - 每项完成回调 (current, total)
 * @returns {Promise<void>}
 */
async function _batchRun(items, fn, concurrency = 5, onItem = null) {
  let completed = 0
  const total = items.length
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    await Promise.all(batch.map((item, idx) => fn(item, i + idx)))
    completed += batch.length
    if (onItem) onItem(completed, total)
  }
}

// ─── 主入口 ───────────────────────────────────

/**
 * 执行完整迁移（所有数据类型）
 *
 * @param {Object}   [options]
 * @param {boolean}  [options.wantList=true]        - 是否迁移想去列表
 * @param {boolean}  [options.collectedList=true]   - 是否迁移收藏列表
 * @param {boolean}  [options.checkinRecords=true]  - 是否迁移打卡记录
 * @param {boolean}  [options.routes=true]          - 是否迁移路线
 * @param {boolean}  [options.userAddedShops=true]  - 是否迁移用户添加店铺
 * @param {Function} [options.onProgress]           - 进度回调 (phase, current, total)
 *
 * @returns {Promise<{success, data: {stats}, error}>}
 *          stats = { wantCount, collectCount, checkinCount, routeCount, shopCount }
 */
async function migrateAll(options = {}) {
  const opts = {
    wantList:       true,
    collectedList:   true,
    checkinRecords:  true,
    routes:          true,
    userAddedShops:  true,
    onProgress:      null,
    ...options,
  }

  const stats = {
    wantCount:     0,
    collectCount:   0,
    checkinCount:   0,
    routeCount:     0,
    shopCount:      0,
  }

  const _progress = (phase, current, total) => {
    if (opts.onProgress) opts.onProgress(phase, current, total)
  }

  // ── 1. 想去列表 ──────────────────────────
  if (opts.wantList) {
    const wantIds = util.getWantList()
    _progress('wantList', 0, wantIds.length)
    await _batchRun(
      wantIds,
      (id) => wantListDal.add(id, 'food'),
      5,
      (current) => _progress('wantList', current, wantIds.length),
    )
    stats.wantCount = wantIds.length
  }

  // ── 2. 收藏列表 ──────────────────────────
  if (opts.collectedList) {
    const foodIds = util.loadData('userCollectedFoods', [])
    const spotIds = util.loadData('userCollectedSpots', [])
    const allIds  = [
      ...foodIds.map(id => ({ id, type: 'food' })),
      ...spotIds.map(id => ({ id, type: 'spot' })),
    ]
    _progress('collectedList', 0, allIds.length)
    await _batchRun(
      allIds,
      (item) => collectedListDal.add(item.id, item.type),
      5,
      (current) => _progress('collectedList', current, allIds.length),
    )
    stats.collectCount = allIds.length
  }

  // ── 3. 打卡记录 ──────────────────────────
  if (opts.checkinRecords) {
    const records = util.loadData('checkin_records', []) || []
    _progress('checkinRecords', 0, records.length)
    await _batchRun(
      records,
      (r) => checkinRecordsDal.add({
        type:                  r.type || 'food',
        photoPath:             r.photoPath || '',
        cloudFileID:           r.cloudFileID || '',
        spotName:              r.spotName || '',
        address:               r.address || '',
        latitude:              r.latitude || r.lat || null,
        longitude:             r.longitude || r.lng || null,
        description:           r.description || '',
        date:                  r.date || new Date().toISOString(),
        customRecordTimeLabel: r.customRecordTimeLabel || '',
        city:                  r.city || '',
        relatedPlaceId:        r.relatedPlaceId || '',
      }),
      5,
      (current) => _progress('checkinRecords', current, records.length),
    )
    stats.checkinCount = records.length
  }

  // ── 4. 路线 ──────────────────────────────
  if (opts.routes) {
    const savedRoutes = util.loadData('savedRoutes', []) || []
    _progress('routes', 0, savedRoutes.length)
    await _batchRun(
      savedRoutes,
      (r) => routesDal.add(r),
      5,
      (current) => _progress('routes', current, savedRoutes.length),
    )
    stats.routeCount = savedRoutes.length
  }

  // ── 5. 用户添加店铺 ──────────────────────
  if (opts.userAddedShops) {
    const shops = util.loadData('userAddedShops', []) || []
    _progress('userAddedShops', 0, shops.length)
    await _batchRun(
      shops,
      (s) => userAddedShopsDal.add({
        name:       s.name || '',
        address:    s.address || '',
        lat:        s.lat || null,
        lng:        s.lng || null,
        type:       s.type || 'food',                   // 保留本地 type，无则默认 food
        category:   s.category || '',
        price:      String(s.price || ''),               // number → string
        rating:     String(s.rating || ''),               // number → string
        tags:       Array.isArray(s.tags) ? s.tags : [],
        coverImage: s.image || s.coverImage || '',        // 兼容本地 image 字段名
      }),
      5,
      (current) => _progress('userAddedShops', current, shops.length),
    )
    stats.shopCount = shops.length
  }

  _progress('done', 1, 1)
  return { success: true, data: { stats }, error: null }
}

/**
 * 检测本地是否有未迁移的数据
 * @returns {boolean}
 */
function hasLocalData() {
  const wantIds   = util.getWantList()
  const foodIds   = util.loadData('userCollectedFoods', [])
  const spotIds   = util.loadData('userCollectedSpots', [])
  const records   = util.loadData('checkin_records', []) || []
  const routes    = util.loadData('savedRoutes', []) || []
  const shops     = util.loadData('userAddedShops', []) || []
  return (
    wantIds.length > 0 ||
    foodIds.length > 0 ||
    spotIds.length > 0 ||
    records.length > 0 ||
    routes.length > 0 ||
    shops.length > 0
  )
}

/**
 * 清除本地数据（迁移完成后调用）
 */
function clearLocalData() {
  util.saveData('userWantList',      [])
  util.saveData('userWantFoods',     [])  // 旧格式
  util.saveData('userWantSpots',     [])  // 旧格式
  util.saveData('userCollectedFoods', [])
  util.saveData('userCollectedSpots', [])
  util.saveData('checkin_records',   [])
  util.saveData('savedRoutes',        [])
  util.saveData('userAddedShops',    [])
  util.saveData('userCheckedIn',     [])
}

// ─── 导出 ─────────────────────────────────────
module.exports = {
  migrateAll,
  hasLocalData,
  clearLocalData,
}
