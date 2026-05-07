const util = require('../../utils/util')

const DEFAULT_COVERS = [
  '/images/covers/01.jpeg',
  '/images/covers/02.jpeg',
  '/images/covers/03.jpeg',
  '/images/covers/04.jpeg',
  '/images/covers/05.jpeg',
  '/images/covers/06.jpeg',
  '/images/covers/07.jpeg',
  '/images/covers/08.jpeg',
  '/images/covers/09.jpeg',
  '/images/covers/10.jpeg',
  '/images/covers/11.jpeg',
  '/images/covers/12.jpeg'
]

function stripEditState(daySections) {
  return (daySections || []).map(day => ({
    ...day,
    items: (day.items || []).map(item => {
      const nextItem = { ...item }
      delete nextItem.swipeOffset
      return nextItem
    })
  }))
}

function alignDaySections(daySections, targetCount) {
  const sections = stripEditState(daySections).slice(0, targetCount)
  while (sections.length < targetCount) {
    sections.push({
      id: `day-${Date.now()}-${sections.length}`,
      items: []
    })
  }
  return sections
}

function buildLegacyRouteData(daySections) {
  const cleanSections = stripEditState(daySections)
  const daySummaries = cleanSections.map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && day.items[0].image) || DEFAULT_COVERS[index % DEFAULT_COVERS.length]
  }))

  const dayDetails = cleanSections.map(day => (day.items || []).map(item => ({
    name: item.name,
    desc: item.travelText || item.desc || '',
    tag: item.tag,
    image: item.image,
    type: item.type
  })))

  return { daySummaries, dayDetails }
}

function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const nightCount = Math.max(dayCount - 1, 0)
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return `${dayCount} 天 ${nightCount} 晚 · ${placeCount} 个地点`
}

Page({
  data: {
    route: null,
    title: '',
    city: '',
    dayCount: 1,
    maxTitleLength: 25
  },

  onLoad(options) {
    if (!options.route) {
      wx.showToast({ title: '路线不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const route = JSON.parse(decodeURIComponent(options.route))
    const daySections = stripEditState(route.daySections || [])
    this.setData({
      route,
      title: route.title || '',
      city: route.city || route.cityText || '',
      dayCount: Math.max(daySections.length || 1, 1)
    })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onCityInput(e) {
    this.setData({ city: e.detail.value })
  },

  onMinusDay() {
    this.setData({ dayCount: Math.max(1, this.data.dayCount - 1) })
  },

  onPlusDay() {
    this.setData({ dayCount: Math.min(15, this.data.dayCount + 1) })
  },

  onSave() {
    const title = (this.data.title || '').trim()
    const city = (this.data.city || '').trim()

    if (!title) {
      wx.showToast({ title: '请输入路线名称', icon: 'none' })
      return
    }

    if (!city) {
      wx.showToast({ title: '请输入城市', icon: 'none' })
      return
    }

    const baseRoute = this.data.route || {}
    const nextSections = alignDaySections(baseRoute.daySections || [], this.data.dayCount)
    const { daySummaries, dayDetails } = buildLegacyRouteData(nextSections)
    const updatedRoute = {
      ...baseRoute,
      title,
      city,
      daySections: nextSections,
      daySummaries,
      dayDetails,
      subtitle: buildSummaryText(nextSections),
      image: baseRoute.image || daySummaries[0]?.image || DEFAULT_COVERS[0],
      updatedAt: Date.now()
    }

    const savedRoutes = util.loadData('savedRoutes', [])
    const index = savedRoutes.findIndex(item => String(item.id) === String(updatedRoute.id))
    if (index > -1) {
      savedRoutes[index] = updatedRoute
    } else {
      savedRoutes.push(updatedRoute)
    }
    wx.setStorageSync('savedRoutes', savedRoutes)

    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300)
  }
})
