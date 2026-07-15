// 觅食图 - 探索页逻辑 (合并景点与美食)
const app = getApp()
const placesData = require('../../utils/placesData')
const util = require('../../utils/util')
const checkinUtil = require('../../utils/checkinUtil')
const markerIcons = require('../../utils/markerIcons')
const { DEFAULT_COVER_POOL } = require('../../config/cover-pool')
// 首页当前选中的城市要同步给攻略页使用。
// 这样攻略页的地区 Tab 就能跟着首页城市一起切换。
const EXPLORE_SELECTED_CITY_STORAGE_KEY = 'selectedExploreCity'

// 探索地图里的“当前位置”使用一个单独的 marker id，
// 避免和正常地点数据的 id 混在一起。
const CURRENT_LOCATION_MARKER_ID = -1001
const CURRENT_LOCATION_ICON_PATH = '/images/markers/marker_current_location.png'
// 用户提供了 6 张透明背景 PNG，这里按“美食名称 -> 图片路径”做映射。
// 这样首页二级美食 Tab 就能直接看到真实图标效果。
const FOOD_SECONDARY_TAB_ICON_MAP = {
  椰子鸡: '/images/food-tabs/椰子鸡.png',
  海鲜砂锅粥: '/images/food-tabs/海鲜砂锅粥.png',
  早茶点心: '/images/food-tabs/早茶点心.png',
  云吞面: '/images/food-tabs/云吞面.png',
  双皮奶: '/images/food-tabs/双皮奶.png',
  煲仔饭: '/images/food-tabs/煲仔饭.png'
}
// 没有专属图片的二级美食，先从这 6 张透明 PNG 里“随机”分配。
// 为了避免每次渲染都变图，这里用名称做一个稳定映射，看起来随机但不会乱跳。
const FOOD_SECONDARY_TAB_FALLBACK_ICONS = Object.values(FOOD_SECONDARY_TAB_ICON_MAP)
// 用户新提供的 4 张 PNG 名称正好对应景点二级 Tab。
// 这里按“景点名称 -> 图片路径”映射，首页切到景点时直接显示对应图标。
const SPOT_SECONDARY_TAB_ICON_MAP = {
  自然景色: '/images/spot-tabs/自然景色.png',
  历史人文: '/images/spot-tabs/历史人文.png',
  风景名胜: '/images/spot-tabs/风景名胜.png',
  城市公园: '/images/spot-tabs/城市公园.png'
}
// 二级横向卡片当前使用固定宽度布局，
// 这里把宽度和间距提成常量，方便后面统一改动。
const SECONDARY_TAB_ITEM_WIDTH_RPX = 144
// 项间距要和 wxss 保持一致，否则 scroll-left 的定位会出现偏差。
const SECONDARY_TAB_ITEM_GAP_RPX = 24
const SECONDARY_TAB_WRAP_HORIZONTAL_PADDING_RPX = 48
// 首页天气拿不到数据时，统一显示这句更自然的提示文案，
// 避免页面出现空白或误导性的默认温度。
const WEATHER_FALLBACK_TEXT = '天气获取失败，请稍后重试'
// 首页天气缓存 10 分钟，避免短时间内重复请求。
// 这里升级一个版本号，顺手让旧的失败缓存失效。
const WEATHER_CACHE_KEY = 'indexWeatherCache_v2'
const WEATHER_CACHE_TTL = 10 * 60 * 1000
// 首页天气使用腾讯地图天气 API（基于已有 qqMapKey）
const WEATHER_API_URL = 'https://apis.map.qq.com/ws/weather/v1/'
// 首页天气在定位和区划更新时都会触发，这里做一层轻量防抖，避免瞬时重复请求。
const WEATHER_REQUEST_DEBOUNCE_MS = 300
// 重新定位后，把地图拉近到当前位置附近，避免只更新中心点却看起来没变化。
const MY_LOCATION_FOCUS_SCALE = 17
// 首页城市列表本身只覆盖广东城市。
// 这里顺手缓存一份中心点，后面给地图筛选做“坐标兜底校验”。
const EXPLORE_CITY_OPTIONS = util.getCityOptions(DEFAULT_COVER_POOL)
// 不同城市允许的最大偏移半径（公里）。
// 这不是行政区精确边界，只是用来挡掉明显跑到省外的脏数据。
const CITY_LOCATION_SANITY_RADIUS_KM_MAP = {
  广州: 90,
  深圳: 80,
  汕头: 80,
  湛江: 110,
  汕尾: 90,
  清远: 110,
  佛山: 70,
  东莞: 80,
  珠海: 70,
  中山: 70,
  江门: 90,
  惠州: 100,
  肇庆: 100,
  茂名: 110,
  阳江: 100,
  梅州: 100,
  河源: 100,
  韶关: 120,
  揭阳: 90,
  潮州: 80,
  云浮: 100
}
const CITY_CENTER_MAP = EXPLORE_CITY_OPTIONS.reduce((result, item) => {
  result[item.name] = {
    lat: item.lat,
    lng: item.lng
  }
  return result
}, {})

