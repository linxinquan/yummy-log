// utils/recognizeFood.js - 图片识别 AI 调用（纯前端方式）
// 流程：压缩图片 → 上传云存储 → 获取临时URL → 前端 wx.cloud.extend.AI 调用

/**
 * 图片识别（ModelScope 多模态，纯前端）
 * @param {string} photoPath - 照片路径
 * @param {'food'|'spot'} type - 识别类型
 * @returns {Promise<{name: string, desc: string}>}
 */
async function recognizePhoto(photoPath, type) {
  if (!photoPath) throw new Error('photoPath 不能为空')

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
        console.log('[Recognize] 压缩后路径:', res.tempFilePath)
        resolve(res.tempFilePath)
      },
      fail: (err) => {
        console.error('[Recognize] 压缩失败，使用原图:', err)
        resolve(photoPath)
      }
    })
  })

  // Step 1: 上传到云存储
  const cloudPath = `recognize_tmp/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const uploadRes = await wx.cloud.uploadFile({
    cloudPath,
    filePath: compressedPath
  })
  const fileID = uploadRes.fileID
  console.log('[Recognize] 图片上传成功:', fileID)

  // Step 2: 获取临时访问链接
  const tempURLRes = await wx.cloud.getTempFileURL({ fileList: [fileID] })
  const tempURL = tempURLRes.fileList[0]?.tempFileURL
  if (!tempURL) throw new Error('获取临时链接失败')
  console.log('[Recognize] 临时链接:', tempURL)

  // Step 3: 构造 prompt
  const prompt = type === 'spot'
    ? `你是一位深圳本地导游专家。请仔细看图，识别图片中最主要的深圳景点或城市地标（如：深圳湾公园、华侨城、海上世界、梧桐山、南头古城等深圳标志性地点），只返回最主要的这一个。按如下JSON格式**只返回纯JSON**，不要任何其他文字：
{
  "name": "景点或地标名称",
  "desc": "一句20字以内的景点特色描述"
}
如果图片中没有明显景点或地标，name返回空字符串，desc返回空字符串。`
    : `你是一位资深美食博主，擅长识别各种食物与菜品。请仔细看图，识别图片中最主要的一样食物或菜品（如：潮汕牛肉火锅、广式早茶、烧腊、白切鸡、肠粉、煲仔饭、烧鹅、叉烧、点心、糖水、面包、水果、零食、饮料等）。**只识别食物，不要联想地点或背景**。按如下JSON格式**只返回纯JSON**，不要任何其他文字：
{
  "name": "食物名称（尽量具体，如：潮汕牛肉火锅、广式虾饺皇、烧鹅腿、蓝莓、三明治）",
  "desc": "一句20字以内的美食描述，突出口感、色泽或特色，有温度"
}
如果图片中没有明显食物，name返回空字符串，desc返回空字符串。`

  // Step 4: 纯前端调用 AI（wx.cloud.extend.AI，无需云函数）
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
    if (event.data === '[DONE]') break
    const data = JSON.parse(event.data)
    const text = data?.choices?.[0]?.delta?.content
    if (text) fullContent += text
  }

  console.log('[Recognize] AI 返回:', fullContent)

  // Step 5: 解析 JSON
  const clean = fullContent.trim()
    .replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
  const parsed = JSON.parse(clean)

  return {
    name: (parsed.name || '').trim(),
    desc: (parsed.desc || '').trim()
  }
}

module.exports = { recognizePhoto }
