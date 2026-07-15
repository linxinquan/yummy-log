const app = getApp();
const util = require("../../../../utils/util");
const checkinUtil = require("../../../../utils/checkinUtil");
const {
  buildDayLabel,
  buildTabsFromSections,
  getPreviewIndexByDay,
  getDayIndexByPreview,
  buildSummaryText,
  getCityInfo,
  buildPreviewTitle,
  buildPreviewRouteData,
  buildPreviewDaySections,
  stripEditState,
  flattenDaySections,
} = require("../../../../utils/routeHelper");
const placesData = require("../../../../utils/placesData");
const {
  applyTravelMeta,
  buildTravelOptions,
} = require("../../../../utils/travel");
const { buildMapPreviewViewData } = require("../../../../utils/map-preview");
const { resolveDisplayCategory } = require("../../../../utils/displayCategory");
const mapConfig = require("../../../../utils/map-config");
const { fetchRealRoute } = require("../../../../utils/mapRouteFetcher");
const {
  normalizeTripSummaryText,
} = require("../../../../utils/trip-duration");
const {
  buildPlaceCardTags,
  buildRouteTravelDisplay,
  buildPlaceIntroData,
} = require("../../../../utils/route-place-card");
const routeMapBehavior = require("../../utils/route-map-behavior");
const myRouteEditBehavior = require("../../utils/my-route-edit-behavior");

// 地图模式统一使用当前位置 PNG 图标，和探索页保持一致。
const CURRENT_LOCATION_ICON_PATH =
  "/images/markers/marker_current_location.png";
const CURRENT_LOCATION_FOCUS_SCALE = 15;

// 把"当前所在位置"和真实定位地址拼成统一显示文案。
// 有地址时显示：当前所在位置（深圳市南山区xxx）
// 没地址时只显示：当前所在位置
function buildCurrentLocationDisplayName(address = "") {
  const safeAddress = String(address || "").trim();
  return safeAddress ? `当前所在位置（${safeAddress}）` : "当前所在位置";
}

// 城市预设：根据路线标题或城市文案，尽量反推路线所在城市和中心坐标。
const CITY_PRESETS = [
  { match: /香港/, name: "香港特别行政区", lat: 22.3193, lng: 114.1694 },
  { match: /上海/, name: "上海市", lat: 31.2304, lng: 121.4737 },
  { match: /北京/, name: "北京市", lat: 39.9042, lng: 116.4074 },
  { match: /广州/, name: "广州市", lat: 23.1291, lng: 113.2644 },
  { match: /杭州/, name: "杭州市", lat: 30.2741, lng: 120.1551 },
  { match: /台北/, name: "台北市", lat: 25.0330, lng: 121.5654 },
  { match: /澳门/, name: "澳门特别行政区", lat: 22.1987, lng: 113.5439 },
  { match: /成都/, name: "成都市", lat: 30.5728, lng: 104.0668 },
  { match: /厦门/, name: "厦门市", lat: 24.4798, lng: 118.0894 },
  { match: /南京/, name: "南京市", lat: 32.0603, lng: 118.7969 },
  { match: /苏州/, name: "苏州市", lat: 31.2990, lng: 120.5853 },
  { match: /福州/, name: "福州市", lat: 26.0745, lng: 119.2965 },
  { match: /台州/, name: "台州市", lat: 28.6564, lng: 121.4208 },
  { match: /台南/, name: "台南市", lat: 22.9999, lng: 120.2270 },
  { match: /台中/, name: "台中市", lat: 24.1477, lng: 120.6736 },
  { match: /高雄/, name: "高雄市", lat: 22.6273, lng: 120.3014 },
  { match: /温州/, name: "温州市", lat: 27.9939, lng: 120.6994 },
  { match: /泉州/, name: "泉州市", lat: 24.8746, lng: 118.6759 },
  { match: /扬州/, name: "扬州市", lat: 32.3936, lng: 119.4213 },
  { match: /常州/, name: "常州市", lat: 31.8101, lng: 119.9736 },
  { match: /新北/, name: "新北市", lat: 25.0620, lng: 121.4570 },
  { match: /新竹县/, name: "新竹县", lat: 24.8393, lng: 121.0020 },
  { match: /新竹/, name: "新竹市", lat: 24.8036, lng: 120.9686 },
  { match: /宁德/, name: "宁德市", lat: 26.6657, lng: 119.5482 },
  { match: /惠州/, name: "惠州市", lat: 23.1118, lng: 114.4168 },
  { match: /乌兰察布/, name: "乌兰察布市", lat: 41.0006, lng: 113.1336 },
  {
    match: /深圳|南山|福田|罗湖|宝安|龙岗|盐田|龙华|光明|坪山|大鹏/,
    name: "深圳市",
    lat: 22.5431,
    lng: 114.0579,
  },
];

// 西安这组点位是给旧攻略和示例路线补坐标用的。
const XIAN_POI_MAP = {
  西安城墙永宁门城楼: { lat: 34.2476, lng: 108.9461, type: "spot" },
  西安钟楼: { lat: 34.259, lng: 108.9488, type: "spot" },
  西安鼓楼: { lat: 34.2597, lng: 108.9434, type: "spot" },
  回民街: { lat: 34.2622, lng: 108.9426, type: "spot" },
  秦始皇兵马俑博物馆: { lat: 34.3849, lng: 109.2786, type: "spot" },
  华清宫: { lat: 34.3639, lng: 109.2139, type: "spot" },
  长恨歌演出: { lat: 34.3622, lng: 109.2147, type: "spot" },
  大雁塔: { lat: 34.2236, lng: 108.9631, type: "spot" },
  陕西历史博物馆: { lat: 34.2241, lng: 108.9537, type: "spot" },
  大唐不夜城: { lat: 34.2174, lng: 108.968, type: "spot" },
};

// 删除按钮本身是 120rpx，这里按 48rpx 间距换算成 px 后，统一地点卡片左滑打开距离。
const MAX_DELETE_OFFSET = -84;

// 统一处理名称，方便做模糊匹配。
function normalizeName(name) {
  return String(name || "")
    .replace(/\s+/g, "")
    .replace(/[()（）·,，.。]/g, "")
    .toLowerCase();
}

// 当地点缺坐标时，按城市中心生成一组临时坐标，避免地图和路线失效。
function buildSyntheticLatLng(cityInfo, dayIndex, itemIndex) {
  return {
    lat: cityInfo.lat + (dayIndex * 0.018 - 0.018) + itemIndex * 0.0035,
    lng: cityInfo.lng + (itemIndex * 0.016 - 0.016) + dayIndex * 0.004,
  };
}

// 根据地点名称猜一个大概标签，主要用于旧数据兜底。
function inferTag(name) {
  if (/博物馆|展馆|美术馆/.test(name)) return "文化展馆";
  if (/演出|剧场|音乐会/.test(name)) return "演出";
  if (/商场|购物中心|步行街/.test(name)) return "购物";
  if (
    /店|馆|面|饭|咖啡|茶|酒|餐|小吃|甜品|火锅|奶茶|烧烤|糖水|包|饼|馍/.test(
      name
    )
  )
    return "美食";
  return "景点";
}

// 尝试把地点名称匹配到系统已有的美食或景点数据。
function findMatchedPlace(name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const allPlaces = placesData.getAllPlaces();
  const matchedPlace = allPlaces.find(
    (item) => normalizeName(item.name) === normalized
  );
  if (matchedPlace) return matchedPlace;

  // 尝试匹配别名（简化逻辑：直接在allPlaces中查找）
  const matchedPlace2 = allPlaces.find((item) => {
    const itemName = normalizeName(item.name);
    return normalized.includes(itemName) || itemName.includes(normalized);
  });
  if (matchedPlace2) return matchedPlace2;

  const xianPoi = Object.keys(XIAN_POI_MAP).find(
    (key) => normalizeName(key) === normalized
  );
  return xianPoi ? XIAN_POI_MAP[xianPoi] : null;
}

// 给路线详情列表补齐展示字段：
// 1. 封面上的大类标签
// 2. 评分和普通标签
// 3. 底部中文距离和中文时间
function decorateRoutePlaceItem(item = {}) {
  const displayCategory = item.displayCategory || resolveDisplayCategory(item);
  const travelDisplay = buildRouteTravelDisplay(
    item.travelMeta,
    item.distanceFromPrev
  );
  return {
    ...item,
    displayCategory,
    tags: buildPlaceCardTags({ ...item, displayCategory }),
    ...travelDisplay,
  };
}

// 保存时保留原始天数结构，但空待计划天不保存。
function removeEmptyDaysOnSave(daySections) {
  const sections = (daySections || []).filter(
    d => d.id !== '__pending__' || (d.items || []).length > 0
  );
  if (sections.length) return sections;
  return (daySections || []).slice(0, 1);
}

// 获取路线的 daySections，如果没有则返回空数组。
function buildDaySectionsFromLegacy(route) {
  return route.daySections || [];
}

// 把"想去 / 收藏 / 全部"来源的地点，统一整理成添加地点弹窗可用的数据格式。
// 这样弹窗里就不用分别兼容很多不同字段名了。
function buildPlaceCandidate(item, type, source) {
  if (!item) return null;
  const resolvedType = item.type || type || "spot";
  const sourceTextMap = {
    want: "来自想去",
    collect: "来自收藏",
    all: "已在想去和收藏",
  };
  // 标签里只保留真实有值的内容，避免出现空标签。
  const rawTags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  return {
    id: String(item.id),
    sourceKey: `${resolvedType}-${item.id}`,
    sourceType: source,
    sourceText: sourceTextMap[source] || "已加入来源列表",
    type: resolvedType,
    name: item.name,
    // 这里显示的是大类标签，不显示"粤菜""面馆"这种细分类。
    tag: resolveDisplayCategory({ ...item, type: resolvedType }),
    coverImage: item.coverImage || "/images/app-logo.jpg",
    rating: item.rating || item.score || "",
    price: item.price || "",
    tags: rawTags.slice(0, 2),
    lat: item.lat || item.latitude,
    lng: item.lng || item.longitude,
  };
}

// 汇总"想去 / 收藏 / 全部"三类来源，给添加地点弹窗使用。
function buildPlacePickerData() {
  const userAddedShops = util.loadData("userAddedShops", []);
  // 新格式：统一数据集，包含所有地点（美食+景点+用户添加）
  const allPlaces = [...placesData.getAllPlaces(), ...userAddedShops];

  // 新格式：从 userWantList 获取所有想去 ID（不再分离 food 和 spot）
  const allWantIds = util.getWantList();

  // 收藏 ID 也合并（不再分离 food 和 spot）
  const collectFoodIds = util
    .loadData("userCollectedFoods", [])
    .map((item) => String(item));
  const collectSpotIds = util
    .loadData("userCollectedSpots", [])
    .map((item) => String(item));
  const allCollectIds = [...collectFoodIds, ...collectSpotIds];

  const wantItems = [];
  const collectItems = [];
  const allMap = new Map();

  const appendItems = (ids, source, targetList) => {
    ids.forEach((id) => {
      const found = allPlaces.find((entry) => String(entry.id) === String(id));
      const candidate = buildPlaceCandidate(found, null, source);
      if (!candidate) return;
      targetList.push(candidate);
      const existed = allMap.get(candidate.sourceKey);
      if (existed) {
        allMap.set(candidate.sourceKey, {
          ...existed,
          sourceType: existed.sourceType === source ? source : "all",
          sourceText:
            existed.sourceType === source
              ? candidate.sourceText
              : "已在想去和收藏",
        });
      } else {
        allMap.set(candidate.sourceKey, candidate);
      }
    });
  };

  // 不再按类型分离，统一处理
  appendItems(allWantIds, "want", wantItems);
  appendItems(allCollectIds, "collect", collectItems);

  return {
    all: Array.from(allMap.values()),
    want: wantItems,
    collect: collectItems,
  };
}

