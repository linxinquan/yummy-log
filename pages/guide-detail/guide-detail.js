const app = getApp()
const shopData = require('../../utils/shopData')
const util = require('../../utils/util')

Page({
  data: {
    guide: null,
    menuTop: 0,
    menuHeight: 32,
    isCollected: false,
    routeItems: [],
    mapCenter: { lat: 22.5431, lng: 114.0579 }, // 默认深圳
    mapMarkers: [],
    polyline: [],
    routeStats: '',
    totalDistance: '5.2 km',
    totalTime: '2.5 小时'
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32

    if (!options.guide) {
      wx.showToast({ title: '攻略不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 1200)
      return
    }

    const guide = JSON.parse(decodeURIComponent(options.guide))
    const tags = Array.isArray(guide.tags) ? guide.tags : (guide.tag ? [guide.tag] : [])
    const shopNames = Array.isArray(guide.shops) ? guide.shops : []
    
    const isCollected = util.loadData('userCollectedGuides', []).some(id => String(id) === String(guide.id))

    const routeItems = shopNames.map((name, index) => {
      const distance = index > 0 ? `${(Math.random() * 2 + 0.5).toFixed(1)} km` : ''
      const time = `${(Math.random() * 1.5 + 0.5).toFixed(1)} 小时`
      return {
        name,
        desc: this.getCategoryByShopName(name),
        time,
        distance
      }
    })

    const markers = this.generateMarkers(routeItems)
    const polyline = this.generatePolyline(markers)
    const center = this.calculateCenter(markers)

    const totalDist = (Math.random() * 5 + 3).toFixed(1)
    const totalT = Math.ceil(totalDist * 0.5)

    this.setData({
      guide: {
        ...guide,
        tags
      },
      menuTop,
      menuHeight,
      isCollected,
      routeItems,
      mapMarkers: markers,
      polyline,
      mapCenter: center,
      routeStats: `${guide.duration} · ${guide.shopCount || shopNames.length} 个地点 · ${guide.author || '匿名'}发布`,
      totalDistance: `${totalDist} km`,
      totalTime: `${totalT} 小时`
    })
  },

  getCategoryByShopName(name) {
    const categoryMap = {
      '羊肉泡馍': '美食 · 西北菜',
      '灌汤包': '美食 · 面点',
      '小炒泡馍': '美食 · 西北菜',
      '甑糕': '美食 · 甜点',
      '胡辣汤': '美食 · 小吃',
      '咖啡': '饮品 · 咖啡',
      '书店': '文化 · 阅读',
      '公园': '景点 · 公园',
      '海鲜': '美食 · 海鲜',
      '夜市': '美食 · 小吃',
      '老街': '景点 · 古迹',
      '栈道': '景点 · 徒步'
    }
    for (const [key, value] of Object.entries(categoryMap)) {
      if (name.includes(key)) return value
    }
    return '未分类'
  },

  generateMarkers(items) {
    const baseLat = 22.5431
    const baseLng = 114.0579
    return items.map((item, index) => ({
      id: index,
      latitude: baseLat + (Math.random() - 0.5) * 0.05,
      longitude: baseLng + (Math.random() - 0.5) * 0.05 + (index * 0.015),
      iconPath: index === 0 
        ? '/images/markers/marker_start.png' 
        : index === items.length - 1
          ? '/images/markers/marker_end.png'
          : '/images/markers/marker_food.png',
      width: 48,
      height: 48,
      label: {
        content: String(index + 1),
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: 'bold'
      }
    }))
  },

  generatePolyline(markers) {
    if (markers.length < 2) return []
    return [{
      points: markers.map(m => ({ latitude: m.latitude, longitude: m.longitude })),
      color: '#47BFFE',
      width: 3,
      dottedLine: false
    }]
  },

  calculateCenter(markers) {
    if (markers.length === 0) return { lat: 22.5431, lng: 114.0579 }
    const lats = markers.map(m => m.latitude)
    const lngs = markers.map(m => m.longitude)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
    }
  },

  onBack() {
    wx.navigateBack()
  },

  onShareTap() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' })
  },

  onCollect() {
    const { guide } = this.data
    if (!guide) return
    
    let collects = util.loadData('userCollectedGuides', [])
    const index = collects.findIndex(id => String(id) === String(guide.id))
    let isCollected = false
    
    if (index > -1) {
      collects.splice(index, 1)
    } else {
      collects.push(guide.id)
      isCollected = true
    }
    wx.setStorageSync('userCollectedGuides', collects)
    
    this.setData({ isCollected })
    wx.showToast({
      title: isCollected ? '已收藏' : '已取消收藏',
      icon: 'none',
      duration: 1200
    })
  },

  onViewRoute() {
    const { guide } = this.data
    const routeData = {
      shops: guide.shops || [],
      title: guide.title,
      duration: guide.duration
    }
    wx.navigateTo({
      url: `/pages/route/route?routeData=${encodeURIComponent(JSON.stringify(routeData))}`
    })
  },

  onAddRoute() {
    const { guide } = this.data
    if (!guide) return
    
    let wants = util.loadData('userWantGuides', [])
    const index = wants.findIndex(id => String(id) === String(guide.id))
    let isAdded = false
    
    if (index > -1) {
      wants.splice(index, 1)
    } else {
      wants.push(guide.id)
      isAdded = true
    }
    wx.setStorageSync('userWantGuides', wants)
    
    wx.showToast({
      title: isAdded ? '已加入想去' : '已移除',
      icon: 'none',
      duration: 1200
    })
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    
    wx.showToast({
      title: `查看：${item.name}`,
      icon: 'none'
    })
  },

  onShareAppMessage() {
    const { guide } = this.data
    return {
      title: guide ? `${guide.title} · 旅行路线` : '旅行路线',
      path: guide ? `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}` : '/pages/index/index'
    }
  }
})