// routeDataUtil.js
// 路线数据的纯函数工具集：全部为"输入 -> 输出"的纯函数，不依赖页面 this 状态。
// 从 my-route.js 顶部抽出，便于单测和降低页面文件体积。
const util = require("../../../utils/util");
const placesData = require("../../../utils/placesData");
const { resolveDisplayCategory } = require("../../../utils/displayCategory");
const {
  buildPlaceCardTags,
  buildRouteTravelDisplay,
} = require("../../../utils/route-place-card");

// 删除按钮本身是 120rpx，这里按 48rpx 间距换算成 px 后，统一地点卡片左滑打开距离。
const MAX_DELETE_OFFSET = -84;

// 把"当前所在位置"和真实定位地址拼成统一显示文案。
// 有地址时显示：当前所在位置（深圳市南山区xxx）
// 没地址时只显示：当前所在位置
function buildCurrentLocationDisplayName(address = "") {
  const safeAddress = String(address || "").trim();
  return safeAddress ? `当前所在位置（${safeAddress}）` : "当前所在位置";
}

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
  return matchedPlace2 || null;
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
  return (route && route.daySections) || [];
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

module.exports = {
  MAX_DELETE_OFFSET,
  buildCurrentLocationDisplayName,
  buildSyntheticLatLng,
  inferTag,
  findMatchedPlace,
  decorateRoutePlaceItem,
  removeEmptyDaysOnSave,
  buildDaySectionsFromLegacy,
  buildPlacePickerData,
  buildAddedPlace,
  buildMapPickedPlace,
  moveItemAcrossDays,
};
