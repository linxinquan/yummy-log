const util = require('../../utils/util')
const shopData = require('../../utils/shopData')
const { spotData } = require('../../utils/spotData')
const {
  applyTravelMeta,
  MODE_CONFIG,
  getGlobalTransportPreferences,
  saveGlobalTransportPreferences
} = require('../../utils/travel')

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

const GUANGDONG_CITIES = [
  { id: 1, name: '广州', fullName: '广州市', lat: 23.1291, lng: 113.2644, bgColor: '#DBE8DD' },
  { id: 2, name: '深圳', fullName: '深圳市', lat: 22.5431, lng: 114.0579, bgColor: '#DAE5E8' },
  { id: 3, name: '汕头', fullName: '汕头市', lat: 23.3541, lng: 116.6819, bgColor: '#E4D8DC' },
  { id: 4, name: '湛江', fullName: '湛江市', lat: 21.2707, lng: 110.3594, bgColor: '#E6DBD8' },
  { id: 5, name: '汕尾', fullName: '汕尾市', lat: 22.7862, lng: 115.3751, bgColor: '#DAE5E8' },
  { id: 6, name: '清远', fullName: '清远市', lat: 23.6817, lng: 113.056, bgColor: '#E0E0E0' },
  { id: 7, name: '佛山', fullName: '佛山市', lat: 23.0215, lng: 113.1214, bgColor: '#DCE5DE' },
  { id: 8, name: '东莞', fullName: '东莞市', lat: 23.0207, lng: 113.7518, bgColor: '#D8E3E8' },
  { id: 9, name: '珠海', fullName: '珠海市', lat: 22.271, lng: 113.5767, bgColor: '#E3DBE6' },
  { id: 10, name: '中山', fullName: '中山市', lat: 22.5176, lng: 113.3928, bgColor: '#E5DFDA' },
  { id: 11, name: '江门', fullName: '江门市', lat: 22.5787, lng: 113.0819, bgColor: '#DCE5E3' },
  { id: 12, name: '惠州', fullName: '惠州市', lat: 23.1118, lng: 114.4168, bgColor: '#DCE3E8' },
  { id: 13, name: '肇庆', fullName: '肇庆市', lat: 23.0472, lng: 112.4651, bgColor: '#E6DDE2' },
  { id: 14, name: '茂名', fullName: '茂名市', lat: 21.6633, lng: 110.9255, bgColor: '#E6E0DA' },
  { id: 15, name: '阳江', fullName: '阳江市', lat: 21.8579, lng: 111.9822, bgColor: '#DCE7E0' },
  { id: 16, name: '梅州', fullName: '梅州市', lat: 24.2886, lng: 116.1176, bgColor: '#D9E3E8' },
  { id: 17, name: '河源', fullName: '河源市', lat: 23.7437, lng: 114.7004, bgColor: '#E4DCE3' },
  { id: 18, name: '韶关', fullName: '韶关市', lat: 24.8104, lng: 113.5972, bgColor: '#E3DFDB' },
  { id: 19, name: '揭阳', fullName: '揭阳市', lat: 23.5498, lng: 116.3728, bgColor: '#DCE5E1' },
  { id: 20, name: '潮州', fullName: '潮州市', lat: 23.6567, lng: 116.6226, bgColor: '#D7E2E6' },
  { id: 21, name: '云浮', fullName: '云浮市', lat: 22.9153, lng: 112.0445, bgColor: '#E2DEE0' }
]

const DAY_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1)

const TRANSPORT_PREFERENCE_OPTIONS = [
  { key: 'walk', label: '步行', icon: MODE_CONFIG.walk.icon },
  { key: 'ride', label: '骑行', icon: MODE_CONFIG.ride.icon },
  { key: 'transit', label: '公共交通', icon: MODE_CONFIG.transit.icon },
  { key: 'drive', label: '驾车', icon: MODE_CONFIG.drive.icon }
]

function buildCityCoverPool() {
  const foodCovers = [...(shopData.shops || []), ...(shopData.foods || [])]
    .map(item => item.logo || item.image || item.thumb)
    .filter(Boolean)
  const spotCovers = (spotData || [])
    .map(item => item.image)
    .filter(Boolean)
  return [...foodCovers, ...spotCovers]
}

function buildCityOptions() {
  const coverPool = buildCityCoverPool()
  return GUANGDONG_CITIES.map((city, index) => ({
    ...city,
    coverImage: coverPool[index % coverPool.length] || DEFAULT_COVERS[index % DEFAULT_COVERS.length]
  }))
}