// 把城市名称统一整理成“XX市”的形式，方便跨页面复用。
function normalizeSelectedCityName(cityName = '') {
  const source = String(cityName || '').trim()
  if (!source) return '深圳市'
  return /市$/.test(source) ? source : `${util.getCityShortName(source)}市`
}

// 首页城市一旦变化，就同步写到全局和本地缓存。
// 攻略页返回时直接读取这里，就能拿到和首页一致的城市。
function syncSelectedExploreCity(cityName = '') {
  const normalizedCityName = normalizeSelectedCityName(cityName)
  app.globalData.selectedExploreCity = normalizedCityName
  wx.setStorageSync(EXPLORE_SELECTED_CITY_STORAGE_KEY, normalizedCityName)
  return normalizedCityName
}

// 统一整理天气展示字段，避免多处重复拼接文案。
function buildWeatherState(weather = '', temperature = '') {
  const weatherDesc = weather || WEATHER_FALLBACK_TEXT
  const weatherTemp = temperature !== undefined && temperature !== null && temperature !== ''
    ? `${temperature}°C`
    : ''
  return {
    weatherDesc,
    weatherTemp
  }
}

// 读取本地天气缓存。
// 只有在缓存没过期、并且带有基础天气字段时才复用。
function getCachedWeatherState() {
  const cache = wx.getStorageSync(WEATHER_CACHE_KEY)
  if (!cache || !cache.timestamp) return null
  if (Date.now() - cache.timestamp > WEATHER_CACHE_TTL) return null
  if (!cache.weatherDesc) return null
  if (cache.weatherDesc === WEATHER_FALLBACK_TEXT) return null
  return {
    weatherDesc: cache.weatherDesc,
    weatherTemp: cache.weatherTemp || ''
  }
}

// 把最新天气写入本地缓存，给短时间内重复进入首页时直接复用。
function saveWeatherStateToCache(weatherState = {}) {
  if (!weatherState.weatherDesc) return
  if (weatherState.weatherDesc === WEATHER_FALLBACK_TEXT) return
  wx.setStorageSync(WEATHER_CACHE_KEY, {
    ...weatherState,
    timestamp: Date.now()
  })
}

