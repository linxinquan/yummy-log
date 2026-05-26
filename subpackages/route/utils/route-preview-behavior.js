// behaviors/route-preview-behavior.js
// 预览相关行为的 Behavior
// 包含：预览路线、焦点切换、预览卡片更新等功能
const { buildMapPreviewViewData } = require('../../../utils/map-preview')
const { getPreviewIndexByDay, getCityInfo, buildDayLabel, buildTabs, buildSummaryText, buildPreviewTitle, buildPreviewDaySections } = require('../../../utils/routeHelper')

// 根据预览下标反推属于第几天。
function getDayIndexByPreview(routeDaySections, previewIndex) {
  if (!routeDaySections || !routeDaySections.length) return -1
  let offset = 0
  for (let i = 0; i < routeDaySections.length; i += 1) {
    const count = (routeDaySections[i].items || []).length
    if (previewIndex < offset + count) return i
    offset += count
  }
  return routeDaySections.length - 1
}

module.exports = Behavior({
  data: {
    // 预览相关（仅在单个behavior中定义的保留在此）
    tabs: [],
    summaryText: '',
    routeTitle: '智能规划路线'
  },

methods: {
// 把当前路线转成"按天展示"的预览结构，并更新标题、摘要、预览卡片。
  refreshPreviewRoute(routeShops, options = {}) {
    const shouldMarkDirty = options.markDirty !== undefined
      ? Boolean(options.markDirty)
      : Boolean(this.data.hasUnsavedPreview || !this.data.previewRouteId)
    const citySource = [
      this.data.currentStart && this.data.currentStart.name,
      ...(routeShops || []).map(item => item.city || item.address || item.name)
    ].filter(Boolean).join(' ')
    const cityInfo = getCityInfo(citySource)
    const routeDaySections = routeShops.length ? buildPreviewDaySections(routeShops, this.data.preferredDayCount) : []
    
    // 保留之前的 startPointText（如果有）：
    // 第一天默认文案统一成“当前所在位置”；
    // 第二天及以后默认留空，避免把“设置起点”误当成真实地址显示出来。
    const prevDaySections = this.data.routeDaySections || []
    const dayStartPointTexts = this.data.dayStartPointTexts || []
    const updatedSections = routeDaySections.map((section, dayIndex) => {
      const prevSection = prevDaySections[dayIndex]
      const defaultText = dayIndex === 0 ? '当前所在位置' : ''
      return {
        ...section,
        startPointText: (prevSection && prevSection.startPointText) || dayStartPointTexts[dayIndex] || defaultText
      }
    })
    
    const tabs = updatedSections.length ? buildTabs(updatedSections.length) : []
    this.setData({
      routeDaySections: updatedSections,
      tabs,
      currentTab: 0,
      currentMapDay: -1,
      sheetScrollTarget: '',
      summaryText: updatedSections.length ? buildSummaryText(updatedSections) : '',
      cityText: cityInfo.name,
      routeTitle: buildPreviewTitle(cityInfo.name, updatedSections.length, updatedSections),
      // 只有真正发生了新的路线改动时，才标记为"未保存"。
      hasUnsavedPreview: updatedSections.length > 0 ? shouldMarkDirty : false,
      mapPreviewShop: routeShops && routeShops.length ? routeShops[0] : null,
      mapPreviewIndex: 0
    })
  },
  // 根据预览下标聚焦当前地点，并刷新顶部预览卡片
  focusPreviewByIndex(index, currentDayOverride) {
    const { routeShops, routeDaySections } = this.data
    if (!routeShops.length) return
    const parsedIndex = parseInt(index, 10)
    if (Number.isNaN(parsedIndex)) return
    const safeIndex = Math.max(0, Math.min(parsedIndex, routeShops.length - 1))
    const target = routeShops[safeIndex]
    const resolvedDayIndex = typeof currentDayOverride === 'number'
      ? currentDayOverride
      : getDayIndexByPreview(routeDaySections, safeIndex)
    const previewViewData = buildMapPreviewViewData(
      routeDaySections,
      resolvedDayIndex,
      safeIndex,
      target,
      routeShops.length
    )
    this.setData({
      mapPreviewIndex: safeIndex,
      mapPreviewShop: target,
      currentMapDay: resolvedDayIndex,
      ...previewViewData,
      mapCenter: {
        lat: target.lat || target.latitude,
        lng: target.lng || target.longitude
      }
    })
  },
  // 在地图预览卡片顶部切换某一天
  onSelectMapPreviewDay(e) {
    const dayIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    this.setData({ currentMapDay: dayIndex })
    this.focusPreviewByIndex(
      dayIndex >= 0 ? getPreviewIndexByDay(this.data.routeDaySections, dayIndex) : 0,
      dayIndex
    )
    // 用 setTimeout 确保 focusPreviewByIndex 里的 setData 完成后，updateMap 能读到最新的 currentMapDay
    setTimeout(() => this.updateMap(), 0)
  },

  // 切换地图预览中的当前地点
  onChangeMapPreview(e) {
    const nextIndex = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(nextIndex)) return
    const nextDayIndex = getDayIndexByPreview(this.data.routeDaySections, nextIndex)
    // 在 focusPreviewByIndex 之前保存旧值，因为 setData 会同步更新 this.data
    const oldMapDay = this.data.currentMapDay
    this.focusPreviewByIndex(nextIndex, nextDayIndex)
    // 只有跨天时才重新渲染地图路径，同天内只切换焦点不需要重绘路线
    if (nextDayIndex !== oldMapDay) {
      setTimeout(() => this.updateMap(), 0)
    }
  },

  // 点击上一站 / 下一站
  onMapPreviewStep(e) {
    const index = parseInt(
      (e.detail && e.detail.index) !== undefined ? e.detail.index : e.currentTarget.dataset.index,
      10
    )
    if (Number.isNaN(index) || index < 0) return
    this.onChangeMapPreview({ detail: { index } })
  },


},
})
