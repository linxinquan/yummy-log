const cloud = require('wx-server-sdk')
const http = require('http')
const https = require('https')
const zlib = require('zlib')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 把响应体按 gzip / br / deflate 自动解压。
function decodeResponseBuffer(buffer, encoding = '') {
  const safeEncoding = String(encoding || '').toLowerCase()
  if (!safeEncoding) return buffer.toString('utf8')

  try {
    if (safeEncoding.includes('gzip')) {
      return zlib.gunzipSync(buffer).toString('utf8')
    }
    if (safeEncoding.includes('deflate')) {
      return zlib.inflateSync(buffer).toString('utf8')
    }
    if (safeEncoding.includes('br') && zlib.brotliDecompressSync) {
      return zlib.brotliDecompressSync(buffer).toString('utf8')
    }
  } catch (error) {
    console.error('[extractRouteFromLink] 解压失败，改用原始内容:', error)
  }

  return buffer.toString('utf8')
}

// 服务端请求网页，并自动跟随跳转。
function requestPage(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('链接跳转次数过多'))
      return
    }

    const parsedUrl = new URL(targetUrl)
    const client = parsedUrl.protocol === 'http:' ? http : https
    const request = client.request(parsedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      }
    }, (response) => {
      const statusCode = response.statusCode || 0
      const location = response.headers && response.headers.location

      // 301/302/307 等跳转，继续追到最终网页。
      if (statusCode >= 300 && statusCode < 400 && location) {
        const nextUrl = new URL(location, targetUrl).toString()
        resolve(requestPage(nextUrl, redirectCount + 1))
        return
      }

      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const html = decodeResponseBuffer(buffer, response.headers && response.headers['content-encoding'])
        resolve({
          finalUrl: targetUrl,
          statusCode,
          html,
          headers: response.headers || {}
        })
      })
    })

    request.on('error', reject)
    request.setTimeout(12000, () => {
      request.destroy(new Error('请求超时'))
    })
    request.end()
  })
}

// 提取 meta 标签内容。
function extractMeta(html = '', attrName = '', attrValue = '') {
  const pattern = new RegExp(
    `<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    'i'
  )
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attrName}=["']${attrValue}["'][^>]*>`,
    'i'
  )
  const match = html.match(pattern) || html.match(reversePattern)
  return match ? decodeHtml(match[1]) : ''
}

// 把 HTML 文本转成普通字符串。
function decodeHtml(text = '') {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

// 清理 HTML，尽量保留正文内容。
function stripHtml(html = '') {
  return decodeHtml(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function trimTextLength(text = '', maxLength = 8000) {
  const safeText = String(text || '').trim()
  if (safeText.length <= maxLength) return safeText
  return safeText.slice(0, maxLength)
}

// 公众号页面正文提取：优先抓 js_content。
function extractWechatArticle(html = '') {
  const title = extractMeta(html, 'property', 'og:title')
    || extractMeta(html, 'name', 'twitter:title')
    || ((html.match(/var\s+msg_title\s*=\s*'([\s\S]*?)'/) || [])[1] || '')
  const desc = extractMeta(html, 'property', 'og:description')
    || ((html.match(/var\s+msg_desc\s*=\s*'([\s\S]*?)'/) || [])[1] || '')
  const contentMatch = html.match(/<div[^>]+id=["']js_content["'][^>]*>([\s\S]*?)<\/div>/i)
  const content = contentMatch ? stripHtml(contentMatch[1]) : ''
  return {
    sourceType: 'wechat',
    title: decodeHtml(title),
    description: decodeHtml(desc),
    text: trimTextLength([title, desc, content].filter(Boolean).join('\n\n'))
  }
}

// 小红书页面提取：优先读 og / description，正文抓页面可见文本兜底。
function extractXiaohongshuArticle(html = '') {
  const title = extractMeta(html, 'property', 'og:title')
    || extractMeta(html, 'name', 'title')
  const desc = extractMeta(html, 'property', 'og:description')
    || extractMeta(html, 'name', 'description')
  const articleText = stripHtml(html)
  return {
    sourceType: 'xiaohongshu',
    title,
    description: desc,
    text: trimTextLength([title, desc, articleText].filter(Boolean).join('\n\n'))
  }
}

// 兜底通用网页提取。
function extractGenericArticle(html = '') {
  const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim()
  const desc = extractMeta(html, 'name', 'description')
    || extractMeta(html, 'property', 'og:description')
  const text = stripHtml(html)
  return {
    sourceType: 'generic',
    title: decodeHtml(title),
    description: desc,
    text: trimTextLength([title, desc, text].filter(Boolean).join('\n\n'))
  }
}

// 按链接来源选择最适合的网页提取方式。
function extractArticleFromHtml(url = '', html = '') {
  if (/mp\.weixin\.qq\.com/i.test(url)) {
    return extractWechatArticle(html)
  }
  if (/xiaohongshu\.com|xhslink\.com/i.test(url)) {
    return extractXiaohongshuArticle(html)
  }
  return extractGenericArticle(html)
}

// 用 AI 把网页正文整理成更适合路线解析的“地点清单文本”。
async function refineRouteTextWithAI(rawText = '', sourceType = '') {
  const safeText = trimTextLength(rawText, 6000)
  if (!safeText) return ''

  const prompt = `你是“路线整理助手”。

任务：从下面网页正文里，提取适合做路线规划的地点信息。

输出要求：
1. 只输出整理后的纯文本，不要解释，不要 Markdown。
2. 一个地点一段，第一行只写地点名。
3. 后面字段尽量按下面格式补齐，有就写，没有就省略：
地址：...
营业：...
推荐：...
4. 严禁编造正文里没有的信息。
5. 如果网页里能识别出多个地点，就全部列出来。
6. 如果网页里主要是景点，也按同样格式输出，第一行仍然只写景点名。

来源：${sourceType || '网页'}

网页正文：
${safeText}`

  try {
    const response = await cloud.cloud.ai.model.generateText({
      model: 'hunyuan-2.0-instruct-20251111',
      messages: [
        { role: 'system', content: '你擅长从网页正文中提取地点列表，并保持输出简洁、准确、可解析' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1600
    })
    const aiText = response && response.choices && response.choices[0] && response.choices[0].message
      ? response.choices[0].message.content
      : ''
    return String(aiText || '')
      .replace(/^```[\w-]*\n?/i, '')
      .replace(/```$/i, '')
      .trim()
  } catch (error) {
    console.error('[extractRouteFromLink] AI 整理失败:', error)
    return safeText
  }
}

exports.main = async (event) => {
  const inputUrl = String((event && event.url) || '').trim()
  if (!inputUrl) {
    return {
      success: false,
      message: '链接不能为空'
    }
  }

  try {
    const fetched = await requestPage(inputUrl)
    const article = extractArticleFromHtml(fetched.finalUrl, fetched.html)
    const refinedText = await refineRouteTextWithAI(article.text, article.sourceType)

    if (!refinedText) {
      return {
        success: false,
        message: '没有提取到可用正文'
      }
    }

    return {
      success: true,
      text: refinedText,
      title: article.title || '',
      sourceType: article.sourceType || 'generic',
      finalUrl: fetched.finalUrl
    }
  } catch (error) {
    console.error('[extractRouteFromLink] 链接解析失败:', error)
    return {
      success: false,
      message: '链接正文提取失败'
    }
  }
}