function pickRandomItem(list) {
  if (!list || !list.length) return ''
  const randomIndex = Math.floor(Math.random() * list.length)
  return list[randomIndex]
}

function resolveRouteCoverImage(route, daySections) {
  if (route && route.coverImage) return route.coverImage

  const routeItemCovers = (daySections || []).reduce((result, day) => {
    ;(day.items || []).forEach(item => {
      const cover = item.image || item.coverImage || item.logo || item.thumb
      if (cover) result.push(cover)
    })
    return result
  }, [])

  const summaryCovers = ((route && route.daySummaries) || [])
    .map(item => item && item.image)
    .filter(Boolean)

  const routeImage = route && route.image && !DEFAULT_COVERS.includes(route.image)
    ? [route.image]
    : []

  const coverPool = [...routeItemCovers, ...summaryCovers, ...routeImage, ...buildCityCoverPool()]
  return pickRandomItem(coverPool) || DEFAULT_COVERS[0]
}

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
    travelText: item.travelText || item.desc || '',
    tag: item.tag,
    image: item.image,
    type: item.type,
    lat: item.lat,
    lng: item.lng
  })))

  return { daySummaries, dayDetails }
}

function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const nightCount = Math.max(dayCount - 1, 0)
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return `${dayCount} 天 ${nightCount} 晚 · ${placeCount} 个地点`
}

function getTransportLabel(mode) {
  const matched = TRANSPORT_PREFERENCE_OPTIONS.find(item => item.key === mode)
  return matched ? matched.label : ''
}

function buildTransportPreferenceSummary(preferences) {
  if (!preferences) return ''
  return [
    getTransportLabel(preferences.shortDistanceMode),
    getTransportLabel(preferences.longDistanceMode)
  ].filter(Boolean).join('、')
}

function inferTransportPreferences() {
  return getGlobalTransportPreferences()
}

