/**
 * 迁移工具 — 仅迁移打卡记录（含图片处理）
 *
 * 数据决策：
 * - 路线、添加店铺、想去列表、收藏列表 → 登录后直接丢弃（不复用）
 * - 打卡记录 → 两阶段迁移：
 *   Phase 1: 处理图片（本地持久化 + 上传云端获取 cloudFileID）
 *   Phase 2: 写入云端数据库
 */
const { safeCall } = require('./base')
const checkinRecordsDal = require('./checkinRecords')
const util = require('../util')

const fs = wx.getFileSystemManager()

// ─── 批量辅助 ─────────────────────────────────
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

// ─── 图片处理 ─────────────────────────────────

/**
 * 处理单条打卡记录的图片：
 * 1. 本地持久化（临时文件 → 持久路径）
 * 2. 上传云端获取 cloudFileID
 * 返回更新后的记录
 */
async function _processCheckinPhoto(record) {
  if (!record.photoPath) return record

  let photoPath = record.photoPath
  let cloudFileID = record.cloudFileID || ''

  // Phase 1a: 本地持久化
  try {
    const savedPath = await new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath: photoPath,
        success: (res) => resolve(res.savedFilePath),
        fail: reject,
      })
    })
    photoPath = savedPath
  } catch (err) {
    // 可能已是持久化路径或已损坏，保留原路径
  }

  // Phase 1b: 上传云端
  if (!cloudFileID) {
    try {
      const cloudPath = `checkin/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: photoPath,
      })
      cloudFileID = uploadRes.fileID
    } catch (err) {
      console.warn('[migration] 图片云端上传失败:', err)
    }
  }

  return { ...record, photoPath, cloudFileID }
}

/**
 * 处理所有打卡记录的图片（Phase 1）
 * 更新本地缓存中的 photoPath 和 cloudFileID
 */
async function _processCheckinPhotos(records, onProgress) {
  const processed = []
  for (let i = 0; i < records.length; i++) {
    processed.push(await _processCheckinPhoto(records[i]))
    if (onProgress) onProgress('photos', i + 1, records.length)
  }
  // 写回本地缓存
  util.saveData('checkin_records', processed)
  return processed
}

// ─── 主入口 ───────────────────────────────────

/**
 * 执行打卡记录迁移（两阶段）
 *
 * @param {Object}   [options]
 * @param {Function} [options.onProgress] - (phase, current, total)
 *        phase: 'photos' | 'checkins' | 'done'
 * @returns {Promise<{success, data: {count}, error}>}
 */
async function migrateAll(options = {}) {
  const opts = { onProgress: null, ...options }

  const records = util.loadData('checkin_records', []) || []
  if (records.length === 0) {
    if (opts.onProgress) opts.onProgress('done', 0, 0)
    return { success: true, data: { count: 0 }, error: null }
  }

  // ── Phase 1: 处理图片 ──────────────────
  const processed = await _processCheckinPhotos(records, opts.onProgress)

  // ── Phase 2: 写入云端 ──────────────────
  let count = 0
  await _batchRun(
    processed,
    async (r) => {
      await checkinRecordsDal.add({
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
      })
      count++
    },
    5,
    (current) => {
      if (opts.onProgress) opts.onProgress('checkins', current, processed.length)
    },
  )

  // 清除本地打卡数据
  util.saveData('checkin_records', [])
  util.saveData('userCheckedIn', [])

  if (opts.onProgress) opts.onProgress('done', count, count)
  return { success: true, data: { count }, error: null }
}

/**
 * 检查本地是否有打卡记录需要迁移
 */
function hasLocalData() {
  const records = util.loadData('checkin_records', []) || []
  return records.length > 0
}

/**
 * 登录后丢弃路线/店铺/想去/收藏等不再复用的本地列表数据
 * （打卡记录保留，供后续迁移）
 */
function discardLocalLists() {
  util.saveData('userWantList',      [])
  util.saveData('userWantFoods',     [])
  util.saveData('userWantSpots',     [])
  util.saveData('userCollectedFoods', [])
  util.saveData('userCollectedSpots', [])
  util.saveData('savedRoutes',        [])
  util.saveData('userAddedShops',    [])
}

/**
 * 清除所有本地用户数据（打卡记录迁移完成后调用）
 */
function clearLocalData() {
  discardLocalLists()
  util.saveData('checkin_records',   [])
  util.saveData('userCheckedIn',     [])
}

// ─── 导出 ─────────────────────────────────────
module.exports = {
  migrateAll,
  hasLocalData,
  discardLocalLists,
  clearLocalData,
}
