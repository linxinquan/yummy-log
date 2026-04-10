// 觅食迹 - 首页逻辑
const app = getApp()
const shopData = require('../../utils/shopData')
const spotData = require('../../utils/spotData')
const util = require('../../utils/util')
const markerIcons = require('../../utils/markerIcons')

Page({
  data: {
    // 地图配置
    mapCenter: {
      lat: 22.4846,
      lng: 113.9046
    },
    markers: [],
    
    // 分类
    categories: shopData.categories,
    currentCategory: '全部',
    
    // 搜索
    searchKeyword: '',
    
    // 排序
    sortType: 'distance', // distance | rating
    
    // 店铺数据
    allShops: [],
    filteredShops: [],
    pageSize: 10,
    currentPage: 1,
    hasMore: true,
    
    // 用户数据
    likedShops: [],
    visitedShops: {},
    
    // 想去数量
    likedCount: 0,

    // 图标Canvas尺寸（用于生成标记图标）
    iconCanvasSize: 40,

    // 地理位置选择（小红书风格）
    currentDistrict: '', // 当前选中的区域
    currentDistance: 0, // 当前选中的距离（米），0表示不限
    showLocationPicker: false, // 是否显示位置选择器弹窗
    currentCity: '深圳市', // 当前城市（动态获取）
    locationMode: 'my', // my=我的位置, district=区域
    myLocationDesc: '南山区', // 我的位置描述（如"南山街道"）
    
    // 距离选项
    distanceOptions: [
      { label: '不限', value: 0 },
      { label: '500m', value: 500 },
      { label: '1km', value: 1000 },
      { label: '2km', value: 2000 },
      { label: '5km', value: 5000 }
    ],
    
    // 美食类型列表（美团风格）
    districts: [
      { id: 0, name: '全部', icon: '🍴' },
      { id: 1, name: '粤菜', icon: '🥘' },
      { id: 2, name: '川菜', icon: '🌶️' },
      { id: 3, name: '湘菜', icon: '🔶' },
      { id: 4, name: '北京菜', icon: '🥟' },
      { id: 5, name: '东南亚餐', icon: '🍛' },
      { id: 6, name: '日韩料理', icon: '🍣' },
      { id: 7, name: '西餐', icon: '🥩' },
      { id: 8, name: '小吃', icon: '🍢' },
      { id: 9, name: '其他', icon: '🍽️' }
    ],

    // 地图图层：food=仅美食, spots=仅景点, all=全部
    mapLayer: 'food',
    allMarkers: [],
    spotMarkers: [],
    
    // 全城选项
    allDistricts: [
      { id: 0, name: 'mylocation', icon: '📍', displayName: '我的位置', isLocation: true },
      { id: 1, name: '', icon: '🔥', displayName: '热门美食圈' },
      { id: 2, name: '罗湖区', icon: '🏙️', lat: 22.5503, lng: 114.0847 },
      { id: 3, name: '南山区', icon: '🌟', lat: 22.5312, lng: 113.9299 },
      { id: 4, name: '福田区', icon: '🏰', lat: 22.5228, lng: 114.0595 },
      { id: 5, name: '宝安区', icon: '🏭', lat: 22.7206, lng: 113.8830 },
      { id: 6, name: '龙华区', icon: '🏢', lat: 22.7009, lng: 114.0491 },
      { id: 7, name: '光明区', icon: '💡', lat: 22.7843, lng: 113.9295 },
      { id: 8, name: '坪山区', icon: '⛰️', lat: 22.6877, lng: 114.3491 },
      { id: 9, name: '大鹏新区', icon: '🏖️', lat: 22.5768, lng: 114.4828 },
      { id: 10, name: '深汕特别合作区', icon: '🏝️', lat: 22.9836, lng: 115.0337 }
    ]
  },

  onLoad() {
    this.loadShops()
    this.loadUserData()
    // 预加载/生成标记图标（40x40彩色圆点）
    markerIcons.ensureIcons(() => {
      this.updateMarkers()
    })
    // 构建景点地图标记
    this._buildSpotMarkers()
    // 等待定位就绪，自动将地图中心移到用户位置
    app.whenLocationReady((loc) => {
      this.setData({ mapCenter: { lat: loc.lat, lng: loc.lng } })
      // 更新位置后重新计算店铺距离
      this.applyFilters()
    })
    // 等待区划信息就绪，显示当前城市和位置描述
    app.whenDistrictReady((info, locationDesc) => {
      this.setData({ 
        currentCity: info.city,
        myLocationDesc: locationDesc || info.district
      })
    })
  },

  onShow() {
    // 每次显示页面时刷新用户数据
    this.loadUserData()
    this.updateShopStatus()
  },

  // 点击"定位"按钮 - 重新获取当前位置并移动地图
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
          currentDistrict: '',  // 清空区域
          locationMode: 'my'    // 设置为"我的位置"模式
        })
        // 重新计算店铺距离
        this.applyFilters()
        wx.showToast({ title: '已定位到当前位置', icon: 'success', duration: 1500 })
      },
      fail: () => {
        wx.hideLoading()
        wx.showModal({
          title: '定位失败',
          content: '请检查是否授权位置权限，或手动选择位置',
          confirmText: '去设置',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
      }
    })
  },

  onPullDownRefresh() {
    this.loadShops()
    wx.stopPullDownRefresh()
  },

  // 加载店铺数据
  loadShops() {
    // 合并：蛇口24家（shopData.shops）+ 深圳V2美食65家（shopData.foods）+ 用户添加的店铺
    const userShops = util.loadData('userAddedShops', [])
    // 为每个店铺添加图片加载状态
    const allShops = [...shopData.shops, ...shopData.foods, ...userShops].map(shop => ({
      ...shop,
      imgError: false
    }))
    
    this.setData({ allShops })
    this.applyFilters()
  },

  // 加载用户数据
  loadUserData() {
    const userData = util.getUserShops()
    this.setData({
      likedShops: userData.likedShops || [],
      visitedShops: userData.checkedInShops || {}
    })
    this.updateShopStatus()
  },

  // 更新店铺状态
  updateShopStatus() {
    const { allShops, likedShops, visitedShops } = this.data
    
    const updatedShops = allShops.map(shop => {
      const isLiked = likedShops.includes(shop.id)
      const baseWant = shop.wantCount || 0
      return {
        ...shop,
        isLiked,
        displayWantCount: isLiked ? baseWant + 1 : baseWant
      }
    })
    
    this.setData({ 
      allShops: updatedShops,
      likedCount: likedShops.length
    })
    this.applyFilters()
  },

  // 应用筛选和排序
  applyFilters() {
    let { allShops, currentCategory, searchKeyword, sortType, currentDistance, mapCenter } = this.data
    
    // 分类筛选（当前美食类型）
    let filtered = currentCategory === '全部' 
      ? allShops 
      : allShops.filter(s => s.category === currentCategory)
    
    // 搜索筛选
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(kw) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(kw))) ||
        (s.dishes && s.dishes.some(d => d.toLowerCase().includes(kw)))
      )
    }
    
    // 基于当前位置计算距离
    const centerLat = mapCenter?.lat || 22.4846
    const centerLng = mapCenter?.lng || 113.9046
    
    // 为每家店铺计算距离
    filtered = filtered.map(shop => {
      const dist = this.calculateDistance(centerLat, centerLng, shop.lat || shop.latitude, shop.lng || shop.longitude)
      return {
        ...shop,
        distance: this.formatDistance(dist)
      }
    })
    
    // 距离筛选
    if (currentDistance > 0) {
      filtered = filtered.filter(shop => {
        const dist = this.calculateDistance(centerLat, centerLng, shop.lat || shop.latitude, shop.lng || shop.longitude)
        return dist <= currentDistance
      })
    }
    
    // 排序
    if (sortType === 'distance') {
      // 按真实距离升序（需重新计算原始km数）
      filtered.sort((a, b) => {
        const da = this.calculateDistance(centerLat, centerLng, a.lat || a.latitude, a.lng || a.longitude)
        const db = this.calculateDistance(centerLat, centerLng, b.lat || b.latitude, b.lng || b.longitude)
        return da - db
      })
    } else if (sortType === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating)
    }
    
    this.setData({ 
      filteredShops: filtered,
      hasMore: filtered.length > this.data.pageSize
    })
    
    // 地图标记也同步更新：只显示筛选后的店铺
    this.updateMarkers()
  },

  // 更新地图标记 - 圆周旅迹风格（精致小圆点）
  updateMarkers() {
    const shops = this.data.filteredShops
    if (!shops || shops.length === 0) {
      this.setData({ markers: [] })
      return
    }

    const markers = shops.map((shop) => {
      const catColor = markerIcons.getCategoryColor(shop.category)
      const catEmoji = markerIcons.getCategoryEmoji(shop.category)
      const iconPath = markerIcons.getIconPath(shop.category)
      const priceInfo = shop.price ? `¥${shop.price}/人` : ''
      const ratingInfo = shop.rating ? `★ ${shop.rating}` : ''
      const lines = [
        `${catEmoji}  ${shop.name}`,
        `${ratingInfo}  ${priceInfo}`
      ].filter(l => l.trim())

      return {
        id: shop.id,
        latitude: shop.lat || shop.latitude,
        longitude: shop.lng || shop.longitude,
        // 自定义图标（40x40彩色小圆点，无iconPath时用默认红点）
        iconPath: iconPath,
        width: iconPath ? markerIcons.ICON_SIZE : 30,
        height: iconPath ? markerIcons.ICON_SIZE : 30,
        // 点击气泡：分类色边框 + 店铺信息
        callout: {
          content: lines.join('\n'),
          color: '#1A1A2E',
          fontSize: 13,
          borderRadius: 10,
          padding: 10,
          display: 'BYCLICK',
          bgColor: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderColor: catColor,
          borderWidth: 1.5
        }
      }
    })

    this.setData({ markers })
    this._refreshMapLayer()
  },

  // 构建景点标记
  _buildSpotMarkers() {
    const spots = spotData.spotData
    const markers = spots.map(s => ({
      id: s.id,
      latitude: s.lat,
      longitude: s.lng,
      title: s.name,
      iconPath: '/images/tabbar-spots-active.png',
      width: 36,
      height: 36,
      callout: {
        content: `🏔️ ${s.name}\n⭐ ${s.rating}  ${s.free ? '免费' : '收费'}`,
        color: '#1A1A2E',
        fontSize: 12,
        borderRadius: 10,
        padding: 8,
        display: 'BYCLICK',
        bgColor: '#ffffff',
        borderColor: '#00B5A6',
        borderWidth: 1.5
      }
    }))
    this.setData({ spotMarkers: markers })
    this._refreshMapLayer()
  },

  // 根据图层刷新 allMarkers
  _refreshMapLayer() {
    const { mapLayer, markers, spotMarkers } = this.data
    let allMarkers = []
    if (mapLayer === 'food') {
      allMarkers = markers
    } else if (mapLayer === 'spots') {
      allMarkers = spotMarkers
    } else {
      allMarkers = [...markers, ...spotMarkers]
    }
    this.setData({ allMarkers })
  },

  // 图层切换
  onMapLayerChange(e) {
    const layer = e.currentTarget.dataset.layer
    this.setData({ mapLayer: layer }, () => {
      this._refreshMapLayer()
    })
  },

  // 分类切换
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category, currentPage: 1 })
    this.applyFilters()
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  // 搜索确认
  onSearchConfirm(e) {
    this.setData({ searchKeyword: e.detail.value, currentPage: 1 })
    this.applyFilters()
  },

  // 排序切换
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.sort
    this.setData({ sortType, currentPage: 1 })
    this.applyFilters()
  },

  // ─── 地理位置选择（小红书风格） ───

  // 打开位置选择器
  onOpenLocationPicker() {
    this.setData({ showLocationPicker: true })
  },

  // 关闭位置选择器
  onCloseLocationPicker() {
    this.setData({ showLocationPicker: false })
  },

  // 选择区域
  onSelectDistrict(e) {
    const districtName = e.currentTarget.dataset.district
    const item = e.currentTarget.dataset.item
    
    // 如果是"我的位置"
    if (item && item.isLocation) {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: (res) => {
          const loc = { lat: res.latitude, lng: res.lng }
          app.globalData.location = loc
          
          // 逆地址解析获取位置描述
          const key = app.globalData.qqMapKey
          wx.request({
            url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${loc.lat},${loc.lng}&key=${key}&get_poi=0`,
            success: (geoRes) => {
              let locationDesc = '附近'
              if (geoRes.data && geoRes.data.status === 0) {
                const addr = geoRes.data.result.address_component
                const street = addr.street || ''
                locationDesc = street || addr.district || '附近'
              }
              this.setData({ 
                mapCenter: loc,
                currentDistrict: '',
                locationMode: 'my',
                currentCity: '深圳市',
                myLocationDesc: locationDesc,
                showLocationPicker: false
              })
              this.applyFilters()
              wx.showToast({ title: '已定位到' + locationDesc, icon: 'success', duration: 1500 })
            },
            fail: () => {
              this.setData({ 
                mapCenter: loc,
                currentDistrict: '',
                locationMode: 'my',
                currentCity: '深圳市',
                myLocationDesc: '附近',
                showLocationPicker: false
              })
              this.applyFilters()
              wx.showToast({ title: '已定位到我的位置', icon: 'success', duration: 1500 })
            }
          })
        },
        fail: () => {
          wx.showToast({ title: '定位失败，请检查权限', icon: 'none' })
        }
      })
      return
    }
    
    this.setData({ 
      currentDistrict: districtName,
      locationMode: 'district',
      showLocationPicker: false
    })
    this.applyFilters()
  },

  // 美食类型切换（从区域标签）
  onDistrictChange(e) {
    const category = e.currentTarget.dataset.district
    this.setData({ 
      currentCategory: category === '全部' ? '全部' : category,
      currentPage: 1
    })
    this.applyFilters()
  },

  // 距离筛选
  onDistanceChange(e) {
    const distance = e.currentTarget.dataset.distance
    this.setData({ currentDistance: distance })
    this.applyFilters()
  },

  // ─── 店铺距离计算 ───
  calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine公式计算两点间距离（米）
    const R = 6371000 // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  // 格式化距离
  formatDistance(meters) {
    if (meters < 1000) {
      return Math.round(meters) + 'm'
    } else {
      return (meters / 1000).toFixed(1) + 'km'
    }
  },

  // 店铺点击
  onShopTap(e) {
    const shop = e.currentTarget.dataset.shop
    wx.navigateTo({
      url: `/pages/sub/shop-detail/shop-detail?shop=${encodeURIComponent(JSON.stringify(shop))}`
    })
  },

  // 标记点击
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    // 景点标记 id >= 101
    if (markerId >= 101) {
      wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${markerId}` })
      return
    }
    const shop = this.data.allShops.find(s => s.id === markerId)
    if (shop) {
      this.onShopTap({ currentTarget: { dataset: { shop } } })
    }
  },

  // 想去/取消想去
  onToggleLike(e) {
    const shopId = e.currentTarget.dataset.shopid
    const isLiked = util.toggleLike(shopId)
    
    // 更新本地状态
    let likedShops = [...this.data.likedShops]
    if (isLiked) {
      likedShops.push(shopId)
    } else {
      likedShops = likedShops.filter(id => id !== shopId)
    }
    
    this.setData({ likedShops, likedCount: likedShops.length })
    this.updateShopStatus()
    
    wx.showToast({
      title: isLiked ? '已添加到想去' : '已取消',
      icon: 'none',
      duration: 1000
    })
  },

  // 打开想去清单（可在清单内一键规划路线）
  onOpenRoute() {
    wx.navigateTo({
      url: '/pages/wantgo/wantgo'
    })
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore) return
    
    const nextPage = this.data.currentPage + 1
    this.setData({ currentPage: nextPage })
    // 可以在这里实现分页加载
  },

  // 图片加载失败处理
  onImageError(e) {
    const index = e.currentTarget.dataset.index
    if (index !== undefined) {
      const shops = [...this.data.filteredShops]
      shops[index] = { ...shops[index], imgError: true }
      this.setData({ filteredShops: shops })
    }
  }
})
