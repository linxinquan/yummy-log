/**
 * markerIcons.js - 地图标记图标管理器
 * 圆周旅迹风格：40x40 精致彩色小圆点标记
 * - 外圈白色描边
 * - 彩色填充 + 高光
 * - 底部钉子形状（地图定位风格）
 * 
 * 工作方式：启动时用 Canvas 绘制 → 保存到本地文件 → 供地图标记使用
 */

const CAT_ICONS = {
  '粤菜':   { emoji: '🥢', bg: '#FF6B35', letter: '粤' },
  '糖水':   { emoji: '🍮', bg: '#9B59B6', letter: '糖' },
  '小吃':   { emoji: '🍡', bg: '#27AE60', letter: '小' },
  '东南亚': { emoji: '🍜', bg: '#2980B9', letter: '东' },
  '其他':   { emoji: '🍽️', bg: '#7F8C8D', letter: '其' },
}

const ICON_SIZE = 40   // 图标尺寸（px）
const CACHE_KEY = 'markerIcons_v1'  // 缓存版本key

// ═══════════════════════════════════════════════════
// 核心函数：初始化图标（启动时调用一次）
// ═══════════════════════════════════════════════════
function ensureIcons(callback) {
  // 检查缓存
  try {
    const cached = wx.getStorageSync(CACHE_KEY)
    if (cached && cached.version === 1) {
      console.log('✅ 标记图标已就绪（缓存）', Object.keys(cached.paths))
      callback && callback(cached.paths)
      return cached.paths
    }
  } catch (e) {}

  // 生成新图标
  generateAllIcons((paths) => {
    try {
      wx.setStorageSync(CACHE_KEY, { version: 1, paths })
    } catch (e) {}
    callback && callback(paths)
  })
  return null
}

// ═══════════════════════════════════════════════════
// 异步生成 5 个图标 PNG → 本地文件
// ═══════════════════════════════════════════════════
function generateAllIcons(callback) {
  const cats = Object.entries(CAT_ICONS)
  const basePath = wx.env.USER_DATA_PATH
  const paths = {}
  let done = 0

  cats.forEach(([name, config]) => {
    generateSingleIcon(config.bg, config.letter, `${basePath}/marker_${name}.png`, (err, filePath) => {
      if (!err && filePath) paths[name] = filePath
      done++
      if (done === cats.length) {
        console.log('✅ 标记图标生成完毕', paths)
        callback(paths)
      }
    })
  })
}

// ═══════════════════════════════════════════════════
// 绘制单个图标 → 保存为 PNG
// 使用 OffscreenCanvas（基础库 2.13+）避免页面生命周期问题
// ═══════════════════════════════════════════════════
function generateSingleIcon(bgColor, letter, outputPath, cb) {
  const size = ICON_SIZE
  const center = size / 2
  const radius = size / 2 - 3   // 留白边

  try {
    // 尝试 OffscreenCanvas（最佳方案）
    const canvas = wx.createOffscreenCanvas({ type: '2d', width: size, height: size })
    const ctx = canvas.getContext('2d')
    drawIcon(ctx, size, center, radius, bgColor, letter)
    const dataUrl = canvas.toDataURL({ fileType: 'png', quality: 1 })
    const fs = wx.getFileSystemManager()
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    fs.writeFile({
      filePath: outputPath,
      data: base64,
      encoding: 'base64',
      success: () => cb(null, outputPath),
      fail: (e) => { console.error('写入图标失败', e); cb(e) }
    })
  } catch (e) {
    // 降级：创建页面临时 canvas
    createPageCanvas(size, bgColor, letter, outputPath, cb)
  }
}

// ═══════════════════════════════════════════════════
// 降级方案：在当前页面创建临时 canvas
// ═══════════════════════════════════════════════════
function createPageCanvas(size, bgColor, letter, outputPath, cb) {
  const pages = getCurrentPages()
  const curPage = pages[pages.length - 1]
  if (!curPage) { cb(new Error('无页面')) }

  const query = curPage.createSelectorQuery()
  query.select('#iconGenCanvas').node((res) => {
    if (!res || !res.node) {
      // 找不到canvas，降级为无图标模式
      cb(new Error('Canvas不可用'))
      return
    }
    const canvas = res.node
    const ctx = canvas.getContext('2d')
    drawIcon(ctx, size, size/2, size/2-3, bgColor, letter)
    wx.canvasToTempFilePath({
      canvas,
      success: (r) => {
        // 复制到永久路径
        const fs = wx.getFileSystemManager()
        fs.copyFile({
          srcPath: r.tempFilePath,
          destPath: outputPath,
          success: () => cb(null, outputPath),
          fail: (e) => cb(e)
        })
      },
      fail: (e) => cb(e)
    })
  }).exec()
}

// ═══════════════════════════════════════════════════
// 绘制图标核心逻辑
// 圆周旅迹风格：白色边框圆 + 彩色填充 + 顶部高光 + 底部钉子 + 字母
// ═══════════════════════════════════════════════════
function drawIcon(ctx, size, center, radius, bgColor, letter) {
  const r = parseInt(bgColor.slice(1, 3), 16)
  const g = parseInt(bgColor.slice(3, 5), 16)
  const b = parseInt(bgColor.slice(5, 7), 16)

  // 清除
  ctx.clearRect(0, 0, size, size)

  // 外层白色圆（描边）
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  // 彩色内圆
  ctx.beginPath()
  ctx.arc(center, center, radius - 2, 0, Math.PI * 2)
  ctx.fillStyle = bgColor
  ctx.fill()

  // 顶部高光（椭圆）
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.ellipse(center - radius * 0.2, center - radius * 0.25, radius * 0.35, radius * 0.2, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.restore()

  // 底部钉子（深色小三角）
  ctx.save()
  ctx.beginPath()
  const pinSize = radius * 0.25
  ctx.moveTo(center, center + radius - 2)
  ctx.lineTo(center - pinSize, center + radius - 2 + pinSize * 1.5)
  ctx.lineTo(center + pinSize, center + radius - 2 + pinSize * 1.5)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()
  ctx.restore()

  // 中心字母（白色粗体）
  ctx.save()
  ctx.font = `bold ${Math.floor(radius * 0.9)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.fillText(letter, center, center + 1)
  ctx.restore()
}

// ═══════════════════════════════════════════════════
// 获取某分类的图标文件路径
// 必须在 ensureIcons 之后调用
// ═══════════════════════════════════════════════════
function getIconPath(category) {
  try {
    const cached = wx.getStorageSync(CACHE_KEY)
    if (cached && cached.paths && cached.paths[category]) {
      return cached.paths[category]
    }
  } catch (e) {}
  return ''  // 降级：空路径 → 使用默认标记
}

function getCategoryColor(category) {
  return CAT_ICONS[category]?.bg || '#7F8C8D'
}

function getCategoryEmoji(category) {
  return CAT_ICONS[category]?.emoji || '📍'
}

module.exports = {
  CAT_ICONS,
  ICON_SIZE,
  CACHE_KEY,
  ensureIcons,
  getIconPath,
  getCategoryColor,
  getCategoryEmoji,
}
