// utils/photoStorage.js - 图片持久化服务（本地 + 云端混合策略）
const util = require('./util')
const fs = wx.getFileSystemManager()

function _isCloudMode() {
  return util.isCloudMode()
}

/**
 * 持久化保存照片：本地 wx.getFileSystemManager().saveFile + 云端 wx.cloud.uploadFile（可选）
 *
 * 策略说明：
 * 1. 先用 saveFile 将临时文件转为小程序沙盒内的持久化文件
 * 2. 如果已登录（云端模式），再异步上传到云存储获取 fileID
 * 3. 任意一步失败都不影响整体流程，返回已成功的部分
 *
 * @param {string} tempPath - 微信临时文件路径
 * @returns {Promise<{localPath: string, cloudFileID: string}>}
 */
async function persistPhoto(tempPath) {
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
    try {
      const cloudPath = `checkin/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath,
      })
      cloudFileID = uploadRes.fileID
      console.log('[PhotoStorage] 云存储上传成功:', cloudFileID)
    } catch (err) {
      console.warn('[PhotoStorage] 云存储上传失败（不影响本地保存）:', err)
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

module.exports = { persistPhoto, getDisplayPath }