// 根据当前城市做一层坐标兜底校验。
// 如果历史数据把省外点误写成“深圳/广州”，这里会直接挡掉。
function isItemNearCurrentCity(item = {}, currentCity = '') {
  const cityShort = util.getCityShortName(currentCity || '')
  const cityCenter = CITY_CENTER_MAP[cityShort]
  if (!cityShort || !cityCenter) return true

  const lat = typeof item.lat === 'number' ? item.lat : Number(item.lat || item.latitude)
  const lng = typeof item.lng === 'number' ? item.lng : Number(item.lng || item.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true

  const distance = util.getDistance(cityCenter.lat, cityCenter.lng, lat, lng)
  const maxDistance = (CITY_LOCATION_SANITY_RADIUS_KM_MAP[cityShort] || 100) * 1000
  return distance <= maxDistance
}


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

// 美食二级 Tab 配置：
// 当前先只接 5 个常用城市。
// 每个城市先放 8 个主打类型，显示在同一张横向滑动的大卡片里。
// label 是页面展示文案，keywords 用来匹配地点名称、分类和标签。
const FOOD_SECONDARY_TAB_CONFIG = {
  深圳: [
    { label: '椰子鸡', keywords: ['椰子鸡'] },
    { label: '光明乳鸽', keywords: ['光明乳鸽', '乳鸽'] },
    { label: '猪脚饭', keywords: ['猪脚饭', '猪脚'] },
    { label: '肠粉', keywords: ['肠粉'] },
    { label: '烧鹅', keywords: ['烧鹅'] },
    { label: '海鲜砂锅粥', keywords: ['海鲜砂锅粥', '砂锅粥'] },
    { label: '潮汕牛肉火锅', keywords: ['潮汕牛肉火锅', '牛肉火锅', '牛肉'] },
    { label: '煲仔饭', keywords: ['煲仔饭'] }
  ],
  广州: [
    { label: '早茶点心', keywords: ['早茶', '点心', '虾饺', '烧卖', '凤爪', '叉烧包', '流沙包'] },
    { label: '肠粉', keywords: ['肠粉'] },
    { label: '烧鹅', keywords: ['烧鹅'] },
    { label: '煲仔饭', keywords: ['煲仔饭'] },
    { label: '云吞面', keywords: ['云吞面', '云吞'] },
    { label: '艇仔粥', keywords: ['艇仔粥'] },
    { label: '牛杂', keywords: ['牛杂'] },
    { label: '双皮奶', keywords: ['双皮奶'] }
  ],
  汕头: [
    { label: '牛肉火锅', keywords: ['牛肉火锅', '牛肉锅', '牛肉'] },
    { label: '粿条汤', keywords: ['粿条汤', '粿条'] },
    { label: '蚝烙', keywords: ['蚝烙'] },
    { label: '卤鹅', keywords: ['卤鹅'] },
    { label: '鱼饭', keywords: ['鱼饭'] },
    { label: '肠粉', keywords: ['肠粉'] },
    { label: '甘草水果', keywords: ['甘草水果', '水果'] },
    { label: '砂锅粥', keywords: ['砂锅粥'] }
  ],
  佛山: [
    { label: '双皮奶', keywords: ['双皮奶'] },
    { label: '柱候鸡', keywords: ['柱候鸡'] },
    { label: '猪脚姜', keywords: ['猪脚姜'] },
    { label: '伦教糕', keywords: ['伦教糕'] },
    { label: '盲公饼', keywords: ['盲公饼'] },
    { label: '鱼皮角', keywords: ['鱼皮角'] },
    { label: '肠粉', keywords: ['肠粉'] }
    ,
    { label: '牛杂', keywords: ['牛杂'] }
  ],
  珠海: [
    { label: '横琴蚝', keywords: ['横琴蚝', '生蚝', '蚝'] },
    { label: '海鲜火锅', keywords: ['海鲜火锅', '海鲜'] },
    { label: '白切鸡', keywords: ['白切鸡'] },
    { label: '乳鸽', keywords: ['乳鸽'] },
    { label: '虾饺', keywords: ['虾饺'] },
    { label: '肠粉', keywords: ['肠粉'] },
    { label: '烧味', keywords: ['烧味', '烧鹅', '烧腊'] },
    { label: '鱼生', keywords: ['鱼生'] }
  ]
}

// 景点二级 Tab 配置：
// 先按用户确认的 4 个方向接入。
// keywords 用来匹配地点名称、标签、展示分类等字段。
const SPOT_SECONDARY_TAB_CONFIG = [
  { label: '自然景色', keywords: ['自然景色', '自然风光', '山', '海', '湖', '岛', '海滩', '海岸', '瀑布', '溪谷', '溶洞'] },
  { label: '历史人文', keywords: ['历史人文', '历史', '人文', '古镇', '古村', '古城', '故居', '祠堂', '遗址', '寺', '庙', '书院', '博物馆', '纪念馆'] },
  { label: '风景名胜', keywords: ['风景名胜', '名胜', '景区', '地标', '观景', '塔', '楼阁', '广场', '步行街', '旅游区'] },
  { label: '城市公园', keywords: ['城市公园', '公园', '植物园', '儿童公园', '森林公园', '湿地公园', '郊野公园'] }
]

// 判断当前一级分类是否需要显示二级卡片。
// 目前首页只保留“景点”二级 Tab，“美食”二级 Tab 暂时关闭。
function categoryHasSecondaryTabs(category) {
  return category === '景点'
}

// 景点二级 Tab 先做成全城市通用配置。
// 当前阶段重点是先把交互和样式接起来，后面再按城市细分也方便扩展。
function getSpotSecondaryTabs() {
  return SPOT_SECONDARY_TAB_CONFIG.map((item) => ({
    ...item,
    iconPath: getSpotSecondaryTabIconPath(item.label)
  }))
}

// 根据二级美食名称返回图片路径。
// 有专属图就直接用专属图；没有就按名称稳定分配一张现有 PNG。
function getFoodSecondaryTabIconPath(label = '') {
  if (FOOD_SECONDARY_TAB_ICON_MAP[label]) {
    return FOOD_SECONDARY_TAB_ICON_MAP[label]
  }
  const fallbackIcons = FOOD_SECONDARY_TAB_FALLBACK_ICONS
  if (!fallbackIcons.length) {
    return '/images/food-tabs/food-tab-unified.webp'
  }
  const hash = String(label).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return fallbackIcons[hash % fallbackIcons.length]
}

// 根据景点二级名称返回图片路径。
// 有同名 PNG 就直接使用；没有时回退到原来的统一占位图。
function getSpotSecondaryTabIconPath(label = '') {
  return SPOT_SECONDARY_TAB_ICON_MAP[label] || '/images/food-tabs/food-tab-unified.webp'
}

// 按一级分类统一返回二级 Tab 配置。
// 目前首页只保留景点二级 Tab，美食配置先保留，后面需要时再恢复。
function getSecondaryTabsByCategory(category) {
  if (category === '景点') {
    return getSpotSecondaryTabs()
  }
  return []
}

// 把地点名称、分类、标签等字段合成一段检索文本。
// 这样美食和景点二级 Tab 都能复用同一套匹配逻辑。
function buildSecondarySearchText(item = {}) {
  const tagText = Array.isArray(item.tags) ? item.tags.join('|') : ''
  return [
    item.name,
    item.category,
    item.subCategory,
    item.displayCategory,
    item.address,
    item.city,
    tagText
  ].filter(Boolean).join('|')
}

// 判断某个地点是否命中当前二级 Tab。
// 先按 keywords 做包含匹配，没配 keywords 时回退到 label 自身。
function matchSecondaryTab(item, tabConfig) {
  if (!tabConfig) return true
  const searchText = buildSecondarySearchText(item)
  const keywords = (tabConfig.keywords && tabConfig.keywords.length > 0)
    ? tabConfig.keywords
    : [tabConfig.label]
  return keywords.some(keyword => searchText.indexOf(keyword) !== -1)
}

// 计算二级横向卡片应该滚动到的 left 偏移量。
// 这里不再只判断“是否可见”，而是尽量把点击项移动到可视区域中间，
// 这样从左往右、从右往左点击都能稳定定位。
function getSecondaryTabScrollLeft(index, totalCount) {
  if (typeof index !== 'number' || index < 0 || totalCount <= 0) return 0
  const windowInfo = wx.getWindowInfo()
  const rpxToPx = windowInfo.windowWidth / 750
  const itemWidth = SECONDARY_TAB_ITEM_WIDTH_RPX * rpxToPx
  const itemGap = SECONDARY_TAB_ITEM_GAP_RPX * rpxToPx
  const wrapPadding = SECONDARY_TAB_WRAP_HORIZONTAL_PADDING_RPX * rpxToPx
  const viewportWidth = windowInfo.windowWidth - (wrapPadding * 2)
  const contentWidth = (totalCount * itemWidth) + (Math.max(totalCount - 1, 0) * itemGap)
  const itemCenter = (index * (itemWidth + itemGap)) + (itemWidth / 2)
  const rawScrollLeft = itemCenter - (viewportWidth / 2)
  const maxScrollLeft = Math.max(contentWidth - viewportWidth, 0)
  return Math.max(0, Math.min(rawScrollLeft, maxScrollLeft))
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
    // 二级分类卡片：
    // 目前“美食”和“景点”共用这一套数据和开关状态。
    secondaryTabs: [],
    currentSecondaryTab: '',
    // 二级横向卡片点击后，scroll-view 会按 left 偏移量平滑滚动。
    secondaryTabScrollLeft: 0,
    showSecondaryCategoryPanel: false,
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
    cityOptions: [],

    // 天气信息
    // 默认先显示提示文案，等接口成功后再替换成真实天气。
    weatherDesc: WEATHER_FALLBACK_TEXT,
    // 温度默认留空，避免天气接口失败时页面还假装显示固定的 25°C。
    weatherTemp: '',
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
    
    // 计算顶部面板高度：胶囊按钮位置 + 一级分类 + 二级分类大卡片的安全预留高度。
    // 二级美食现在是一整张卡片，整体高度比之前更高，所以这里额外多留一些空间。
    const rpxToPx = windowInfo.windowWidth / 750
    const categoryAreaHeight = 296 * rpxToPx
    // 顶部白色渐变只覆盖“地址 + 天气 + 一级分类”这部分，
    // 不再因为二级卡片出现而把白色蒙层一起拉长。
    const topGradientHeight = Math.round(menuTop + menuHeight + (132 * rpxToPx))
    const headerRowHeight = menuHeight + 20 // nav-bar(含padding) + weather-row(含padding)
    const topPanelHeight = menuTop + headerRowHeight + categoryAreaHeight
    
    // 计算收起时的高度：
    // 收起态只需要露出手柄区域，并把“全部 / 距离 / 好评”再多收进去一点。
    // 这里改成固定的手柄高度，而不是按屏幕百分比算，避免不同机型下露出过多内容。
    const minHeight = Math.round(56 * rpxToPx)
    
    // 计算最大高度：屏幕高度 - 顶部面板高度(不含分类菜单) - tabBar高度(50px) - 安全区域底部
    // 保留部分顶部空间给分类菜单，避免遮挡
    const tabBarHeight = 50
    const topReserve = 100 // 顶部预留空间，防止遮挡分类菜单
    const sysMaxHeight = windowInfo.windowHeight - topPanelHeight + categoryAreaHeight - tabBarHeight - (windowInfo.safeAreaBottom || 0) - topReserve
    
    // 改回微信原生 tabbar 后，页面可视区域本身就已经停在 tabbar 上方。
    // 这里不能再额外加 tabBarHeight，否则收起态会被整体抬高，露出后面的地图。
    const sheetBottom = 0
    
    // 计算半屏高度
    const midHeight = windowInfo.windowHeight * 0.45
    
    this.setData({ 
      statusBarHeight: windowInfo.statusBarHeight || 44,
      menuTop: menuTop,
      menuHeight: menuHeight,
      menuButtonWidth: menuButtonWidth,
      menuRightInset,
      topPanelHeight: topPanelHeight,
      topGradientHeight: topGradientHeight,
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
      this.ensureCurrentLocationMarkerIcon(false)
      // 使用统一调度，避免重复计算
      this._scheduleApplyFilters()
      // 定位完成后获取天气
      this.scheduleWeatherLoad()
    })

    app.whenDistrictReady((info, locationDesc) => {
      // 当前城市变化后，如果景点二级面板正处于展开状态，就同步刷新当前二级项。
      const nextCity = info.city
      const syncedCityName = syncSelectedExploreCity(nextCity)
      const secondaryTabs = (this.data.showSecondaryCategoryPanel && categoryHasSecondaryTabs(this.data.currentCategory))
        ? getSecondaryTabsByCategory(this.data.currentCategory)
        : []
      this.setData({ 
        currentCity: syncedCityName,
        secondaryTabs,
        currentSecondaryTab: '',
        secondaryTabScrollLeft: 0
      })
      // 区划更新后重新获取天气
      this.scheduleWeatherLoad()
    })
    
    // 监听图标加载完成事件
    this._iconsReady = false
    markerIcons.ensureIcons(() => {
      this._iconsReady = true
    })
  },

  initCityOptions() {
    this.setData({ cityOptions: EXPLORE_CITY_OPTIONS })
  },

  ensureCurrentLocationMarkerIcon(fitMap = true) {
    // 当前位置直接使用用户提供的 PNG 图标，
    // 不再走 canvas 动态绘制，避免锯齿和样式偏差。
    this._currentLocationMarkerIconPath = CURRENT_LOCATION_ICON_PATH
    // 这里允许外部决定是否顺手执行全量 fitMap，
    // 避免“回到当前位置”时又把地图缩回全部结果。
    this.updateMarkers(fitMap)
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

  // 统一调度 applyFilters，避免重复调用。
  // fitMap 允许像“回到当前位置”这类场景只刷新距离和 marker，
  // 但不要再次触发 includePoints 把地图缩回全量结果。
  _scheduleApplyFilters(fitMap = true) {
    if (this._applyFiltersTimer) {
      clearTimeout(this._applyFiltersTimer)
    }
    this._applyFiltersTimer = setTimeout(() => {
      this.applyFilters(fitMap)
      this._applyFiltersTimer = null
    }, 0)
  },

  // 加载数据 (本地优先 + 后台同步)
  async loadItems() {
    // 等待 placesData 初始化完成（解决启动时序竞争问题）
    await placesData.whenReady()
    const userShops = util.getUserShopsAsync()
    
    // 自定义地点只对“已有 city 字段”的数据做标准化处理，
    // 不再把缺少 city 的点强行归到当前城市。
    // 否则像新疆、贵州这类外省坐标，只要刚好在深圳页加载，
    // 就会被误标成“深圳”，进而混进深圳地图结果里。
    const normalizedUserShops = userShops.map(shop => {
      if (!shop.city) {
        return {
          ...shop,
          city: ''
        }
      }
      return {
        ...shop,
        city: util.getCityShortName(shop.city)
      }
    })
    
    // 直接从 placesData 获取所有数据（已包含真实数据+演示数据）
    const allPlaces = [...placesData.getAllPlaces(), ...normalizedUserShops].map(item => {
      // 标签里像"南山区"这种行政区信息不展示，只保留前 2 个业务标签。
      const filteredTags = (item.tags || []).filter(tag => !tag.endsWith('区')).slice(0, 2);
      
      return {
        ...item,
        tags: filteredTags,
      };
    })
    // 直接设置为总列表，不再需要合并演示数据
    this.setData({ allItems: allPlaces })
    this._scheduleApplyFilters()
    // 页面读取完本地数据后，后台再给缺少 city 的旧自定义地点补城市。
    // 补完会回写本地缓存，后续深圳/广州这类城市筛选就不会再串城。
    this.backfillUserShopCities(normalizedUserShops)
  },

  // 从自定义地点里统一拿经纬度。
  // 兼容历史数据可能出现的 lat/lng 或 latitude/longitude 两套字段名。
  getUserShopLocation(shop = {}) {
    const latitude = typeof shop.lat === 'number' ? shop.lat : Number(shop.lat || shop.latitude)
    const longitude = typeof shop.lng === 'number' ? shop.lng : Number(shop.lng || shop.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null
    }
    return { latitude, longitude }
  },

  // 给缺少 city 的旧自定义地点按经纬度反查城市，并回写到本地缓存。
  // 这样后续再切城市时，就不会把外省坐标误混到当前城市里。
  async backfillUserShopCities(userShops = []) {
    if (this._isBackfillingUserShopCities) return
    const hasMissingCity = userShops.some(shop => !shop.city && this.getUserShopLocation(shop))
    if (!hasMissingCity) return

    this._isBackfillingUserShopCities = true
    const nextUserShops = userShops.map(shop => ({ ...shop }))
    let hasUpdated = false

    try {
      for (let index = 0; index < nextUserShops.length; index += 1) {
        const shop = nextUserShops[index]
        if (shop.city) continue

        const location = this.getUserShopLocation(shop)
        if (!location) continue

        try {
          const geocodeResult = await checkinUtil.reverseGeocode(location.latitude, location.longitude)
          const cityShort = util.getCityShortName((geocodeResult && geocodeResult.city) || '')
          if (!cityShort) continue

          nextUserShops[index].city = cityShort
          hasUpdated = true
        } catch (error) {
          console.log('[index] 自定义地点反查城市失败:', shop.name || shop.id, error)
        }
      }
    } finally {
      this._isBackfillingUserShopCities = false
    }

    if (!hasUpdated) return

    util.saveData('userAddedShops', nextUserShops)
    this.loadItems()
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

  // 首页天气会被多个初始化时机触发，这里统一做防抖调度，减少同一秒内的重复请求。
  scheduleWeatherLoad(options = {}) {
    if (this._weatherLoadTimer) {
      clearTimeout(this._weatherLoadTimer)
    }
    this._weatherLoadTimer = setTimeout(() => {
      this._weatherLoadTimer = null
      this.loadWeather(options)
    }, WEATHER_REQUEST_DEBOUNCE_MS)
  },

  // 读取当前定位对应的天气信息。
  loadWeather(options = {}) {
    const { force = false } = options
    // 短时间内重复进入首页时，优先用缓存，避免再次打天气接口。
    const cachedWeatherState = force ? null : getCachedWeatherState()
    if (cachedWeatherState) {
      this.setData(cachedWeatherState)
      return
    }

    // 如果上一次天气请求还没结束，就不要再重复发起。
    if (this._weatherLoading) {
      return
    }

    const location = app.globalData.location
    const key = app.globalData.qqMapKey
    // 没有定位或 key 时，直接回退到提示文案，
    // 避免页面停留在空白天气状态。
    if (!location || !key) {
      this.setData({
        weatherDesc: WEATHER_FALLBACK_TEXT,
        weatherTemp: ''
      })
      return
    }

    // 使用腾讯地图天气 API
    this._weatherLoading = true
    wx.request({
      url: WEATHER_API_URL,
      data: {
        location: `${location.lat},${location.lng}`,
        key: key,
        type: 'now'
      },
      success: (res) => {
        if (res.data && res.data.status === 0) {
          const realtime = Array.isArray(res.data.result && res.data.result.realtime)
            ? res.data.result.realtime[0]
            : (res.data.result && res.data.result.realtime)
          const infos = (realtime && realtime.infos) || (res.data.result && res.data.result.infos) || {}
          const weatherState = buildWeatherState(infos.weather, infos.temperature)
          this.setData(weatherState)
          saveWeatherStateToCache(weatherState)
        } else {
          // 接口返回异常状态时，统一回退到提示文案。
          this.setData({
            weatherDesc: WEATHER_FALLBACK_TEXT,
            weatherTemp: ''
          })
        }
        this._weatherLoading = false
      },
      fail: () => {
        // 请求失败时显示提示文案，不再保留旧的假数据。
        this.setData({
          weatherDesc: WEATHER_FALLBACK_TEXT,
          weatherTemp: ''
        })
        this._weatherLoading = false
      }
    })
  },

  // 按当前分类、排序和地图中心点，重新生成当前可见列表。
  // 全量数据存入 _fullFilteredList，UI 只展示第一页
  applyFilters(fitMap = true) {
    let {
      allItems,
      currentCategory,
      sortType,
      currentDistance,
      mapCenter,
      currentCity,
      pageSize,
      currentSecondaryTab,
      secondaryTabs
    } = this.data
    
    let filtered = allItems
    
    // 城市筛选：根据当前选中的城市进行筛选
    if (currentCity) {
      const cityShort = util.getCityShortName(currentCity)
      filtered = filtered.filter(item => {
        if (item.city !== cityShort) return false
        return isItemNearCurrentCity(item, cityShort)
      })
    }
    
    // 分类筛选
    if (currentCategory === '景点') {
      filtered = filtered.filter(i => i.type === 'spot')
      // 景点和美食一样，只有点了二级项才继续往下细分。
      if (currentSecondaryTab) {
        const activeSecondaryTab = secondaryTabs.find(item => item.label === currentSecondaryTab)
        if (activeSecondaryTab) {
          filtered = filtered.filter(item => matchSecondaryTab(item, activeSecondaryTab))
        }
      }
    } else if (currentCategory === '美食') {
      filtered = filtered.filter(i => i.type === 'food')
      // 命中“美食”后，再按当前二级 Tab 继续细分筛选。
      // 只有这 5 个已配置城市会进入这层筛选，其他城市仍然显示全部美食。
      if (currentSecondaryTab) {
        const activeSecondaryTab = secondaryTabs.find(item => item.label === currentSecondaryTab)
        if (activeSecondaryTab) {
          filtered = filtered.filter(item => matchSecondaryTab(item, activeSecondaryTab))
        }
      }
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
    
    this.updateMarkers(fitMap)
  },

  // 根据当前筛选结果，让地图自动缩放到合适范围。
  // 一级“美食”时会覆盖到当前城市的全部美食；点了某个二级项后，再缩到该细分结果。
  _fitMapToCurrentResults() {
    const pointsSource = Array.isArray(this._fullFilteredList) ? this._fullFilteredList : []
    const points = pointsSource
      .filter(item => typeof item.lat === 'number' && typeof item.lng === 'number')
      .map(item => ({
        latitude: item.lat,
        longitude: item.lng
      }))

    if (points.length === 0) return

    // 只有一个点时，直接把中心点对准它并给一个合适的缩放级别。
    if (points.length === 1) {
      this.setData({
        mapCenter: { lat: points[0].latitude, lng: points[0].longitude },
        mapScale: 15
      })
      return
    }

    const windowInfo = wx.getWindowInfo()
    const mapCtx = wx.createMapContext('mainMap', this)
    const topPadding = Math.round((this.data.topPanelHeight || 160) + 12)
    const bottomPadding = Math.round((this.data.sheetHeight || 0) + (this.data.sheetBottom || 0) + 24)

    // 顶部留白要避开地址、天气、一级分类和二级美食卡片。
    // 底部留白要避开当前列表面板高度，避免点位被底部列表挡住。
    mapCtx.includePoints({
      points,
      padding: [topPadding, 24, bottomPadding, 24]
    })
  },

  // 根据当前列表更新地图上的点位。
  updateMarkers(fitMap = true) {
    // 地图 marker 要跟当前筛选后的“全部结果”走，不跟列表第一页绑定。
    // 这样一级点“美食”时，地图才能显示当前城市的全部美食点位。
    const items = Array.isArray(this._fullFilteredList) ? this._fullFilteredList : this.data.filteredItems
    if (!items || items.length === 0) {
      this.setData({ allMarkers: [] })
      return
    }

    const markers = items.map((item) => {
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
        // 普通地点图标放大到 32px，当前位置图标仍保持原尺寸不变。
        width: 32,
        height: 32
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

    this.setData({ allMarkers: markers }, () => {
      if (fitMap) {
        this._fitMapToCurrentResults()
      }
    })
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
    const isSameCategory = category === this.data.currentCategory
    const hasSecondaryTabs = categoryHasSecondaryTabs(category)
    // 一级“景点”第一次点击时展开二级卡片，
    // 再点击同一个一级分类时就把二级卡片收起。
    const showSecondaryCategoryPanel = hasSecondaryTabs
      ? (isSameCategory ? !this.data.showSecondaryCategoryPanel : true)
      : false
    const secondaryTabs = showSecondaryCategoryPanel
      ? getSecondaryTabsByCategory(category)
      : []
    // 点击“景点”一级分类时，默认选中第一个二级 Tab。
    // 这样用户进入景点后会直接看到首个推荐分类，其它交互保持不变。
    const defaultSecondaryTab = showSecondaryCategoryPanel && secondaryTabs.length
      ? secondaryTabs[0].label
      : ''
    const defaultSecondaryTabScrollLeft = defaultSecondaryTab
      ? getSecondaryTabScrollLeft(0, secondaryTabs.length)
      : 0
    this.setData({ 
      currentCategory: category, 
      secondaryTabs,
      currentSecondaryTab: defaultSecondaryTab,
      secondaryTabScrollLeft: defaultSecondaryTabScrollLeft,
      showSecondaryCategoryPanel,
      currentPage: 1,
      scrollToCategory: '' // 先清空触发重新滚动
    })
    // 异步设置滚动目标，确保scroll-view重新渲染
    setTimeout(() => {
      this.setData({ scrollToCategory: 'cat-' + category })
    }, 10)
    this._scheduleApplyFilters()
  },

  // 切换二级 Tab。
  // 点击后除了更新筛选，还会把横向滚动区域自动移动到当前项附近。
  onSecondaryTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    const index = e.currentTarget.dataset.index
    if (!tab) return
    const secondaryTabScrollLeft = getSecondaryTabScrollLeft(index, this.data.secondaryTabs.length)
    this.setData({
      currentSecondaryTab: tab,
      secondaryTabScrollLeft,
      currentPage: 1
    }, () => {
      // 二级景点每次点击后，都要按“当前二级筛选出的全部结果”重新缩放地图。
      // 这里不再只在 tab 变化时才触发，避免重复点击当前二级项时地图范围不更新。
      this._scheduleApplyFilters(true)
    })
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

  // 地图拖动或缩放结束后，同步当前真实中心点。
  // 这样首页再点“放大 / 缩小”时，就会基于用户刚刚看到的区域来缩放，
  // 不会再跳回上一次定位写入的旧中心点。
  onMainMapRegionChange(e) {
    if (!e || e.type !== 'end') return

    // 复用同一个 mapContext，避免每次都重复创建。
    if (!this._mainMapCtx) {
      this._mainMapCtx = wx.createMapContext('mainMap', this)
    }

    this._mainMapCtx.getCenterLocation({
      success: (res) => {
        if (
          typeof res.latitude !== 'number' ||
          Number.isNaN(res.latitude) ||
          typeof res.longitude !== 'number' ||
          Number.isNaN(res.longitude)
        ) {
          return
        }

        const nextCenter = {
          lat: res.latitude,
          lng: res.longitude
        }

        const currentCenter = this.data.mapCenter || {}
        // 中心点变化极小时不重复 setData，避免缩放和拖动后连续抖动。
        if (
          Math.abs((currentCenter.lat || 0) - nextCenter.lat) < 0.000001 &&
          Math.abs((currentCenter.lng || 0) - nextCenter.lng) < 0.000001
        ) {
          return
        }

        this.setData({
          mapCenter: nextCenter
        })
      }
    })
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
        const resolvedCity = (app.globalData.districtInfo && app.globalData.districtInfo.city) || this.data.currentCity
        const syncedCityName = syncSelectedExploreCity(resolvedCity)
        app.globalData.location = loc
        this.setData({ 
          mapCenter: loc,
          // 重新定位后同步拉近地图，让当前位置区域更明确。
          mapScale: MY_LOCATION_FOCUS_SCALE,
          // 重新定位时同步更新当前位置 marker 的坐标，
          // 否则地图中心变了，但自定义当前位置图标不会跟着走。
          currentLocation: loc,
          currentDistrict: '',
          currentCity: syncedCityName,
          locationMode: 'my'
        })
        // 重新定位后重新确认当前位置 iconPath 已挂上，
        // 避免路径未初始化时 marker 条件不成立。
        this.ensureCurrentLocationMarkerIcon(false)
        this._scheduleApplyFilters(false)
        wx.showToast({ title: '已定位到当前位置', icon: 'success', duration: 1500 })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '定位失败', icon: 'none' })
      }
    })
  },

  // 地图放大一级：
  // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
  onMapZoomIn() {
    const currentScale = this.data.mapScale
    if (currentScale < 20) {
      const newScale = Math.min(currentScale + 1, 20)
      this.setData({
        mapScale: newScale
      })
    }
  },

  // 地图缩小一级：
  // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
  onMapZoomOut() {
    const currentScale = this.data.mapScale
    if (currentScale > 3) {
      const newScale = Math.max(currentScale - 1, 3)
      this.setData({
        mapScale: newScale
      })
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
    const syncedCityName = syncSelectedExploreCity(item.fullName)
    // 切换城市时，如果景点二级卡片正处于展开状态，
    // 就同步刷新卡片内容，但不保留旧的二级选中项。
    const secondaryTabs = (this.data.showSecondaryCategoryPanel && categoryHasSecondaryTabs(this.data.currentCategory))
      ? getSecondaryTabsByCategory(this.data.currentCategory)
      : []
    this.setData({ 
      currentCity: syncedCityName,
      currentDistrict: '',
      mapCenter: {
        lat: item.lat,
        lng: item.lng
      },
      secondaryTabs,
      currentSecondaryTab: '',
      secondaryTabScrollLeft: 0,
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
