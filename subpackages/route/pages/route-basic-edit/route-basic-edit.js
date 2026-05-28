const { getCityOptions, loadData } = require('../../../../utils/util')
const placesData = require('../../../../utils/placesData')
const {
  applyTravelMeta,
  MODE_CONFIG,
  getGlobalTransportPreferences,
  saveGlobalTransportPreferences
} = require('../../../../utils/travel')
const { formatTripSummary } = require('../../../../utils/trip-duration')
const { DEFAULT_SPOT_COVERS } = require('../../../../config/cover-pool')


// 旅行天数选择范围：1 到 30 天。
const DAY_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1)

// 全局交通偏好可选项。
const TRANSPORT_PREFERENCE_OPTIONS = [
  { key: 'walk', label: '步行', icon: MODE_CONFIG.walk.icon },
  { key: 'ride', label: '骑行', icon: MODE_CONFIG.ride.icon },
  { key: 'transit', label: '公共交通', icon: MODE_CONFIG.transit.icon },
  { key: 'drive', label: '驾车', icon: MODE_CONFIG.drive.icon }
]


// 从一个数组里随机取一个值。
function pickRandomItem(list) {
  if (!list || !list.length) return ''
  const randomIndex = Math.floor(Math.random() * list.length)
  return list[randomIndex]
}

// 优先用路线自己的封面；没有时，从地点图或城市图里兜底。
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

  const routeImage = route && route.image && route.image !== '/images/app-logo.jpg'
    ? [route.image]
    : []

  const coverPool = [...routeItemCovers, ...summaryCovers, ...routeImage, ...DEFAULT_SPOT_COVERS]
  return pickRandomItem(coverPool) || '/images/app-logo.jpg'
}

// 去掉编辑态临时字段，避免保存进正式数据。
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

// 当用户修改旅行天数时，对天数做裁剪或补齐。
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

