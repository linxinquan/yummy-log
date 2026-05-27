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
  const routeDaySections = (route.daySections || []).map((day, dayIndex) => ({
    ...day,
    id: day.id || `preview-day-${dayIndex}`,
    title: day.title || buildDayLabel(dayIndex + 1),
    countText: `${(day.items || []).length} 个地点`,
    items: (day.items || []).map((item, itemIndex) => {
      const lat = item.lat || item.latitude
      const lng = item.lng || item.longitude
      const decorated = decorateRouteCardItem({
        ...item,
        coverImage: item.coverImage || getCoverImage(item),
        image: item.image || item.coverImage || getCoverImage(item),
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
  const routeShops = routeDaySections.reduce((result, day) => result.concat(day.items || []), [])
  const totalDistanceValue = routeShops.reduce((sum, item) => sum + (item.distanceFromPrev || 0), 0)
  const totalMinutes = routeShops.reduce((sum, item) => {
    const modeKey = (item.travelMeta && item.travelMeta.mode) || item.travelMode
    const modeConfig = MODE_CONFIG[modeKey] || MODE_CONFIG.ride
    return sum + ((Math.max(0, item.distanceFromPrev || 0) / 1000) * modeConfig.minutesPerKm)
  }, 0)
  const previewViewData = routeShops.length
    ? buildMapPreviewViewData(routeDaySections, -1, 0, routeShops[0], routeShops.length)
    : {}

  return {
    routeShops,
    routeDaySections,
    tabs: routeDaySections.length ? buildTabs(routeDaySections.length) : [],
    currentTab: 0,
    currentMapDay: -1,
    sheetScrollTarget: '',
    summaryText: route.subtitle || buildSummaryText(routeDaySections),
    cityText: cityInfo.name,
    routeTitle: route.title || buildPreviewTitle(cityInfo.name, routeDaySections.length, routeDaySections),
    previewRouteId: route.id ? String(route.id) : '',
    hasUnsavedPreview: true,
    preferredDayCount: Math.max(routeDaySections.length || route.dayCount || 1, 1),
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