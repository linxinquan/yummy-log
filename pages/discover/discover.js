// 觅食图 - 攻略页
const app = getApp();
const { normalizeTripDurationText } = require("../../utils/trip-duration");
const { backfillStoredGuides } = require("../../utils/guide-backfill");
const { DEFAULT_COVER_POOL } = require("../../config/cover-pool");
const {
 parseRouteTextToIds,
 resolveRouteImportText,
} = require("../../utils/route-import");
const placesData = require("../../utils/placesData");
const util = require("../../utils/util");
// 读取首页当前选中的城市时，和首页共用同一个缓存 key。
const EXPLORE_SELECTED_CITY_STORAGE_KEY = "selectedExploreCity";

// 云端头像资源路径
const cloudFile =
 "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/avatar_images/";
const authorImages = [
 "img_00001.jpg",
 "img_00002.jpg",
 "img_00003.jpg",
 "img_00004.jpg",
 "img_00005.jpg",
 "img_00006.jpg",
 "img_00007.jpg",
 "img_00008.jpg",
];

// 不同城市对应不同的行政区 Tab。
// 攻略页顶部地区栏要跟首页当前选中的城市保持一致。
const CITY_DISTRICT_MAP = {
 深圳: [
  { name: "福田区", id: "futian" },
  { name: "南山区", id: "nanshan" },
  { name: "罗湖区", id: "luohu" },
  { name: "宝安区", id: "baoan" },
  { name: "龙岗区", id: "longgang" },
  { name: "龙华区", id: "longhua" },
  { name: "光明区", id: "guangming" },
  { name: "坪山区", id: "pingshan" },
  { name: "盐田区", id: "yantian" },
  { name: "大鹏新区", id: "dapeng" },
 ],
 广州: [
  { name: "天河区", id: "tianhe" },
  { name: "越秀区", id: "yuexiu" },
  { name: "海珠区", id: "haizhu" },
  { name: "荔湾区", id: "liwan" },
  { name: "白云区", id: "baiyun" },
  { name: "黄埔区", id: "huangpu" },
  { name: "番禺区", id: "panyu" },
  { name: "花都区", id: "huadu" },
  { name: "南沙区", id: "nansha" },
  { name: "从化区", id: "conghua" },
  { name: "增城区", id: "zengcheng" },
 ],
 汕头: [
  { name: "金平区", id: "jinping" },
  { name: "龙湖区", id: "longhu" },
  { name: "濠江区", id: "haojiang" },
  { name: "潮阳区", id: "chaoyang" },
  { name: "潮南区", id: "chaonan" },
  { name: "澄海区", id: "chenghai" },
  { name: "南澳县", id: "nanao" },
 ],
 佛山: [
  { name: "禅城区", id: "chancheng" },
  { name: "南海区", id: "nanhai" },
  { name: "顺德区", id: "shunde" },
  { name: "三水区", id: "sanshui" },
  { name: "高明区", id: "gaoming" },
 ],
 珠海: [
  { name: "香洲区", id: "xiangzhou" },
  { name: "斗门区", id: "doumen" },
  { name: "金湾区", id: "jinwan" },
 ],
};

// 把城市名称统一成简称，方便读取对应的行政区配置。
function normalizeGuideCityName(cityName = "") {
 return util.getCityShortName(String(cityName || "").trim() || "深圳市");
}

// 优先读取首页当前选中的城市。
// 如果用户还没手动切过城市，再退回定位得到的当前城市。
function getSelectedExploreCity() {
 const savedCity =
  wx.getStorageSync(EXPLORE_SELECTED_CITY_STORAGE_KEY) ||
  app.globalData.selectedExploreCity ||
  (app.globalData.districtInfo && app.globalData.districtInfo.city) ||
  "深圳市";
 return normalizeGuideCityName(savedCity);
}

// 根据当前城市生成对应的地区 Tab。
// 没配到的城市先兜底回深圳，避免页面出现空数组。
function getDistrictsByCity(cityName = "") {
 const cityShortName = normalizeGuideCityName(cityName);
 return CITY_DISTRICT_MAP[cityShortName] || CITY_DISTRICT_MAP.深圳;
}

// 随机获取一个作者头像
function getRandomAuthorAvatar() {
 const index = Math.floor(Math.random() * authorImages.length);
 return cloudFile + authorImages[index];
}

