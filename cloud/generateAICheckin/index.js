/**
 * generateAICheckin - 混元 AI 生成打卡内容
 *
 * 输入：{ spotName, address, type ('food'|'spot'), city, region }
 * 输出：{ title, description }
 *
 * 微信云开发标准写法，使用 wx-server-sdk + cloud.cloud.ai
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ── 构建 Prompt ───────────────────────────────
function buildPrompt(spotName, address, type, city, region) {
  const cityRegion = region || city
  const typeLabel = type === 'spot' ? '景点' : '美食'
  const hour = new Date().getHours()
  const timeLabel = hour < 9 ? '清晨' : hour < 12 ? '上午' : hour < 14 ? '中午' : hour < 17 ? '下午' : hour < 20 ? '傍晚' : '夜晚'

  const systemPrompt = `你是一个温暖有趣的生活方式记录者，擅长为用户的旅行/美食打卡生成富有故事感的短文案。

风格要求：
- 像朋友发朋友圈一样自然、有温度，不要营销腔
- 融入时间、氛围、环境细节
- 美食类：突出香气、口感、治愈感
- 景点类：突出画面感、时空感、回忆感
- 避免："来到这里""打卡成功""推荐给大家"等空话
- 标题15字以内，要有记忆点，让人想点进来
- 正文60字以内，要有画面感，让人仿佛身临其境
- 结尾可用 emoji 点缀但不要滥用`

  const userPrompt = `请为以下${typeLabel}生成一段打卡文案：

- 地点：${spotName || '未知地点'}
- 地址：${address || '未知地址'}
- 城市：${city}
- 类型：${typeLabel}
- 当前时段：${timeLabel}

请严格按以下 JSON 格式返回（只返回 JSON，不要任何其他内容）：
{
  "title": "标题（15字以内，有记忆点）",
  "description": "正文描述（60字以内，有画面感，融入${timeLabel}的时间氛围，自然带出地点特色）"
}`

  return { systemPrompt, userPrompt }
}

// ── 解析 AI 返回的 JSON ───────────────────────
function parseAIResponse(raw) {
  let clean = raw.trim()
  if (clean.startsWith('```json')) clean = clean.slice(7)
  else if (clean.startsWith('```')) clean = clean.slice(3)
  if (clean.endsWith('```')) clean = clean.slice(0, -3)
  return JSON.parse(clean.trim())
}

// ── 主入口 ───────────────────────────────────
exports.main = async (event, context) => {
  const { spotName = '', address = '', type = 'food', city = '深圳', region = '' } = event
  const { systemPrompt, userPrompt } = buildPrompt(spotName, address, type, city, region)

  try {
    const res = await cloud.cloud.ai.model.generateText({
      model: 'hunyuan-2.0-instruct-20251111',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 300
    })

    const raw = res?.choices?.[0]?.message?.content || ''
    const parsed = parseAIResponse(raw)

    return {
      success: true,
      title: parsed.title || `${spotName || city}打卡`,
      description: parsed.description || '',
      model: 'hunyuan-2.0-instruct-20251111'
    }
  } catch (err) {
    console.error('[generateAICheckin] 调用失败:', err)

    // 兜底内容
    const cityRegion = region || city
    const isSpot = type === 'spot'
    const hour = new Date().getHours()
    const timeWords = ['清晨微凉', '阳光正好', '午后时光', '傍晚时分', '夜色温柔']
    const timeWord = timeWords[Math.floor(hour / 5)] || '时光'

    const fallbackTitles = isSpot
      ? ['🏛 城市漫游', '📍 发现角落', '🌿 安静角落', '✨ 值得一去', '🏙 光影记录']
      : ['🍽 觅食记录', '😋 吃到了！', '🌟 推荐打卡', '🥢 私藏小店', '🍜 满足的一餐']

    const fallbackDescs = isSpot
      ? [
          `${timeWord}路过${spotName || cityRegion}，这里的空气里有故事。`,
          `${spotName || cityRegion}有一种让人慢下来的力量。`,
          `${timeWord}，在${spotName || cityRegion}找到了意外的惊喜。`
        ]
      : [
          `${timeWord}，在${spotName || cityRegion}尝到了让人满足的味道。`,
          `${spotName || cityRegion}的出品有惊喜，值得记一笔。`,
          `${timeWord}，一碗一筷，都是生活的味道。`
        ]

    const idx = Math.floor(Math.random() * fallbackTitles.length)
    return {
      success: false,
      title: fallbackTitles[idx],
      description: fallbackDescs[idx],
      fromCache: true
    }
  }
}
