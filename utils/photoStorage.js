// utils/photoStorage.js - 图片持久化服务（本地 + 云端混合策略）
// 权威版本：主包维护。checkin / extra 子包均复用本模块。
const util = require('./util')
const fs = wx.getFileSystemManager()

// 判断当前是否处于云端登录模式。已登录才尝试上传云存储，未登录只做本地持久化。
function _isCloudMode() {
  return util.isCloudMode()
}

// ─── 补传队列（离线补偿）──────────────────────────────
// 上传失败时不再丢数据：把任务缓存到本地，等网络恢复后由 flushPendingUploads 补传，
// 成功后把 fileID 回写到对应打卡记录，从而保住云文件 id。
const PENDING_UPLOAD_KEY = 'pending_photo_uploads'
let _flushing = false

function _getPendingUploads() {
  const list = util.loadData(PENDING_UPLOAD_KEY, [])
  return Array.isArray(list) ? list : []
}

function _savePendingUploads(list) {
  util.saveData(PENDING_UPLOAD_KEY, list)
}

/**
 * 将一次上传任务加入补传队列（幂等：同 recordId 只保留一条）
 * @param {Object} task { localPath, recordId }
 */
function enqueuePendingUpload(task = {}) {
  if (!task || !task.localPath || !task.recordId) return
  const list = _getPendingUploads().filter(t => String(t.recordId) !== String(task.recordId))
  list.push({ localPath: task.localPath, recordId: task.recordId, createdAt: Date.now() })
  _savePendingUploads(list)
  console.log('[PhotoStorage] 已加入补传队列:', task.recordId)
}

/**
 * 尝试补传队列里的所有待上传图片。
 * 仅云端登录模式且未在刷新中才执行；成功后用 checkinUtil 把 cloudFileID 回写记录。
 * @returns {Promise<number>} 成功补传的条数
 */
