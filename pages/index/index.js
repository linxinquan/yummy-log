// 觅食图 - 探索页逻辑 (合并景点与美食)
const app = getApp()
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const markerIcons = require('../../utils/markerIcons')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')

// 重新定位后，把地图拉近到当前位置附近，避免只更新中心点却看起来没变化。
const MY_LOCATION_FOCUS_SCALE = 17

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

Page({
  data: {
    // 布局与交互
    statusBarHeight: 44,
    sheetHeight: 300,
    isDragging: false,
    tabBarHeight: 50, // tabBar高度
    safeAreaBottom: 0, // 安全区域底部高度

    // 地图配置
    mapCenter: {
      lat: 22.4846,
      lng: 113.9046
    },
    mapScale: 15,
    allMarkers: [],
    
    // 分类
    exploreCategories: [
      { name: '全部', icon: 'mgc_grid_line', color: '#9B59B6' },
      { name: '美食', icon: 'mgc_fork_spoon_line', color: '#E67E22' },
      { name: '景点', icon: 'mgc_map_line', color: '#27AE60' },
      { name: '酒店', icon: 'mgc_store_line', color: '#3498DB' },
      { name: '饮品', icon: 'mgc_drink_line', color: '#9B59B6' },
      { name: '购物', icon: 'mgc_shopping_bag_line', color: '#E91E63' },
      { name: '自然户外', icon: 'mgc_tree_line', color: '#2ECC71' },
      { name: '文化展馆', icon: 'mgc_compass_line', color: '#F39C12' }
    ],
    currentCategory: '全部',
    scrollToCategory: '',
    
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
    const windowInfo = wx.getWindowInfo()
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const menuTop = menuButtonInfo ? menuButtonInfo.top : (windowInfo.statusBarHeight || 44) + 4
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32
    const menuButtonWidth = menuButtonInfo ? menuButtonInfo.width : 87
    const menuRightInset = menuButtonInfo
      ? Math.max(windowInfo.windowWidth - menuButtonInfo.left + 8, 24)
      : 103
    
    // 计算顶部面板高度：胶囊按钮位置 + 分类标签滚动区域的高度
    const rpxToPx = windowInfo.windowWidth / 750
    const categoryAreaHeight = 120 * rpxToPx
    const headerRowHeight = menuHeight + 20 // nav-bar(含padding) + weather-row(含padding)
    const topPanelHeight = menuTop + headerRowHeight + categoryAreaHeight
    
    // 计算收起时的高度:
    // 收起状态只显示拖拽区域，使用屏幕高度百分比
    const minHeight = windowInfo.windowHeight * 0.08
    
    // 计算最大高度：屏幕高度 - 顶部面板高度(不含分类菜单) - tabBar高度(50px) - 安全区域底部
    // 保留部分顶部空间给分类菜单，避免遮挡
    const tabBarHeight = 50
    const topReserve = 100 // 顶部预留空间，防止遮挡分类菜单
    const sysMaxHeight = windowInfo.windowHeight - topPanelHeight + categoryAreaHeight - tabBarHeight - (windowInfo.safeAreaBottom || 0) - topReserve
    
    // 计算弹窗底部偏移（tabBar高度 + 安全区域底部）
    const sheetBottom = tabBarHeight + (windowInfo.safeAreaBottom || 0)
    
    // 计算半屏高度
    const midHeight = windowInfo.windowHeight * 0.45
    
    this.setData({ 
      statusBarHeight: windowInfo.statusBarHeight || 44,
      menuTop: menuTop,
      menuHeight: menuHeight,
      menuButtonWidth: menuButtonWidth,
      menuRightInset,
      topPanelHeight: topPanelHeight,
      sheetBottom: sheetBottom,
      sysMinHeight: minHeight,
      sysMidHeight: midHeight,
      sysMaxHeight: sysMaxHeight,
      sheetHeight: minHeight, // 默认收起状态
      isSheetExpanded: false, // 默认收起状态
      tabBarHeight: tabBarHeight,
      safeAreaBottom: windowInfo.safeAreaBottom || 0
    })

    // 延迟加载非关键数据，避免阻塞页面渲染
    setTimeout(() => {
      this.initCityOptions()
    }, 0)

    // 加载数据
    this.loadItems()
    
    // 监听数据变更（后台刷新合并后触发，补全其他城市数据）
    this._onDataUpdate = () => {
      console.log('[index] 数据已更新，刷新列表')
      this.loadItems()
    }
    placesData.onUpdate(this._onDataUpdate)
    
    // 延迟加载用户数据，避免阻塞
    setTimeout(() => {
      this.loadUserData()
    }, 0)
    
    // 确保图标加载完成后再更新标记（避免重复调用 applyFilters）
    markerIcons.ensureIcons(() => {
      // 使用统一调度，避免重复计算
      this._scheduleApplyFilters()
    })
    
    app.whenLocationReady((loc) => {
      this.setData({ mapCenter: { lat: loc.lat, lng: loc.lng } })
      // 使用统一调度，避免重复计算
      this._scheduleApplyFilters()
    })
    
    app.whenDistrictReady((info, locationDesc) => {
      this.setData({ 
        currentCity: info.city
      })
    })
    
    // 监听图标加载完成事件
    this._iconsReady = false
    markerIcons.ensureIcons(() => {
      this._iconsReady = true
    })
  },

  initCityOptions() {
    const coverPool = DEFAULT_COVER_POOL
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

  onUnload() {
    // 取消数据变更监听，避免内存泄漏
    if (this._onDataUpdate) {
      placesData.offUpdate(this._onDataUpdate)
      this._onDataUpdate = null
    }
  },

  // 统一调度 applyFilters，避免重复调用
  _scheduleApplyFilters() {
    if (this._applyFiltersTimer) {
      clearTimeout(this._applyFiltersTimer)
    }
    this._applyFiltersTimer = setTimeout(() => {
      this.applyFilters()
      this._applyFiltersTimer = null
    }, 0)
  },

  // 加载数据 (混合美食和景点)
  async loadItems() {
    // 等待 placesData 初始化完成（解决启动时序竞争问题）
    await placesData.whenReady()
    console.log('loadItems')
    const userShops = util.loadData('userAddedShops', [])
    const currentCity = this.data.currentCity || '深圳市'
    
    // 为用户添加的数据补充 city 字段
    const userShopsWithCity = userShops.map(shop => {
      if (!shop.city) {
        const cityShort = util.getCityShortName(currentCity)
        return { ...shop, city: cityShort }
      }
      return shop
    })
    
    // 直接从 placesData 获取所有数据（已包含真实数据+演示数据）
    const allPlaces = [...placesData.getAllPlaces(), ...userShopsWithCity].map(item => {
      // 标签里像"南山区"这种行政区信息不展示，只保留前 2 个业务标签。
      const filteredTags = (item.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2);
      
      return {
        ...item,
        tags: filteredTags,
      };
    })
    console.log('allPlaces', allPlaces)
    // 直接设置为总列表，不再需要合并演示数据
    this.setData({ allItems: allPlaces })
    this._scheduleApplyFilters()
  },

  // 读取用户状态：
  // 这里主要拿"想去"和"足迹"的本地缓存。
  loadUserData() {
    const wantFoods = util.loadData('userWantFoods', [])
    const wantSpots = util.loadData('userWantSpots', [])
    const checkedIn = util.getFootprintItems()
    
    // 合并所有的想去 ID，方便在混合列表中判断
    const likedShops = [...wantFoods, ...wantSpots]

    this.setData({
      likedShops: likedShops,
      visitedShops: checkedIn.map(item => String(item.id))
    })
    this.updateItemStatus()
  },

  // 把"是否想去"和"想去人数展示文案"刷新到列表数据里。
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
    this._scheduleApplyFilters()
  },

  // 按当前分类、排序和地图中心点，重新生成当前可见列表。
  // 全量数据存入 _fullFilteredList，UI 只展示第一页
  applyFilters() {
    let { allItems, currentCategory, sortType, currentDistance, mapCenter, currentCity, pageSize } = this.data
    
    let filtered = allItems
    console.log('applyFilters', filtered)
    
    // 城市筛选：根据当前选中的城市进行筛选
    if (currentCity) {
      const cityShort = util.getCityShortName(currentCity)
      filtered = filtered.filter(i => i.city === cityShort)
    }
    
    // 分类筛选
    if (currentCategory === '景点') {
      filtered = filtered.filter(i => i.type === 'spot')
    } else if (currentCategory === '美食') {
      filtered = filtered.filter(i => i.type === 'food')
    } else if (currentCategory === '饮品') {
      filtered = filtered.filter(i => i.type === 'food' && (i.category === '饮品' || i.category === '咖啡' || i.tags?.includes('糖水')))
    } else if (currentCategory === '购物') {
      filtered = filtered.filter(i => i.type === 'shopping')
    } else if (currentCategory === '酒店') {
      filtered = filtered.filter(i => i.type === 'hotel')
    } else if (currentCategory === '自然户外') {
      filtered = filtered.filter(i => i.type === 'outdoor')
    } else if (currentCategory === '文化展馆') {
      filtered = filtered.filter(i => i.type === 'culture')
    }
    // '全部' 时不筛选，显示所有数据
    
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
    console.log('applyFilters', filtered)
    
    // 排序
    if (sortType === 'distance') {
      filtered.sort((a, b) => a.distanceRaw - b.distanceRaw)
    } else if (sortType === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    }
    
    // 缓存全量结果，UI 只渲染第一页
    this._fullFilteredList = filtered
    const firstPage = filtered.slice(0, pageSize)
    
    this.setData({ 
      filteredItems: firstPage,
      hasMore: filtered.length > pageSize,
      currentPage: 1
    })
    
    this.updateMarkers()
  },

  // 根据当前列表更新地图上的点位。
  updateMarkers() {
    const items = this.data.filteredItems
    if (!items || items.length === 0) {
      this.setData({ allMarkers: [] })
      return
    }

    const markers = items.map(item => {
      const isSpot = item.type === 'spot'
      let markerCategory
      switch(item.type) {
        case 'spot':
          markerCategory = '景点'
          break
        case 'food':
          markerCategory = '美食'
          break
        case 'culture':
          markerCategory = '文化展馆'
          break
        case 'outdoor':
          markerCategory = '自然户外'
          break
        case 'shopping':
          markerCategory = '购物'
          break
        case 'hotel':
          markerCategory = '酒店'
          break
        default:
          markerCategory = '美食'
      }
      
      const catColor = markerIcons.getCategoryColor(markerCategory)
      const catEmoji = markerIcons.getCategoryEmoji(markerCategory)
      const markerIconPath = markerIcons.getIconPath(markerCategory)

      return {
        id: item.id,
        latitude: item.lat,
        longitude: item.lng,
        iconPath: markerIconPath,
        width: 28,
        height: 28,
        callout: {
          content: isSpot 
            ? `${catEmoji} ${item.name}\n★ ${item.rating}  ${item.free ? '免费' : '收费'}`
            : `${catEmoji} ${item.name}\n★ ${item.rating || '暂无'}  ¥${item.price || '--'}/人`,
          color: '#1A1A2E',
          fontSize: 12,
          borderRadius: 10,
          padding: 8,
          display: 'BYCLICK',
          bgColor: '#ffffff',
          borderColor: catColor,
          borderWidth: 1.5
        }
      }
    })

    this.setData({ allMarkers: markers })
  },

  // ─── Bottom Sheet 拖拽逻辑：开始拖动 ───
  onSheetTouchStart(e) {
    this.startY = e.touches[0].clientY
    this.startHeight = this.data.sheetHeight
    this.setData({ isDragging: true })
  },

  // Bottom Sheet 拖动过程：实时改变列表面板高度
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

  // Bottom Sheet 松手后：自动吸附到收起 / 半屏 / 全屏 其中一个状态
  onSheetTouchEnd(e) {
    this.setData({ isDragging: false })
    
    const windowInfo = wx.getWindowInfo()
    const wh = windowInfo.windowHeight
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
    
    this.setData({ 
      sheetHeight: finalHeight, 
      isSheetExpanded: finalHeight > minH
    })
  },

  // 切换顶部分类，例如美食、景点、购物
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ 
      currentCategory: category, 
      currentPage: 1,
      scrollToCategory: '' // 先清空触发重新滚动
    })
    // 异步设置滚动目标，确保scroll-view重新渲染
    setTimeout(() => {
      this.setData({ scrollToCategory: 'cat-' + category })
    }, 10)
    this._scheduleApplyFilters()
  },

  // 切换排序方式，例如按距离、按评分
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.sort
    this.setData({ sortType, currentPage: 1 })
    this._scheduleApplyFilters()
  },

  // 点击列表卡片：根据类型进入景点详情或美食详情
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (item.type === 'spot') {
      wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
    } else {
      wx.navigateTo({ url: `/subpackages/extra/pages/shop-detail/shop-detail?shopData=${encodeURIComponent(JSON.stringify(item))}` })
    }
  },

  // 点击地图上的标记点，等同于点击对应的列表卡片
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const item = this.data.allItems.find(s => s.id === markerId)
    if (item) {
      this.onItemTap({ currentTarget: { dataset: { item } } })
    }
  },

  // 重新定位到当前用户位置
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
          // 重新定位后同步拉近地图，让当前位置区域更明确。
          mapScale: MY_LOCATION_FOCUS_SCALE,
          currentDistrict: '',
          currentCity: (app.globalData.districtInfo && app.globalData.districtInfo.city) || this.data.currentCity,
          locationMode: 'my'
        })
        this._scheduleApplyFilters()
        wx.showToast({ title: '已定位到当前位置', icon: 'success', duration: 1500 })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '定位失败', icon: 'none' })
      }
    })
  },

  // 地图放大一级
  onMapZoomIn() {
    const currentScale = this.data.mapScale
    if (currentScale < 20) {
      const newScale = Math.min(currentScale + 1, 20)
      this.setData({ mapScale: newScale })
    }
  },

  // 地图缩小一级
  onMapZoomOut() {
    const currentScale = this.data.mapScale
    if (currentScale > 3) {
      const newScale = Math.max(currentScale - 1, 3)
      this.setData({ mapScale: newScale })
    }
  },

  // 点击右侧心形，加入或移出"想去"
  onToggleLike(e) {
    // 统一走公共登录校验，避免每个页面提示文案不一致。
    if (!util.requireLogin()) {
      return
    }
    
    const shopId = e.currentTarget.dataset.shopid
    const type = e.currentTarget.dataset.type || 'food'
    const isLiked = util.toggleLike(shopId, type)
    
    this.loadUserData()
    
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已移出想去',
      icon: 'none',
      duration: 1000
    })
  },
  // 计算两点之间的直线距离（单位：米）
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

  // 把米数格式化成页面展示文案，例如 883m、1.2km
  formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + 'm'
    return (meters / 1000).toFixed(1) + 'km'
  },

  // 图片加载失败时，用默认图片兜底
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    const key = `filteredItems[${index}].image`
    this.setData({ [key]: '/images/app-logo.jpg' })
  },

  // 列表滚动到底部时，加载下一页数据
  onLoadMore() {
    console.log('onLoadMore')
    if (this._loadingMore) return
    if (!this._fullFilteredList || !this.data.hasMore) return
    
    this._loadingMore = true
    const { currentPage, pageSize } = this.data
    const nextPage = currentPage + 1
    // 已展示 0 ~ currentPage*pageSize-1，下一页从 currentPage*pageSize 开始
    const start = currentPage * pageSize
    const end = start + pageSize
    const nextItems = this._fullFilteredList.slice(start, end)
    
    if (nextItems.length === 0) {
      this.setData({ hasMore: false })
      this._loadingMore = false
      return
    }
    
    const merged = [...this.data.filteredItems, ...nextItems]
    const hasMore = start + pageSize < this._fullFilteredList.length
    
    this.setData({
      filteredItems: merged,
      currentPage: nextPage,
      hasMore
    }, () => {
      this._loadingMore = false
    })
  },

  // 位置选择器：打开 / 关闭 / 阻止冒泡 / 切换城市
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
    this._scheduleApplyFilters()
  },

  // 底部按钮：跳去"想去"页
  onOpenRoute() {
    wx.switchTab({
      url: '/pages/wantgo/wantgo'
    })
  },

  // 把列表面板收起，只露出地图
  onToggleMap() {
    // 切换收起状态，显示地图
    this.setData({
      isSheetExpanded: false,
      sheetHeight: this.data.sysMinHeight
    })
  },

  // 直接展开到半屏列表
  onExpandSheet() {
    const windowInfo = wx.getWindowInfo()
    this.setData({
      isSheetExpanded: true,
      sheetHeight: windowInfo.windowHeight * 0.45
    })
  },

  // 列表按钮：第一次到半屏，第二次到全屏
  onListBtnTap() {
    const windowInfo = wx.getWindowInfo()
    const wh = windowInfo.windowHeight
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

  // 搜索入口暂时未接功能
  onSearchTap() {
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    })
  },

  // 头像入口：跳到"我的"页
  onProfileTap() {
    wx.switchTab({
      url: '/pages/my/my'
    })
  }
})
