// 觅食图 - 首页逻辑 v9.0（城市→区两级筛选）
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
    totalFiltered: [], // 全部筛选结果（用于分页）
    pageSize: 10,
    currentPage: 1,
    hasMore: true,
    
    // 用户数据
    likedShops: [],
    visitedShops: {},
    
    // 想去数量
    likedCount: 0,

    // 距离缓存（避免重复计算）
    distanceCache: {},

    // 地理位置选择（城市→区两级）
    currentDistrict: '',   // 当前选中的区
    currentDistance: 0, // 当前选中的距离（米），0表示不限
    showLocationPicker: false, // 是否显示位置选择器弹窗
    currentCity: '深圳', // 当前城市
    locationMode: 'my',    // my=我的位置, district=区/城市
    myLocationDesc: '南山区', // 我的位置描述（如"南山街道"）

    // ── 两级筛选数据 ──
    // 城市列表（Header picker 一级）
    allCities: [
      { id: 0, name: '深圳',       icon: '🏙️', center: { lat: 22.5433, lng: 114.0579 } },
      { id: 1, name: '西双版纳',   icon: '🌴', center: { lat: 22.0097, lng: 100.7975 } },
      { id: 2, name: '惠州',       icon: '🌊', center: { lat: 23.1115, lng: 114.4152 } },
      { id: 3, name: '广州',       icon: '🌸', center: { lat: 23.1291, lng: 113.2644 } }
    ],

    // 各城市对应的区列表（name 与 foodData/spotData 的 district 字段精确匹配）
    districtMap: {
      '深圳': [
        { name: '全部',        icon: '🔥', isHot: true },
        { name: '我的位置',    icon: '📍', isLocation: true },
        { name: '福田',        icon: '🏰', lat: 22.5228, lng: 114.0595 },
        { name: '南山',        icon: '🌟', lat: 22.5312, lng: 113.9299 },
        { name: '罗湖',        icon: '🏙️', lat: 22.5503, lng: 114.0847 },
        { name: '宝安',        icon: '🏭', lat: 22.7206, lng: 113.8830 },
        { name: '龙华',        icon: '🏢', lat: 22.7009, lng: 114.0491 },
        { name: '龙岗',        icon: '⛰️', lat: 22.7207, lng: 114.2512 },
        { name: '坪山',        icon: '🌄', lat: 22.6877, lng: 114.3491 },
        { name: '光明',        icon: '💡', lat: 22.7843, lng: 113.9295 },
        { name: '盐田',        icon: '🌊', lat: 22.5574, lng: 114.2419 },
        { name: '大鹏',        icon: '🏖️', lat: 22.5768, lng: 114.4828 }
      ],
      '西双版纳': [
        { name: '全部',    icon: '🔥', isHot: true },
        { name: '景洪',    icon: '🌴', lat: 22.0097, lng: 100.7975 },
        { name: '勐腊',    icon: '🌿', lat: 21.4829, lng: 101.5654 },
        { name: '勐海',    icon: '☁️', lat: 21.9547, lng: 100.2548 }
      ],
      '惠州': [
        { name: '全部',        icon: '🔥', isHot: true },
        { name: '惠东',        icon: '🌊', lat: 22.9844, lng: 114.7198 },
        { name: '惠城',        icon: '🏙️', lat: 23.1115, lng: 114.4152 },
        { name: '惠阳',        icon: '🌟', lat: 22.7899, lng: 114.4569 },
        { name: '龙门',        icon: '🌲', lat: 23.7279, lng: 114.2576 }
      ],
      '广州': [
        { name: '全部',        icon: '🔥', isHot: true },
        { name: '天河',        icon: '🏙️', lat: 23.1292, lng: 113.3623 },
        { name: '越秀',        icon: '🏛️', lat: 23.1285, lng: 113.2740 },
        { name: '荔湾',        icon: '🌺', lat: 23.1260, lng: 113.2365 },
        { name: '海珠',        icon: '🌊', lat: 23.0840, lng: 113.3170 },
        { name: '番禺',        icon: '🌾', lat: 22.9370, lng: 113.3640 },
        { name: '白云',        icon: '☁️', lat: 23.2677, lng: 113.2730 },
        { name: '黄埔',        icon: '⚓', lat: 23.1018, lng: 113.4577 },
        { name: '花都',        icon: '🌸', lat: 23.4040, lng: 113.2203 }
      ]
    },

