// 觅食图 - 探索页逻辑 (合并景点与美食)
const app = getApp()
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const markerIcons = require('../../utils/markerIcons')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')

// 探索地图里的“当前位置”使用一个单独的 marker id，
// 避免和正常地点数据的 id 混在一起。
const CURRENT_LOCATION_MARKER_ID = -1001
const CURRENT_LOCATION_ICON_PATH = '/images/markers/marker_current_location.png'
// 重新定位后，把地图拉近到当前位置附近，避免只更新中心点却看起来没变化。
const MY_LOCATION_FOCUS_SCALE = 17


// 顶部分类导航统一复用 marker 图标资源。
// 这样地图上的点位图标和分类 Tab 图标就能保持同一套视觉。
function buildExploreCategories() {
  return [
    { name: '全部' },
    { name: '美食' },
    { name: '景点' },
    { name: '酒店' },
    { name: '饮品' },
    { name: '购物' },
    { name: '自然户外' },
    { name: '文化展馆' }
  ].map((item) => ({
    ...item,
    iconPath: markerIcons.getIconPath(item.name)
  }))
}

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
      lat: 22.5322,
      lng: 113.9558
    },
    mapScale: 15,
    allMarkers: [],
    // 探索地图单独维护一份当前位置，
    // 用来生成自定义的当前位置 PNG marker。
    currentLocation: null,
    
    // 分类
    exploreCategories: buildExploreCategories(),
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
    currentCity: '广州市', 
    locationMode: 'my',
    cityOptions: [],

    // 天气信息
    weatherDesc: '',
    weatherTemp: '25°C',
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
      this.setData({
        mapCenter: { lat: loc.lat, lng: loc.lng },
        // 页面首次拿到定位后，同时保存当前位置，
        // 这样 updateMarkers 才能把当前位置 PNG 插进 markers。
        currentLocation: { lat: loc.lat, lng: loc.lng }
      })
      // 当前位置图标路径在这里显式挂上，
      // 避免只拿到坐标却没有 iconPath，导致真机上完全不显示。
      this.ensureCurrentLocationMarkerIcon()
      // 使用统一调度，避免重复计算
      this._scheduleApplyFilters()
      // 定位完成后获取天气
      this.loadWeather()
    })

    app.whenDistrictReady((info, locationDesc) => {
      // 将逆地址解析返回的城市短名（如'深圳'）映射为城市选择器的 fullName（如'深圳市'）
      const cityFullName = util.getCityFullName(info.city)
      this.setData({ 
        currentCity: cityFullName
      })
      // 城市切换后重新筛选数据并刷新地图
      this._scheduleApplyFilters()
      // 区划更新后重新获取天气
      this.loadWeather()
    })
    
    // 监听图标加载完成事件
    this._iconsReady = false
    markerIcons.ensureIcons(() => {
      this._iconsReady = true
    })
  },

  initCityOptions() {
    const cityOptions = util.getCityOptions(DEFAULT_COVER_POOL)
    this.setData({ cityOptions })
  },

  ensureCurrentLocationMarkerIcon() {
    // 当前位置直接使用用户提供的 PNG 图标，
    // 不再走 canvas 动态绘制，避免锯齿和样式偏差。
    this._currentLocationMarkerIconPath = CURRENT_LOCATION_ICON_PATH
    this.updateMarkers()
  },

  
  onShow() {
    this.loadUserData()
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

  // 加载数据 (本地优先 + 后台同步)
  async loadItems() {
    // 等待 placesData 初始化完成（解决启动时序竞争问题）
    await placesData.whenReady()
    const userShops = util.getUserShopsAsync()
    const currentCity = this.data.currentCity || '广州市'
    
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
    // 将 cloud:// 封面转为临时 URL，避免网络波动时解析失败
    await util.resolveCloudUrls(allPlaces, 'coverImage')
    // 直接设置为总列表，不再需要合并演示数据
    this.setData({ allItems: allPlaces })
    this._scheduleApplyFilters()
  },

  // 读取用户状态（读本地 + 后台同步）
  loadUserData() {
    const wantList = util.getWantListAsync()
    const checkedIn = util.getFootprintItemsAsync()
    this.setData({
      likedShops: wantList,
      visitedShops: checkedIn.map(item => String(item.id))
    })
  },

  // 读取当前定位对应的天气信息。
  loadWeather() {
    const location = app.globalData.location
    const key = app.globalData.qqMapKey
    if (!location || !key) return

    // 使用腾讯地图天气API
    wx.request({
      url: 'https://apis.map.qq.com/ws/weather/v1/',
      data: {
        location: `${location.lat},${location.lng}`,
        key: key,
        type: 'now'
      },
      success: (res) => {
        if (res.data && res.data.status === 0) {
          const infos = res.data.result.infos
          this.setData({
            weatherDesc: infos.weather || '',
            weatherTemp: infos.temperature + '°C'
          })
        }
      },
      fail: () => {
        // 静默失败，保持默认天气
      }
    })
  },

  // 按当前分类、排序和地图中心点，重新生成当前可见列表。
  // 全量数据存入 _fullFilteredList，UI 只展示第一页
  applyFilters() {
    let { allItems, currentCategory, sortType, currentDistance, mapCenter, currentCity, pageSize } = this.data
    
    let filtered = allItems
    
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
      
      // 地图点位单独使用带白色圆底的 marker 图标，
      // 不影响顶部分类 Tab 现在使用的普通分类图标。
      const markerIconPath = markerIcons.getMapIconPath(markerCategory)

      return {
        id: item.id,
        latitude: item.lat,
        longitude: item.lng,
        iconPath: markerIconPath,
        width: 28,
        height: 28,
      }
    })


    // 把当前位置作为一个独立 marker 插到最前面，替代原生蓝点。
    if (this.data.currentLocation && this._currentLocationMarkerIconPath) {
      markers.unshift({
        id: CURRENT_LOCATION_MARKER_ID,
        markerRole: 'current-location',
        latitude: this.data.currentLocation.lat,
        longitude: this.data.currentLocation.lng,
        iconPath: this._currentLocationMarkerIconPath,
        // 当前位置图标显示尺寸改成 72rpx，对应 36px。
        width: 36,
        height: 36,
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 999
      })
    }

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
    wx.navigateTo({ url: `/subpackages/extra/pages/spot-detail/spot-detail?id=${item.id}` })
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
          // 重新定位时同步更新当前位置 marker 的坐标，
          // 否则地图中心变了，但自定义当前位置图标不会跟着走。
          currentLocation: loc,
          currentDistrict: '',
          currentCity: (app.globalData.districtInfo && app.globalData.districtInfo.city) || this.data.currentCity,
          locationMode: 'my'
        })
        // 重新定位后重新确认当前位置 iconPath 已挂上，
        // 避免路径未初始化时 marker 条件不成立。
        this.ensureCurrentLocationMarkerIcon()
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

  // 点击右侧心形，加入或移出"想去"（本地优先 + 后台同步）
  onToggleLike(e) {
    if (!util.requireLogin()) {
      return
    }
    
    const shopId = e.currentTarget.dataset.shopid
    
    // toggleWantAsync 内部已处理本地缓存切换 + 云端同步
    const isNowWant = util.toggleWantAsync(shopId)
    this.setData({ likedShops: util.getWantList() })
    
    wx.showToast({
      title: isNowWant ? '已添加到想去' : '已移出想去',
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
