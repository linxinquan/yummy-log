const { MODE_CONFIG } = require('./travel')

// 把距离改成中文紧凑写法，例如“465米”“1.2公里”。
function formatDistanceZh(distance) {
  const safeDistance = Math.max(Number(distance) || 0, 0)
  if (safeDistance < 1000) return `${Math.round(safeDistance)}米`
  return `${(safeDistance / 1000).toFixed(1).replace('.0', '')}公里`
}

// 把分钟改成中文紧凑写法，例如“6分钟”“1小时20分钟”。
function formatDurationZh(minutes) {
  const safeMinutes = Math.max(1, Math.round(minutes || 0))
  if (safeMinutes < 60) return `${safeMinutes}分钟`
  const hours = Math.floor(safeMinutes / 60)
  const remainMinutes = safeMinutes % 60
  return remainMinutes ? `${hours}小时${remainMinutes}分钟` : `${hours}小时`
}

// 地点卡片的标签统一走这里：
// 1. 优先用真实 tags
// 2. 如果没有，就退回到单个 tag 或 displayCategory
function buildPlaceCardTags(item = {}) {
  const safeTags = Array.isArray(item.tags) ? item.tags.filter(Boolean).slice(0, 2) : []
  if (safeTags.length) return safeTags
  return [item.tag || item.tagText || item.displayCategory].filter(Boolean).slice(0, 2)
}

// 底部交通信息统一在这里组装，避免三页文案不一致。
function buildRouteTravelDisplay(travelMeta = {}, distanceFromPrev = 0) {
  const safeDistance = Math.max(Number(travelMeta.distance || distanceFromPrev) || 0, 0)
  const modeKey = MODE_CONFIG[travelMeta.mode] ? travelMeta.mode : 'walk'
  const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.walk
  const minutes = (safeDistance / 1000) * modeConfig.minutesPerKm
  const distanceText = formatDistanceZh(safeDistance)
  const timeText = formatDurationZh(minutes)
  return {
    travelModeIcon: travelMeta.icon || modeConfig.icon,
    travelModeLabel: travelMeta.label || modeConfig.label,
    travelDistanceText: distanceText,
    travelTimeText: timeText,
    travelSummaryText: `${distanceText} · ${timeText}`
  }
}

// 地点简介弹窗的数据结构也统一收口到这里。
function buildPlaceIntroData(item = {}, cityText = '', defaultImage = '') {
  const detailTags = buildPlaceCardTags(item)
  let feeText = '收费'
  if (item.free === true) {
    feeText = '免费'
  } else if (item.price) {
    feeText = `人均约 ¥${item.price}`
  }
  return {
    id: item.id,
    image: item.image || item.coverImage || defaultImage,
    name: item.name || '未命名地点',
    rating: item.rating || '',
    tags: detailTags,
    openTimeText: `营业时间：${item.openHours || item.hours || '全天'} · ${feeText}`,
    address: item.address || `${cityText || ''}${item.name || ''}`,
    desc: item.desc || '暂未补充简介',
    type: item.type || 'spot',
    // 地点简介里的地址点击后也要能直接调起导航弹窗，所以这里顺手把坐标带上。
    lat: item.lat || item.latitude || 0,
    lng: item.lng || item.longitude || 0
  }
}

module.exports = {
  formatDistanceZh,
  formatDurationZh,
  buildPlaceCardTags,
  buildRouteTravelDisplay,
  buildPlaceIntroData
}