function buildEmptyRoute() {
  return {
    id: `custom-${Date.now()}`,
    title: '',
    city: '',
    dayCount: 1,
    daySections: [{ id: `day-${Date.now()}`, items: [] }],
    daySummaries: [],
    dayDetails: [],
    sourceType: 'custom',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function applyTransportPreferences(daySections, preferences) {
  return stripEditState(daySections).map(day => ({
    ...day,
    items: (day.items || []).map(item => {
      const distance = Number(item.distanceFromPrev || (item.travelMeta && item.travelMeta.distance) || 0)
      const preferredMode = distance < 1000 ? preferences.shortDistanceMode : preferences.longDistanceMode
      return applyTravelMeta(item, preferredMode)
    })
  }))
}

Page({
  data: {
    route: null,
    isNewRoute: false,
    coverImage: '',
    title: '',
    city: '',
    dayCount: 1,
    maxTitleLength: 20,
    showCityPicker: false,
    showDayPicker: false,
    showTransportPicker: false,
    cityOptions: [],
    dayOptions: DAY_OPTIONS,
    dayPickerIndex: 0,
    transportOptions: TRANSPORT_PREFERENCE_OPTIONS,
    draftDayCount: 1,
    transportPreferences: {
      shortDistanceMode: 'walk',
      longDistanceMode: 'ride'
    },
    draftTransportPreferences: {
      shortDistanceMode: 'walk',
      longDistanceMode: 'ride'
    },
    transportPreferenceText: ''
  },

  onLoad(options) {
    const isNewRoute = options.create === '1'
    if (!options.route && options.create !== '1') {
      wx.showToast({ title: '路线不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const route = options.route
      ? JSON.parse(decodeURIComponent(options.route))
      : buildEmptyRoute()
    const daySections = stripEditState(route.daySections || [])
    const transportPreferences = inferTransportPreferences()
    this.setData({
      route,
      isNewRoute,
      coverImage: resolveRouteCoverImage(route, daySections),
      title: route.title || '',
      city: route.city || route.cityText || '',
      dayCount: Math.max(daySections.length || route.dayCount || 1, 1),
      draftDayCount: Math.max(daySections.length || route.dayCount || 1, 1),
      dayPickerIndex: Math.max(Math.max(daySections.length || route.dayCount || 1, 1) - 1, 0),
      cityOptions: buildCityOptions(),
      transportPreferences,
      draftTransportPreferences: { ...transportPreferences },
      transportPreferenceText: buildTransportPreferenceSummary(transportPreferences)
    })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onOpenCityPicker() {
    this.setData({ showCityPicker: true })
  },

  onCloseCityPicker() {
    this.setData({ showCityPicker: false })
  },

  onSelectCity(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.setData({
      city: item.fullName,
      showCityPicker: false
    })
  },

  onChooseCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = (res.tempFilePaths || [])[0]
        if (!tempFilePath) return
        wx.saveFile({
          tempFilePath,
          success: ({ savedFilePath }) => {
            this.setData({ coverImage: savedFilePath || tempFilePath })
          },
          fail: () => {
            this.setData({ coverImage: tempFilePath })
          }
        })
      }
    })
  },

  onOpenDayPicker() {
    this.setData({
      showDayPicker: true,
      draftDayCount: this.data.dayCount,
      dayPickerIndex: Math.max((this.data.dayCount || 1) - 1, 0)
    })
  },

  onCloseDayPicker() {
    this.setData({ showDayPicker: false })
  },

  onDayPickerChange(e) {
    const value = e.detail && e.detail.value
    const pickerIndex = Array.isArray(value) ? parseInt(value[0], 10) : parseInt(value, 10)
    if (Number.isNaN(pickerIndex)) return
    const nextDayCount = this.data.dayOptions[pickerIndex]
    if (!nextDayCount) return
    this.setData({
      dayPickerIndex: pickerIndex,
      draftDayCount: nextDayCount
    })
  },

  onConfirmDayPicker() {
    this.setData({
      dayCount: this.data.draftDayCount,
      showDayPicker: false
    })
  },

  onOpenTransportPicker() {
    this.setData({
      showTransportPicker: true,
      draftTransportPreferences: { ...this.data.transportPreferences }
    })
  },

  onCloseTransportPicker() {
    this.setData({ showTransportPicker: false })
  },

  onSelectTransportMode(e) {
    const type = e.currentTarget.dataset.type
    const mode = e.currentTarget.dataset.mode
    if (!type || !mode) return
    this.setData({
      draftTransportPreferences: {
        ...this.data.draftTransportPreferences,
        [type]: mode
      }
    })
  },

  onConfirmTransportPicker() {
    const transportPreferences = { ...this.data.draftTransportPreferences }
    saveGlobalTransportPreferences(transportPreferences)
    this.setData({
      transportPreferences,
      transportPreferenceText: buildTransportPreferenceSummary(transportPreferences),
      showTransportPicker: false
    })
  },

  onCancel() {
    wx.navigateBack({ delta: 1 })
  },

  onDeleteRoute() {
    const routeId = this.data.route && this.data.route.id
    wx.showModal({
      title: '删除路线',
      content: '删除后无法恢复，确认删除吗？',
      success: (res) => {
        if (!res.confirm) return
        if (routeId !== undefined && routeId !== null) {
          const savedRoutes = util.loadData('savedRoutes', [])
          const nextRoutes = savedRoutes.filter(item => String(item.id) !== String(routeId))
          wx.setStorageSync('savedRoutes', nextRoutes)
        }
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack({
            delta: 2,
            fail: () => {
              wx.switchTab({ url: '/pages/wantgo/wantgo' })
            }
          })
        }, 300)
      }
    })
  },

  preventBubble() {
  },

  onSave() {
    const inputTitle = (this.data.title || '').trim()
    const title = inputTitle || (this.data.isNewRoute ? '未命名路线' : '')
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
    const transportPreferences = saveGlobalTransportPreferences(this.data.transportPreferences)
    const alignedSections = alignDaySections(baseRoute.daySections || [], this.data.dayCount)
    const nextSections = applyTransportPreferences(alignedSections, transportPreferences)
    const { daySummaries, dayDetails } = buildLegacyRouteData(nextSections)
    const updatedRoute = {
      ...baseRoute,
      title,
      city,
      dayCount: nextSections.length,
      daySections: nextSections,
      daySummaries,
      dayDetails,
      subtitle: buildSummaryText(nextSections),
      image: this.data.coverImage || baseRoute.coverImage || baseRoute.image || daySummaries[0]?.image || DEFAULT_COVERS[0],
      coverImage: this.data.coverImage || baseRoute.coverImage || baseRoute.image || daySummaries[0]?.image || DEFAULT_COVERS[0],
      transportPreferences: { ...transportPreferences },
      transportPreferenceText: buildTransportPreferenceSummary(transportPreferences),
      isDraft: false,
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

    if (this.data.isNewRoute) {
      wx.redirectTo({
        url: `/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(updatedRoute))}`
      })
      return
    }

    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300)
  }
})
