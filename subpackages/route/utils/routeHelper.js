const util = require('../../../utils/util')
const { MODE_CONFIG, formatDurationShort } = require('../../../utils/travel')
const { buildMapPreviewViewData } = require('../../../utils/map-preview')
const {
  getCityInfo,
  buildDayLabel,
  buildTabs,
  buildSummaryText,
  buildPreviewTitle,
  decorateRouteCardItem,
  getCoverImage,
  getItemTagText,
  estimateRouteDuration
} = require('../../../utils/routeHelper')



// 把临时路线重新应用回当前预览页：
// 这样从"基础信息"页回来后，不需要先落库也能立刻看到修改结果。
function buildPreviewStateFromRoute(route = {}, currentStart = null) {
  const citySource = route.city || route.cityText || route.title || ''
  const cityInfo = getCityInfo(citySource)
  // 兼容新旧属性名：daySections (新) 或 routeDaySections (旧)
  const daySections = (route.daySections || route.routeDaySections || []).map((day, dayIndex) => ({
    ...day,
    id: day.id || `preview-day-${dayIndex}`,
    title: day.title || buildDayLabel(dayIndex + 1),
    countText: `${(day.items || []).length} 个地点`,
    items: (day.items || []).map((item, itemIndex) => {
      const lat = item.lat || item.latitude
      const lng = item.lng || item.longitude
      const decorated = decorateRouteCardItem({
        ...item,
        coverImage: item.coverImage,
        tagText: item.tagText || getItemTagText(item),
        distanceStr: item.distanceStr || util.formatDistance(item.distanceFromPrev || 0),
        timeStr: item.timeStr || estimateRouteDuration(item.distanceFromPrev || 0, item.travelMode)
      })
      return {
        ...decorated,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        dayIndex,
        itemIndex
      }
    })
  }))
  const routeShops = daySections.reduce((result, day) => result.concat(day.items || []), [])
  const totalDistanceValue = routeShops.reduce((sum, item) => sum + (item.distanceFromPrev || 0), 0)
  const totalMinutes = routeShops.reduce((sum, item) => {
    const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
    const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.ride
    return sum + ((Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm)
  }, 0)
  const previewViewData = routeShops.length
    ? buildMapPreviewViewData(daySections, -1, 0, routeShops[0], routeShops.length)
    : {}

  return {
    daySections,  // ★ 改用 daySections 作为属性名（新标准）
    routeShops,
    tabs: daySections.length ? buildTabs(daySections.length) : [],
    currentTab: 0,
    currentMapDay: -1,
    sheetScrollTarget: '',
    summaryText: route.subtitle || buildSummaryText(daySections),
    cityText: cityInfo.name,
    routeTitle: route.title || buildPreviewTitle(cityInfo.name, daySections.length, daySections),
    previewRouteId: route.id ? String(route.id) : '',
    hasUnsavedPreview: true,
    preferredDayCount: Math.max(daySections.length || route.dayCount || 1, 1),
    totalDistance: util.formatDistance(totalDistanceValue),
    totalTime: formatDurationShort(totalMinutes),
    mapPreviewShop: routeShops[0] || null,
    mapPreviewIndex: 0,
    mapCenter: routeShops.length
      ? {
          lat: routeShops[0].lat || routeShops[0].latitude,
          lng: routeShops[0].lng || routeShops[0].longitude
        }
      : {
          lat: (currentStart && currentStart.lat) || cityInfo.lat,
          lng: (currentStart && currentStart.lng) || cityInfo.lng
        },
    ...previewViewData
  }
}

module.exports = {
    buildPreviewStateFromRoute
}