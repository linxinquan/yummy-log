// utils/recognizePhoto.js - 图片识别 AI 调用（前端 → 云函数）
// 流程：压缩图片 → 上传云存储 → 获取临时URL → 调用云函数 recognizePhoto

// 请求版本号：用户更换照片时递增，旧请求自动丢弃
let _requestId = 0
const forceBase64 = false;
/**
 * 图片识别（通过云函数 recognizePhoto 调用 AI）
 * @param {string} photoPath - 照片路径
 * @param {boolean} forceBase64 - 是否强制使用 base64（跳过云存储，方便测试）
 * @returns {Promise<{name: string, desc: string}>}
 */
async function recognizePhoto(photoPath) {
  if (!photoPath) throw new Error('photoPath 不能为空')

  // 递增请求版本号，后续判断是否过期
  const currentRequestId = ++_requestId
  console.log('[Recognize] 请求版本:', currentRequestId, forceBase64 ? '(强制 base64)' : '')

  // Step 0: 压缩图片（避免 API 请求超限，目标 < 200KB）
  console.log('[Recognize] 原图路径:', photoPath)
  const compressedPath = await new Promise((resolve) => {
    wx.compressImage({
      src: photoPath,
      quality: 20,
      width: 800,
      compressedWidth: 800,
      compressedHeight: 800,
      success: (res) => {
        wx.getFileSystemManager().getFileInfo({
          filePath: res.tempFilePath,
          success: (info) => {
            console.log('[Recognize] 压缩后路径:' + res.tempFilePath + '大小:' + (info.size / 1024).toFixed(1) + 'KB')
          },
          fail: () => {
            console.log('[Recognize] 压缩后路径:', res.tempFilePath)
          }
        })
        resolve(res.tempFilePath)
      },
      fail: (err) => {
        console.error('[Recognize] 压缩失败，使用原图:', err)
        resolve(photoPath)
      }
    })
  })

  // Step 1: 获取图片 URL（云存储或 base64）
  let tempURL = null
  
  if (forceBase64) {
    console.log('[Recognize] 强制使用 base64 模式...')
    const base64 = await new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: compressedPath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: (err) => reject(err)
      })
    })
    tempURL = `data:image/jpeg;base64,${base64}`
    console.log('[Recognize] base64 图片就绪，长度:', base64.length)
  } else {
    const cloudPath = `recognize_tmp/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    try {
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: compressedPath })
      const fileID = uploadRes.fileID
      console.log('[Recognize] 图片上传成功:', fileID)
      const tempURLRes = await wx.cloud.getTempFileURL({ fileList: [fileID] })
      tempURL = tempURLRes.fileList[0]?.tempFileURL
      if (!tempURL) throw new Error('获取临时链接失败')
      console.log('[Recognize] 临时链接:', tempURL)
    } catch (e) {
      console.warn('[Recognize] 云存储上传失败，降级为 base64:', e)
      const base64 = await new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: compressedPath,
          encoding: 'base64',
          success: (res) => resolve(res.data),
          fail: (err) => reject(err)
        })
      })
      tempURL = `data:image/jpeg;base64,${base64}`
    }
  }

  // Step 2: 调用云函数 recognizePhoto
  console.log('[Recognize] 调用云函数 recognizePhoto...')
  const res = await wx.cloud.callFunction({
    name: 'recognizePhoto',
    data: { tempURL }
  })

  // 最终检查，防止是旧请求的响应
  if (currentRequestId !== _requestId) {
    console.log('[Recognize] 请求已过时，丢弃结果')
    return
  }

  const result = res.result || {}
  if (!result.success) {
    throw new Error(result.error || '云函数调用失败')
  }

  console.log('[Recognize] AI 返回:', result.name, result.desc)
  return {
    name: (result.name || '').trim(),
    desc: (result.desc || '').trim()
  }
}

/**
 * 生成AI打卡内容（包装 recognizePhoto，返回标准化格式）
 * @param {string} photoPath - 照片路径
 * @returns {Promise<{success: boolean, title: string, description: string}>}
 */
async function generateAIContent(photoPath) {
  try {
    const result = await recognizePhoto(photoPath)
    return {
      success: true,
      title: result.name || '',
      description: result.desc || '',
      type: result.type || ''
    }
  } catch (err) {
    console.error('[generateAIContent] 失败:', err)
    return { success: false, title: '', description: '' }
  }
}

module.exports = { recognizePhoto, generateAIContent }

