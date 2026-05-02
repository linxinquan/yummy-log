// 觅食图 - 探索页逻辑 (合并景点与美食)
const app = getApp()
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')
const util = require('../../utils/util')
const markerIcons = require('../../utils/markerIcons')

const GUANGDONG_CITIES = [
  { id: 1, name: '广州', fullName: '广州市', lat: 23.1291, lng: 113.2644, bgColor: '#DBE8DD', wantCount: 1070 },
  { id: 2, name: '深圳', fullName: '深圳市', lat: 22.5431, lng: 114.0579, bgColor: '#DAE5E8', wantCount: 1070 },
  { id: 3, name: '汕头', fullName: '汕头市', lat: 23.3541, lng: 116.6819, bgColor: '#E4D8DC', wantCount: 1070 },
  { id: 4, name: '湛江', fullName: '湛江市', lat: 21.2707, lng: 110.3594, bgColor: '#E6DBD8', wantCount: 1070 },
  { id: 5, name: '汕尾', fullName: '汕尾市', lat: 22.7862, lng: 115.3751, bgColor: '#DAE5E8', wantCount: 1070 },
  { id: 6, name: '清远', fullName: '清远市', lat: 23.6817, lng: 113.0560, bgColor: '#E0E0E0', wantCount: 1070 },
  { id: 7, name: '佛山', fullName: '佛山市', lat: 23.0215, lng: 113.1214, bgColor: '#DCE5DE', wantCount: 1070 },
  { id: 8, name: '东莞', fullName: '东莞市', lat: 23.0207, lng: 113.7518, bgColor: '#D8E3E8', wantCount: 1070 },
  { id: 9, name: '珠海', fullName: '珠海市', lat: 22.2710, lng: 113.5767, bgColor: '#E3DBE6', wantCount: 1070 },
  { id: 10, name: '中山', fullName: '中山市', lat: 22.5176, lng: 113.3928, bgColor: '#E5DFDA', wantCount: 1070 },
  { id: 11, name: '江门', fullName: '江门市', lat: 22.5787, lng: 113.0819, bgColor: '#DCE5E3', wantCount: 1070 },
  { id: 12, name: '惠州', fullName: '惠州市', lat: 23.1118, lng: 114.4168, bgColor: '#DCE3E8', wantCount: 1070 },
  { id: 13, name: '肇庆', fullName: '肇庆市', lat: 23.0472, lng: 112.4651, bgColor: '#E6DDE2', wantCount: 1070 },
  { id: 14, name: '茂名', fullName: '茂名市', lat: 21.6633, lng: 110.9255, bgColor: '#E6E0DA', wantCount: 1070 },
  { id: 15, name: '阳江', fullName: '阳江市', lat: 21.8579, lng: 111.9822, bgColor: '#DCE7E0', wantCount: 1070 },
  { id: 16, name: '梅州', fullName: '梅州市', lat: 24.2886, lng: 116.1176, bgColor: '#D9E3E8', wantCount: 1070 },
  { id: 17, name: '河源', fullName: '河源市', lat: 23.7437, lng: 114.7004, bgColor: '#E4DCE3', wantCount: 1070 },
  { id: 18, name: '韶关', fullName: '韶关市', lat: 24.8104, lng: 113.5972, bgColor: '#E3DFDB', wantCount: 1070 },
  { id: 19, name: '揭阳', fullName: '揭阳市', lat: 23.5498, lng: 116.3728, bgColor: '#DCE5E1', wantCount: 1070 },
  { id: 20, name: '潮州', fullName: '潮州市', lat: 23.6567, lng: 116.6226, bgColor: '#D7E2E6', wantCount: 1070 },
  { id: 21, name: '云浮', fullName: '云浮市', lat: 22.9153, lng: 112.0445, bgColor: '#E2DEE0', wantCount: 1070 }
]