// 把弹窗里选中的地点转换成正式加入路线的数据格式。
function buildAddedPlace(item) {
  return {
    id: `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    originalId: item.id,
    name: item.name,
    tag: item.tag,
    coverImage: item.coverImage,
    type: item.type,
    lat: item.lat,
    lng: item.lng,
  };
}

// 把地图选点结果也转换成和普通地点一致的格式。
function buildMapPickedPlace(location) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return {
    id: `map-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: location.name || location.address || "地图选点",
    tag: "地点",
    coverImage: "/images/app-logo.jpg",
    type: "spot",
    lat: latitude,
    lng: longitude,
  };
}

// 跨天拖拽时，把某个地点从原来那天移动到目标那天。
function moveItemAcrossDays(
  daySections,
  fromDayIndex,
  fromItemIndex,
  toDayIndex,
  toItemIndex
) {
  const nextSections = (daySections || []).map((day) => ({
    ...day,
    items: [...((day && day.items) || [])],
  }));
  const sourceDay = nextSections[fromDayIndex];
  const targetDay = nextSections[toDayIndex];
  if (!sourceDay || !targetDay || !sourceDay.items[fromItemIndex]) {
    return nextSections;
  }

  const [movedItem] = sourceDay.items.splice(fromItemIndex, 1);
  let safeTargetIndex = Math.max(
    0,
    Math.min(parseInt(toItemIndex, 10) || 0, targetDay.items.length)
  );

  if (fromDayIndex === toDayIndex && safeTargetIndex > fromItemIndex) {
    safeTargetIndex -= 1;
  }

  targetDay.items.splice(safeTargetIndex, 0, movedItem);
  return nextSections;
}

