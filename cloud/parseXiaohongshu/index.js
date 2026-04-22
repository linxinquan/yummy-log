/**
 * parseXiaohongshu - AI 解析小红书 URL 内容
 *
 * 输入：{ url: string }
 * 输出：{ success, shops[], error }
 *
 * 使用混元 AI 从小红书内容中提取地点/店铺信息
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ── 小红书 URL 检测正则 ────────────────────────────
const XHS_URL_REG = /(?:xigua|xhslink|xiaohongshu|xhs)\.(?:com|app|cn)\/[\w\-\./?=&#]+/gi

// ── 构建 Prompt ───────────────────────────────────
function buildPrompt(content) {
  const systemPrompt = `你是专业的地点信息提取专家，擅长从各类内容中精准提取地点/店铺信息。

核心能力：
- 从游记、攻略、分享帖中提取具体的店铺或地点名称
- 识别地址中的关键信息（路名、区域、城市）
- 区分真实地点和模糊描述（如"附近"、"周边"）

输出规范：
- 只提取具体可查找的地点/店铺名称
- 返回 JSON 数组格式，每个元素包含：name（名称）、address（地址，可为空）
- 如果内容中找不到有效地点，返回空数组 []
- 最多返回 20 个地点
- 地点名称尽量简洁，去除emoji和冗余描述

禁止出现：
❌ 模糊描述（如"附近的店"、"这个地方"）
❌ 非地点内容（如心情描述、话题标签）
❌ 重复的地点（去重处理）`

  const userPrompt = `请从以下小红书内容中提取所有具体的地点或店铺信息：

---
${content}
---

请严格按以下 JSON 格式返回（只返回 JSON，无其他内容）：
{
  "shops": [
    {"name": "店铺/地点名称", "address": "详细地址（可为空字符串）"},
    ...
  ]
}`

  return { systemPrompt, userPrompt }
}

// ── 解析 AI 返回的 JSON ────────────────────────────
function parseAIResponse(raw) {
  let clean = raw.trim()
  if (clean.startsWith('```json')) clean = clean.slice(7)
  else if (clean.startsWith('```')) clean = clean.slice(3)
  if (clean.endsWith('```')) clean = clean.slice(0, -3)
  return JSON.parse(clean.trim())
}

// ── 提取 URL 中的内容 ──────────────────────────────
function extractXiaohongshuContent(url) {
  // 小红书分享链接通常包含笔记ID
  // 格式如：xhs.cn/posts/xxx 或 xhslink.com/xxx
  const match = url.match(/(?:posts|note|discovery)\/([a-zA-Z0-9]+)/i)
  if (match) {
    return `这是一篇小红书笔记，笔记ID：${match[1]}。内容来自用户分享的美食/旅行打卡攻略。`
  }
  return `这是一篇来自小红书分享链接的内容。`
}

// ── 主入口 ────────────────────────────────────────
exports.main = async (event, context) => {
  const { url = '' } = event

  // 检测是否是小红书 URL
  if (!url || !XHS_URL_REG.test(url)) {
    return {
      success: false,
      error: '不是有效的小红书链接',
      shops: []
    }
  }

  // 提取 URL 中的笔记标识
  const content = extractXiaohongshuContent(url)
  const { systemPrompt, userPrompt } = buildPrompt(content)

  try {
    const res = await cloud.cloud.ai.model.generateText({
      model: 'hunyuan-2.0-instruct-20251111',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    })

    const raw = res?.choices?.[0]?.message?.content || ''
    const parsed = parseAIResponse(raw)

    return {
      success: true,
      shops: parsed.shops || [],
      model: 'hunyuan-2.0-instruct-20251111',
      url: url
    }
  } catch (err) {
    console.error('[parseXiaohongshu] 调用失败:', err)

    // 兜底：返回空结果，提示用户手动输入
    return {
      success: false,
      error: '解析失败，请尝试手动输入攻略',
      shops: [],
      fromCache: true
    }
  }
}
