/**
 * recognizePhoto - 图片识别 AI 调用（云函数）
 *
 * 输入：{ tempURL: string, type: 'food'|'spot' }
 * 输出：{ success, name, desc, error }
 *
 * 使用 ModelScope API（Qwen/Qwen3.5-27B 多模态）
 */
const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ModelScope API 配置（环境变量方式，需在云函数配置中设置）
const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY || 'ms-3abfc141-4dd2-4994-87f2-4a871b0ea9b9'
const MODELSCOPE_BASE_URL = 'https://api-inference.modelscope.cn/v1'

/**
 * 构造 prompt
 */
function buildPrompt(type) {
  if (type === 'spot') {
    return `请仔细看图，识别图片中最主要的景点、建筑或自然风景的特征。按如下JSON格式**只返回纯JSON**，不要任何其他文字：
{
  "name": "形容词加概括性名词（3-8字，如：辽阔的大海、繁华的街景、古典的建筑、宁静的山林、灿烂的花海）",
  "desc": "一句20字以内的场景特色描述"
}
如果图片中没有明显风景或建筑，请描述图片整体的视觉感受，name返回"旅途中的风景"，desc返回对画面基调的简要描述。`
  }

  return `你是一位资深美食博主，擅长识别各种食物与菜品。请仔细看图，识别图片中最主要的一样食物或菜品（如：潮汕牛肉火锅、广式早茶、烧腊、白切鸡、肠粉、煲仔饭、烧鹅、叉烧、点心、糖水、面包、水果、零食、饮料等）。**只识别食物，不要联想地点或背景**。按如下JSON格式**只返回纯JSON**，不要任何其他文字：
{
  "name": "食物名称（尽量具体，如：潮汕牛肉火锅、广式虾饺皇、烧鹅腿、蓝莓、三明治）",
  "desc": "一句30字以内的美食描述，突出口感、色泽或特色，有温度"
}
如果图片中没有明显食物，name返回"美味的食物"，desc返回对画面整体的简要描述。`
}

/**
 * HTTP POST 请求封装（Promise）
 */
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: headers
    }
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => { chunks.push(chunk) })
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString()
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data })
        }
      })
    })
    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })
}

/**
 * 调用 ModelScope API（非流式）
 */
async function callModelScope(tempURL, prompt) {
  const requestBody = {
    model: 'Qwen/Qwen3.5-27B',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: tempURL } },
        { type: 'text', text: prompt }
      ]
    }],
    stream: false
  }

  const res = await httpPost(
    `${MODELSCOPE_BASE_URL}/chat/completions`,
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MODELSCOPE_API_KEY}`
    },
    requestBody
  )

  if (res.statusCode !== 200) {
    throw new Error(`API 返回 ${res.statusCode}: ${JSON.stringify(res.data)}`)
  }

  const content = res.data?.choices?.[0]?.message?.content || ''
  return content
}

/**
 * 解析 AI 返回的 JSON
 */
function parseAIResponse(raw) {
  let clean = raw.trim()
  clean = clean.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean)
}

// ── 主入口 ────────────────────────────────────────
exports.main = async (event, context) => {
  const { tempURL, type = 'food' } = event

  if (!tempURL) {
    return { success: false, error: 'tempURL 不能为空' }
  }

  try {
    const prompt = buildPrompt(type)
    const raw = await callModelScope(tempURL, prompt)
    console.log('[recognizePhoto] AI 返回:', raw)

    const parsed = parseAIResponse(raw)

    return {
      success: true,
      name: (parsed.name || '').trim(),
      desc: (parsed.desc || '').trim()
    }
  } catch (err) {
    console.error('[recognizePhoto] 调用失败:', err)
    return {
      success: false,
      error: err.message || 'AI 识别失败',
      name: '',
      desc: ''
    }
  }
}
