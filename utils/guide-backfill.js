const util = require('./util')
const placesData = require('./placesData')
const { resolveDisplayCategory } = require('./displayCategory')
const { buildPlaceCardTags } = require('./route-place-card')
const { normalizeTripDurationText } = require('./trip-duration')

// 把名称做成更稳定的比较格式，尽量提高老攻略地点匹配成功率。
function normalizeName(name = '') {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/[·•,，。.!！？、\-()（）]/g, '')
    .toLowerCase()
}

// 从探索页同源数据里找出同名地点，给老攻略补齐评分、标签、地址这些字段。
function findMatchedPlace(name = '') {
  const normalized = normalizeName(name)
  if (!normalized) return null

  const foods = [...placesData.getFoods(), ...(util.loadData('userAddedShops', []) || [])]
    .map(item => ({ ...item, type: item.type || 'food' }))
  const spots = placesData.getSpots().map(item => ({ ...item, type: item.type || 'spot' }))
  const allPlaces = foods.concat(spots)

  return allPlaces.find(item => {
    const itemName = normalizeName(item.name)
    return itemName === normalized || itemName.includes(normalized) || normalized.includes(itemName)
  }) || null
}

// 给单个老攻略地点补齐缺失字段。
function enrichGuidePlace(item = {}) {
  const matched = findMatchedPlace(item.name)
  const merged = {
    ...matched,
    ...item
  }
  const displayCategory = merged.displayCategory || resolveDisplayCategory(merged)

  return {
    ...item,
    image: item.coverImage || '',
    coverImage: item.coverImage || '',
    displayCategory,
    rating: item.rating || item.score || matched?.rating || matched?.score || '',
    tags: buildPlaceCardTags({ ...merged, displayCategory }),
    address: item.address || matched?.address || '',
    desc: item.desc || matched?.desc || '',
    openHours: item.openHours || item.hours || matched?.openHours || matched?.hours || '',
    free: item.free !== undefined ? item.free : matched?.free,
    price: item.price || matched?.price || '',
    lat: item.lat || item.latitude || matched?.lat || '',
    lng: item.lng || item.longitude || matched?.lng || '',
    type: item.type || matched?.type || ''
  }
}

// 给整篇老攻略补齐地点字段和旅行时间文案。
function enrichGuide(guide = {}) {
  const nextDaySections = (guide.daySections || []).map(day => ({
    ...day,
    items: (day.items || []).map(item => enrichGuidePlace(item))
  }))
  const placeCount = nextDaySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  const fallbackDayCount = Math.max(nextDaySections.length || guide.dayCount || 1, 1)

  return {
    ...guide,
    daySections: nextDaySections,
    duration: normalizeTripDurationText(guide.duration, fallbackDayCount),
    shopCount: guide.shopCount || placeCount
  }
}

// 读取本地 myGuides 时，自动补齐老攻略数据。
// 如果内容确实有变化，就直接写回本地，避免下次还要重复修。
function backfillStoredGuides(guides = []) {
  const nextGuides = (guides || []).map(guide => enrichGuide(guide))
  const changed = JSON.stringify(nextGuides) !== JSON.stringify(guides || [])
  return { guides: nextGuides, changed }
}

module.exports = {
  enrichGuidePlace,
  enrichGuide,
  backfillStoredGuides
}