function buildCityCoverPool() {
  const foodCovers = [...(shopData.shops || []), ...(shopData.foods || [])]
    .map(item => item.logo || item.image || item.thumb)
    .filter(Boolean)
  const spotCovers = (spotData.spotData || [])
    .map(item => item.image)
    .filter(Boolean)
  return [...foodCovers, ...spotCovers]
}

Page({
  data: {
    // 布局与交互
    statusBarHeight: 44,
    sheetHeight: 300,
    isDragging: false,

    // 地图配置
    mapCenter: {
      lat: 22.4846,
      lng: 113.9046
    },
    mapScale: 15,
    allMarkers: [],
    
    // 分类
    exploreCategories: [
      { name: '全部', icon: 'mgc_category_fill', color: '#9B59B6' },
      { name: '热门', icon: 'mgc_flame_fill', color: '#E74C3C' },
      { name: '美食', icon: 'mgc_food_fill', color: '#E67E22' },
      { name: '景点', icon: 'mgc_tree_pine_fill', color: '#27AE60' },
      { name: '酒店民宿', icon: 'mgc_home_5_fill', color: '#3498DB' },
      { name: '饮品甜点', icon: 'mgc_coffee_cup_fill', color: '#9B59B6' },
      { name: '自然户外', icon: 'mgc_mountain_fill', color: '#2ECC71' },
      { name: '文化艺术', icon: 'mgc_palette_fill', color: '#F39C12' }
    ],
    currentCategory: '全部',
    
    // 排序
    sortType: 'distance', // distance | rating
    
    // 数据
    allItems: [],
    filteredItems: [],
    pageSize: 10,
    currentPage: 1,
    hasMore: true,
    
    // 用户数据
    likedShops: [],
    visitedShops: {},
    
    // 地理位置选择
    currentDistrict: '', 
    currentDistance: 0, 
    showLocationPicker: false, 
    currentCity: '深圳市', 
    locationMode: 'my',
    cityOptions: []
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (sysInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuButtonWidth = menuButtonInfo ? menuButtonInfo.width : 87
    const menuRightInset = menuButtonInfo
      ? Math.max(sysInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103
    
    // 计算顶部面板高度：胶囊按钮位置 + 分类标签滚动区域的高度
    const rpxToPx = sysInfo.windowWidth / 750
    const categoryAreaHeight = 120 * rpxToPx
    const headerRowHeight = menuHeight + 20 // nav-bar(含padding) + weather-row(含padding)
    const topPanelHeight = menuTop + headerRowHeight + categoryAreaHeight
    
    // 计算收起时的高度: 
    // handle area高度(24rpx) = 24rpx
    const minHeightRpx = 24
    const minHeight = minHeightRpx * rpxToPx
    
    // 计算最大高度：屏幕高度 - 顶部面板高度 - tabBar高度(50px) - 安全区域底部
    const tabBarHeight = 50
    const sysMaxHeight = sysInfo.windowHeight - topPanelHeight - tabBarHeight - (sysInfo.safeAreaBottom || 0)
    
    // 计算弹窗底部偏移（tabBar高度 + 安全区域底部 + handle区域高度）
    const handleHeight = 24 // 24px
    const sheetBottom = tabBarHeight + (sysInfo.safeAreaBottom || 0) + handleHeight
    
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight || 44,
      menuTop: menuTop,
      menuHeight: menuHeight,
      menuButtonWidth: menuButtonWidth,
      menuRightInset,
      topPanelHeight: topPanelHeight,
      sheetBottom: sheetBottom,
      sysMinHeight: minHeight,
      sysMaxHeight: sysMaxHeight,
      sheetHeight: minHeight, // 默认收起状态
      isSheetExpanded: false // 默认收起状态
    })

    this.initCityOptions()

    this.loadItems()
    this.loadUserData()
    
    markerIcons.ensureIcons(() => {
      this.updateMarkers()
    })
    
    app.whenLocationReady((loc) => {
      this.setData({ mapCenter: { lat: loc.lat, lng: loc.lng } })
      this.applyFilters()
    })
    
    app.whenDistrictReady((info, locationDesc) => {
      this.setData({ 
        currentCity: info.city
      })
    })
  },

  initCityOptions() {
    const coverPool = buildCityCoverPool()
    const cityOptions = GUANGDONG_CITIES.map((city, index) => ({
      ...city,
      coverImage: coverPool[index % coverPool.length] || '/images/app-logo.jpg'
    }))
    this.setData({ cityOptions })
  },

  onShow() {
    this.loadUserData()
    this.updateItemStatus()
  },

  // 加载数据 (混合美食和景点)
  loadItems() {
    const userShops = util.loadData('userAddedShops', [])
    
    // 处理美食
    const foods = [...shopData.shops, ...shopData.foods, ...userShops].map(shop => {
      // 过滤掉行政区划标签，并最多取2个
      const filteredTags = (shop.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2);
      return {
        ...shop,
        tags: filteredTags,
        type: 'food',
        displayCategory: shop.category || '美食',
        lat: shop.lat || shop.latitude,
        lng: shop.lng || shop.longitude,
        displayImage: shop.logo || shop.image || shop.thumb // 统一图片字段
      };
    })
    
    // 处理景点
    const spots = spotData.spotData.map(spot => {
      // 最多取2个
      const filteredTags = (spot.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2);
      return {
        ...spot,
        tags: filteredTags,
        type: 'spot',
        displayCategory: spot.category || '景点',
        displayImage: spot.image || spot.logo || spot.thumb // 统一图片字段
      };
    })
    
    const allItems = [...spots, ...foods]
    this.setData({ allItems })
    this.applyFilters()
  },

  loadUserData() {
    const wantFoods = util.loadData('userWantFoods', [])
    const wantSpots = util.loadData('userWantSpots', [])
    const checkedIn = util.loadData('userCheckedIn', [])
    
    // 合并所有的想去 ID，方便在混合列表中判断
    const likedShops = [...wantFoods, ...wantSpots]

    this.setData({
      likedShops: likedShops,
      visitedShops: checkedIn
    })
    this.updateItemStatus()
  },

  updateItemStatus() {
    const { allItems, likedShops } = this.data
    const updatedItems = allItems.map(item => {
      // util 中的存储都统一转为了 String，所以这里比较时也转为 String
      const isLiked = likedShops.includes(String(item.id)) || likedShops.includes(Number(item.id))
      const baseWant = item.wantCount || 1024
      const actualWant = isLiked ? baseWant + 1 : baseWant
      
      // 格式化想去人数
      let displayWantCount = actualWant
      if (actualWant >= 10000) {
        displayWantCount = (actualWant / 10000).toFixed(1).replace('.0', '') + 'w'
      } else if (actualWant >= 1000) {
        displayWantCount = (actualWant / 1000).toFixed(1).replace('.0', '') + 'k'
      }

      return { 
        ...item, 
        isLiked,
        displayWantCount
      }
    })
    this.setData({ allItems: updatedItems })
    this.applyFilters()
  },

  // 筛选与计算
  applyFilters() {
    let { allItems, currentCategory, sortType, currentDistance, mapCenter } = this.data
    
    let filtered = allItems
    
    // 分类筛选
    if (currentCategory === '景点') {
      filtered = filtered.filter(i => i.type === 'spot')
    } else if (currentCategory === '美食') {
      filtered = filtered.filter(i => i.type === 'food')
    } else if (currentCategory === '饮品') {
      filtered = filtered.filter(i => i.type === 'food' && (i.category === '饮品' || i.category === '咖啡' || i.tags?.includes('糖水')))
    } else if (currentCategory === '购物' || currentCategory === '住宿') {
      filtered = [] // 暂无数据
    }
    
    // 距离计算与排序
    const centerLat = mapCenter?.lat || 22.4846
    const centerLng = mapCenter?.lng || 113.9046
    
    filtered = filtered.map(item => {
      const dist = this.calculateDistance(centerLat, centerLng, item.lat, item.lng)
      return {
        ...item,
        distanceRaw: dist,
        distance: this.formatDistance(dist)
      }
    })
    
    // 排序
    if (sortType === 'distance') {
      filtered.sort((a, b) => a.distanceRaw - b.distanceRaw)
    } else if (sortType === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    }
    
    this.setData({ 
      filteredItems: filtered,
      hasMore: filtered.length > this.data.pageSize
    })
    
    this.updateMarkers()
  },

  updateMarkers() {
    const items = this.data.filteredItems
    if (!items || items.length === 0) {
      this.setData({ allMarkers: [] })
      return
    }

    const markers = items.map(item => {
      if (item.type === 'spot') {
        return {
          id: item.id,
          latitude: item.lat,
          longitude: item.lng,
          iconPath: '/images/markers/marker_景点.png',
          width: 28,
          height: 28,
          callout: {
            content: `🌲 ${item.name}\n★ ${item.rating}  ${item.free ? '免费' : '收费'}`,
            color: '#1A1A2E',
            fontSize: 12,
            borderRadius: 10,
            padding: 8,
            display: 'BYCLICK',
            bgColor: '#ffffff',
            borderColor: '#27AE60',
            borderWidth: 1.5
          }
        }
      } else {
        const catColor = markerIcons.getCategoryColor(item.category)
        const catEmoji = markerIcons.getCategoryEmoji(item.category)
        const iconPath = markerIcons.getIconPath(item.category) || '/images/markers/marker_默认.png'
        return {
          id: item.id,
          latitude: item.lat,
          longitude: item.lng,
          iconPath: iconPath,
          width: 28,
          height: 28,
          callout: {
            content: `${catEmoji} ${item.name}\n★ ${item.rating || '暂无'}  ¥${item.price || '--'}/人`,
            color: '#1A1A2E',
            fontSize: 12,
            borderRadius: 10,
            padding: 8,
            display: 'BYCLICK',
            bgColor: '#ffffff',
            borderColor: catColor || '#E6A817',
            borderWidth: 1.5
          }
        }
      }
    })

    this.setData({ allMarkers: markers })
  },

  // ─── Bottom Sheet 拖拽逻辑 ───
  onSheetTouchStart(e) {
    this.startY = e.touches[0].clientY
    this.startHeight = this.data.sheetHeight
    this.setData({ isDragging: true })
  },

  onSheetTouchMove(e) {
    if (!this.data.isDragging) return
    const currentY = e.touches[0].clientY
    const deltaY = this.startY - currentY // 向上滑动距离为正
    let newHeight = this.startHeight + deltaY
    
    const minHeight = this.data.sysMinHeight // 使用精确计算的高度
    const maxHeight = this.data.sysMaxHeight
    
    if (newHeight < minHeight) newHeight = minHeight
    if (newHeight > maxHeight) newHeight = maxHeight
    
    this.setData({ sheetHeight: newHeight })
  },

  onSheetTouchEnd(e) {
    this.setData({ isDragging: false })
    
    const sysInfo = wx.getSystemInfoSync()
    const wh = sysInfo.windowHeight
    const minH = this.data.sysMinHeight // 使用精确计算的高度
    const midH = wh * 0.45
    const maxH = this.data.sysMaxHeight
    
    const h = this.data.sheetHeight
    let finalHeight = midH
    
    if (h < midH - 60) {
      finalHeight = minH
    } else if (h > midH + 60) {
      finalHeight = maxH
    } else {
      finalHeight = midH
    }
    
    this.setData({ sheetHeight: finalHeight, isSheetExpanded: finalHeight > minH })
  },

  // 分类切换
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category, currentPage: 1 })
    this.applyFilters()
  },

  // 排序切换
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.sort
    this.setData({ sortType, currentPage: 1 })
    this.applyFilters()
  },

  // 点击卡片
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.type === 'spot') {
      wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${item.id}` })
    } else {
      wx.navigateTo({ url: `/pages/shop-detail/shop-detail?shopData=${encodeURIComponent(JSON.stringify(item))}` })
    }
  },

  // 标记点击
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const item = this.data.allItems.find(s => s.id === markerId)
    if (item) {
      this.onItemTap({ currentTarget: { dataset: { item } } })
    }
  },

  // 点击定位
  onMyLocation() {
    wx.showLoading({ title: '定位中...' })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        wx.hideLoading()
        const loc = { lat: res.latitude, lng: res.longitude }
        app.globalData.location = loc
        this.setData({ 
          mapCenter: loc,
          currentDistrict: '',
          currentCity: (app.globalData.districtInfo && app.globalData.districtInfo.city) || this.data.currentCity,
          locationMode: 'my'
        })
        this.applyFilters()
        wx.showToast({ title: '已定位到当前位置', icon: 'success', duration: 1500 })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '定位失败', icon: 'none' })
      }
    })
  },

  // 地图放大
  onMapZoomIn() {
    const currentScale = this.data.mapScale
    if (currentScale < 20) {
      const newScale = Math.min(currentScale + 2, 20)
      this.setData({ mapScale: newScale })
    }
  },

  // 地图缩小
  onMapZoomOut() {
    const currentScale = this.data.mapScale
    if (currentScale > 3) {
      const newScale = Math.max(currentScale - 2, 3)
      this.setData({ mapScale: newScale })
    }
  },

  // 想去/取消想去
  onToggleLike(e) {
    const shopId = e.currentTarget.dataset.shopid
    const type = e.currentTarget.dataset.type || 'food' // 获取当前项类型 (food / spot)
    const isLiked = util.toggleLike(shopId, type)
    
    // 重新从本地存储加载最新状态
    this.loadUserData()
    
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已取消',
      icon: 'none',
      duration: 1000
    })
  },
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000 
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + 'm'
    return (meters / 1000).toFixed(1) + 'km'
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const key = `filteredItems[${index}].image`
    this.setData({ [key]: '/images/app-logo.jpg' })
  },

  onLoadMore() {
    // 暂无更多数据处理
  },

  // 位置选择器
  onOpenLocationPicker() { this.setData({ showLocationPicker: true }) },
  onCloseLocationPicker() { this.setData({ showLocationPicker: false }) },
  preventBubble() { },
  onSelectCity(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.setData({ 
      currentCity: item.fullName,
      currentDistrict: '',
      mapCenter: {
        lat: item.lat,
        lng: item.lng
      },
      locationMode: 'city',
      showLocationPicker: false
    })
    this.applyFilters()
  },

  // 打开想去清单（切换Tab）
  onOpenRoute() {
    wx.switchTab({
      url: '/pages/wantgo/wantgo'
    })
  },

  onToggleMap() {
    // 切换收起状态，显示地图
    this.setData({
      isSheetExpanded: false,
      sheetHeight: this.data.sysMinHeight // 恢复精确计算的收起高度
    })
  },

  onExpandSheet() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      isSheetExpanded: true,
      sheetHeight: sysInfo.windowHeight * 0.45
    })
  },

  onListBtnTap() {
    const sysInfo = wx.getSystemInfoSync()
    const wh = sysInfo.windowHeight
    const minH = this.data.sysMinHeight
    const midH = wh * 0.45
    const maxH = this.data.sysMaxHeight

    const currentH = this.data.sheetHeight

    if (currentH < midH - 60) {
      // 当前在收起状态，第一次点击 -> 半屏
      this.setData({
        isSheetExpanded: true,
        sheetHeight: midH
      })
    } else {
      // 当前在半屏状态，第二次点击 -> 全屏
      this.setData({
        isSheetExpanded: true,
        sheetHeight: maxH
      })
    }
  },

  onSearchTap() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    })
  },

  onProfileTap() {
    wx.switchTab({
      url: '/pages/my/my'
    })
  }
})