// 根据攻略已有字段，尽量推断出城市名称。
function inferGuideCity(guide = {}) {
 const sourceText = [
  guide.city,
  guide.districtName,
  guide.title,
  guide.desc,
  ...(guide.tags || []),
  ...(guide.shops || []),
 ].join(" ");

 if (/广州/.test(sourceText)) return "广州市";
 if (/汕头/.test(sourceText)) return "汕头市";
 if (/佛山/.test(sourceText)) return "佛山市";
 if (/珠海/.test(sourceText)) return "珠海市";
 return "深圳市";
}

// 统计这篇攻略被保存成路线的次数。
function getSavedGuideCount(guideId) {
 const savedRoutes = wx.getStorageSync("savedRoutes") || [];
 return savedRoutes.filter(
  (item) => String(item.guideId || item.id) === String(guideId)
 ).length;
}

// 给攻略卡片补齐展示字段，例如城市、头像、使用次数。
function decorateGuideCards(guides = []) {
 return guides.map((item) => ({
  ...item,
  cityText: item.cityText || inferGuideCity(item),
  authorAvatar: item.authorAvatar || getRandomAuthorAvatar(),
  useRouteCount: (item.baseUseCount || 0) + getSavedGuideCount(item.id),
  duration: normalizeTripDurationText(
   item.duration,
   Math.max((item.daySections || []).length, 1)
  ),
 }));
}

// 读取用户自己发布的攻略，并补成和攻略列表一致的字段结构。
function getPublishedGuides(cardColors = []) {
 const guides = wx.getStorageSync("myGuides") || [];
 const { guides: fixedGuides, changed } = backfillStoredGuides(guides);
 if (changed) {
  wx.setStorageSync("myGuides", fixedGuides);
 }
 return fixedGuides.map((item, index) => ({
  ...item,
  category: item.category || "all",
  cardColor:
   item.cardColor || cardColors[index % cardColors.length] || "#F7F7F7",
  cityText: item.cityText || inferGuideCity(item),
  baseUseCount: item.baseUseCount || 0,
  duration: normalizeTripDurationText(
   item.duration,
   Math.max((item.daySections || []).length, 1)
  ),
  shopCount: item.shopCount || (item.content || []).length || 0,
 }));
}

// 根据地点ID获取封面图（用于攻略卡片）
function getGuideCoverImage(placeId) {
  const place = placesData.getPlaceById(placeId);
  if (place && place.coverImage) {
    return place.coverImage;
  }
  // 降级到默认封面池
  return DEFAULT_COVER_POOL[0];
}

