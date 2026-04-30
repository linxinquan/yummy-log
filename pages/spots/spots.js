// 觅食图 V2 - 景点列表页（v9.1 对齐首页风格）
const app = getApp()
const util = require('../../utils/util')
const spotData = require('../../utils/spotData')

Page({
  data: {
    spots: [],
    filteredSpots: [],
    totalFiltered: [], // 全部筛选结果（用于分页）
    categories: [],
    currentCategory: '全部',
    pageSize: 10,
    currentPage: 1,
    hasMore: true,
    viewMode: 'list',
    mapCenter: { lat: 22.5415, lng: 114.0596 },
    mapMarkers: [],
    activeSpot: null,
    userLocation: null,
    wantSpots: [],

    // ── 两级筛选数据 ──
    currentCity: '深圳',
    showLocationPicker: false,

    // 城市列表
    allCities: [
      { id: 0, name: '深圳',       icon: '🏙️', center: { lat: 22.5433, lng: 114.0579 } },
      { id: 1, name: '广州',       icon: '🌸', center: { lat: 23.1291, lng: 113.2644 } },
      { id: 2, name: '西双版纳',   icon: '🌴', center: { lat: 22.0097, lng: 100.7975 } },
      { id: 3, name: '惠州',       icon: '🌊', center: { lat: 23.1115, lng: 114.4152 } }
    ],

    // 各城市对应的区/县列表（name 与 spotData.js 的 district 字段精确匹配，无「区/县/市」后缀）
    districtMap: {
      '深圳': [
        { name: '全部',    icon: '🔥', isHot: true },
        { name: '南山',    icon: '🌟', lat: 22.5312, lng: 113.9299 },
        { name: '福田',    icon: '🏰', lat: 22.5228, lng: 114.0595 },
        { name: '罗湖',    icon: '🏙️', lat: 22.5503, lng: 114.0847 },
        { name: '宝安',    icon: '🏭', lat: 22.7206, lng: 113.8830 },
        { name: '龙华',    icon: '🏢', lat: 22.7009, lng: 114.0491 },
        { name: '龙岗',    icon: '⛰️', lat: 22.7207, lng: 114.2512 },
        { name: '坪山',    icon: '🌄', lat: 22.6877, lng: 114.3491 },
        { name: '光明',    icon: '💡', lat: 22.7843, lng: 113.9295 },
        { name: '盐田',    icon: '🌊', lat: 22.5574, lng: 114.2419 },
        { name: '大鹏',    icon: '🏖️', lat: 22.5768, lng: 114.4828 }
      ],
      '广州': [
        { name: '全部',    icon: '🔥', isHot: true },
        { name: '天河',    icon: '🌟', lat: 23.1355, lng: 113.3625 },
        { name: '白云',    icon: '☁️', lat: 23.1577, lng: 113.2730 },
        { name: '越秀',    icon: '🏛️', lat: 23.1291, lng: 113.2644 },
        { name: '荔湾',    icon: '🌺', lat: 23.1188, lng: 113.2440 },
        { name: '海珠',    icon: '🌊', lat: 23.0833, lng: 113.3175 },
        { name: '番禺',    icon: '🌾', lat: 22.9370, lng: 113.3640 }
      ],
      '西双版纳': [
        { name: '全部',    icon: '🔥', isHot: true },
        { name: '西双版纳', icon: '🌴', lat: 22.0097, lng: 100.7975 }
      ],
      '惠州': [
        { name: '全部',    icon: '🔥', isHot: true },
        { name: '惠城',    icon: '🏙️', lat: 23.1115, lng: 114.4152 },
        { name: '惠东',    icon: '🌊', lat: 22.9844, lng: 114.7198 },
        { name: '大亚湾',  icon: '🌟', lat: 22.6527, lng: 114.5294 }
      ]
    },

    // 当前城市对应的区列表（初始化为深圳，与 spotData.js district 值一致）
    currentDistricts: [
      { name: '全部',    icon: '🔥', isHot: true },
      { name: '南山',    icon: '🌟', lat: 22.5312, lng: 113.9299 },
      { name: '福田',    icon: '🏰', lat: 22.5228, lng: 114.0595 },
      { name: '罗湖',    icon: '🏙️', lat: 22.5503, lng: 114.0847 },
      { name: '宝安',    icon: '🏭', lat: 22.7206, lng: 113.8830 },
      { name: '龙华',    icon: '🏢', lat: 22.7009, lng: 114.0491 },
      { name: '龙岗',    icon: '⛰️', lat: 22.7207, lng: 114.2512 },
      { name: '坪山',    icon: '🌄', lat: 22.6877, lng: 114.3491 },
      { name: '光明',    icon: '💡', lat: 22.7843, lng: 113.9295 },
      { name: '盐田',    icon: '🌊', lat: 22.5574, lng: 114.2419 },
      { name: '大鹏',    icon: '🏖️', lat: 22.5768, lng: 114.4828 }
    ],

    currentDistrict: ''  // 当前选中的区
  },

  onLoad() {
    const cats = [...new Set(spotData.map(s => s.category).filter(Boolean))]
    const wantSpots = util.getWantSpots()
    // 在每个景点上标记是否想去
    const spotsWithWant = spotData.map(s => ({
      ...s,
      isWanted: wantSpots.indexOf(String(s.id)) > -1
    }))
    this.setData({
      spots: spotsWithWant,
      categories: ['全部', ...cats],
      wantSpots: wantSpots
    })
    // 首次进入执行筛选（按当前城市）
    this.applyFilters()
    this._getUserLocation()
  },

  onShow() {
    // 每次显示时刷新想去状态
    const wantSpots = util.getWantSpots()
    const updatedSpots = this.data.spots.map(s => ({
      ...s,
      isWanted: wantSpots.indexOf(String(s.id)) > -1
    }))
    this.setData({
      wantSpots: wantSpots,
      spots: updatedSpots
    })
    // 重新执行筛选（保持当前城市/分类/区过滤）
    this.applyFilters()
  },

  _getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ userLocation: { lat: res.latitude, lng: res.longitude } })
      },
      fail: () => {}
    })
  },

  _buildMarkers(spotList) {
    const markers = spotList.map(s => ({
      id: s.id,
      latitude: s.lat,
      longitude: s.lng,
      title: s.name,
      width: 36,
      height: 36,
      iconPath: '/images/tabbar-spots-active.png',
      callout: {
        content: s.name,
        color: '#ffffff',
        bgColor: '#00D9C0',
        padding: 8,
        borderRadius: 8,
        display: 'BYCLICK'
      }
    }))
    this.setData({ mapMarkers: markers })
  },

  // ── 分类筛选（含城市+区过滤） ──
  onCategoryChange(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ currentCategory: cat })
    this.applyFilters()
  },

  // ── 城市 Tab 选择（一级切换） ──
  onSelectCity(e) {
    const city = e.currentTarget.dataset.city
    const { districtMap } = this.data
    const districts = districtMap[city.name] || districtMap['深圳']

    this.setData({
      currentCity: city.name,
      currentDistricts: districts,
      currentDistrict: '',   // 切换城市时重置区
      mapCenter: { lat: city.center.lat, lng: city.center.lng }
    })
    this.applyFilters()
  },

  // ── 区选择（二级切换） ──
  onSelectDistrict(e) {
    const item = e.currentTarget.dataset.item

    if (item && item.lat && item.lng) {
      this.setData({
        currentDistrict: item.name === '全部' ? '' : item.name,
        mapCenter: { lat: item.lat, lng: item.lng },
        showLocationPicker: false
      })
    } else {
      this.setData({
        currentDistrict: item && item.name !== '全部' ? item.name : '',
        showLocationPicker: false
      })
    }
    this.applyFilters()
  },

  // ── 打开位置选择器 ──
  onOpenLocationPicker() {
    const { currentCity, districtMap } = this.data
    this.setData({
      showLocationPicker: true,
      currentDistricts: districtMap[currentCity] || districtMap['深圳']
    })
  },

  // ── 关闭位置选择器 ──
  onCloseLocationPicker() {
    this.setData({ showLocationPicker: false })
  },

  // ── 通用筛选（含城市+区过滤） ──
  applyFilters() {
    // 每次筛选都重置到第一页
    this.setData({ currentPage: 1 })
    
    const { spots, currentCategory, currentCity, currentDistrict } = this.data

    let filtered = currentCategory === '全部'
      ? spots
      : spots.filter(s => s.category === currentCategory)

    // 城市筛选（所有城市都需要筛选）
    if (currentCity) {
      filtered = filtered.filter(s => s.city === currentCity)
    }

    // 区筛选（去掉「区/县/市/镇/新区」后缀后比对）
    if (currentDistrict && currentDistrict !== '全部') {
      const normDistrict = currentDistrict.replace(/区|县|市|镇|新区$/g, '')
      filtered = filtered.filter(s => {
        const normItemDistrict = (s.district || '').replace(/区|县|市|镇|新区$/g, '')
        return normItemDistrict === normDistrict
      })
    }

    // 缓存全部筛选结果用于分页
    const totalFiltered = filtered
    // 只取当前页数据
    const { currentPage, pageSize } = this.data
    const startIndex = (currentPage - 1) * pageSize
    const paginatedSpots = filtered.slice(startIndex, startIndex + pageSize)

    this.setData({
      totalFiltered,
      filteredSpots: paginatedSpots,
      hasMore: totalFiltered.length > startIndex + pageSize,
      activeSpot: null
    })
    this._buildMarkers(filtered)
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore) return

    const { totalFiltered, filteredSpots, currentPage, pageSize } = this.data
    const nextPage = currentPage + 1
    const startIndex = (nextPage - 1) * pageSize
    const nextPageSpots = totalFiltered.slice(startIndex, startIndex + pageSize)

    if (nextPageSpots.length > 0) {
      this.setData({
        currentPage: nextPage,
        filteredSpots: filteredSpots.concat(nextPageSpots),
        hasMore: totalFiltered.length > startIndex + pageSize
      })
      console.log('[Spots] 加载更多，第', nextPage, '页，新增', nextPageSpots.length, '条')
    } else {
      this.setData({ hasMore: false })
    }
  },

  onSwitchView(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
    if (mode === 'map' && this.data.filteredSpots.length > 0) {
      const first = this.data.filteredSpots[0]
      this.setData({ mapCenter: { lat: first.lat, lng: first.lng } })
    }
  },

  onMarkerTap(e) {
    const id = e.detail.markerId
    const spot = this.data.spots.find(s => s.id === id)
    if (spot) {
      this.setData({ activeSpot: spot, mapCenter: { lat: spot.lat, lng: spot.lng } })
    }
  },

  onCloseCard() {
    this.setData({ activeSpot: null })
  },

  onGoDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${id}` })
  },

  // 想去按钮
  onWantTap(e) {
    const id = e.currentTarget.dataset.id
    const strId = String(id)
    util.toggleLike(id, 'spot')
    const wantSpots = util.getWantSpots()
    const updateWanted = (list) => list.map(s => ({
      ...s,
      isWanted: wantSpots.indexOf(String(s.id)) > -1
    }))
    this.setData({
      wantSpots: wantSpots,
      spots: updateWanted(this.data.spots),
      filteredSpots: updateWanted(this.data.filteredSpots)
    })
    const isLiked = wantSpots.indexOf(strId) > -1
    wx.showToast({ title: isLiked ? '已收藏 ❤️' : '已取消', icon: 'none', duration: 1200 })
  },

  onFindNearbyFood(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.spots.find(s => s.id === id)
    if (!spot) return
    app.globalData.nearbySpot = spot
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 跳转到想去清单（景点Tab）
  onOpenWantList() {
    wx.navigateTo({ url: '/pages/wantgo/wantgo?tab=spot' })
  },

  // 规划景点路线（从当前筛选列表选）
  onPlanRoute() {
    const { filteredSpots } = this.data
    if (filteredSpots.length === 0) return
    const ids = filteredSpots.slice(0, 10).map(s => s.id).join(',')
    wx.navigateTo({ url: `/pages/route/route?type=spot&ids=${ids}` })
  },

  stopProp() {}
})