Page({
  behaviors: [routeMapBehavior, myRouteEditBehavior],
  data: {
    route: null,
    generatingRoute: false,
    routeId: "",
    returnTo: "",
    menuTop: 0,
    menuHeight: 32,
    modeSwitchTop: 110,
    tabStickyTop: 150,
    editTabStickyTop: 90,
    viewMode: "list",
    currentTab: 0,
    currentMapDay: -1,
    detailScrollTop: 0,
    sheetScrollTarget: "",
    cityText: "深圳市",
    summaryText: "",
    hasRoutePlaces: false,
    daySections: [],
    originalDaySections: [],
    tabs: [],
    mapCenter: { lat: 22.5431, lng: 114.0579 },
    mapMarkers: [],
    polyline: [],
    mapPreviewPlaces: [],
    mapPreviewPlace: null,
    mapPreviewIndex: 0,
    previewTabs: [],
    previewDisplayMeta: [],
    previewDescriptionText: "",
    previewFeeText: "",
    previewStationText: "",
    previewCountText: "",
    previewPrevIndex: -1,
    previewNextIndex: -1,
    previewDisablePrev: true,
    previewDisableNext: true,
    mapScale: 12,
    // 当前定位和当前起点统一分开存：
    // currentLocation 负责地图定位，currentStart 负责起点文案和当天起点计算。
    currentLocation: null,
    currentStart: {
      name: "当前所在位置",
      lat: 22.5431,
      lng: 114.0579,
      type: "current",
    },
    isEditing: false,
    dragging: false,
    dragDay: -1,
    dragIndex: -1,
    dragTouchStartY: 0,
    dragOffsetY: 0,
    handleTouchStartY: 0,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeDay: -1,
    swipeIndex: -1,
    swipeStartOffset: 0,
    cityInfo: { name: "深圳市", lat: 22.5431, lng: 114.0579 },
    // 每天起点：dayStartPoints[dayIndex] = { lat, lng, name }
    dayStartPoints: [],
    // 每天起点的显示文本
    dayStartPointTexts: [],
    // 设置起点弹窗
    showDayStartSheet: false,
    dayStartSheetDayIndex: -1,
    dayStartOptions: [],
    reorderSheetVisible: false,
    placePickerVisible: false,
    placePickerTab: "all",
    placePickerItems: [],
    placePickerWantItems: [],
    placePickerCollectItems: [],
    placePickerCurrentItems: [],
    placePickerDayIndex: -1,
    autoEnterEdit: false,
    isNewRouteDraft: false,
    fromPreview: false,
    transportSheetVisible: false,
    transportOptions: [],
    pendingTransportMode: "walk",
    transportTarget: null,
    navMapSheetVisible: false,
    navMapTarget: null,
    placeIntroVisible: false,
    placeIntroData: null,
    exitConfirmVisible: false,
    exitConfirmMode: "",
    exitConfirmTitle: "是否保存当前修改？",
    exitConfirmDesc: "",
    exitConfirmCancelText: "不保存",
    exitConfirmConfirmText: "保存",
  },

  // 页面初始化：
  // 1. 读取路线数据
  // 2. 计算顶部布局高度
  // 3. 预先准备添加地点弹窗数据
  onLoad(options) {
    const windowInfo = wx.getWindowInfo();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const menuTop = menuButtonInfo
      ? menuButtonInfo.top
      : (windowInfo.statusBarHeight || 44) + 4;
    const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32;
    const modeSwitchTop = menuTop;
    const tabStickyTop = menuTop + menuHeight + 24;
    const editTabStickyTop = menuTop + menuHeight + 20;

    this.setData({
      menuTop,
      menuHeight,
      modeSwitchTop,
      tabStickyTop,
      editTabStickyTop,
      returnTo: options.returnTo || "",
      autoEnterEdit: options.edit === "1",
    });
    this.refreshPlacePickerItems();

    // 统一支持两种进入方式：
    // 1. 传完整 route 对象：直接展示已有"我的路线"
    // 2. 只传 ids + dayCount：在当前页生成、自动保存、再展示
    if (options.route) {
      const route = JSON.parse(decodeURIComponent(options.route));
      this.setData({
        routeId: String(route.id),
        isNewRouteDraft: options.create === "1" || Boolean(route.isDraft),
        fromPreview: options.fromPreview === "1",
      });
      this.applyRoute(route);
      this.syncCurrentLocation();
      return;
    }

    if (options.ids) {
      this.setData({
        generatingRoute: false,
        routeId: "",
        isNewRouteDraft: false,
        fromPreview: false,
      });
      // 恢复成之前的体验：先直接生成并进入详情，不阻塞在定位上。
      this.loadGeneratedRoute(options);
      // 定位和地址回填放到后面异步做，避免路线规划入口出现明显等待。
      this.syncCurrentLocation(false);
      return;
    }

    wx.showToast({ title: "路线不存在", icon: "none" });
    setTimeout(() => wx.navigateBack({ delta: 1 }), 1200);
  },

  // 页面重新显示时，如果路线已经被别的页面改过，就重新同步最新数据。
  onShow() {
    const { routeId, isEditing, isNewRouteDraft } = this.data;
    if (isNewRouteDraft) return;
    if (!routeId || isEditing) return;
    const savedRoutes = util.loadData("savedRoutes", []);
    const latestRoute = savedRoutes.find(
      (item) => String(item.id) === String(routeId)
    );
    if (latestRoute) {
      this.applyRoute(latestRoute);
      return;
    }
    wx.showToast({ title: "路线不存在", icon: "none" });
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: "/pages/wantgo/wantgo" });
        },
      });
    }, 300);
  },

  // 把当前位置补成"当前所在位置（真实地址）"：
  // 这里只在仍然使用当前定位作为默认起点时更新，避免覆盖用户手动选择的起点。
  syncCurrentStartAddress(location) {
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      return;
    }

    const applyDisplayName = (displayName) => {
      const currentLocationWithAddress = {
        ...location,
        name: displayName,
      };
      const nextData = {
        currentStart: {
          ...this.data.currentStart,
          ...currentLocationWithAddress,
          name: displayName,
          type: "current",
        },
      };

      app.globalData.location = {
        ...(app.globalData.location || {}),
        ...currentLocationWithAddress,
      };

      const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])];
      // 只有"还没写入文案"或"当前仍是默认当前位置文案"时，才自动回填地址。
      // 如果用户主动清空成空字符串，这里不要再覆盖回去。
      if (
        typeof dayStartPointTexts[0] !== "string" ||
        /^当前所在位置/.test(dayStartPointTexts[0])
      ) {
        dayStartPointTexts[0] = displayName;
        nextData.dayStartPointTexts = dayStartPointTexts;
      }

      this.setData(nextData, () => {
        if (this.data.daySections && this.data.daySections.length) {
          this._updateDayStartPointTexts();
        }
      });
    };

    checkinUtil
      .reverseGeocode(location.lat, location.lng)
      .then((geo) => {
        const resolvedAddress = geo.address || geo.spotName || geo.district || "";
        applyDisplayName(buildCurrentLocationDisplayName(resolvedAddress));
      })
      .catch(() => {
        applyDisplayName(buildCurrentLocationDisplayName(""));
      });
  },

  // 把路线每天的地点整理成统一结构，并补全坐标、标签、图片、交通信息。
  syncDaySections(daySections, cityInfo, options = {}) {
    const fallbackCity = cityInfo || { lat: 22.5431, lng: 114.0579 };
    const currentStart = options.currentStart || this.data.currentStart;
    const dayStartPoints = options.dayStartPoints || this.data.dayStartPoints || [];
    const dayStartPointTexts = options.dayStartPointTexts || this.data.dayStartPointTexts || [];
    return stripEditState(daySections).map((day, dayIndex) => {
      const rawItems = (day.items || []).map((item, itemIndex) => {
        const matched = findMatchedPlace(item.name);
        const synthetic = buildSyntheticLatLng(
          fallbackCity,
          dayIndex,
          itemIndex
        );
        const rawTags =
          Array.isArray(item.tags) && item.tags.length
            ? item.tags
            : matched && Array.isArray(matched.tags)
            ? matched.tags
            : [];
        const itemType =
          item.type ||
          matched?.type ||
          ((item.tag || inferTag(item.name)) === "美食" ? "food" : "spot");
        return {
          ...item,
          id: item.id || `day-${dayIndex}-item-${itemIndex}`,
          name: item.name || "待补充地点",
          tag: item.tag || inferTag(item.name),
          coverImage: item.coverImage || "/images/app-logo.jpg",
          type: itemType,
          rating: item.rating || matched?.rating || matched?.score || "",
          tags: rawTags,
          displayCategory:
            item.displayCategory ||
            resolveDisplayCategory({ ...matched, ...item, type: itemType }),
          desc: item.desc || matched?.desc || "",
          hours: item.hours || matched?.hours || "",
          openHours: item.openHours || matched?.openHours || "",
          free: item.free !== undefined ? item.free : matched?.free,
          price: item.price || matched?.price || "",
          address:
            item.address ||
            matched?.address ||
            `${fallbackCity.name || ""}${item.name || ""}`,
          lat: item.lat || item.latitude || matched?.lat || synthetic.lat,
          lng: item.lng || item.longitude || matched?.lng || synthetic.lng,
          swipeOffset: item.swipeOffset || 0,
        };
      });

      let dayStartPoint = null;
      if (dayIndex === 0) {
        dayStartPoint =
          currentStart && currentStart.type === "current"
            ? currentStart || app.globalData.location || app.globalData.centerLocation
            : currentStart;
      } else {
        const customStart = dayStartPoints[dayIndex] || day.startPoint || null;
        if (customStart) {
          dayStartPoint = customStart;
        } else {
          const prevDay = stripEditState(daySections)[dayIndex - 1] || {};
          const prevDayItems = prevDay.items || [];
          const prevDayLastItem = prevDayItems[prevDayItems.length - 1];
          dayStartPoint = prevDayLastItem
            ? {
                lat: prevDayLastItem.lat || prevDayLastItem.latitude,
                lng: prevDayLastItem.lng || prevDayLastItem.longitude,
                name: prevDayLastItem.name,
              }
            : currentStart || app.globalData.location || app.globalData.centerLocation;
        }
      }

      const plannedItems = util.planRoute(
        rawItems.map((item) => ({ ...item })),
        dayStartPoint || { lat: fallbackCity.lat, lng: fallbackCity.lng },
        true
      );

      // 空字符串也算一种明确状态：
      // 用户点了"清空起点位置"后，需要保留"不显示地点"的结果。
      const resolvedStartPointText =
        typeof dayStartPointTexts[dayIndex] === "string"
          ? dayStartPointTexts[dayIndex]
          : (day.startPointText || "");
      return {
        id: day.id || `day-${dayIndex}`,
        // 待计划天固定显示"待计划"，其他天按规则显示"第 N 天"。
        title: day.id === '__pending__' ? '待计划' : buildDayLabel(dayIndex + 1),
        countText: `${plannedItems.length} 个地点`,
        startPoint: dayStartPoint,
        startPointText: resolvedStartPointText,
        items: plannedItems.map((item) =>
          decorateRoutePlaceItem({
            ...applyTravelMeta(item, item.travelMode),
            swipeOffset: item.swipeOffset || 0,
          })
        ),
      };
    });
  },
  // 把一条路线真正应用到页面上：
  // 会同时刷新列表、地图、顶部摘要和预览卡片。
  applyRoute(route) {
    const cityText =
      route.city || route.cityText || getCityInfo(route.title).name;
    const cityInfo = getCityInfo(cityText);
    const currentStart = route.currentStart || this.data.currentStart;
    const dayStartPoints = (route.dayStartPoints || []).slice();
    const dayStartPointTexts = (route.dayStartPointTexts || []).slice();
    let daySections = this.syncDaySections(
      buildDaySectionsFromLegacy(route),
      cityInfo,
      {
        currentStart,
        dayStartPoints,
        dayStartPointTexts,
      }
    );
    // 兼容旧数据：之前待计划存在 pendingItems 字段，迁移到 daySections 中的 __pending__ 天。
    const oldPendingItems = route.pendingItems || [];
    if (oldPendingItems.length > 0 && !daySections.some(d => d.id === '__pending__')) {
      daySections = daySections.concat([{
        id: '__pending__',
        title: '待计划',
        countText: `${oldPendingItems.length} 个地点`,
        items: oldPendingItems,
        startPointText: ''
      }])
    }
    // 确保 __pending__ 天的标题永远是"待计划"。
    daySections = daySections.map(d => d.id === '__pending__' ? { ...d, title: '待计划' } : d)
    // 待计划天没有地点时不显示。
    daySections = daySections.filter(d => d.id !== '__pending__' || (d.items || []).length > 0)
    // 用 buildSummaryText 重新计算天数地点数，避免被旧文案误导。
    const summaryText = buildSummaryText(daySections);
    const flattenedPlaces = flattenDaySections(daySections);

    this.setData(
      {
        route,
        routeId: String(route.id),
        cityInfo,
        cityText,
        currentStart,
        dayStartPoints,
        dayStartPointTexts:
          dayStartPointTexts.length
            ? dayStartPointTexts
            : daySections.map((day, dayIndex) =>
                day.startPointText || (dayIndex === 0 ? (currentStart && currentStart.name) || "当前所在位置" : "")
              ),
        daySections,
        originalDaySections: JSON.parse(
          JSON.stringify(stripEditState(daySections))
        ),
        tabs: buildTabsFromSections(daySections),
        summaryText,
        hasRoutePlaces: flattenedPlaces.length > 0,
        currentTab: 0,
        currentMapDay: -1,
        sheetScrollTarget: "",
        generatingRoute: false,
        isEditing: false,
        dragging: false,
        dragDay: -1,
        dragIndex: -1,
        dragOffsetY: 0,
        swipeDay: -1,
        swipeIndex: -1,
        swipeStartOffset: 0,
        mapPreviewPlaces: flattenedPlaces,
        mapPreviewPlace: flattenedPlaces[0] || null,
        mapPreviewIndex: 0,
      },
      () => {
        if (this.data.viewMode === "map") {
          this.updateMapData(daySections, cityInfo, -1);
        }
        if (this.data.autoEnterEdit) {
          this.setData({ autoEnterEdit: false });
          setTimeout(() => {
            if (!this.data.isEditing) {
              this.onStartRouteEdit();
            }
          }, 0);
        }
      }
    );
  },

  // 当页面只收到地点 ids + 天数时，直接在"我的路线详情页"里完成生成和自动保存。
  loadGeneratedRoute(options = {}) {
    const ids = String(options.ids || "")
      .split(",")
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const preferredDayCount = Math.max(1, parseInt(options.dayCount, 10) || 1);

    const userAddedShops = util.loadData("userAddedShops", []);
    const allPlaces = [...placesData.getAllPlaces(), ...userAddedShops];
    const rawItems = ids
      .map((id) => allPlaces.find((item) => String(item.id) === String(id)))
      .filter(Boolean);

    if (!rawItems.length) {
      this.setData({ generatingRoute: false });
      wx.showToast({ title: "暂未识别到可规划地点", icon: "none" });
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
          fail: () => {
            wx.switchTab({ url: "/pages/wantgo/wantgo" });
          },
        });
      }, 300);
      return;
    }

    const currentStart = this.data.currentStart || {
      name: "当前所在位置",
      lat: 22.5431,
      lng: 114.0579,
      type: "current",
    };
    const daySections = this.syncDaySections(
      buildPreviewDaySections(rawItems, preferredDayCount),
      getCityInfo(
        [
          currentStart && currentStart.name,
          ...rawItems.map((item) => item.city || item.address || item.name),
        ]
          .filter(Boolean)
          .join(" ")
      ),
      {
        currentStart,
        dayStartPoints: [],
        dayStartPointTexts: [currentStart.name || "当前所在位置"],
      }
    );
    const cityText = getCityInfo(
      [
        currentStart && currentStart.name,
        ...rawItems.map((item) => item.city || item.address || item.name),
      ]
        .filter(Boolean)
        .join(" ")
    ).name;
    const summaryText = buildSummaryText(daySections);
    const routeTitle = buildPreviewTitle(cityText, daySections.length, daySections);
    const newRoute = {
      ...buildPreviewRouteData(
        {
          daySections,
          cityText,
          summaryText,
          routeTitle,
        },
        {
          routeId: `ai-${Date.now()}`,
        }
      ),
      currentStart,
      dayStartPoints: [],
      dayStartPointTexts: [currentStart.name || "当前所在位置"],
      isDraft: false,
    };

    // 这里直接落到"我的路线"，这样返回时也不会再提示是否保存。
    this.saveRouteToStorage(newRoute);
    this.applyRoute(newRoute);
  },

  // 写回本地存储并同步云端：这是"保存路线"的真正落盘入口。
  saveRouteToStorage(route, showToastTitle) {
    const savedRoutes = util.loadData("savedRoutes", []);
    const index = savedRoutes.findIndex(
      (item) => String(item.id) === String(route.id)
    );
    if (index > -1) {
      savedRoutes[index] = route;
    } else {
      savedRoutes.push(route);
    }
    wx.setStorageSync("savedRoutes", savedRoutes);
    if (showToastTitle) {
      wx.showToast({ title: showToastTitle, icon: "success" });
    }
    // 云端同步由 saveRouteAsync / updateRouteAsync 内部 fire-and-forget
    if (index > -1) {
      util.updateRouteAsync(route._id || savedRoutes[index]._id, route)
    } else {
      util.saveRouteAsync(route)
    }
  },

  // 从"路线规划详情"临时进入手动编辑时：
  // 保存结果不直接落库，而是回传给上一页，再返回上一页。
  handoffPreviewRoute(route, showToastTitle) {
    const eventChannel = this.getOpenerEventChannel
      ? this.getOpenerEventChannel()
      : null;
    if (eventChannel) {
      eventChannel.emit("previewRouteEdited", route);
    } else {
      console.error(
        "[my-route] handoffPreviewRoute: eventChannel is null, cannot emit event"
      );
    }

    if (showToastTitle) {
      wx.showToast({ title: showToastTitle, icon: "success" });
    }
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({ url: "/pages/wantgo/wantgo" });
        },
      });
    }, 300);
  },

  // 按当前编辑结果组装出一份最新路线对象，方便保存或跳去编辑基础信息。
  buildUpdatedRoute(daySections) {
    const { route, cityText, summaryText, currentStart, dayStartPoints, dayStartPointTexts } = this.data;
    const cleanSections = stripEditState(daySections);
    return {
      ...route,
      city: cityText,
      subtitle: summaryText,
      dayCount: cleanSections.length,
      daySections: cleanSections,
      currentStart,
      dayStartPoints: (dayStartPoints || []).slice(),
      dayStartPointTexts: (dayStartPointTexts || []).slice(),
      coverImage: route.coverImage || "/images/app-logo.jpg",
      isDraft: Boolean(route.isDraft),
      updatedAt: Date.now(),
    };
  },

  // 关闭其他左滑卡片，只保留当前这一个的偏移量。
  resetSwipeOffsets(daySections, keepDay = -1, keepIndex = -1, keepOffset = 0) {
    return (daySections || []).map((day, dayIndex) => ({
      ...day,
      items: (day.items || []).map((item, itemIndex) => ({
        ...item,
        swipeOffset:
          dayIndex === keepDay && itemIndex === keepIndex ? keepOffset : 0,
      })),
    }));
  },

  // 刷新地图数据：包括地图中心点、标记点和路线线条。
  updateMapData(daySections, cityInfo, mapDayIndex) {
    const sections =
      typeof mapDayIndex === "number" && mapDayIndex >= 0
        ? [daySections[mapDayIndex]].filter(Boolean)
        : daySections;
    const flattened = flattenDaySections(sections);

    const markers = flattened.map((item, index) => {
      return {
        id: index,
        latitude: item.lat,
        longitude: item.lng,
        width: 28,
        height: 28,
        // 我的路线地图模式只保留数字顺序，不再显示分类图片底图，
        // 避免分类图标和数字标签叠在一起影响识别。
        label: {
          content: String(index + 1),
          // 继续按用户确认的新参数微调成更接近正圆：
          // 数字 14px、内容宽高 14px、水平居中、padding 8px、白色 2px 描边。
          fontSize: 14,
          width: 14,
          height: 14,
          textAlign: "center",
          color: "#FFFFFF",
          fontWeight: "bold",
          borderRadius: 15,
          bgColor: "#25BBE7",
          padding: 8,
          borderWidth: 2,
          borderColor: "#FFFFFF",
          // 去掉图片底图后，把数字标签贴回点位本身。
          anchorY: 0,
        },
      };
    });

    // 不显示直线折线，等待 API 返回真实路线
    const routeColor = mapConfig.THEME_COLORS.drive;
    const initialPolyline = [];

    const mapMarkers = markers.slice();
    if (
      this.data.currentLocation &&
      typeof this.data.currentLocation.lat === "number" &&
      typeof this.data.currentLocation.lng === "number"
    ) {
      mapMarkers.unshift({
        id: -1001,
        latitude: this.data.currentLocation.lat,
        longitude: this.data.currentLocation.lng,
        iconPath: CURRENT_LOCATION_ICON_PATH,
        width: 36,
        height: 36,
        anchor: { x: 0.5, y: 0.5 },
      });
    }

    // 如果有焦点地点，地图中心对准它；否则对准城市中心
    const focusPlace = this.data.mapPreviewPlace;
    const mapCenter =
      focusPlace &&
      (focusPlace.lat !== undefined || focusPlace.latitude !== undefined)
        ? {
            lat:
              focusPlace.lat !== undefined
                ? focusPlace.lat
                : focusPlace.latitude,
            lng:
              focusPlace.lng !== undefined
                ? focusPlace.lng
                : focusPlace.longitude,
          }
        : { lat: cityInfo.lat, lng: cityInfo.lng };

    this.setData({
      mapCenter,
      mapScale: focusPlace ? 14 : 12,
      mapMarkers,
      polyline: initialPolyline,
      currentMapDay: typeof mapDayIndex === "number" ? mapDayIndex : -1,
    });

    // 有 2+ 个地点时才请求真实路线（与路线规划页行为一致）
    if (flattened.length > 1) {
      const qqMapKey = app.globalData && app.globalData.qqMapKey;
      if (!qqMapKey) return;

      const allPoints = flattened.map((item) => ({
        latitude: item.lat,
        longitude: item.lng,
      }));
      fetchRealRoute({
        allPoints,
        travelMode: "drive",
        qqMapKey,
        onSuccess: (points) => {
          this.setData({
            polyline: [
              {
                points,
                color: routeColor + "CC",
                width: 5,
                dottedLine: false,
                arrowLine: true,
              },
            ],
          });
        },
        onFallback: () => {
          // 降级时不展示路线
        },
      });
    }
  },

  // 同步当前位置，供地图模式显示当前位置图标和重新定位使用。
  syncCurrentLocation(showToast = false, onDone) {
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: (res) => {
        const currentLocation = {
          lat: res.latitude,
          lng: res.longitude,
          name: "当前所在位置",
        };
        app.globalData.location = currentLocation;
        this.setData(
          {
            currentLocation,
            currentStart:
              this.data.currentStart && this.data.currentStart.type !== "current"
                ? this.data.currentStart
                : {
                    ...this.data.currentStart,
                    ...currentLocation,
                    type: "current",
                  },
            mapCenter: { lat: currentLocation.lat, lng: currentLocation.lng },
          },
          () => {
            if (
              typeof this.data.dayStartPointTexts[0] !== "string" ||
              /^当前所在位置/.test(this.data.dayStartPointTexts[0])
            ) {
              this.syncCurrentStartAddress(currentLocation);
            }
            if (this.data.viewMode === "map" && this.data.daySections.length) {
              this.updateMapData(
                this.data.daySections,
                this.data.cityInfo,
                this.data.currentMapDay
              );
            }
            if (typeof onDone === "function") {
              onDone(currentLocation);
            }
          }
        );
        if (showToast) {
          wx.showToast({ title: "定位成功", icon: "success" });
        }
      },
      fail: () => {
        if (typeof onDone === "function") {
          onDone(null);
        }
        if (showToast) {
          wx.showToast({ title: "定位失败，请检查权限", icon: "none" });
        }
      },
    });
  },

  // 让地图自动缩放到能看见当前路线的全部地点。
  onFitRoute() {
    const effectiveDayIndex =
      this.data.currentMapDay >= 0
        ? this.data.currentMapDay
        : (this.data.mapPreviewPlace && this.data.mapPreviewPlace.dayIndex) ||
          0;
    const dayItems =
      ((this.data.daySections || [])[effectiveDayIndex] || {}).items || [];
    const places = dayItems.length
      ? dayItems
      : this.data.mapPreviewPlaces || [];
    if (!places.length) return;
    const points = places
      .map((item) => ({
        latitude: item.lat || item.latitude,
        longitude: item.lng || item.longitude,
      }))
      .filter(
        (item) =>
          typeof item.latitude === "number" &&
          typeof item.longitude === "number"
      );
    if (!points.length) return;

    if (points.length === 1) {
      this.setData({
        mapCenter: { lat: points[0].latitude, lng: points[0].longitude },
        mapScale: 15,
      });
      return;
    }

    const windowInfo = wx.getWindowInfo();
    const mapCtx = wx.createMapContext("myRouteMap", this);
    mapCtx.includePoints({
      points,
      padding: [
        96,
        24,
        Math.round((windowInfo.windowHeight || 812) * 0.34),
        24,
      ],
    });
  },

  // 地图模式重新定位到当前位置，并拉近到当前位置附近。
  onLocateMe() {
    wx.showLoading({ title: "定位中..." });
    this.syncCurrentLocation(false, (currentLocation) => {
      wx.hideLoading();
      if (!currentLocation) {
        wx.showToast({ title: "定位失败，请检查权限", icon: "none" });
        return;
      }
      this.setData({
        mapCenter: {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        },
        mapScale: CURRENT_LOCATION_FOCUS_SCALE,
      });
      wx.showToast({ title: "定位成功", icon: "success" });
    });
  },

  // 地图放大一级：
  // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
  onMapZoomIn() {
    const currentScale = Number(this.data.mapScale) || 12;
    if (currentScale >= 20) return;
    this.setData({
      mapScale: Math.min(currentScale + 1, 20),
    });
  },

  // 地图缩小一级：
  // 这里只改缩放级别，不主动改中心点，手感更接近双指缩放。
  onMapZoomOut() {
    const currentScale = Number(this.data.mapScale) || 12;
    if (currentScale <= 3) return;
    this.setData({
      mapScale: Math.max(currentScale - 1, 3),
    });
  },

  // 地图区域变化结束后，同步真实中心点。
  // 这样点完缩放按钮后，下一次继续缩放会围绕当前屏幕中心。
  onMapRegionChange(e) {
    if (!e || e.type !== "end") return;

    if (!this._myRouteMapCtx) {
      this._myRouteMapCtx = wx.createMapContext("myRouteMap", this);
    }

    this._myRouteMapCtx.getCenterLocation({
      success: (res) => {
        if (
          typeof res.latitude !== "number" ||
          Number.isNaN(res.latitude) ||
          typeof res.longitude !== "number" ||
          Number.isNaN(res.longitude)
        ) {
          return;
        }

        const nextCenter = {
          lat: res.latitude,
          lng: res.longitude,
        };
        const currentCenter = this.data.mapCenter || {};
        if (
          Math.abs((currentCenter.lat || 0) - nextCenter.lat) < 0.000001 &&
          Math.abs((currentCenter.lng || 0) - nextCenter.lng) < 0.000001
        ) {
          return;
        }

        this.setData({
          mapCenter: nextCenter,
        });
      },
    });
  },

  // 刷新地图模式上方的预览卡片内容。
  refreshMapPreview(daySections, previewIndex = 0, currentDayOverride) {
    const places = flattenDaySections(daySections);
    const safeIndex = places.length
      ? Math.max(0, Math.min(previewIndex, places.length - 1))
      : 0;
    const currentPlace = places[safeIndex] || null;
    const resolvedDayIndex =
      typeof currentDayOverride === "number"
        ? currentDayOverride
        : places.length
        ? getDayIndexByPreview(daySections, safeIndex)
        : -1;
    const previewViewData = buildMapPreviewViewData(
      daySections,
      resolvedDayIndex,
      safeIndex,
      currentPlace,
      places.length
    );
    const nextData = {
      mapPreviewPlaces: places,
      mapPreviewPlace: currentPlace,
      mapPreviewIndex: safeIndex,
      currentMapDay: resolvedDayIndex,
      ...previewViewData,
    };
    // 增加聚焦功能：设置 mapCenter 使地图聚焦到当前预览地点
    if (currentPlace) {
      const lat =
        currentPlace.lat !== undefined
          ? currentPlace.lat
          : currentPlace.latitude;
      const lng =
        currentPlace.lng !== undefined
          ? currentPlace.lng
          : currentPlace.longitude;
      if (lat !== undefined && lng !== undefined) {
        nextData.mapCenter = { lat, lng };
      }
    }
    this.setData(nextData);
  },

  // 切换地图预览中的当前地点。
  changeMapPreview(index) {
    const nextIndex = parseInt(index, 10);
    if (Number.isNaN(nextIndex)) return;
    const places = this.data.mapPreviewPlaces || [];
    if (!places.length || nextIndex < 0 || nextIndex >= places.length) return;
    this.refreshMapPreview(this.data.daySections, nextIndex);
  },

  // 顶部返回逻辑：
  // 新建路线、从路线页进入、普通返回，这三种来源处理不一样。
  goBackBySource() {
    if (this.data.isNewRouteDraft && !this.data.isEditing) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 兜底回首页，避免误回到不存在的中间入口上下文。
          wx.switchTab({ url: "/pages/index/index" });
        },
      });
      return;
    }
    if (this.data.returnTo === "plan") {
      wx.setStorageSync("pendingWantgoTab", "plan");
      wx.switchTab({ url: "/pages/wantgo/wantgo" });
      return;
    }
    wx.navigateBack();
  },

  // 顶部返回逻辑：
  // 编辑态下单独走"保持并退出 / 直接退出"，其余情况按来源正常返回。
  onBack() {
    if (this.data.isEditing) {
      const changed = this.hasEditingChanges();
      if (!changed) {
        this.goBackBySource();
        return;
      }
      this.openExitConfirm("back");
      return;
    }
    this.goBackBySource();
  },

  // 统一打开"保存当前修改"弹窗：
  // back = 返回当前页前确认
  // cancel = 取消编辑前确认
  openExitConfirm(mode = "back") {
    const isBackMode = mode === "back";
    this.setData({
      exitConfirmVisible: true,
      exitConfirmMode: mode,
      exitConfirmTitle: "是否保存当前修改？",
      exitConfirmDesc: isBackMode
        ? "保存后会更新当前路线并退出当前页面，不保存将丢弃本次编辑"
        : "保存后会更新当前路线，不保存将丢弃本次编辑",
      exitConfirmCancelText: isBackMode ? "直接退出" : "不保存",
      exitConfirmConfirmText: isBackMode ? "保存并退出" : "保存",
    });
  },

  // 关闭编辑返回确认弹窗
  onCloseExitConfirm() {
    this.setData({ exitConfirmVisible: false, exitConfirmMode: "" });
  },

  // 确认弹窗左侧按钮：
  // back 模式 = 直接退出页面
  // cancel 模式 = 丢弃修改，退出编辑态
  onConfirmDirectExit() {
    const { exitConfirmMode } = this.data;
    this.setData({ exitConfirmVisible: false, exitConfirmMode: "" });
    if (exitConfirmMode === "cancel") {
      this.discardRouteEdits();
      return;
    }
    this.goBackBySource();
  },

  // 确认弹窗右侧按钮：
  // back 模式 = 保存并退出
  // cancel 模式 = 保存但停留当前页
  onConfirmSaveExit() {
    const { exitConfirmMode } = this.data;
    this.setData({ exitConfirmVisible: false, exitConfirmMode: "" });
    if (exitConfirmMode === "cancel") {
      this.onSave();
      return;
    }
    this.onSaveAndExit();
  },

  // 提示用户使用右上角分享
  onShareTap() {
    wx.showToast({ title: "请点击右上角分享", icon: "none" });
  },

  // 列表 / 地图 两种查看模式切换
  onSwitchMode(e) {
    if (this.data.isEditing) return;
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.viewMode) return;
    this.setData({ viewMode: mode });
    if (mode === "map") {
      const mapDayIndex =
        this.data.currentTab > 0
          ? this.data.currentTab - 1
          : this.data.daySections.length
          ? 0
          : -1;
      this.setData({ currentMapDay: mapDayIndex });
      this.refreshMapPreview(
        this.data.daySections,
        mapDayIndex >= 0
          ? getPreviewIndexByDay(this.data.daySections, mapDayIndex)
          : this.data.mapPreviewIndex,
        mapDayIndex
      );
      this.updateMapData(
        this.data.daySections,
        this.data.cityInfo,
        mapDayIndex
      );
    }
  },

  // 底部"路线"按钮：直接切到地图模式
  onOpenMapMode() {
    if (this.data.isEditing) return;
    const mapDayIndex =
      this.data.currentTab > 0
        ? this.data.currentTab - 1
        : this.data.daySections.length
        ? 0
        : -1;
    this.setData({ viewMode: "map", currentMapDay: mapDayIndex });
    this.refreshMapPreview(
      this.data.daySections,
      mapDayIndex >= 0
        ? getPreviewIndexByDay(this.data.daySections, mapDayIndex)
        : this.data.mapPreviewIndex,
      mapDayIndex
    );
    this.updateMapData(this.data.daySections, this.data.cityInfo, mapDayIndex);
  },

  // 在地图模式里切换某一天
  onSelectMapDay(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.updateMapData(this.data.daySections, this.data.cityInfo, index);
  },

  // 地图预览卡片顶部的"每天 Tab"切换
  onSelectMapPreviewDay(e) {
    const index = parseInt(
      (e.detail && e.detail.index) !== undefined
        ? e.detail.index
        : e.currentTarget.dataset.index,
      10
    );
    this.refreshMapPreview(
      this.data.daySections,
      index >= 0
        ? getPreviewIndexByDay(this.data.daySections, index)
        : this.data.mapPreviewIndex,
      index
    );
    // 用 setTimeout 确保 refreshMapPreview 里的 setData 完成后，updateMapData 能读到最新的 currentMapDay
    setTimeout(() => {
      if (this.data.viewMode === "map") {
        this.updateMapData(
          this.data.daySections,
          this.data.cityInfo,
          this.data.currentMapDay
        );
      }
    }, 0);
  },

  // 列表模式顶部 Tab 切换：行程总览 / 第一天 / 第二天...
  onTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData(
      {
        currentTab: index,
        sheetScrollTarget: "",
      },
      () => {
        wx.nextTick(() => {
          this.scrollListToTab(index);
        });
      }
    );
  },

  // 把 rpx 换算成当前设备下的 px，用来保持"标题距离吸顶 Tab 48rpx"的视觉留白。
  rpxToPx(rpx) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
    const windowWidth = windowInfo.windowWidth || 375;
    return (Number(rpx) * windowWidth) / 750;
  },

  // 点击"行程总览 / 第几天"时，不再依赖固定负锚点。
  // 这里直接测量目标标题的真实位置，再减去吸顶 Tab 高度和预留留白。
  scrollListToTab(index) {
    const safeIndex = Number(index) || 0;
    const fallbackTarget =
      safeIndex === 0
        ? "route-overview-anchor"
        : `route-day-anchor-${safeIndex - 1}`;
    const targetSelector =
      safeIndex === 0
        ? "#route-overview-title"
        : `#route-day-header-${safeIndex - 1}`;
    const query = wx.createSelectorQuery().in(this);
    query.select(".detail-scroll").boundingClientRect();
    query.select(".detail-scroll").scrollOffset();
    query.select(".tab-sticky-wrap").boundingClientRect();
    query.select(targetSelector).boundingClientRect();
    query.exec((result) => {
      const [scrollRect, scrollOffset, stickyRect, targetRect] = result || [];
      if (!scrollRect || !scrollOffset || !stickyRect || !targetRect) {
        this.setData({ sheetScrollTarget: fallbackTarget });
        return;
      }
      const gapPx = this.rpxToPx(48);
      const nextScrollTop = Math.max(
        0,
        Math.round(
          (scrollOffset.scrollTop || 0) +
            (targetRect.top - scrollRect.top) -
            (stickyRect.height || 0) -
            gapPx
        )
      );
      this.setData({
        detailScrollTop: nextScrollTop,
      });
    });
  },

  // 兼容旧入口：点击"路线"时进入地图模式
  onViewRoute() {
    this.onOpenMapMode();
  },

  // 点击某一天的起点卡片，打开统一的起点选择底部弹窗。
  onSetDayStart(e) {
    const dayIndex = e.currentTarget.dataset.dayIndex;
    if (dayIndex === undefined || dayIndex < 0) return;

    const options = [
      {
        type: "current",
        icon: "mgc_aiming_2_line",
        label: "使用当前所在位置",
      },
    ];

    const day = (this.data.daySections || [])[dayIndex];
    const dayHasItems = day && day.items && day.items.length > 0;
    if (dayHasItems) {
      options.push({
        type: "firstPlace",
        icon: "mgc_map_pin_line",
        label: "使用第一个地点",
      });
    }
    if (dayIndex > 0) {
      options.push({
        type: "prev",
        icon: "mgc_route_line",
        label: "使用前一天终点",
      });
    }
    options.push({
      type: "search",
      icon: "mgc_search_2_line",
      label: "搜索地点",
    });
    options.push({
      type: "clear",
      icon: "mgc_delete_2_line",
      label: "清空起点位置",
    });

    this.setData({
      showDayStartSheet: true,
      dayStartSheetDayIndex: dayIndex,
      dayStartOptions: options,
    });
  },

  // 关闭起点选择弹窗，同时清掉临时数据，避免下一次沿用旧状态。
  onCloseDayStartSheet() {
    this.setData({
      showDayStartSheet: false,
      dayStartSheetDayIndex: -1,
      dayStartOptions: [],
    });
  },

  // 点击起点弹窗中的某个选项后立即执行，保持和其他底部弹窗一致。
  onSelectDayStartOption(e) {
    const type = e.currentTarget.dataset.type;
    const dayIndex = this.data.dayStartSheetDayIndex;
    if (!type || dayIndex < 0) return;

    this.onCloseDayStartSheet();

    if (type === "current") {
      this._setDayStartToCurrent(dayIndex);
      return;
    }
    if (type === "prev") {
      this._setDayStartToPrevDayEnd(dayIndex);
      return;
    }
    if (type === "firstPlace") {
      this._setDayStartToFirstPlace(dayIndex);
      return;
    }
    if (type === "search") {
      this._searchDayStartPoint(dayIndex);
      return;
    }
    if (type === "clear") {
      this._clearDayStartPoint(dayIndex);
    }
  },

  // 设置起点为当前位置。
  _setDayStartToCurrent(dayIndex) {
    const currentStart = this.data.currentStart;
    const startPoint =
      currentStart && currentStart.type === "current"
        ? currentStart || app.globalData.location || app.globalData.centerLocation
        : currentStart;
    if (!startPoint) return;

    const dayStartPoints = [...(this.data.dayStartPoints || [])];
    dayStartPoints[dayIndex] = {
      lat: startPoint.lat,
      lng: startPoint.lng,
      name: startPoint.name || "当前所在位置",
    };

    const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])];
    dayStartPointTexts[dayIndex] = startPoint.name || "当前所在位置";

    this.setData(
      {
        dayStartPoints,
        dayStartPointTexts,
      },
      () => {
        this._updateDayStartPointTexts();
        this._replanRouteWithDayStarts();
      }
    );
  },

  // 设置起点为前一天最后一个地点。
  _setDayStartToPrevDayEnd(dayIndex) {
    const daySections = this.data.daySections || [];
    if (dayIndex <= 0 || dayIndex >= daySections.length) return;

    const prevDay = daySections[dayIndex - 1];
    const prevDayLastItem = ((prevDay || {}).items || []).slice(-1)[0];
    if (!prevDayLastItem) return;

    const startPoint = {
      lat: prevDayLastItem.lat || prevDayLastItem.latitude,
      lng: prevDayLastItem.lng || prevDayLastItem.longitude,
      name: prevDayLastItem.name,
    };

    const dayStartPoints = [...(this.data.dayStartPoints || [])];
    dayStartPoints[dayIndex] = startPoint;

    const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])];
    dayStartPointTexts[dayIndex] = prevDayLastItem.name;

    this.setData(
      {
        dayStartPoints,
        dayStartPointTexts,
      },
      () => {
        this._updateDayStartPointTexts();
        this._replanRouteWithDayStarts();
      }
    );
  },

  // 设置起点为当天第一个地点。
  _setDayStartToFirstPlace(dayIndex) {
    const daySections = this.data.daySections || [];
    const day = daySections[dayIndex];
    const firstItem = day && day.items && day.items[0];
    if (!firstItem) return;

    const startPoint = {
      lat: firstItem.lat || firstItem.latitude,
      lng: firstItem.lng || firstItem.longitude,
      name: firstItem.name,
    };

    const dayStartPoints = [...(this.data.dayStartPoints || [])];
    dayStartPoints[dayIndex] = startPoint;

    const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])];
    dayStartPointTexts[dayIndex] = firstItem.name;

    this.setData(
      {
        dayStartPoints,
        dayStartPointTexts,
      },
      () => {
        this._updateDayStartPointTexts();
        this._replanRouteWithDayStarts();
      }
    );
  },

  // 通过地图选点搜索起点。
  _searchDayStartPoint(dayIndex) {
    wx.chooseLocation({
      success: (res) => {
        const startPoint = {
          lat: res.latitude,
          lng: res.longitude,
          name: res.name || "选中的地点",
        };

        const dayStartPoints = [...(this.data.dayStartPoints || [])];
        dayStartPoints[dayIndex] = startPoint;

        const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])];
        dayStartPointTexts[dayIndex] = res.name || "选中的地点";

        this.setData(
          {
            dayStartPoints,
            dayStartPointTexts,
          },
          () => {
            this._updateDayStartPointTexts();
            this._replanRouteWithDayStarts();
          }
        );
      },
      fail: () => {
        wx.showToast({ title: "已取消", icon: "none" });
      },
    });
  },

  // 清空当前这一天的起点设置，恢复成默认规划逻辑，同时不再显示地点文案。
  _clearDayStartPoint(dayIndex) {
    const dayStartPoints = [...(this.data.dayStartPoints || [])];
    const dayStartPointTexts = [...(this.data.dayStartPointTexts || [])];

    dayStartPoints[dayIndex] = null
    dayStartPointTexts[dayIndex] = ""

    this.setData(
      {
        dayStartPoints,
        dayStartPointTexts,
      },
      () => {
        this._updateDayStartPointTexts();
        this._replanRouteWithDayStarts();
      }
    );
  },

  // 只更新 daySections 里的起点显示文本，不改地点本体。
  _updateDayStartPointTexts() {
    const { daySections, dayStartPointTexts, currentStart } = this.data;
    if (!daySections || !daySections.length) return;

    const updatedSections = daySections.map((section, dayIndex) => ({
      ...section,
      startPointText:
        typeof dayStartPointTexts[dayIndex] === "string"
          ? dayStartPointTexts[dayIndex]
          : (section.startPointText || ""),
    }));

    this.setData({
      daySections: updatedSections,
    });
  },

  // 按当前 dayStartPoints 重新规划每一天的地点顺序和交通信息。
  _replanRouteWithDayStarts() {
    const route = this.data.route || {};
    const cityText = route.city || route.cityText || getCityInfo(route.title).name;
    const cityInfo = getCityInfo(cityText);
    const nextSections = this.syncDaySections(
      buildDaySectionsFromLegacy(route),
      cityInfo,
      {
        currentStart: this.data.currentStart,
        dayStartPoints: this.data.dayStartPoints,
        dayStartPointTexts: this.data.dayStartPointTexts,
      }
    );
    const summaryText = buildSummaryText(nextSections);
    const flattenedPlaces = flattenDaySections(nextSections);
    const nextMapDay =
      this.data.currentMapDay >= nextSections.length ? -1 : this.data.currentMapDay;

    this.setData(
      {
        daySections: nextSections,
        summaryText,
        tabs: buildTabsFromSections(nextSections),
        hasRoutePlaces: flattenedPlaces.length > 0,
        mapPreviewPlaces: flattenedPlaces,
        mapPreviewPlace: flattenedPlaces[this.data.mapPreviewIndex] || flattenedPlaces[0] || null,
        mapPreviewIndex:
          flattenedPlaces.length === 0
            ? 0
            : Math.min(this.data.mapPreviewIndex, flattenedPlaces.length - 1),
        currentMapDay: nextMapDay,
        route: {
          ...route,
          subtitle: summaryText,
          daySections: stripEditState(nextSections),
          currentStart: this.data.currentStart,
          dayStartPoints: [...(this.data.dayStartPoints || [])],
          dayStartPointTexts: [...(this.data.dayStartPointTexts || [])],
        },
      },
      () => {
        if (this.data.viewMode === "map") {
          this.updateMapData(nextSections, cityInfo, nextMapDay);
        }
        this.refreshMapPreview(
          nextSections,
          this.data.mapPreviewIndex,
          nextMapDay
        );
      }
    );
  },

  // 点击预览卡片或箭头时切换当前预览地点
  onChangeMapPreview(e) {
    const nextIndex = parseInt(
      (e.detail && e.detail.index) !== undefined
        ? e.detail.index
        : e.currentTarget.dataset.index,
      10
    );
    if (Number.isNaN(nextIndex)) return;
    const nextDayIndex = getDayIndexByPreview(this.data.daySections, nextIndex);
    // 在 refreshMapPreview 之前保存旧值，因为 setData 会同步更新 this.data
    const oldMapDay = this.data.currentMapDay;
    this.refreshMapPreview(this.data.daySections, nextIndex, nextDayIndex);
    // 只有跨天时才重新渲染地图路径，相同天内只切换焦点不需要重绘路线
    if (nextDayIndex !== oldMapDay && this.data.viewMode === "map") {
      setTimeout(() => {
        this.updateMapData(
          this.data.daySections,
          this.data.cityInfo,
          this.data.currentMapDay
        );
      }, 0);
    }
  },

  // 点击上一站 / 下一站
  onMapPreviewStep(e) {
    const index = parseInt(
      (e.detail && e.detail.index) !== undefined
        ? e.detail.index
        : e.currentTarget.dataset.index,
      10
    );
    if (Number.isNaN(index) || index < 0) return;
    this.onChangeMapPreview({ detail: { index } });
  },

  // 去基础信息页编辑路线名称、天数、城市这些基础资料
  onEditMeta() {
    const routeForEdit = this.buildUpdatedRoute(this.data.daySections);
    wx.navigateTo({
      url: `/subpackages/route/pages/route-basic-edit/route-basic-edit?route=${encodeURIComponent(
        JSON.stringify(routeForEdit)
      )}`,
    });
  },

  // 从路线的第一个地点开始导航
  onStartNavigation() {
    const firstDayWithPlace = (this.data.daySections || []).find(
      (day) => (day.items || []).length
    );
    const firstPlace =
      firstDayWithPlace &&
      firstDayWithPlace.items &&
      firstDayWithPlace.items[0];
    if (!firstPlace || !firstPlace.lat || !firstPlace.lng) {
      wx.showToast({ title: "暂无可导航地点", icon: "none" });
      return;
    }

    util.openNavigation({
      lat: firstPlace.lat,
      lng: firstPlace.lng,
      name: firstPlace.name,
      address: this.data.cityText || firstPlace.name,
    });
  },

  // 进入编辑态：允许拖拽、删除、加地点
  onStartRouteEdit() {
    const daySections = this.resetSwipeOffsets(this.data.daySections);
    this.refreshPlacePickerItems();
    this.setData({
      isEditing: true,
      reorderSheetVisible: false,
      viewMode: "list",
      dragging: false,
      currentTab: Math.min(daySections.length, 1),
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
      sheetScrollTarget: daySections.length ? "route-day-anchor-0" : "",
      daySections,
      originalDaySections: JSON.parse(
        JSON.stringify(stripEditState(daySections))
      ),
      placePickerVisible: false,
      placePickerTab: "all",
      placePickerDayIndex: -1,
      placeIntroVisible: false,
      navMapSheetVisible: false,
    });
    wx.showToast({ title: "进入编辑路线", icon: "none" });
  },

  // 取消编辑：恢复到进入编辑前的状态
  onCancelEdit() {
    const changed = this.hasEditingChanges();
    if (!changed) {
      this.discardRouteEdits();
      return;
    }
    this.openExitConfirm("cancel");
  },

  // 保存编辑结果，并退出编辑态
  buildSavedRoutePayload() {
    const cleanedSections = this.syncDaySections(
      this.data.daySections,
      this.data.cityInfo
    );
    const savedSections = removeEmptyDaysOnSave(cleanedSections);
    const summaryText = buildSummaryText(savedSections);
    const updatedRoute = {
      ...this.buildUpdatedRoute(savedSections),
      subtitle: summaryText,
      isDraft: this.data.fromPreview,
    };
    return {
      savedSections,
      summaryText,
      updatedRoute,
    };
  },

  // 保存当前编辑，但停留在当前页面。
  onSave() {
    const { savedSections, summaryText, updatedRoute } =
      this.buildSavedRoutePayload();

    if (this.data.fromPreview) {
      this.setData({
        route: updatedRoute,
        daySections: savedSections,
      });
      this.handoffPreviewRoute(updatedRoute, "保存成功");
      return;
    }

    this.saveRouteToStorage(updatedRoute, "保存成功");

    const nextMapDay =
      this.data.currentMapDay >= savedSections.length
        ? -1
        : this.data.currentMapDay;

    this.setData({
      route: updatedRoute,
      isEditing: false,
      dragging: false,
      daySections: savedSections,
      summaryText,
      tabs: buildTabsFromSections(savedSections),
      sheetScrollTarget: "",
      currentTab: Math.min(this.data.currentTab, savedSections.length),
      originalDaySections: JSON.parse(
        JSON.stringify(stripEditState(savedSections))
      ),
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      placePickerVisible: false,
      placePickerDayIndex: -1,
      isNewRouteDraft: false,
      hasRoutePlaces: flattenDaySections(savedSections).length > 0,
      placeIntroVisible: false,
      navMapSheetVisible: false,
    });
    if (this.data.viewMode === "map") {
      this.updateMapData(savedSections, this.data.cityInfo, nextMapDay);
    }
    this.refreshMapPreview(savedSections, this.data.mapPreviewIndex);
  },

  // 保存当前编辑，并直接离开当前页。
  onSaveAndExit() {
    const { savedSections, summaryText, updatedRoute } =
      this.buildSavedRoutePayload();

    if (this.data.fromPreview) {
      this.setData({
        route: updatedRoute,
        daySections: savedSections,
      });
      this.handoffPreviewRoute(updatedRoute, "保存成功");
      return;
    }

    const nextMapDay =
      this.data.currentMapDay >= savedSections.length
        ? -1
        : this.data.currentMapDay;
    this.saveRouteToStorage(updatedRoute, "保存成功");
    this.setData({
      route: updatedRoute,
      isEditing: false,
      dragging: false,
      daySections: savedSections,
      summaryText,
      tabs: buildTabsFromSections(savedSections),
      sheetScrollTarget: "",
      currentTab: Math.min(this.data.currentTab, savedSections.length),
      originalDaySections: JSON.parse(
        JSON.stringify(stripEditState(savedSections))
      ),
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      placePickerVisible: false,
      placePickerDayIndex: -1,
      isNewRouteDraft: false,
      hasRoutePlaces: flattenDaySections(savedSections).length > 0,
      placeIntroVisible: false,
      navMapSheetVisible: false,
    });
    if (this.data.viewMode === "map") {
      this.updateMapData(savedSections, this.data.cityInfo, nextMapDay);
    }
    this.refreshMapPreview(savedSections, this.data.mapPreviewIndex);
    setTimeout(() => {
      this.goBackBySource();
    }, 300);
  },

  // 打开交通方式弹窗：既支持列表里的地点，也支持地图预览卡片里的地点
  openTransportSheet(dayIndex, itemIndex, previewIndex) {
    const day = (this.data.daySections || [])[dayIndex];
    const item = ((day || {}).items || [])[itemIndex];
    if (!item) return;
    this.setData({
      transportSheetVisible: true,
      transportOptions: buildTravelOptions(item.distanceFromPrev || 0),
      pendingTransportMode:
        item.travelMode || (item.travelMeta && item.travelMeta.mode) || "walk",
      transportTarget: { dayIndex, itemIndex, previewIndex },
    });
  },

  // 列表模式里点击交通方式入口
  onOpenPlaceTransportSheet(e) {
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10);
    this.openTransportSheet(
      dayIndex,
      itemIndex,
      getPreviewIndexByDay(this.data.daySections, dayIndex) + itemIndex
    );
  },

  // 地图模式里点击交通方式入口
  onOpenMapTransportSheet() {
    const currentPlace = this.data.mapPreviewPlace;
    if (!currentPlace) return;
    this.openTransportSheet(
      currentPlace.dayIndex,
      currentPlace.itemIndex,
      this.data.mapPreviewIndex
    );
  },

  // 关闭交通方式弹窗
  onCloseTransportSheet() {
    this.setData({ transportSheetVisible: false, transportTarget: null });
  },

  // 交通方式弹窗里切换选项
  onSelectTransportMode(e) {
    const mode = e.detail && e.detail.mode;
    if (!mode) return;
    this.setData({ pendingTransportMode: mode });
  },

  // 确认交通方式后，把新的方式写回具体地点
  onConfirmTransportMode() {
    const { transportTarget, pendingTransportMode, daySections } = this.data;
    if (!transportTarget) return;

    const nextSections = (daySections || []).map((day, dayIndex) => ({
      ...day,
      items: (day.items || []).map((item, itemIndex) => {
        if (
          dayIndex !== transportTarget.dayIndex ||
          itemIndex !== transportTarget.itemIndex
        ) {
          return item;
        }
        return decorateRoutePlaceItem(
          applyTravelMeta(item, pendingTransportMode)
        );
      }),
    }));
    const updatedRoute = this.buildUpdatedRoute(nextSections);

    this.setData({
      route: updatedRoute,
      daySections: nextSections,
      originalDaySections: JSON.parse(
        JSON.stringify(stripEditState(nextSections))
      ),
      transportSheetVisible: false,
      transportTarget: null,
    });
    this.saveRouteToStorage(updatedRoute);
    this.refreshMapPreview(nextSections, transportTarget.previewIndex);
  },

  // 点击地点主体：打开地点简介底部弹窗。
  onOpenPlaceIntro(e) {
    if (this.data.isEditing) return;
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10);
    const day = (this.data.daySections || [])[dayIndex];
    const item = ((day || {}).items || [])[itemIndex];
    if (!item) return;
    this.setData({
      placeIntroVisible: true,
      placeIntroData: buildPlaceIntroData(item, this.data.cityText),
    });
  },

  // 关闭地点简介底部弹窗。
  onClosePlaceIntro() {
    this.setData({
      placeIntroVisible: false,
      placeIntroData: null,
    });
  },

  // 点击右侧导航图标：打开导航地图选择弹窗。
  onOpenPlaceNavigation(e) {
    if (this.data.isEditing) return;
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const itemIndex = parseInt(e.currentTarget.dataset.index, 10);
    const day = (this.data.daySections || [])[dayIndex];
    const item = ((day || {}).items || [])[itemIndex];
    if (!item) return;
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: item.lat,
        lng: item.lng,
        name: item.name,
        address:
          item.address || `${this.data.cityText || ""}${item.name || ""}`,
      },
    });
  },

  // 点击地点简介里的地址：
  // 和右侧导航图标共用同一个地图选择弹窗。
  onOpenPlaceIntroNavigation() {
    const target = this.data.placeIntroData;
    if (!target) return;
    this.onClosePlaceIntro();
    this.setData({
      navMapSheetVisible: true,
      navMapTarget: {
        lat: target.lat,
        lng: target.lng,
        name: target.name,
        address:
          target.address || `${this.data.cityText || ""}${target.name || ""}`,
      },
    });
  },

  // 关闭导航地图选择弹窗。
  onCloseNavMapSheet() {
    this.setData({
      navMapSheetVisible: false,
      navMapTarget: null,
    });
  },

  // 新增一天行程
  onAddDay() {
    if (!this.data.isEditing) return;

    const nextSections = this.data.daySections.slice();
    const newDay = { id: `day-${Date.now()}`, items: [] };
    // 待计划天应始终排在最后，新天插入在它前面。
    const pendingIndex = nextSections.findIndex(d => d.id === '__pending__');
    if (pendingIndex >= 0) {
      nextSections.splice(pendingIndex, 0, newDay);
    } else {
      nextSections.push(newDay);
    }
    const syncedSections = this.syncDaySections(nextSections, this.data.cityInfo);
    const nextTabIndex = syncedSections.length;

    this.setData({
      daySections: syncedSections,
      tabs: buildTabsFromSections(syncedSections),
      summaryText: buildSummaryText(syncedSections),
      currentTab: nextTabIndex,
      sheetScrollTarget: `route-day-anchor-${syncedSections.length - 1}`,
    });
  },

  // 记录拖拽把手按下时的起始位置
  onHandleTouchStart(e) {
    const touch =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]) ||
      {};
    this.setData({ handleTouchStartY: touch.clientY || 0 });
  },

  // 路线规划弹窗改成"点选项即确认"：
  // 直接点"智能规划"或"手动编辑"就执行，不再需要底部确认按钮。
  onConfirmReorderOption(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode) return;

    if (mode === "manual") {
      this.setData({ reorderSheetVisible: false });
      this.onStartRouteEdit();
      return;
    }

    const currentSections = stripEditState(this.data.daySections || []);
    const hasPlaces = flattenDaySections(currentSections).length > 0;
    if (!hasPlaces) {
      wx.showToast({ title: "当前没有可规划地点", icon: "none" });
      return;
    }

    const optimizedSections = this.syncDaySections(
      currentSections,
      this.data.cityInfo
    );
    const summaryText = buildSummaryText(optimizedSections);
    const updatedRoute = {
      ...this.buildUpdatedRoute(optimizedSections),
      subtitle: summaryText,
      isDraft: this.data.fromPreview,
    };
    const nextMapDay =
      this.data.currentMapDay >= optimizedSections.length
        ? -1
        : this.data.currentMapDay;

    if (this.data.fromPreview) {
      this.setData({
        reorderSheetVisible: false,
        route: updatedRoute,
        daySections: optimizedSections,
        summaryText,
        tabs: buildTabsFromSections(optimizedSections),
        originalDaySections: JSON.parse(
          JSON.stringify(stripEditState(optimizedSections))
        ),
        hasRoutePlaces: flattenDaySections(optimizedSections).length > 0,
      });
      this.refreshMapPreview(optimizedSections, this.data.mapPreviewIndex);
      if (this.data.viewMode === "map") {
        this.updateMapData(optimizedSections, this.data.cityInfo, nextMapDay);
      }
      this.handoffPreviewRoute(updatedRoute, "已智能规划");
      return;
    }

    this.saveRouteToStorage(updatedRoute, "已智能规划");
    this.setData({
      reorderSheetVisible: false,
      route: updatedRoute,
      daySections: optimizedSections,
      summaryText,
      tabs: buildTabsFromSections(optimizedSections),
      originalDaySections: JSON.parse(
        JSON.stringify(stripEditState(optimizedSections))
      ),
      hasRoutePlaces: flattenDaySections(optimizedSections).length > 0,
    });
    this.refreshMapPreview(optimizedSections, this.data.mapPreviewIndex);
    if (this.data.viewMode === "map") {
      this.updateMapData(optimizedSections, this.data.cityInfo, nextMapDay);
    }
  },

  // 打开"编辑路线规划"弹窗
  onOpenReorderSheet() {
    this.setData({
      reorderSheetVisible: true,
    });
  },

  // 关闭"编辑路线规划"弹窗：
  // 统一给遮罩点击和右上角关闭按钮复用。
  onCloseReorderSheet() {
    this.setData({
      reorderSheetVisible: false,
    });
  },

  // 读取页面里每一天、每个地点当前的位置，
  // 供拖拽排序时判断"应该放到哪里"。
  captureDragLayout(callback) {
    const query = wx.createSelectorQuery().in(this);
    query.selectAll(".day-section").fields({ rect: true, dataset: true });
    query.selectAll(".place-swipe-cell").fields({ rect: true, dataset: true });
    query.exec((res) => {
      const dayRects = (res && res[0]) || [];
      const placeRects = (res && res[1]) || [];
      const dayLayouts = (dayRects || []).map((rect) => ({
        dayIndex: parseInt(rect.dataset && rect.dataset.dayIndex, 10),
        top: rect.top,
        bottom: rect.bottom,
        center: (rect.top + rect.bottom) / 2,
        items: [],
      }));

      (placeRects || []).forEach((rect) => {
        const dayIndex = parseInt(rect.dataset && rect.dataset.dayIndex, 10);
        const placeIndex = parseInt(
          rect.dataset && rect.dataset.placeIndex,
          10
        );
        const targetDay = dayLayouts.find((item) => item.dayIndex === dayIndex);
        if (!targetDay) return;
        targetDay.items.push({
          placeIndex,
          top: rect.top,
          bottom: rect.bottom,
          center: (rect.top + rect.bottom) / 2,
        });
      });

      dayLayouts.forEach((day) => {
        day.items.sort((a, b) => a.placeIndex - b.placeIndex);
      });

      this._dragLayouts = dayLayouts.sort((a, b) => a.dayIndex - b.dayIndex);
      if (typeof callback === "function") callback();
    });
  },

  // 根据手指当前 Y 坐标，推算拖拽目标落点。
  resolveDragTarget(currentY) {
    const layouts = this._dragLayouts || [];
    if (!layouts.length) {
      return {
        dayIndex: this.data.dragDay,
        placeIndex: this.data.dragIndex,
      };
    }

    let targetDay = layouts.find(
      (day) => currentY >= day.top && currentY <= day.bottom
    );
    if (!targetDay) {
      targetDay = layouts.reduce((nearest, day) => {
        if (!nearest) return day;
        return Math.abs(day.center - currentY) <
          Math.abs(nearest.center - currentY)
          ? day
          : nearest;
      }, null);
    }

    if (!targetDay) {
      return {
        dayIndex: this.data.dragDay,
        placeIndex: this.data.dragIndex,
      };
    }

    const items = targetDay.items || [];
    if (!items.length) {
      return { dayIndex: targetDay.dayIndex, placeIndex: 0 };
    }

    let targetIndex = items.length;
    for (let i = 0; i < items.length; i += 1) {
      if (currentY < items[i].center) {
        targetIndex = items[i].placeIndex;
        break;
      }
    }

    if (targetIndex === items.length) {
      const lastItem = items[items.length - 1];
      targetIndex = lastItem.placeIndex + 1;
    }

    return { dayIndex: targetDay.dayIndex, placeIndex: targetIndex };
  },

  // 刷新添加地点弹窗的数据源
  refreshPlacePickerItems() {
    const pickerData = buildPlacePickerData();
    const placePickerCurrentItems = this.resolvePlacePickerItems(
      this.data.placePickerTab,
      pickerData
    );
    this.setData({
      placePickerItems: pickerData.all || [],
      placePickerWantItems: pickerData.want || [],
      placePickerCollectItems: pickerData.collect || [],
      placePickerCurrentItems,
    });
  },

  // 根据当前弹窗 Tab，切换显示"全部 / 想去 / 收藏"
  resolvePlacePickerItems(tab, pickerData) {
    const source = pickerData || this.data;
    if (tab === "want") return source.want || source.placePickerWantItems || [];
    if (tab === "collect")
      return source.collect || source.placePickerCollectItems || [];
    return source.all || source.placePickerItems || [];
  },

  // 开始拖拽某个地点
  onDragStart(e) {
    if (!this.data.isEditing) return;
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const touch =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]) ||
      {};

    this.setData(
      {
        dragging: true,
        dragDay: dayIndex,
        dragIndex: index,
        dragTouchStartY: this.data.handleTouchStartY || touch.clientY || 0,
        dragOffsetY: 0,
        swipeDay: -1,
        swipeIndex: -1,
        daySections: this.resetSwipeOffsets(this.data.daySections),
      },
      () => {
        this.captureDragLayout();
      }
    );
    wx.vibrateShort();
  },

  // 拖拽移动中：根据当前位置动态换位
  onDragMove(e) {
    if (!this.data.isEditing || !this.data.dragging) return;

    const touch =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]) ||
      {};
    const currentY = touch.clientY || 0;
    const deltaY = currentY - this.data.dragTouchStartY;
    const target = this.resolveDragTarget(currentY);
    if (!target || target.dayIndex < 0 || target.placeIndex < 0) {
      this.setData({ dragOffsetY: deltaY });
      return;
    }

    const fromDay = this.data.dragDay;
    const fromIndex = this.data.dragIndex;
    const effectiveTargetIndex =
      target.dayIndex === fromDay && target.placeIndex > fromIndex
        ? target.placeIndex - 1
        : target.placeIndex;

    if (target.dayIndex === fromDay && effectiveTargetIndex === fromIndex) {
      this.setData({ dragOffsetY: deltaY });
      return;
    }

    const movedSections = moveItemAcrossDays(
      this.data.daySections,
      fromDay,
      fromIndex,
      target.dayIndex,
      target.placeIndex
    );
    const syncedSections = this.syncDaySections(movedSections, this.data.cityInfo);
    this.setData(
      {
        daySections: syncedSections,
        dragDay: target.dayIndex,
        dragIndex: effectiveTargetIndex,
        dragTouchStartY: currentY,
        dragOffsetY: 0,
        summaryText: buildSummaryText(syncedSections),
      },
      () => {
        this.captureDragLayout();
      }
    );
  },

  // 拖拽结束：清理临时状态
  onDragEnd() {
    if (!this.data.dragging) return;
    this.setData({
      dragging: false,
      dragDay: -1,
      dragIndex: -1,
      dragTouchStartY: 0,
      dragOffsetY: 0,
      handleTouchStartY: 0,
    });
    this._dragLayouts = null;
  },

  // 左滑开始：记录手指起点
  onSwipeStart(e) {
    if (!this.data.isEditing || this.data.dragging) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const item =
      (((this.data.daySections || [])[dayIndex] || {}).items || [])[index] ||
      {};
    this.setData({
      swipeStartX: touch.clientX,
      swipeStartY: touch.clientY,
      swipeDay: dayIndex,
      swipeIndex: index,
      swipeStartOffset: item.swipeOffset || 0,
    });
  },

  // 左滑移动：只更新当前卡片的删除偏移量
  onSwipeMove(e) {
    if (!this.data.isEditing) return;
    if (this.data.dragging) {
      this.onDragMove(e);
      return;
    }
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const index = parseInt(e.currentTarget.dataset.index, 10);
    if (dayIndex !== this.data.swipeDay || index !== this.data.swipeIndex)
      return;

    const deltaX = touch.clientX - this.data.swipeStartX;
    const deltaY = touch.clientY - this.data.swipeStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    let offset = this.data.swipeStartOffset + deltaX;
    offset = Math.max(MAX_DELETE_OFFSET, Math.min(0, offset));

    this.setData({
      daySections: this.resetSwipeOffsets(
        this.data.daySections,
        dayIndex,
        index,
        offset
      ),
    });
  },

  // 左滑结束：决定是停在打开状态，还是自动关回去
  onSwipeEnd(e) {
    if (!this.data.isEditing) return;
    if (this.data.dragging) {
      this.onDragEnd();
      return;
    }
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const index = parseInt(e.currentTarget.dataset.index, 10);
    if (dayIndex !== this.data.swipeDay || index !== this.data.swipeIndex)
      return;

    const item =
      (((this.data.daySections || [])[dayIndex] || {}).items || [])[index] ||
      {};
    // 打开阈值同步按一半偏移量判断，避免改了滑出距离后手感不一致。
    const isOpen = Math.abs(item.swipeOffset || 0) > Math.abs(MAX_DELETE_OFFSET) / 2;
    this.setData({
      daySections: this.resetSwipeOffsets(
        this.data.daySections,
        isOpen ? dayIndex : -1,
        isOpen ? index : -1,
        isOpen ? MAX_DELETE_OFFSET : 0
      ),
      swipeStartOffset: isOpen ? MAX_DELETE_OFFSET : 0,
    });
  },

  // 删除某一天里的一个地点
  onDeletePlace(e) {
    if (!this.data.isEditing) return;
    const dayIndex = parseInt(e.currentTarget.dataset.dayIndex, 10);
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const daySections = this.data.daySections.slice();
    const items = ((daySections[dayIndex] || {}).items || []).slice();
    if (!items[index]) return;

    items.splice(index, 1);
    daySections[dayIndex] = { ...daySections[dayIndex], items };
    const syncedSections = this.syncDaySections(daySections, this.data.cityInfo);

    this.setData({
      daySections: syncedSections,
      summaryText: buildSummaryText(syncedSections),
      swipeDay: -1,
      swipeIndex: -1,
      swipeStartOffset: 0,
    });
    wx.showToast({ title: "已删除地点", icon: "none" });
  },

  // 打开"添加地点"底部弹窗
  onOpenPlacePicker(e) {
    if (!this.data.isEditing) return;
    this.refreshPlacePickerItems();
    this.setData({
      placePickerVisible: true,
      placePickerTab: "all",
      placePickerCurrentItems: this.resolvePlacePickerItems("all"),
      placePickerDayIndex: parseInt(e.currentTarget.dataset.dayIndex, 10),
    });
  },

  // 关闭"添加地点"底部弹窗
  onClosePlacePicker() {
    this.setData({
      placePickerVisible: false,
      placePickerDayIndex: -1,
    });
  },

  // 切换添加地点弹窗里的筛选 Tab
  onSwitchPlacePickerTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      placePickerTab: tab,
      placePickerCurrentItems: this.resolvePlacePickerItems(tab),
    });
  },

  // 通过系统地图选点，把地点加进某一天
  onChoosePlaceFromMap() {
    const dayIndex = this.data.placePickerDayIndex;
    if (dayIndex < 0) return;
    const { cityInfo } = this.data;
    wx.chooseLocation({
      latitude: cityInfo.lat,
      longitude: cityInfo.lng,
      success: (res) => {
        if (
          typeof res.latitude !== "number" ||
          typeof res.longitude !== "number"
        )
          return;
        const nextSections = this.data.daySections.slice();
        const targetDay = nextSections[dayIndex] || {
          id: `day-${dayIndex}`,
          items: [],
        };
        const nextItems = (targetDay.items || []).slice();
        nextItems.push(buildMapPickedPlace(res));
        nextSections[dayIndex] = {
          ...targetDay,
          items: nextItems,
        };
        const syncedSections = this.syncDaySections(
          nextSections,
          this.data.cityInfo
        );
        this.setData({
          daySections: syncedSections,
          tabs: buildTabsFromSections(syncedSections),
          summaryText: buildSummaryText(syncedSections),
          currentTab: dayIndex + 1,
          sheetScrollTarget: `route-day-anchor-${dayIndex}`,
          placePickerVisible: false,
          placePickerDayIndex: -1,
        });
        wx.showToast({ title: "已添加地点", icon: "success" });
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes("cancel")) return;
        wx.showToast({ title: "地图选点失败", icon: "none" });
      },
    });
  },

  // 从弹窗列表里选一个地点，加进当前这一天
  onAddPlaceToDay(e) {
    const dayIndex = this.data.placePickerDayIndex;
    const item = e.currentTarget.dataset.item;
    if (dayIndex < 0 || !item) return;

    const nextSections = this.data.daySections.slice();
    const targetDay = nextSections[dayIndex] || {
      id: `day-${dayIndex}`,
      items: [],
    };
    const nextItems = (targetDay.items || []).slice();
    nextItems.push(buildAddedPlace(item));
    nextSections[dayIndex] = {
      ...targetDay,
      items: nextItems,
    };

    const syncedSections = this.syncDaySections(nextSections, this.data.cityInfo);
    this.setData({
      daySections: syncedSections,
      tabs: buildTabsFromSections(syncedSections),
      summaryText: buildSummaryText(syncedSections),
      currentTab: dayIndex + 1,
      sheetScrollTarget: `route-day-anchor-${dayIndex}`,
      placePickerVisible: false,
      placePickerDayIndex: -1,
    });
    wx.showToast({ title: "已添加地点", icon: "success" });
  },

  // 阻止弹窗内部点击冒泡到遮罩层
  preventBubble() {},

  // 预留空函数，主要给模板占位用
  noop() {},

  // 小程序右上角分享文案
  onShareAppMessage() {
    const { route } = this.data;
    return {
      title: route ? `${route.title} · 我的路线` : "我的路线",
      path: route
        ? `/subpackages/route/pages/my-route/my-route?route=${encodeURIComponent(
            JSON.stringify(route)
          )}`
        : "/pages/index/index",
    };
 s },
});
