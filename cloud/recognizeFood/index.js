/**
 * recognizeFood - AI图片识别云函数
 * 输入：{ cloudPath, type ('food'|'spot') }
 * 输出：{ success, name, desc }
 *
 * 方案：axios + TC3签名 直调腾讯云混元视觉 API
 * API地址：https://hunyuan.cloud.tencent.com/hunyuan/
 *
 * COS 存储桶：metour-1322296918（公有读私有写）
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ── COS 公有读 URL ────────────────────────────────────────
const COS_BUCKET = 'metour-1322296918'
const COS_REGION = 'ap-guangzhou'

// ── 腾讯云凭证（来自云函数环境变量）────────────────────────
const SECRET_ID  = process.env.TENCENT_CLOUD_SECRET_ID  || ''
const SECRET_KEY = process.env.TENCENT_CLOUD_SECRET_KEY || ''
const APPID      = process.env.TENCENTCLOUD_APPID       || ''

// ── API 常量（腾讯云混元视觉）─────────────────────────────
const HOST    = 'hunyuan.tencentcloudapi.com'  // 腾讯云 API Gateway（正确地址）
const PATH    = '/'                             // 规范路径（不是 /hunyuan/）
const SERVICE = 'hunyuan'
const ACTION  = 'InvokeModel'
const VERSION = '2023-09-01'

// ── TC3 签名 ─────────────────────────────────────────────
const crypto = require('crypto')

function tc3sign(secretKey, date, service, str2sign) {
  const kDate    = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest('hex')
  const kService = crypto.createHmac('sha256', kDate).update(service).digest('hex')
  const kSign    = crypto.createHmac('sha256', kService).update('tc3_request').digest('hex')
  return crypto.createHmac('sha256', kSign).update(str2sign).digest('hex')
}

// ── 调用混元视觉 API ──────────────────────────────────────
async function callHunyuan(imageUrl, prompt) {
  const axios  = require('axios')
  const now     = new Date()
  const date    = now.toISOString().slice(0, 10)           // YYYY-MM-DD
  const datetime = now.toISOString().replace('.000Z', 'Z').replace(/[:-]/g, '') // 20210412T030910Z
  const timestamp = String(Math.floor(now.getTime() / 1000))

  const payload = JSON.stringify({
    Model: 'hunyuan-vision',
    Input: {
      Messages: [{
        Role: 'user',
        Content: [
          { Type: 'image_url', ImageUrl: { Url: imageUrl } },
          { Type: 'text',      Text: prompt }
        ]
      }]
    }
  })

  const hashedPayload     = crypto.createHash('sha256').update(payload).digest('hex')
  const httpRequestMethod = 'POST'
  const canonicalQuery    = ''
  const canonicalHeaders  = `content-type:application/json\nhost:${HOST}\n`
  const signedHeaders     = 'content-type;host'

  const canonicalRequest = [
    httpRequestMethod, PATH, canonicalQuery,
    canonicalHeaders, signedHeaders, hashedPayload
  ].join('\n')

  const credentialScope = `${date}/${SERVICE}/tc3_request`
  const hashedRequest   = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const string2sign = [
    'TC3-HMAC-SHA256', datetime, credentialScope, hashedRequest
  ].join('\n')

  const signature    = tc3sign(SECRET_KEY, date, SERVICE, string2sign)
  const authorization = 'TC3-HMAC-SHA256 ' +
    `Credential=${SECRET_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`

  console.log('[recognizeFood] 请求地址: https://' + HOST + PATH + '?Action=' + ACTION)
  console.log('[recognizeFood] datetime:', datetime, 'date:', date)

  const res = await axios.post(`https://${HOST}${PATH}`, payload, {
    params: { Action: ACTION, Version: VERSION },
    headers: {
      'Authorization':  authorization,
      'Content-Type':   'application/json',
      'Host':           HOST,
      'X-TC-Action':    ACTION,
      'X-TC-Version':   VERSION,
      'X-TC-Timestamp': timestamp,
      'X-TC-Region':   COS_REGION,
      ...(APPID ? { 'X-TC-Appid': APPID } : {})
    },
    timeout: 25000
  })

  return res.data
}

// ── 主入口 ───────────────────────────────────────────────
exports.main = async (event, context) => {
  const { cloudPath, type = 'food' } = event

  if (!cloudPath) {
    return { success: false, name: '', desc: '', error: 'cloudPath missing' }
  }

  const imageUrl = `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com/${cloudPath}`
  console.log('[recognizeFood] 图片URL:', imageUrl)
  console.log('[recognizeFood] 类型:', type)
  console.log('[recognizeFood] SecretId前4位:', SECRET_ID.slice(0, 4))

  // ── 构造 prompt ────────────────────────────────────────
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

  try {
    const res = await callHunyuan(imageUrl, prompt)
    console.log('[recognizeFood] API返回:', JSON.stringify(res).slice(0, 500))

    // 腾讯云混元 API 返回格式：{ Response: { Choices: [{ Message: { Content: '{"name":...}' } }] } }
    const choices = res?.Response?.Choices
    if (!choices || !Array.isArray(choices) || choices.length === 0) {
      const errMsg = JSON.stringify(res).slice(0, 200)
      console.error('[recognizeFood] API返回格式异常:', errMsg)
      return { success: false, name: '', desc: '', error: 'api response abnormal: ' + errMsg }
    }

    const raw = choices[0]?.Message?.Content || ''
    console.log('[recognizeFood] 原始结果:', raw.slice(0, 300))

    const clean = raw.trim()
      .replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch (e) {
      console.error('[recognizeFood] JSON解析失败:', e.message, 'raw:', raw.slice(0, 100))
      return { success: false, name: '', desc: '', error: 'json parse failed: ' + raw.slice(0, 80) }
    }

    return {
      success: true,
      name: (parsed.name || '').trim(),
      desc: (parsed.desc || '').trim()
    }

  } catch (err) {
    const msg = err?.response?.data
      ? JSON.stringify(err.response.data).slice(0, 300)
      : (err?.message || JSON.stringify(err)).slice(0, 300)
    console.error('[recognizeFood] 调用失败:', msg)
    return { success: false, name: '', desc: '', error: msg }
  }
}