// 当前城市对应的区列表（初始化为深圳）
    currentDistricts: [
      { name: '全部',        icon: '🔥', isHot: true },
      { name: '我的位置',    icon: '📍', isLocation: true },
      { name: '福田',        icon: '🏰', lat: 22.5228, lng: 114.0595 },
      { name: '南山',        icon: '🌟', lat: 22.5312, lng: 113.9299 },
      { name: '罗湖',        icon: '🏙️', lat: 22.5503, lng: 114.0847 },
      { name: '宝安',        icon: '🏭', lat: 22.7206, lng: 113.8830 },
      { name: '龙华',        icon: '🏢', lat: 22.7009, lng: 114.0491 },
      { name: '龙岗',        icon: '⛰️', lat: 22.7207, lng: 114.2512 },
      { name: '坪山',        icon: '🌄', lat: 22.6877, lng: 114.3491 },
      { name: '光明',        icon: '💡', lat: 22.7843, lng: 113.9295 },
      { name: '盐田',        icon: '🌊', lat: 22.5574, lng: 114.2419 },
      { name: '大鹏',        icon: '🏖️', lat: 22.5768, lng: 114.4828 }
    ],

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
    
    // 全城选项（兼容旧逻辑，保留但不使用）
    allDistricts: []
  },

  onLoad() {
    console.log('[Index] onLoad 开始')
    // 初始化：只调用一次，后续由回调触发
    this._isLoaded = false
    
    // 预加载/生成标记图标（40x40彩色圆点）
    markerIcons.ensureIcons(() => {
      console.log('[Index] markerIcons 准备完成')
      this.updateMarkers()
    })
    // 构建景点地图标记
    console.log('[Index] 开始构建景点标记')
    this._buildSpotMarkers()
    
    // 等待定位就绪，再加载店铺数据（避免重复计算）
    app.whenLocationReady((loc) => {
      console.log('[Index] 定位就绪:', loc)
      this.setData({ mapCenter: { lat: loc.lat, lng: loc.lng } })
      this._loadAndFilter()
    })
    
    // 等待区划信息就绪，显示当前城市和位置描述
    app.whenDistrictReady((info, locationDesc) => {
      console.log('[Index] 区划信息就绪:', info)
      // 去掉"市"后缀，保证与 districtMap key 一致（如"深圳市"→"深圳"）
      const cityName = (info.city || '深圳').replace(/市$|自治州$|盟$/, '')
      this.setData({ 
        currentCity: cityName,
        myLocationDesc: locationDesc || info.district
      })
    })
  },
  
  // 统一加载和筛选（只在定位就绪后调用一次）
  _loadAndFilter() {
    if (this._isLoaded) return
    this._isLoaded = true
    
    this.loadShops()
    this.loadUserData()
  },

  onShow() {
    // 仅在首次加载后刷新点赞状态，避免重复计算
    if (this._isLoaded) {
      // 只更新点赞状态，不需要重新筛选
      const userData = util.getUserShops()
      const likedShops = userData.likedShops || []
      const visitedShops = userData.checkedInShops || {}
      
      // 快速更新点赞状态（不重新计算距离）
      const updatedShops = this.data.filteredShops.map(shop => {
        const isLiked = likedShops.includes(shop.id)
        const baseWant = shop.wantCount || 0
        return {
          ...shop,
          isLiked,
          displayWantCount: isLiked ? baseWant + 1 : baseWant
        }
      })
      
      this.setData({
        likedShops,
        likedCount: likedShops.length,
        filteredShops: updatedShops
      })
    }
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
    console.log('[Index] loadShops 开始')
    // 合并：蛇口24家（shopData.shops）+ 深圳V2美食65家（shopData.foods）+ 用户添加的店铺
    const userShops = util.loadData('userAddedShops', [])
    console.log('[Index] shopData.shops 数量:', shopData.shops.length)
    console.log('[Index] shopData.foods 数量:', shopData.foods.length)
    console.log('[Index] userShops 数量:', userShops.length)
    
    // 为每个店铺添加图片加载状态
    const allShops = [...shopData.shops, ...shopData.foods, ...userShops].map(shop => ({
      ...shop,
      imgError: false
    }))
    console.log('[Index] allShops 总数:', allShops.length)
    
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

  // 应用筛选和排序（优化：减少重复计算）
  applyFilters() {
    console.log('[Index] applyFilters 开始')
    // 每次筛选都重置到第一页
    this.setData({ currentPage: 1 })
    
    let { allShops, currentCategory, searchKeyword, sortType, currentDistance, mapCenter, currentCity, currentDistrict } = this.data

    // 分类筛选
    let filtered = currentCategory === '全部'
      ? allShops
      : allShops.filter(s => s.category === currentCategory)

    // 城市筛选
    if (currentCity && currentCity !== '深圳') {
      filtered = filtered.filter(s => s.city === currentCity)
    }

    // 区筛选（去掉「区/县/市/镇/新区」后缀后比对，兼容逆地理编码返回的完整地名）
    if (currentDistrict && currentDistrict !== '全部' && currentDistrict !== '我的位置') {
      const normDistrict = currentDistrict.replace(/区|县|市|镇|新区$/g, '')
      filtered = filtered.filter(s => {
        const normItemDistrict = (s.district || '').replace(/区|县|市|镇|新区$/g, '')
        return normItemDistrict === normDistrict
      })
    }


    
    // 搜索筛选
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(kw) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(kw))) ||
        (s.dishes && s.dishes.some(d => d.toLowerCase().includes(kw)))
      )
    }
    
    // 基于当前位置计算距离（使用缓存）
    const centerLat = mapCenter?.lat || 22.4846
    const centerLng = mapCenter?.lng || 113.9046
    
    // 第一遍：计算所有店铺距离
    filtered = filtered.map(shop => {
      const lat = shop.lat || shop.latitude
      const lng = shop.lng || shop.longitude
      const dist = this.getCachedDistance(centerLat, centerLng, lat, lng)
      return {
        ...shop,
        _rawDist: dist,
        distance: this.formatDistance(dist)
      }
    })
    
    // 距离筛选
    if (currentDistance > 0) {
      filtered = filtered.filter(shop => shop._rawDist <= currentDistance)
    }
    
    // 排序（使用已计算的 _rawDist）
    if (sortType === 'distance') {
      filtered.sort((a, b) => a._rawDist - b._rawDist)
    } else if (sortType === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating)
    }
    
    // 缓存全部筛选结果用于分页
    const totalFiltered = filtered
    // 只取当前页数据
    const { currentPage, pageSize } = this.data
    const startIndex = (currentPage - 1) * pageSize
    const paginatedShops = filtered.slice(startIndex, startIndex + pageSize)
    
    this.setData({ 
      totalFiltered,
      filteredShops: paginatedShops,
      hasMore: totalFiltered.length > startIndex + pageSize
    })
    console.log('[Index] applyFilters 完成，totalFiltered:', totalFiltered.length, '页:', currentPage, '显示:', paginatedShops.length)
    
    // 地图标记同步更新
    this.updateMarkers()
  },

  // 更新地图标记 - 圆周旅迹风格（精致小圆点）
  updateMarkers() {
    console.log('[Index] updateMarkers 开始')
    const shops = this.data.filteredShops
    if (!shops || shops.length === 0) {
      console.log('[Index] updateMarkers: 没有店铺数据')
      this.setData({ markers: [] })
      return
    }
    console.log('[Index] updateMarkers: 店铺数量:', shops.length)

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
        id: Number(shop.id),
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
    const spots = spotData
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
    this.setData({ currentCategory: category })
    this.applyFilters()
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  // 搜索确认
  onSearchConfirm(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applyFilters()
  },

  // 排序切换
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.sort
    this.setData({ sortType })
    this.applyFilters()
  },

  // ─── 地理位置选择（小红书风格） ───

  // 打开位置选择器
  onOpenLocationPicker() {
    const { currentCity, districtMap } = this.data
    this.setData({
      showLocationPicker: true,
      currentDistricts: districtMap[currentCity] || districtMap['深圳']
    })
  },

  // 关闭位置选择器
  onCloseLocationPicker() {
    this.setData({ showLocationPicker: false })
  },

  // 选择区域（两级筛选）
  onSelectDistrict(e) {
    const item = e.currentTarget.dataset.item

    // "我的位置"：触发定位
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
                currentCity: '深圳',
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
                currentCity: '深圳',
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

    // ── 区选择（移动地图 + 筛选） ──
    // 有经纬度的区 → 移动地图
    if (item && item.lat && item.lng) {
      this.setData({
        currentDistrict: item.name === '全部' ? '' : item.name,
        locationMode: 'district',
        mapCenter: { lat: item.lat, lng: item.lng },
        showLocationPicker: false
      })
    } else {
      // "全部" 或其他
      this.setData({
        currentDistrict: item && item.name !== '全部' ? item.name : '',
        locationMode: 'district',
        showLocationPicker: false
      })
    }
    this.applyFilters()
  },

  // ── 城市 Tab 选择（一级切换） ──
  onSelectCity(e) {
    const city = e.currentTarget.dataset.city
    const { districtMap } = this.data
    const districts = districtMap[city.name] || []

    this.setData({
      currentCity: city.name,
      currentDistricts: districts,
      currentDistrict: '',   // 切换城市时重置区
      mapCenter: { lat: city.center.lat, lng: city.center.lng },
      locationMode: 'district',
    })
    this.applyFilters()
  },

  // 美食类型切换（从区域标签）
  onDistrictChange(e) {
    const category = e.currentTarget.dataset.district
    this.setData({ 
      currentCategory: category === '全部' ? '全部' : category
    })
    this.applyFilters()
  },

  // 距离筛选
  onDistanceChange(e) {
    const distance = e.currentTarget.dataset.distance
    this.setData({ currentDistance: distance })
    this.applyFilters()
  },

  // ─── 店铺距离计算（带缓存） ───
  _getDistanceCacheKey(lat1, lng1, lat2, lng2) {
    return `${lat1.toFixed(5)},${lng1.toFixed(5)}-${lat2.toFixed(5)},${lng2.toFixed(5)}`
  },
  
  // 获取缓存的距离，或计算并缓存
  getCachedDistance(lat1, lng1, lat2, lng2) {
    const key = this._getDistanceCacheKey(lat1, lng1, lat2, lng2)
    if (this.data.distanceCache[key] !== undefined) {
      return this.data.distanceCache[key]
    }
    const dist = this._calcDistance(lat1, lng1, lat2, lng2)
    // 更新缓存
    this.setData({
      distanceCache: {
        ...this.data.distanceCache,
        [key]: dist
      }
    })
    return dist
  },
  
  // Haversine公式计算两点间距离（米）
  _calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000
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
    
    const { totalFiltered, filteredShops, currentPage, pageSize } = this.data
    const nextPage = currentPage + 1
    const startIndex = (nextPage - 1) * pageSize
    const nextPageShops = totalFiltered.slice(startIndex, startIndex + pageSize)
    
    if (nextPageShops.length > 0) {
      this.setData({
        currentPage: nextPage,
        filteredShops: filteredShops.concat(nextPageShops),
        hasMore: totalFiltered.length > startIndex + pageSize
      })
      console.log('[Index] 加载更多，第', nextPage, '页，新增', nextPageShops.length, '条')
    } else {
      this.setData({ hasMore: false })
    }
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
