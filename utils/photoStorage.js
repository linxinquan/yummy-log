// utils/photoStorage.js - 主包可复用的图片持久化服务
const util = require('./util')
const fs = wx.getFileSystemManager()

// 统一判断当前是否处于云端登录模式。
// 已登录时才尝试上传云存储，未登录只做本地持久化。
function isCloudMode() {
  return util.isCloudMode()
}

/**
 * 持久化保存图片：先保存到本地沙盒，再按需上传到云端。
 * 这样“我的”页这类主包页面也能安全复用，不再依赖分包工具文件。
 * @param {string} tempPath 微信临时文件路径
 * @returns {Promise<{localPath: string, cloudFileID: string}>}
 */
async function persistPhoto(tempPath) {
  if (!tempPath) {
    return { localPath: '', cloudFileID: '' }
  }

  let localPath = tempPath
  let cloudFileID = ''

  // 先把临时图片保存到小程序沙盒，避免临时路径失效。
  try {
    const savedFilePath = await new Promise((resolve, reject) => {
      fs.saveFile({
        tempFilePath: tempPath,
        success: (res) => resolve(res.savedFilePath),
        fail: reject
      })
    })
    localPath = savedFilePath
  } catch (error) {
    console.warn('[photoStorage] 本地持久化失败，继续使用临时路径:', error)
  }

  // 只有登录态才上传云端，避免未登录场景下无意义调用云能力。
  if (isCloudMode()) {
    try {
      const cloudPath = `checkin/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath
      })
      cloudFileID = uploadResult.fileID || ''
    } catch (error) {
      console.warn('[photoStorage] 云端上传失败，保留本地图片:', error)
    }
  }

  return { localPath, cloudFileID }
}

/**
 * 统一返回页面可直接展示的图片路径。
 * 优先用本地持久化路径，其次用云端 fileID。
 * @param {Object} record 图片记录对象
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
  getDisplayPath
}
