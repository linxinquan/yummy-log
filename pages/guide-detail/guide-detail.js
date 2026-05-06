const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    guide: null,
    menuTop: 0,
    menuHeight: 32,
    isCollected: false,
    mode: 'list', // 'map' or 'list'
    currentDay: 0, // 0=总览
    dateTabs: ['总览', '第1天', '第2天', '第3天', '第4天'],
    daySummaries: [],
    allDaySpots: [],
    mapCenter: { lat: 22.5431, lng: 114.0579 },
    mapMarkers: [],
    polyline: []
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
    const isCollected = util.loadData('userCollectedGuides', []).some(id => String(id) === String(guide.id))

    const daySummaries = this.generateDaySummaries(guide)
    const allDaySpots = this.generateAllDaySpots(guide)
    const markers = this.generateMarkers(allDaySpots)
    const polyline = this.generatePolyline(markers)
    const center = this.calculateCenter(markers)

    this.setData({
      guide,
      menuTop,
      menuHeight,
      isCollected,
      daySummaries,
      allDaySpots,
      mapMarkers: markers,
      polyline,
      mapCenter: center
    })
  },

  generateDaySummaries(guide) {
    const covers = [
      '/images/covers/01.jpeg',
      '/images/covers/02.jpeg', 
      '/images/covers/03.jpeg',
      '/images/covers/04.jpeg'
    ]
    
    return [
      {
        location: '西安市',
        route: '钟楼 --- 马洪小炒泡馍馆 --- 西安碑林博物馆 --- 西安城墙永宁门城楼(南入口)-西安书院门步行街',
        image: covers[0]
      },
      {
        location: '',
        route: '小南门便民早市 --- 小雁塔-西安博物院 --- 陕西历史博物馆-秦椒香biangbiang面陕菜馆-大雁塔北广场 --- 赳赳大秦',
        image: covers[1]
      },
      {
        location: '',
        route: '秦始皇帝陵博物院丽山园 --- 秦始皇帝兵马俑博物馆 --- 华清宫 --- 长恨歌演出',
        image: covers[2]
      },
      {
        location: '西安市',
        route: '赛格国际购物中心',
        image: covers[3]
      }
    ]
  },

  generateAllDaySpots(guide) {
    const covers = [
      '/images/covers/01.jpeg',
      '/images/covers/02.jpeg', 
      '/images/covers/03.jpeg',
      '/images/covers/04.jpeg',
      '/images/covers/01.jpeg',
      '/images/covers/02.jpeg',
      '/images/covers/03.jpeg',
      '/images/covers/04.jpeg'
    ]

    return [
      [
        { name: '钟楼', desc: '西安标志性建筑，明代古城楼典范', tag: '景点', image: covers[0], distance: '', time: '' },
        { name: '马洪小炒泡馍馆', desc: '本地老字号，正宗小炒泡馍', tag: '美食', image: covers[1], distance: '2.9km', time: '14分钟' },
        { name: '西安碑林博物馆', desc: '收藏历代碑石最多的博物馆', tag: '景点', image: covers[2], distance: '1.2km', time: '8分钟' },
        { name: '西安城墙永宁门城楼', desc: '明城墙正南门，历史悠久', tag: '景点', image: covers[3], distance: '1.5km', time: '10分钟' }
      ],
      [
        { name: '小南门便民早市', desc: '本地人气早市，烟火气十足', tag: '美食', image: covers[0], distance: '', time: '' },
        { name: '小雁塔-西安博物院', desc: '唐代佛塔，文物丰富', tag: '景点', image: covers[1], distance: '3.2km', time: '20分钟' },
        { name: '陕西历史博物馆', desc: '陕西文物精华汇集地', tag: '景点', image: covers[2], distance: '1.8km', time: '12分钟' },
        { name: '大雁塔北广场', desc: '亚洲最大音乐喷泉广场', tag: '景点', image: covers[3], distance: '2.5km', time: '15分钟' }
      ],
      [
        { name: '秦始皇帝陵博物院丽山园', desc: '国家5A景区，兵马俑震撼壮观', tag: '景点', image: covers[4], distance: '', time: '' },
        { name: '秦始皇帝兵马俑博物馆', desc: '世界第八大奇迹，地下军团', tag: '景点', image: covers[5], distance: '13.6km', time: '35分钟' },
        { name: '华清宫', desc: '皇家园林，温泉胜地', tag: '景点', image: covers[6], distance: '1.5km', time: '21分钟' },
        { name: '长恨歌演出', desc: '大型实景历史舞剧', tag: '演出', image: covers[7], distance: '2.3km', time: '18分钟' }
      ],
      [
        { name: '赛格国际购物中心', desc: '西安最大购物中心，室内瀑布', tag: '购物', image: covers[0], distance: '', time: '' }
      ]
    ]
  },

  generateMarkers(allDaySpots) {
    const baseLat = 22.5431
    const baseLng = 114.0579
    const allSpots = allDaySpots.flat()
    
    return allSpots.map((spot, index) => ({
      id: index,
      latitude: baseLat + (Math.random() - 0.5) * 0.08,
      longitude: baseLng + (Math.random() - 0.5) * 0.08 + (index * 0.01),
      iconPath: index === 0 
        ? '/images/markers/marker_start.png' 
        : index === allSpots.length - 1
          ? '/images/markers/marker_end.png'
          : '/images/markers/marker_food.png',
      width: 56,
      height: 56,
      label: {
        content: String(index + 1),
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: 'bold'
      },
      callout: {
        content: spot.name,
        fontSize: 12,
        borderRadius: 8,
        bgColor: '#FFFFFF',
        padding: 8
      }
    }))
  },

  generatePolyline(markers) {
    if (markers.length < 2) return []
    return [{
      points: markers.map(m => ({ latitude: m.latitude, longitude: m.longitude })),
      color: '#FF6B35',
      width: 4,
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

  onTip() {
    wx.showToast({ title: '暂无提示', icon: 'none' })
  },

  onToggleMode() {
    this.setData({
      mode: this.data.mode === 'list' ? 'map' : 'list'
    })
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

  onDateTab(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentDay: index })
  },

  onDayCard(e) {
    const day = e.currentTarget.dataset.day
    this.setData({ currentDay: day })
  },

  onSpotTap(e) {
    const spot = e.currentTarget.dataset.spot
    if (!spot) return
    wx.showToast({ title: `查看：${spot.name}`, icon: 'none' })
  },

  onEditRoute() {
    wx.showToast({ title: '编辑路线功能开发中', icon: 'none' })
  },

  onStartNav() {
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

  get currentDayName() {
    return this.data.dateTabs[this.data.currentDay]
  },

  get currentDaySpots() {
    if (this.data.currentDay === 0) {
      return this.data.allDaySpots[0] || []
    }
    return this.data.allDaySpots[this.data.currentDay - 1] || []
  },

  get currentRouteText() {
    if (this.data.currentDay === 0) {
      return this.data.daySummaries[0]?.route || ''
    }
    return this.data.daySummaries[this.data.currentDay - 1]?.route || ''
  },

  onShareAppMessage() {
    const { guide } = this.data
    return {
      title: guide ? `${guide.title} · 旅行路线` : '旅行路线',
      path: guide ? `/pages/guide-detail/guide-detail?guide=${encodeURIComponent(JSON.stringify(guide))}` : '/pages/index/index'
    }
  }
})