// 兼容旧结构：重新生成 daySummaries / dayDetails。
function buildLegacyRouteData(daySections) {
  const cleanSections = stripEditState(daySections)
  const daySummaries = cleanSections.map((day, index) => ({
    location: '',
    route: (day.items || []).map(item => item.name).join(' --- '),
    image: (day.items && day.items[0] && day.items[0].image) || '/images/app-logo.jpg'
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

// 顶部摘要文案，例如“3 天 2 晚 · 0 个地点”。
function buildSummaryText(daySections) {
  const dayCount = daySections.length
  const placeCount = daySections.reduce((sum, day) => sum + (day.items || []).length, 0)
  return formatTripSummary(dayCount, placeCount)
}

// 把交通方式 key 转成页面上可读的中文。
function getTransportLabel(mode) {
  const matched = TRANSPORT_PREFERENCE_OPTIONS.find(item => item.key === mode)
  return matched ? matched.label : ''
}

// 生成交通偏好的展示文案。
function buildTransportPreferenceSummary(preferences) {
  if (!preferences) return ''
  return [
    getTransportLabel(preferences.shortDistanceMode),
    getTransportLabel(preferences.longDistanceMode)
  ].filter(Boolean).join('、')
}

// 读取全局交通偏好。
function inferTransportPreferences() {
  return getGlobalTransportPreferences()
}

// 新建路线时的默认空数据。
function buildEmptyRoute() {
  const timestamp = Date.now()
  return {
    id: `custom-${timestamp}`,
    title: '',
    city: '',
    dayCount: 3,
    daySections: Array.from({ length: 3 }, (_, index) => ({
      id: `day-${timestamp}-${index}`,
      title: `第${index + 1}天`,
      countText: '0 个地点',
      items: []
    })),
    daySummaries: [],
    dayDetails: [],
    sourceType: 'custom',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

// 把全局交通偏好重新应用到路线里的每个地点。
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
    isTempPreview: false,
    coverImage: '',
    title: '',
    city: '',
    dayCount: 3,
    maxTitleLength: 20,
    showCityPicker: false,
    showDayPicker: false,
    showTransportPicker: false,
    cityOptions: [],
    dayOptions: DAY_OPTIONS,
    dayPickerIndex: 2,
    transportOptions: TRANSPORT_PREFERENCE_OPTIONS,
    draftDayCount: 3,
    transportPreferences: {
      shortDistanceMode: 'walk',
      longDistanceMode: 'drive'
    },
    draftTransportPreferences: {
      shortDistanceMode: 'walk',
      longDistanceMode: 'drive'
    },
    transportPreferenceText: ''
  },

  // 页面初始化：
  // 编辑已有路线时读取 route，新建路线时生成一条空路线。
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
      isTempPreview: options.temp === '1',
      coverImage: resolveRouteCoverImage(route, daySections),
      title: route.title || '',
      city: route.city || route.cityText || '',
      dayCount: Math.max(daySections.length || route.dayCount || 1, 1),
      draftDayCount: Math.max(daySections.length || route.dayCount || 1, 1),
      dayPickerIndex: Math.max(Math.max(daySections.length || route.dayCount || 1, 1) - 1, 0),
      cityOptions: getCityOptions(DEFAULT_SPOT_COVERS),
      transportPreferences,
      draftTransportPreferences: { ...transportPreferences },
      transportPreferenceText: buildTransportPreferenceSummary(transportPreferences)
    })
  },

  // 路线标题输入
  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  // 打开城市选择弹窗
  onOpenCityPicker() {
    this.setData({ showCityPicker: true })
  },

  // 关闭城市选择弹窗
  onCloseCityPicker() {
    this.setData({ showCityPicker: false })
  },

  // 选择城市
  onSelectCity(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.setData({
      city: item.fullName,
      showCityPicker: false
    })
  },

  // 随机更换一张路线封面
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

  // 打开旅行天数选择弹窗
  onOpenDayPicker() {
    this.setData({
      showDayPicker: true,
      draftDayCount: this.data.dayCount,
      dayPickerIndex: Math.max((this.data.dayCount || 1) - 1, 0)
    })
  },

  // 关闭旅行天数选择弹窗
  onCloseDayPicker() {
    this.setData({ showDayPicker: false })
  },

  // picker-view 滚动时同步草稿天数
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

  // 确认旅行天数，并同步到路线结构
  onConfirmDayPicker() {
    this.setData({
      dayCount: this.data.draftDayCount,
      showDayPicker: false
    })
  },

  // 打开交通偏好弹窗
  onOpenTransportPicker() {
    this.setData({
      showTransportPicker: true,
      draftTransportPreferences: { ...this.data.transportPreferences }
    })
  },

  // 关闭交通偏好弹窗
  onCloseTransportPicker() {
    this.setData({ showTransportPicker: false })
  },

  // 交通偏好选项切换
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

  // 确认交通偏好，并把结果应用到路线地点上
  onConfirmTransportPicker() {
    const transportPreferences = { ...this.data.draftTransportPreferences }
    saveGlobalTransportPreferences(transportPreferences)
    this.setData({
      transportPreferences,
      transportPreferenceText: buildTransportPreferenceSummary(transportPreferences),
      showTransportPicker: false
    })
  },

  // 取消并返回上一页
  onCancel() {
    wx.navigateBack({ delta: 1 })
  },

  // 删除当前路线
  onDeleteRoute() {
    const routeId = this.data.route && this.data.route.id
    wx.showModal({
      title: '删除路线',
      content: '删除后无法恢复，确认删除吗？',
      success: (res) => {
        if (!res.confirm) return
        if (routeId !== undefined && routeId !== null) {
          const savedRoutes = loadData('savedRoutes', [])
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

  // 阻止弹窗内容点击冒泡
  preventBubble() {
  },

  // 保存基础信息：
  // 新建路线时会先写入“我的路线”，然后进入详情页。
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
      image: this.data.coverImage || baseRoute.coverImage || baseRoute.image || daySummaries[0]?.image || '/images/app-logo.jpg',
      coverImage: this.data.coverImage || baseRoute.coverImage || baseRoute.image || daySummaries[0]?.image || '/images/app-logo.jpg',
      transportPreferences: { ...transportPreferences },
      transportPreferenceText: buildTransportPreferenceSummary(transportPreferences),
      isDraft: this.data.isTempPreview,
      updatedAt: Date.now()
    }

    if (this.data.isTempPreview) {
      const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel()
      eventChannel && eventChannel.emit('routeBasicSaved', updatedRoute)
      wx.showToast({ title: '已更新基础信息', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 300)
      return
    }

    const savedRoutes = loadData('savedRoutes', [])
    const index = savedRoutes.findIndex(item => String(item.id) === String(updatedRoute.id))
    if (index > -1) {
      savedRoutes[index] = updatedRoute
    } else {
      savedRoutes.push(updatedRoute)
    }
    wx.setStorageSync('savedRoutes', savedRoutes)

    if (this.data.isNewRoute) {
      wx.redirectTo({
        url: `/subpackages/route/pages/my-route/my-route?route=${encodeURIComponent(JSON.stringify(updatedRoute))}`
      })
      return
    }

    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack({ delta: 1 }), 300)
  }
})
