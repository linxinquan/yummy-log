// utils/recognizePhoto.js - 图片识别 AI 调用（纯前端方式）
// 流程：压缩图片 → 上传云存储 → 获取临时URL → 前端 wx.cloud.extend.AI 调用

// 请求版本号：用户更换照片时递增，旧请求自动丢弃
let _requestId = 0

/**
 * 图片识别（ModelScope 多模态，纯前端）
 * @param {string} photoPath - 照片路径
 * @param {'food'|'spot'} type - 识别类型
 * @param {Function} onToken - 可选的流式回调，每次收到新 token 时调用
 * @param {boolean} forceBase64 - 是否强制使用 base64（跳过云存储，方便测试）
 * @returns {Promise<{name: string, desc: string}>}
 */
async function recognizePhoto(photoPath, type, onToken = null, forceBase64 = false) {
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
        // 获取压缩后文件大小
        wx.getFileSystemManager().getFileInfo({
          filePath: res.tempFilePath,
          success: (info) => {
            console.log('[Recognize] 压缩后路径:', res.tempFilePath, '大小:', (info.size / 1024).toFixed(1) + 'KB')
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
    // 测试模式：强制使用 base64，跳过云存储
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
    // 正常模式：先尝试云存储，失败则降级为 base64
    const cloudPath = `recognize_tmp/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    let fileID = null

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: compressedPath
      })
      fileID = uploadRes.fileID
      console.log('[Recognize] 图片上传成功:', fileID)

      // 获取临时访问链接
      const tempURLRes = await wx.cloud.getTempFileURL({ fileList: [fileID] })
      tempURL = tempURLRes.fileList[0]?.tempFileURL
      if (!tempURL) throw new Error('获取临时链接失败')
      console.log('[Recognize] 临时链接:', tempURL)
    } catch (e) {
      console.warn('[Recognize] 云存储上传失败，降级为 base64:', e)
      // 降级方案：直接读取本地图片转 base64
      const base64 = await new Promise((resolve, reject) => {
        wx.getFileSystemManager().readFile({
          filePath: compressedPath,
          encoding: 'base64',
          success: (res) => resolve(res.data),
          fail: (err) => reject(err)
        })
      })
      tempURL = `data:image/jpeg;base64,${base64}`
      console.log('[Recognize] base64 图片就绪')
    }
  }

  // Step 2: 构造 prompt
  const prompt = type === 'spot'
    ? `请仔细看图，识别图片中最主要的景点、建筑或自然风景的特征。按如下JSON格式**只返回纯JSON**，不要任何其他文字：
{
  "name": "形容词加概括性名词（3-8字，如：辽阔的大海、繁华的街景、古典的建筑、宁静的山林、灿烂的花海）",
  "desc": "一句20字以内的场景特色描述"
}
如果图片中没有明显风景或建筑，请描述图片整体的视觉感受，name返回"旅途中的风景"，desc返回对画面基调的简要描述。`
    : `你是一位资深美食博主，擅长识别各种食物与菜品。请仔细看图，识别图片中最主要的一样食物或菜品（如：潮汕牛肉火锅、广式早茶、烧腊、白切鸡、肠粉、煲仔饭、烧鹅、叉烧、点心、糖水、面包、水果、零食、饮料等）。**只识别食物，不要联想地点或背景**。按如下JSON格式**只返回纯JSON**，不要任何其他文字：
{
  "name": "食物名称（尽量具体，如：潮汕牛肉火锅、广式虾饺皇、烧鹅腿、蓝莓、三明治）",
  "desc": "一句30字以内的美食描述，突出口感、色泽或特色，有温度"
}
如果图片中没有明显食物，name返回"美味的食物"，desc返回对画面整体的简要描述。`

  // Step 3: 纯前端调用 AI（wx.cloud.extend.AI，无需云函数）
  console.log('[Recognize] 开始调用 AI...')
  const ai = wx.cloud.extend.AI
  const model = ai.createModel('modelscope-custom')  // modelscope-custom 需在 CloudBase 控制台配置

  let fullContent = ''
  const res = await model.streamText({
    data: {
      model: 'Qwen/Qwen3.5-27B',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: tempURL } },
          { type: 'text', text: prompt }
        ]
      }]
    }
  })

  for await (let event of res.eventStream) {
    // 请求已被新照片替换，直接退出
    if (currentRequestId !== _requestId) {
      console.log('[Recognize] 请求已过时，丢弃结果')
      return
    }
    if (event.data === '[DONE]') break
    const data = JSON.parse(event.data)
    const text = data?.choices?.[0]?.delta?.content
    if (text) {
      fullContent += text
      // 如果有流式回调，实时返回 token
      if (onToken && typeof onToken === 'function') {
        onToken(text, fullContent)
      }
    }
  }

  // 最终检查，防止最后一批数据是旧请求的
  if (currentRequestId !== _requestId) {
    console.log('[Recognize] 最终检查：请求已过时，丢弃结果')
    return
  }

  console.log('[Recognize] AI 返回:', fullContent)

  // Step 4: 解析 JSON
  const clean = fullContent.trim()
    .replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(clean)

  return {
    name: (parsed.name || '').trim(),
    desc: (parsed.desc || '').trim()
  }
}

module.exports = { recognizePhoto }