async function flushPendingUploads() {
  if (_flushing) return 0
  if (!_isCloudMode()) return 0

  const pending = _getPendingUploads()
  if (pending.length === 0) return 0

  _flushing = true
  const doneIds = new Set()
  let successCount = 0
  try {
    const checkinUtil = require('./checkinUtil')
    // 逐个串行补传，避免并发占用带宽再次触发断连
    for (const task of pending) {
      if (!task.localPath) continue
      try {
        const cloudPath = `checkin/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
        const cloudFileID = await _uploadWithRetry(task.localPath, cloudPath)
        // 回写本地记录（updateCheckinAsync 同时会同步云端文档）
        const record = checkinUtil.updateCheckinAsync(task.recordId, { cloudFileID })
        if (record) {
          // 若本地记录已有关联的云端 _id，则额外用云端 _id 同步 cloudFileID，
          // 确保云端文档不因本地 id 与 _id 不同而漏更。
          if (record._id && cloudFileID) {
            const { checkinRecords } = require('./db/checkinRecords')
            checkinRecords.update(record._id, { cloudFileID }).catch(err => {
              console.warn('[PhotoStorage] 云端文档同步 cloudFileID 失败:', err)
            })
          }
          console.log('[PhotoStorage] 补传成功并回写:', task.recordId, cloudFileID)
          doneIds.add(String(task.recordId))
          successCount += 1
        } else {
          // 记录已被删除，清理该队列条目，避免反复重试
          doneIds.add(String(task.recordId))
        }
      } catch (err) {
        console.warn('[PhotoStorage] 补传仍失败，保留在队列:', task.recordId, err)
      }
    }
    // 只清理已成功回写的条目；失败的保留，下次继续补传
    const stillPending = _getPendingUploads().filter(task => !doneIds.has(String(task.recordId)))
    _savePendingUploads(stillPending)
  } finally {
    _flushing = false
  }
  return successCount
}

/**
 * 压缩图片，减小体积以降低云上传失败的几率。
 * 压缩失败时回退原路径，不影响主流程。
 * @param {string} srcPath
 * @returns {Promise<string>}
 */
function _compressImage(srcPath) {
  return new Promise((resolve) => {
    if (!srcPath || !wx.compressImage) {
      resolve(srcPath)
      return
    }
    wx.compressImage({
      src: srcPath,
      quality: 60,
      success: (res) => {
        resolve((res && res.tempFilePath) || srcPath)
      },
      fail: () => resolve(srcPath)
    })
  })
}

/**
 * 带重试的云上传：ECONNRESET 多为临时网络抖动，重试即可成功。
 * @param {string} localPath - 本地文件路径
 * @param {string} cloudPath - 云存储路径
 * @param {number} maxRetries - 最大重试次数（默认 3）
 * @returns {Promise<string>} 返回 fileID
 */
function _uploadWithRetry(localPath, cloudPath, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      wx.cloud.uploadFile({ cloudPath, filePath: localPath })
        .then(res => resolve(res.fileID))
        .catch(err => {
          if (n < maxRetries) {
            const delay = 800 * Math.pow(2, n)
            console.warn(`[PhotoStorage] 上传失败，${delay}ms 后重试(${n + 1}/${maxRetries})`, err)
            setTimeout(() => attempt(n + 1), delay)
          } else {
            reject(err)
          }
        })
    }
    attempt(0)
  })
}

/**
 * 持久化保存照片：本地 wx.getFileSystemManager().saveFile + 云端 wx.cloud.uploadFile（可选）
 *
 * 策略说明：
 * 1. 先用 saveFile 将临时文件转为小程序沙盒内的持久化文件
 * 2. 如果已登录（云端模式），压缩后带重试上传到云存储获取 fileID
 * 3. 上传仍失败时，把任务记入补传队列，等待网络恢复后补传（不丢云文件 id）
 * 4. 任意一步失败都不影响整体流程，返回已成功的部分
 *
 * @param {string} tempPath - 微信临时文件路径
 * @param {Object} [options]
 * @param {string} [options.recordId] - 关联的打卡记录 id，上传失败时用于补传回写
 * @returns {Promise<{localPath: string, cloudFileID: string}>}
 */
async function persistPhoto(tempPath, options = {}) {
  if (!tempPath) {
    console.warn('[PhotoStorage] tempPath 为空')
    return { localPath: '', cloudFileID: '' }
  }

  let localPath = tempPath   // 保底：原始临时路径
  let cloudFileID = ''

  // Step 1: 本地持久化
  try {
    const savedFilePath = await new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath: tempPath,
        success: (res) => resolve(res.savedFilePath),
        fail: reject,
      })
    })
    localPath = savedFilePath
    console.log('[PhotoStorage] 本地持久化成功:', localPath)
  } catch (err) {
    console.warn('[PhotoStorage] 本地持久化失败，使用原临时路径:', err)
    // localPath 保持 tempPath
  }

  // Step 2: 云端上传（仅登录用户）
  if (_isCloudMode()) {
    // 压缩后上传，减小体积
    const compressedPath = await _compressImage(localPath)
    const cloudPath = `checkin/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
    try {
      cloudFileID = await _uploadWithRetry(compressedPath, cloudPath)
      console.log('[PhotoStorage] 云存储上传成功:', cloudFileID)
    } catch (err) {
      console.warn('[PhotoStorage] 云存储上传失败（已入补传队列，不影响本地保存）:', err)
      // 记录关联 id 时入队补传，网络恢复后自动补传回写
      if (options.recordId) {
        enqueuePendingUpload({ localPath, recordId: options.recordId })
      }
    }
  }

  return { localPath, cloudFileID }
}

/**
 * 获取可展示的图片路径（含降级策略）
 *
 * 降级顺序：
 * 1. photoPath（本地持久路径，最快）
 * 2. cloudFileID（云端 fileID，跨设备）
 * 3. 空字符串（兜底）
 *
 * @param {Object} record - 打卡记录对象
 * @param {string} [record.photoPath]
 * @param {string} [record.cloudFileID]
 * @returns {string}
 */
function getDisplayPath(record) {
  if (!record) return ''
  if (record.photoPath) return record.photoPath
  if (record.cloudFileID) return record.cloudFileID
  return ''
}

module.exports = {
  persistPhoto,
  getDisplayPath,
  enqueuePendingUpload,
  flushPendingUploads,
}
