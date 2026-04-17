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
function buildPrompt(spotName, address, type, city, region, timeSlot) {
  const cityRegion = region || city
  const typeLabel = type === 'spot' ? '景点' : '美食'

  const systemPrompt = `你是「资深美食/生活记录者」，笔触精致而有温度。

核心原则：
- 写作风格：诗意、轻盈、带有淡淡的感叹感，像资深文人写美食札记
- 描述对象：聚焦食物/风味本身的感官细节，或场景的诗意氛围
- 标题：10-14字，有记忆点，画面感强，可用1个emoji点缀
- 正文：严格控制在25-35字，两端对齐，有韵律感，像朋友圈高赞文案
- 美食类：香气、鲜味、舌尖触感、生活气息优先，避免"打卡""推荐"等词
- 景点类：光影、时空感、城市肌理优先，避免"值得一去""很美"等空泛词

禁止出现：
❌ 口语化表达（如"真的太好吃了""超级推荐"）
❌ 无关信息（行政区划、距离描述）
❌ 过长描述（正文超过35字即失败）
❌ "来到这里""打卡成功""今天来"等流水账开头`

  const userPrompt = `地点：${spotName || '未知地点'}
地址：${address || '未知'}
城市：${city}
类型：${typeLabel}
时段：${timeSlot || '日常'}

请严格按以下 JSON 格式返回（只返回 JSON，无其他内容）：
{
  "title": "10-14字，有画面感，1个emoji",
  "description": "25-35字，诗意轻盈，两端对齐，结尾带感叹感"
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

// ── 时段辅助 ─────────────────────────────────
function getTimeSlot(hour) {
  if (hour < 6)  return '凌晨时分'
  if (hour < 9)  return '清晨'
  if (hour < 12) return '上午'
  if (hour < 14) return '午间'
  if (hour < 17) return '午后'
  if (hour < 20) return '傍晚'
  if (hour < 23) return '夜晚'
  return '深夜'
}

// ── 主入口 ───────────────────────────────────
exports.main = async (event, context) => {
  const { spotName = '', address = '', type = 'food', city = '深圳', region = '' } = event
  const hour = new Date().getHours()
  const timeSlot = getTimeSlot(hour)
  const { systemPrompt, userPrompt } = buildPrompt(spotName, address, type, city, region, timeSlot)

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
      model: 'hunyuan-2.0-instruct-20251111',
      timeSlot
    }
  } catch (err) {
    console.error('[generateAICheckin] 调用失败:', err)

    // 诗意兜底：资深美食记录者风格
    const isFood = type !== 'spot'
    const name = spotName || city

    const fallbackTitles = isFood
      ? [
          `🍜 鲜香一刻｜${name}`,
          `😋 落胃时光｜${name}`,
          `🥢 食遇记｜${name}`,
          `🍽 风味人间｜${name}`,
          `✨ 一口入魂｜${name}`
        ]
      : [
          `🏛 城市漫游｜${name}`,
          `📍 片刻宁静｜${name}`,
          `✨ 意料之外｜${name}`,
          `🏙 光影札记｜${name}`
        ]

    // 25-35字，诗意，结尾感叹感，避免口语
    const fallbackDescs = isFood
      ? [
          `${timeSlot}路过${name}，肠粉蒸气升腾，一口鲜滑，是打工人的治愈时刻。`,
          `${name}的汤头清澈，鲜味却浓，胃里落定，心里也暖了起来。`,
          `${timeSlot}，一碗热汤下肚，城市的忙碌忽然变得可以忍受。`,
          `${name}的出品有惊喜，香气从路口就能捕捉到。`,
          `${timeSlot}的光落在${name}，筷起筷落，是认真生活的证据。`
        ]
      : [
          `${timeSlot}走进${name}，城市的喧哗在这里忽然安静下来。`,
          `${name}有一种魔力，让人不由得放慢了脚步。`,
          `${timeSlot}的光影落在${name}，像一帧老电影。`,
          `${timeSlot}，在${name}找到了属于自己的城市角落。`
        ]

    const idx = Math.floor(Math.random() * fallbackTitles.length)
    return {
      success: false,
      title: fallbackTitles[idx],
      description: fallbackDescs[idx],
      fromCache: true,
      timeSlot
    }
  }
}