Page({
 data: {
  // 导航栏高度
  menuTop: 44,
  menuHeight: 32,
  menuRightInset: 24,
  contentTop: 108,

  // 区域
  currentCity: "深圳",
  districts: getDistrictsByCity("深圳"),

  // 分类
  categories: [
   { name: "全部", id: "all" },
   { name: "推荐", id: "recommend" },
  ],
  currentCategory: "全部",

  // 精选攻略
  featuredGuides: [],

  // 攻略列表
  allGuides: [],
  currentGuides: [],

  // 右下角悬浮入口状态：攻略页沿用想去页同一套三卡片菜单。
  addEntryVisible: false,
  importEntryVisible: false,
  guideLink: "",
  parsingRoute: false,
 },

 // 页面初始化：计算顶部安全区，并首次加载攻略数据。
 onLoad() {
  // 低版本基础库没有 getWindowInfo 时，退回到更稳的同步系统信息。
  const windowInfo = wx.getWindowInfo
   ? wx.getWindowInfo()
   : wx.getSystemInfoSync();
  const menuButtonInfo = wx.getMenuButtonBoundingClientRect
   ? wx.getMenuButtonBoundingClientRect()
   : null;
  const menuTop = menuButtonInfo
   ? menuButtonInfo.top
   : (windowInfo.statusBarHeight || 44) + 4;
  const menuHeight = menuButtonInfo ? menuButtonInfo.height : 32;
  const menuRightInset = menuButtonInfo
   ? Math.max(windowInfo.windowWidth - menuButtonInfo.left + 8, 24)
   : 103;

  const contentTop = menuTop + menuHeight + 12;

  this.setData({
   menuTop,
   menuHeight,
   menuRightInset,
   contentTop,
  });

  // 首次进入攻略页时，先按首页当前城市刷新顶部地区 Tab。
  this.syncDistrictTabsWithSelectedCity();

  this.loadGuides();
 },

 // 每次回到页面都重新加载，保证新发布的攻略能出现。
 onShow() {
  // 首页切换城市后再进入攻略页，这里要同步刷新地区 Tab。
  this.syncDistrictTabsWithSelectedCity();
  this.loadGuides(this.data.currentCategory || "全部");
 },

 // 页面切走时收起悬浮菜单，避免回到页面时状态残留。
 onHide() {
  this.setData({
   addEntryVisible: false,
   importEntryVisible: false,
  });
 },

 // 页面卸载前也收起悬浮菜单，避免输入内容残留到下一次进入。
 onUnload() {
  this.setData({
   addEntryVisible: false,
   importEntryVisible: false,
   guideLink: "",
   parsingRoute: false,
  });
 },

 // 让攻略页顶部地区 Tab 跟首页当前城市保持一致。
 syncDistrictTabsWithSelectedCity() {
  const currentCity = getSelectedExploreCity();
  this.setData({
   currentCity,
   districts: getDistrictsByCity(currentCity),
  });
 },

 // 根据顶部分类切换当前列表。
 refreshGuideList(categoryName = "全部") {
  const filtered =
   categoryName === "全部"
    ? this.data.allGuides
    : this.data.allGuides.filter((item) => item.category === "recommend");

  this.setData({
   currentCategory: categoryName,
   currentGuides: decorateGuideCards(filtered),
  });
 },

 // 组装攻略页的数据源：
 // 包括精选攻略、内置攻略、以及用户自己发布的攻略。
 loadGuides(categoryName = "全部") {
  const cardColors = [
   "#F7F7F7",
   "#F5F6F8",
   "#F6F7F6",
   "#F5F5F6",
   "#F6F5F5",
   "#F4F5F4",
  ];

  const featuredGuides = [
   {
    id: 1,
    name: "蛇口的海与月",
    title: "深圳蛇口必吃地道老店推荐",
    coverImage:
     "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/guides/shekoubichi.jpg",
    author: "小胖又饿了",
    duration: "2天",
    shopCount: 14,
    likes: 4222,
    routes: [
     {
      id: "day-0",
      title: "第1天",
      countText: "3 个地点",
      places: [2, 9, 20],
     },
     {
      id: "day-1",
      title: "第2天",
      countText: "4 个地点",
      places: [15, 1073, 10, 5],
     },
     {
      id: "day-2",
      title: "第3天",
      countText: "4 个地点",
      places: [1, 12, 19, 22],
     },
     { id: "day-3", title: "第4天", countText: "2 个地点", places: [4, 17] },
    ],
   },
   {
    id: 2,
    name: "春日踏青",
    title: "深圳春日赏花攻略",
    coverImage:
     "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/guides/shanghua.jpg",
    author: "旅行博主",
    duration: "1天",
    shopCount: 8,
    likes: 2841,
    routes: [
     {
      id: "day-0",
      title: "第1天",
      countText: "4 个地点",
      places: [162, 157, 149, 150],
     },
     {
      id: "day-1",
      title: "第2天",
      countText: "4 个地点",
      places: [153, 154, 163, 168],
     },
    ],
   },
   {
    id: 3,
    name: "周末寻味",
    title: "深圳本地人常去的美食街",
    coverImage:
     "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/guides/szmeishijie.jpg",
    author: "美食达人",
    duration: "1天",
    shopCount: 8,
    likes: 3567,
    routes: [
     {
      id: "day-0",
      title: "第1天",
      countText: "4 个地点",
      places: [15, 18, 923, 1068],
     },
     {
      id: "day-1",
      title: "第2天",
      countText: "3 个地点",
      places: [144, 10, 23],
     },
    ],
   },
   {
    id: 4,
    name: "文艺慢生活",
    title: "蛇口值得打卡的咖啡馆",
    coverImage:
     "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/guides/cafei.jpg",
    author: "文艺青年",
    duration: "半天",
    shopCount: 6,
    likes: 2156,
    routes: [
     {
      id: "day-0",
      title: "第1天",
      countText: "4 个地点",
      places: [902, 903, 14, 1069],
     },
     { id: "day-1", title: "第2天", countText: "2 个地点", places: [165, 904] },
    ],
   },
   {
    id: 5,
    name: "海滨漫步",
    title: "深圳最值得去的海边景点",
    coverImage:
     "cloud://cloud1-9grc0ja0405b042a.636c-cloud1-9grc0ja0405b042a-1420912402/images/guides/haibianjingdian.jfif",
    author: "旅行家",
    duration: "1天",
    shopCount: 5,
    likes: 1987,
    routes: [
     {
      id: "day-0",
      title: "第1天",
      countText: "3 个地点",
      places: [167, 160, 149],
     },
     { id: "day-1", title: "第2天", countText: "2 个地点", places: [913, 158] },
    ],
   },
  ];

const allGuides = [
  {
    id: 7,
    district: "futian",
    category: "recommend",
    title: "深圳南山老字号餐厅攻略",
    desc: "14年+老店真的好吃！嘉华小吃、好好味面馆、翠湖广东乡下菜等10家南山老字号，带你体验深圳本地人的美食记忆。这些店承载了一代人的味蕾回忆，值得打卡！",
    coverImage: getGuideCoverImage(1105),
    cardColor: cardColors[1],
    author: "大湾区探店王",
    duration: "1天",
    shopCount: 3,
    likes: 3891,
    tags: ["南山", "老字号", "本地美食"],
    shops: ["嘉华小吃", "好好味面馆", "翠湖广东乡下菜", "潮香四海", "湛江鸡饭店", "桂园酒楼"],
    routes: [
      { id: "day-0", title: "第1天", countText: "3 个地点", places: [1105, 1073, 1095] }
    ],
  },
  {
    id: 8,
    district: "luohu",
    category: "recommend",
    title: "深圳必打卡网红餐厅合集",
    desc: "深圳最火的网红餐厅推荐！打卡拍照两不误，从高空景观餐厅到ins风咖啡馆，从创意料理到特色甜品，这份攻略带你刷爆朋友圈！",
    coverImage: getGuideCoverImage(1126),
    cardColor: cardColors[2],
    author: "美食博主",
    duration: "2天",
    shopCount: 4,
    likes: 6789,
    tags: ["网红", "打卡", "拍照"],
    shops: ["网红咖啡店", "高空餐厅", "创意料理", "甜品店", "露台酒吧", "花园餐厅"],
    routes: [
      { id: "day-0", title: "第1天", countText: "2 个地点", places: [1126, 1094] },
      { id: "day-1", title: "第2天", countText: "2 个地点", places: [1099, 1097] },
    ],
  },
  {
    id: 9,
    district: "yantian",
    category: "recommend",
    title: "福田CBD商务宴请餐厅指南",
    desc: "福田会展中心周边高端餐厅推荐，适合商务宴请和朋友聚会。从粤菜到日料，从海鲜到牛排，这里有最适合商务场合的用餐选择",
    coverImage: getGuideCoverImage(1102),
    cardColor: cardColors[3],
    author: "商务美食家",
    duration: "3天",
    shopCount: 10,
    likes: 2103,
    tags: ["商务", "高端", "宴请"],
    shops: ["粤菜餐厅", "日料放题", "海鲜酒楼", "牛排馆", "私房菜", "茶馆"],
    routes: [
      { id: "day-0", title: "第1天", countText: "4 个地点", places: [1102, 1086, 1093, 933] },
      { id: "day-1", title: "第2天", countText: "4 个地点", places: [1119, 1117, 931, 932] },
      { id: "day-2", title: "第3天", countText: "2 个地点", places: [1080, 1123] },
    ],
  },
  {
    id: 10,
    district: "longgang",
    category: "recommend",
    title: "深圳夜市攻略",
    desc: "深圳各大夜市美食全攻略，从沙井到东门一网打尽！烧烤、小吃、甜品、饮品应有尽有，体验深圳夜生活的烟火气",
    coverImage: getGuideCoverImage(10),
    cardColor: cardColors[4],
    author: "夜市达人",
    duration: "2天",
    shopCount: 7,
    likes: 8901,
    tags: ["夜市", "小吃", "宵夜"],
    shops: ["沙井生蚝", "东门小吃街", "福田夜市", "南山烧烤", "龙华大排档", "宝安糖水铺"],
    routes: [
      { id: "day-0", title: "第1天", countText: "3 个地点", places: [10, 1108, 1073] },
      { id: "day-1", title: "第2天", countText: "4 个地点", places: [1103, 1120, 13, 8] },
    ],
  },
  {
    id: 11,
    district: "dapeng",
    category: "recommend",
    title: "大鹏半岛海鲜之旅",
    desc: "大鹏所城、南澳渔港，最新鲜的海鲜等你来尝！从捕捞到餐桌，体验真正的海鲜盛宴。还有美丽的海滩和古村落等着你！",
    coverImage: getGuideCoverImage(1106),
    cardColor: cardColors[5],
    author: "海鲜控",
    duration: "1天",
    shopCount: 2,
    likes: 3456,
    routes: [
      { id: "day-0", title: "第1天", countText: "2 个地点", places: [1106, 164] }
    ],
  },
  {
    id: 12,
    district: "baoan",
    category: "all",
    title: "深圳隐藏的文艺角落",
    desc: "远离喧嚣，发现深圳那些不为人知的文艺小店和咖啡馆。老厂房改造的艺术区、独立书店、小众画廊，带你感受深圳的文艺气息",
    coverImage: getGuideCoverImage(1069),
    cardColor: cardColors[0],
    author: "文艺青年",
    duration: "1天",
    shopCount: 4,
    likes: 1567,
    tags: ["文艺", "小众", "咖啡馆"],
    shops: ["旧天堂书店", "华侨城创意园", "海上世界艺术中心", "深业上城", "OCT-LOFT", "南头古城"],
    routes: [
      { id: "day-0", title: "第1天", countText: "4 个地点", places: [1069, 144, 158, 1122] }
    ],
  },
  {
    id: 14,
    district: "nanshan",
    category: "all",
    title: "盐田海滨栈道徒步",
    desc: "最美海岸线徒步路线，山海相连的绝美风景！从盐田海鲜街到大梅沙，一路海景相伴，适合周末徒步和拍照打卡",
    coverImage: getGuideCoverImage(143),
    cardColor: cardColors[2],
    author: "户外达人",
    duration: "2天",
    shopCount: 6,
    likes: 1892,
    tags: ["徒步", "海景", "户外"],
    shops: ["盐田海鲜街", "大梅沙", "小梅沙", "东部华侨城"],
    routes: [
      { id: "day-0", title: "第1天", countText: "4 个地点", places: [143, 914, 912, 167] },
      { id: "day-1", title: "第2天", countText: "2 个地点", places: [911, 913] },
    ],
  },
  {
    id: 15,
    district: "futian",
    category: "all",
    title: "深圳公园打卡指南",
    desc: "深圳各大公园游玩攻略，周末亲子游好去处！莲花山、深圳湾公园、中心公园，每个公园都有独特的风景和玩法",
    coverImage: getGuideCoverImage(157),
    cardColor: cardColors[3],
    author: "亲子达人",
    duration: "4天",
    shopCount: 13,
    likes: 2345,
    tags: ["公园", "亲子", "游玩"],
    shops: ["莲花山公园", "深圳湾公园", "中心公园", "笔架山公园", "塘朗山", "梅林水库"],
    routes: [
      { id: "day-0", title: "第1天", countText: "4 个地点", places: [157, 149, 159, 167] },
      { id: "day-1", title: "第2天", countText: "4 个地点", places: [151, 150, 914, 154] },
      { id: "day-2", title: "第3天", countText: "3 个地点", places: [148, 143, 162] },
      { id: "day-3", title: "第4天", countText: "2 个地点", places: [156, 168] },
    ],
  },
];

  const normalizedGuides = allGuides.map((item) => ({
   ...item,
   baseUseCount: item.likes || 0,
   cityText: inferGuideCity(item),
  }));

  const publishedGuides = getPublishedGuides(cardColors);
  const mergedGuides = publishedGuides.concat(normalizedGuides);

  this.setData({
   featuredGuides,
   allGuides: mergedGuides,
  });

  this.refreshGuideList(categoryName);
 },

 // 点击顶部区县入口，进入对应的区县攻略页。
 onDistrictChange(e) {
  const district = e.currentTarget.dataset.district;
  const districtName = e.currentTarget.dataset.name;
  wx.navigateTo({
   url: `/subpackages/guide/pages/district-guide/district-guide?district=${district}&name=${encodeURIComponent(
    districtName
   )}`,
  });
 },

 // 点击顶部分类，切换“全部 / 推荐”。
 onCategoryChange(e) {
  const categoryName = e.currentTarget.dataset.name;
  this.refreshGuideList(categoryName);
 },

 // 点击攻略卡片，进入攻略详情页。
 onGuideTap(e) {
  const guide = e.currentTarget.dataset.guide;
  wx.navigateTo({
   url: `/subpackages/guide/pages/guide-detail/guide-detail?guide=${encodeURIComponent(
    JSON.stringify(guide)
   )}`,
  });
 },

 // 阻止点击弹窗内容时冒泡到遮罩层，避免误关闭。
 preventBubble() {
 },

 // 打开右下角悬浮入口菜单。
 openAddEntrySheet() {
  this.setData({
   addEntryVisible: true,
   importEntryVisible: false,
  });
 },

 // 关闭右下角悬浮入口菜单。
 closeAddEntrySheet() {
  this.setData({
   addEntryVisible: false,
  });
 },

 // 悬浮按钮统一入口：关闭态时收起弹层，普通态时打开菜单。
 onEntryFabTap() {
  if (this.data.addEntryVisible || this.data.importEntryVisible) {
   this.closeActiveEntryOverlay();
   return;
  }
  this.openAddEntrySheet();
 },

 // 统一关闭当前悬浮入口相关弹层，供右下角关闭按钮复用。
 closeActiveEntryOverlay() {
  this.setData({
   addEntryVisible: false,
   importEntryVisible: false,
  });
 },

 // 打开“解析路线”输入弹窗，同时收起三张入口卡片。
 onOpenLinkImport() {
  this.setData({
   addEntryVisible: false,
   importEntryVisible: true,
  });
 },

 // 关闭“解析路线”输入弹窗。
 onCloseLinkImport() {
  this.setData({
   importEntryVisible: false,
  });
 },

 // 同步输入框内容。
 onLinkInput(e) {
  this.setData({
   guideLink: (e.detail && e.detail.value) || "",
  });
 },

 // 一键读取剪贴板内容。
 onPasteLink() {
  wx.getClipboardData({
   success: ({ data }) => {
    this.setData({ guideLink: data || "" });
   },
   fail: () => {
    wx.showToast({ title: "未获取到剪贴板内容", icon: "none" });
   },
  });
 },

 // 确认解析内容，并直接跳去路线规划页。
 async onConfirmLink() {
  const guideLink = (this.data.guideLink || "").trim();
  if (!guideLink) {
   wx.showToast({ title: "请先粘贴链接或正文", icon: "none" });
   return;
  }

  if (this.data.parsingRoute) return;
  this.setData({ parsingRoute: true });
  wx.showLoading({ title: "解析中..." });

  try {
   const resolvedInput = await resolveRouteImportText(guideLink);
   if (!resolvedInput.success || !resolvedInput.text) {
    wx.showToast({
     title: resolvedInput.message || "解析失败",
     icon: "none",
    });
    return;
   }

   const parseResult = await parseRouteTextToIds(resolvedInput.text);
   if (!parseResult.totalCount) {
    wx.showToast({ title: "暂未识别到可规划地点", icon: "none" });
    return;
   }

   if (parseResult.warning) {
    console.warn("[discover-entry]", parseResult.warning);
   }

   let successMsg = `已识别 ${parseResult.totalCount} 个地点`;
   if (parseResult.geoStats && parseResult.geoStats.total > 0) {
    const unresolved =
     parseResult.geoStats.total - parseResult.geoStats.resolved;
    if (unresolved > 0) {
     successMsg += `（${unresolved}个使用估算坐标）`;
    }
   }

   this.setData({
    guideLink: "",
    importEntryVisible: false,
   });

   wx.showToast({
    title: successMsg,
    icon: "success",
   });

   setTimeout(() => {
    wx.navigateTo({
     url: `/subpackages/route/pages/route/route?ids=${parseResult.routeIds.join(",")}&dayCount=${parseResult.dayCount}`,
    });
   }, 300);
  } finally {
   wx.hideLoading();
   this.setData({ parsingRoute: false });
  }
 },

 // 从悬浮入口直接进入“创建路线”。
 onCreateRouteFromFab() {
  this.setData({
   addEntryVisible: false,
  });
  wx.navigateTo({
   url: "/subpackages/route/pages/route-basic-edit/route-basic-edit?create=1",
  });
 },

 // 从悬浮入口直接进入“采集打卡”。
 onOpenCheckinFromFab() {
  this.setData({
   addEntryVisible: false,
  });
  wx.navigateTo({
   url: "/subpackages/checkin/pages/checkin-camera/checkin-camera?type=food&source=discoverFab",
  });
 },
});
