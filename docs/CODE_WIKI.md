# 觅食图 / Me Tour - Code Wiki

> 深圳蛇口美食探店地图 · 微信小程序代码文档
> 版本: V1.1.0 | 更新日期: 2026-06-26

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [页面模块](#3-页面模块)
4. [自定义组件](#4-自定义组件)
5. [工具模块](#5-工具模块)
6. [核心数据模型](#6-核心数据模型)
7. [关键函数说明](#7-关键函数说明)
8. [页面导航与路由](#8-页面导航与路由)
9. [依赖关系](#9-依赖关系)
10. [外部服务与API](#10-外部服务与api)
11. [本地存储结构](#11-本地存储结构)
12. [运行与部署](#12-运行与部署)

---

## 1. 项目概述

**觅食图**是一款面向深圳蛇口地区的美食探店小程序，提供地图浏览、店铺搜索、想去清单、路线规划、攻略导入、打卡采集等核心功能。

### 1.1 技术栈

| 类别 | 技术选型 |
|------|----------|
| 框架 | 微信小程序原生框架 |
| 地图 | 微信 Map 组件 + 腾讯地图 API |
| 云服务 | 微信云开发 (CloudBase) |
| 数据存储 | localStorage + 云数据库 (迁移中) |
| 样式 | WXSS + MingCute 图标库 + Design Tokens |
| 构建 | 微信开发者工具 + miniprogram-ci |

### 1.2 项目结构

```
yummy/
├── app.js                    # 小程序入口（云初始化、定位、全局数据）
├── app.json                  # 全局配置（路由、tabbar、分包、预加载）
├── app.wxss                  # 全局样式（CSS变量设计系统）
├── pages/                    # 主包页面（5个Tab）
│   ├── index/               # 探索页（地图 + 店铺列表）
│   ├── wantgo/              # 想去清单页
│   ├── discover/            # 攻略发现页
│   ├── route-entry/         # 中间路线入口页
│   └── my/                  # 个人中心页
├── subpackages/             # 分包页面（4个子包）
│   ├── guide/               # 攻略子包
│   │   ├── pages/district-guide/
│   │   ├── pages/guide-detail/
│   │   └── pages/my-guides/
│   ├── checkin/             # 打卡子包
│   │   ├── pages/checkin/
│   │   ├── pages/checkin-camera/
│   │   ├── pages/checkin-detail/
│   │   └── utils/
│   ├── route/               # 路线子包
│   │   ├── pages/route/
│   │   ├── pages/route-basic-edit/
│   │   ├── pages/my-route/
│   │   └── utils/
│   └── extra/               # 扩展功能子包
│       ├── pages/spot-detail/
│       ├── pages/collection/
│       ├── pages/link-import/
│       ├── pages/webview/
│       ├── pages/my-favorites/
│       └── utils/
├── custom-tabbar/           # 自定义底部导航
├── components/              # 自定义组件
│   ├── route-map-preview-card/
│   ├── transport-info-sheet/
│   └── travel-meta-line/
├── utils/                   # 工具函数
│   └── db/                  # 数据库访问层（DAL）
├── cloud/                   # 云函数
├── config/                  # 配置文件
├── styles/                  # 全局样式文件
├── images/                  # 静态资源
├── assets/                  # 图标资源
├── i18n/                    # 国际化
└── __tests__/               # 单元测试
```

---

## 2. 技术架构

### 2.1 应用架构

```
┌─────────────────────────────────────────────────────────┐
│                      表现层 (UI)                        │
│  pages/ · subpackages/ · custom-tabbar/ · images/      │
│  components/ · styles/                                 │
├─────────────────────────────────────────────────────────┤
│                      业务逻辑层                          │
│  app.js (全局状态) · 各页面 .js (Page 逻辑)            │
├─────────────────────────────────────────────────────────┤
│                      数据服务层                          │
│  utils/util.js · utils/cloudData.js · utils/db/        │
│  utils/checkinUtil.js · utils/placesData.js            │
├─────────────────────────────────────────────────────────┤
│                      数据持久层                          │
│  localStorage (legacy) · 微信云数据库 (migrating)       │
├─────────────────────────────────────────────────────────┤
│                      外部服务层                          │
│  腾讯地图 API · 腾讯天气 API · 百度地图 API              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 全局状态管理 (app.js)

通过 `App()` 实例的 `globalData` 管理全局状态：

```javascript
App({
  globalData: {
    userInfo: null,           // 用户信息
    location: null,            // 用户当前位置 {lat, lng, accuracy}
    locationReady: false,      // 定位是否就绪
    locationCallbacks: [],     // 定位回调队列
    districtInfo: { city: '深圳', district: '南山区' },  // 行政区划信息
    centerLocation: { lat: 22.5322, lng: 113.9558 },    // 默认中心坐标
    qqMapKey: 'SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG',   // 腾讯地图 Key
    baiduMapKey: 'KuGlOjdoC0kmGUbU1Tw2OQyK6LKQ6gGa',   // 百度地图 Key（全景图）
    locationDesc: ''           // 位置描述
  }
})
```

### 2.3 回调机制

| 方法 | 用途 |
|------|------|
| `whenLocationReady(callback)` | 等待定位完成后执行回调 |
| `whenDistrictReady(callback)` | 等待区划信息获取完成后执行回调 |

---

## 3. 页面模块

### 3.1 主包页面 (pages/)

#### 探索页 (pages/index/)

| 文件 | 职责 |
|------|------|
| `index.js` | 地图展示、店铺/景点列表、分类筛选、想去功能 |
| `index.wxml` | 地图组件、底部抽屉、店铺卡片 |
| `index.wxss` | 页面样式 |

**核心功能：**
- 地图 + 底部抽屉双视图
- 美食/景点/酒店/饮品等分类筛选
- 距离/评分排序
- 广东21城市切换
- 想去/取消想去
- 位置选择器
- 使用 `custom-tabbar` 组件

#### 想去清单页 (pages/wantgo/)

| 文件 | 职责 |
|------|------|
| `wantgo.js` | 想去/路线/足迹三Tab、拖拽排序 |

**核心功能：**
- 想去清单（支持拖拽排序）
- 路线规划入口
- 到访足迹展示
- 项目移除
- 使用 `travel-meta-line`、`transport-info-sheet` 组件

#### 攻略发现页 (pages/discover/)

| 文件 | 职责 |
|------|------|
| `discover.js` | 攻略列表、区域分类、攻略导入 |
| `discover.wxs` | WXS 工具函数 |

**核心功能：**
- 区域筛选（福田/南山/罗湖等）
- 精选攻略展示
- 小红书/大众点评攻略文本解析

#### 路线入口页 (pages/route-entry/)

| 文件 | 职责 |
|------|------|
| `route-entry.js` | 解析路线与创建路线入口 |

**核心功能：**
- 粘贴正文或链接解析路线
- 跳转路线规划页
- 创建空白路线

#### 个人中心页 (pages/my/)

| 文件 | 职责 |
|------|------|
| `my.js` | 用户登录、数据统计、打卡地图 |

**核心功能：**
- 快速登录（生成默认账号）
- 想去/足迹/添加店铺统计
- 打卡采集入口
- 双地图展示（景点/美食打卡点）

### 3.2 分包页面 (subpackages/)

#### guide 子包（攻略）

| 页面 | 文件 | 职责 |
|------|------|------|
| `district-guide/` | 18.80KB | 区域攻略列表 |
| `guide-detail/` | 34.95KB | 攻略详情、店铺关联、路线规划入口 |
| `my-guides/` | 9.10KB | 用户创建的攻略列表 |

#### checkin 子包（打卡）

| 页面 | 文件 | 职责 |
|------|------|------|
| `checkin/` | 19.58KB | 拍照打卡、逆地理编码、AI描述生成 |
| `checkin-camera/` | 2.42KB | 拍照页面（相机/相册选择） |
| `checkin-detail/` | 8.10KB | 打卡详情展示 |

#### route 子包（路线）

| 页面 | 文件 | 职责 |
|------|------|------|
| `route/` | 36.66KB | 路线规划（贪心算法、双模式、导览导航） |
| `route-basic-edit/` | 13.50KB | 路线基础编辑 |
| `my-route/` | 64.15KB | 我的路线（最大页面） |

#### extra 子包（扩展功能）

| 页面 | 职责 |
|------|------|
| `spot-detail/` | 地点详情、收藏、导航 |
| `collection/` | 打卡记录列表展示 |
| `link-import/` | 链接导入页面 |
| `webview/` | 网页容器 |
| `my-favorites/` | 我的收藏列表 |

---

## 4. 自定义组件

### 4.1 custom-tabbar/

自定义底部导航栏组件，包含5个Tab：

| Tab | 路径 | 图标 |
|-----|------|------|
| 探索 | `/pages/index/index` | `tabbar-home.png` |
| 想去 | `/pages/wantgo/wantgo` | `tabbar-spots.png` |
| (中间+) | `/pages/route-entry/route-entry` | `tabbar-add.png` |
| 攻略 | `/pages/discover/discover` | `tabbar-discover.png` |
| 我的 | `/pages/my/my` | `tabbar-my.png` |

**关键方法：**
- `updateSelected()` - 根据当前路由更新选中状态
- `switchTab(e)` - 切换Tab页面（中间按钮特殊处理+旋转动画）

### 4.2 components/ 目录组件

| 组件 | 说明 |
|------|------|
| `route-map-preview-card/` | 路线地图预览卡片 (2.13KB) |
| `transport-info-sheet/` | 交通信息面板 (645B) |
| `travel-meta-line/` | 旅行元信息行 (302B) |

---

## 5. 工具模块

### 5.1 utils/util.js（核心工具库, 37.4KB）

| 函数 | 功能 |
|------|------|
| `getDistance()` | Haversine公式计算两点距离 |
| `planRoute()` | 贪心最近邻路线规划 |
| `formatDistance()` | 距离格式化显示 |
| `estimateTime()` | 出行时间估算 |
| `parseBlockBasedGuide()` | 攻略文本智能解析 |
| `openNavigation()` | 多地图导航选择 |
| `toggleLike()` / `isLiked()` | 想去/取消想去 |
| `toggleCollect()` / `isCollected()` | 收藏/取消收藏 |
| `saveData()` / `loadData()` | 本地存储读写 |

### 5.2 utils/placesData.js（地点数据, 11.56KB）

统一的地点数据管理模块，替代原来的 `shopData.js` 和 `spotData.js`：

| 导出项 | 说明 |
|--------|------|
| 统一的地点数据接口 | 覆盖美食店铺和景点数据 |

### 5.3 utils/checkinUtil.js（打卡工具, 12.17KB）

| 函数 | 功能 |
|------|------|
| `reverseGeocode()` | 坐标逆地理编码 |
| `saveCheckin()` | 保存打卡记录 |
| `getCheckins()` | 获取打卡列表 |
| `getCheckinStats()` | 获取打卡统计 |
| `generateDescription()` | AI生成诗意描述 |

### 5.4 地图相关工具

| 文件 | 功能 |
|------|------|
| `utils/map-config.js` | 地图配置（2.25KB） |
| `utils/map-preview.js` | 地图预览（4.16KB） |
| `utils/mapRouteFetcher.js` | 地图路线获取（10.42KB） |
| `utils/markerIcons.js` | 地图标记图标管理 |

### 5.5 路线相关工具

| 文件 | 功能 |
|------|------|
| `utils/routeHelper.js` | 路线辅助工具 (11.66KB) |
| `utils/route-import.js` | 路线导入 (10.15KB) |
| `utils/route-place-card.js` | 路线地点卡片 (3.09KB) |
| `utils/travel.js` | 旅行工具 (4.26KB) |
| `utils/trip-duration.js` | 行程时长 (1.68KB) |

### 5.6 其他工具

| 文件 | 功能 |
|------|------|
| `utils/cloudData.js` | 云端数据 (2.41KB) |
| `utils/displayCategory.js` | 分类展示 (859B) |
| `utils/guide-backfill.js` | 攻略回填 (3.31KB) |
| `utils/likedCheck.wxs` | WXS脚本-检查收藏状态 (625B) |

### 5.7 数据库访问层 (utils/db/)

| 文件 | 功能 |
|------|------|
| `client.js` | 数据库客户端初始化 |
| `base.js` | 基础数据库操作（CRUD） |
| `index.js` | DAL入口（集合名称常量，8个集合） |
| `users.js` | 用户数据访问 |
| `places.js` | 地点数据访问 |
| `routes.js` | 路线数据访问 |
| `wantList.js` | 想去清单数据 |
| `collectedList.js` | 收藏列表数据 |
| `checkinRecords.js` | 打卡记录数据 |
| `userAddedShops.js` | 用户添加店铺数据 |
| `syncManager.js` | 同步管理器 |
| `migration.js` | 数据迁移（localStorage → 云数据库） |
| `restore.js` | 数据恢复 |

### 5.8 子包内工具

| 文件 | 位置 | 功能 |
|------|------|------|
| `photoStorage.js` | checkin/utils/ | 照片存储 |
| `recognizePhoto.js` | checkin/utils/ | 照片识别 |
| `photoStorage.js` | extra/utils/ | 照片存储（与checkin共用） |
| `route-edit-behavior.js` | route/utils/ | 路线编辑行为 |
| `route-map-behavior.js` | route/utils/ | 路线地图行为 (14.48KB) |
| `route-nav-behavior.js` | route/utils/ | 路线导航行为 |
| `route-place-behavior.js` | route/utils/ | 路线地点行为 |
| `route-preview-behavior.js` | route/utils/ | 路线预览行为 |
| `routeHelper.js` | route/utils/ | 路线帮助工具 (3.58KB) |
| `my-route-edit-behavior.js` | route/utils/ | 我的路线编辑行为 |

---

## 6. 核心数据模型

### 6.1 店铺数据 (Shop)

```javascript
{
  id: Number,           // 唯一标识
  name: String,         // 店铺名称
  emoji: String,        // emoji图标
  rating: Number,        // 评分 (1-5)
  price: Number,         // 人均价格
  category: String,      // 分类 (粤菜/小吃/其他)
  tags: String[],        // 标签
  address: String,      // 详细地址
  lat: Number,          // 纬度
  lng: Number,           // 经度
  hours: String,        // 营业时间
  dishes: String[],     // 推荐菜
  phone: String,        // 联系电话
  logo: String,         // 封面图片
  checkInCount: Number, // 打卡次数
  wantCount: Number     // 想去的次数
}
```

### 6.2 景点数据 (Spot)

```javascript
{
  id: Number,           // 唯一标识
  name: String,         // 景点名称
  district: String,     // 所属区域
  category: String,     // 分类
  rating: Number,       // 评分
  tags: String[],       // 标签
  desc: String,         // 详细介绍
  address: String,      // 地址
  lat: Number,          // 纬度
  lng: Number,          // 经度
  image: String,        // 封面图
  free: Boolean,        // 是否免费
  openHours: String     // 开放时间
}
```

### 6.3 打卡记录 (Checkin)

```javascript
{
  id: String,           // 'CK' + 时间戳
  type: String,          // 'food' | 'spot'
  photoPath: String,     // 照片路径
  spotName: String,      // 地点名称
  address: String,       // 详细地址
  latitude: Number,      // 纬度
  longitude: Number,     // 经度
  description: String,   // AI生成的描述
  date: String,          // ISO日期字符串
  city: String           // 城市名
}
```

### 6.4 用户信息 (UserInfo)

```javascript
{
  uid: String,           // 'MS' + 36进制时间戳
  nickName: String,      // 昵称
  avatarUrl: String,     // 头像URL
  phone: String,         // 手机号
  level: String,         // 等级 'Lv.1 入门吃货'
  isVip: Boolean,        // 是否VIP
  visits: Number,        // 到访次数
  days: Number,          // 天数
  createdAt: String      // 创建时间
}
```

---

## 7. 关键函数说明

### 7.1 路线规划算法

**位置:** `utils/util.js` → `planRoute()`

```javascript
/**
 * 贪心最近邻路线规划算法
 * @param {Array} items - 地点数组
 * @param {Object} startPoint - 起点 {lat, lng}
 * @param {boolean} preserveOrder - true按原顺序，false贪心优化
 * @returns {Array} 排序后的地点数组
 */
function planRoute(items, startPoint, preserveOrder = false)
```

**算法逻辑：**
1. 从起点开始
2. 在剩余未访问地点中，选择距离最近的
3. 将该地点加入路线，以其为新起点
4. 重复步骤2-3直到所有地点访问完毕
5. 为每个地点注入 `distanceFromPrev` 属性

### 7.2 攻略文本解析

**位置:** `utils/util.js` → `parseBlockBasedGuide()`

```javascript
/**
 * 解析攻略文本（支持多种格式）
 * @param {string} text - 用户粘贴的攻略文本
 * @returns {Object} { foundShops: [], notFoundShops: [] }
 */
function parseBlockBasedGuide(text)
```

**解析策略：**
1. 按 ✅ 分隔文本块
2. 尝试按 📍 / 👏 / 👋 等emoji二次分隔
3. 提取每块中的：店名、地址、营业时间、推荐菜
4. 依次尝试：别名映射 → 关键词匹配 → 模糊匹配
5. 返回匹配成功和未匹配的店铺

### 7.3 距离计算

**位置:** `utils/util.js` → `getDistance()`

```javascript
function getDistance(lat1, lng1, lat2, lng2)
```
使用 Haversine 公式计算两点距离（米）。

### 7.4 导航功能

| 函数 | 导航方式 |
|------|----------|
| `openWechatNavigation()` | 微信内置地图 |
| `openGaodeNavigation()` | 高德地图APP |
| `openBaiduNavigation()` | 百度地图（实际代理到微信导航） |
| `openTencentNavigation()` | 腾讯地图（实际代理到微信导航） |
| `openDirectNavigation()` | 微信导航 + 出行方式选择 |
| `openNavigation()` | 多地图选择器 |

### 7.5 打卡采集流程

```javascript
// 1. 获取定位
wx.getLocation({ type: 'gcj02' })

// 2. 逆地理编码获取地点信息
checkinUtil.reverseGeocode(latitude, longitude)

// 3. 拍照获取照片
wx.chooseImage({ count: 1, sourceType: ['camera', 'album'] })

// 4. 保存打卡记录
checkinUtil.saveCheckin({
  type: 'food',
  photoPath: tempFilePath,
  latitude, longitude,
  spotName, address
})
```

---

## 8. 页面导航与路由

### 8.1 TabBar页面

| Tab | 路径 |
|-----|------|
| 探索 | `/pages/index/index` |
| 想去 | `/pages/wantgo/wantgo` |
| 中间入口 | `/pages/route-entry/route-entry` |
| 攻略 | `/pages/discover/discover` |
| 我的 | `/pages/my/my` |

### 8.2 路由参数约定

| 页面 | 参数格式 | 示例 |
|------|----------|------|
| spot-detail | `?id=数字` | `subpackages/extra/pages/spot-detail/spot-detail?id=101` |
| route | `?type=food\|spot\|plan&ids=1,2,3` | `subpackages/route/pages/route/route?type=food&ids=1,2,3` |
| guide-detail | `?guide=URL编码JSON` | `subpackages/guide/pages/guide-detail/guide-detail?guide=...` |
| district-guide | `?district=id&name=名称` | `subpackages/guide/pages/district-guide/district-guide?district=nanshan&name=南山区` |

### 8.3 预加载规则

| 触发页面 | 预加载子包 |
|----------|-----------|
| `my` | `checkin` 子包 |
| `route-entry` | `checkin` 子包 |
| `discover` | `guide` 子包 |
| `wantgo` | `route` 子包 |

---

## 9. 依赖关系

### 9.1 内部依赖图

```
app.js (全局入口)
├── utils/util.js (核心工具)
│   ├── utils/placesData.js
│   ├── utils/markerIcons.js
│   └── utils/db/* (DAL层)
├── utils/checkinUtil.js
├── utils/cloudData.js
├── custom-tabbar/index.js
└── pages/* (所有页面)

pages/index/index.js
├── app.js (全局状态)
├── utils/placesData.js
├── utils/util.js
└── utils/markerIcons.js

pages/my/my.js
├── app.js
├── utils/util.js
├── utils/checkinUtil.js
└── utils/db/*
```

### 9.2 npm依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| miniprogram-ci | ^2.1.31 | 小程序自动化构建/发布 |
| jest | ^29.7.0 | 单元测试框架 |

---

## 10. 外部服务与API

### 10.1 腾讯地图服务

| 功能 | API端点 |
|------|---------|
| 逆地理编码 | `https://apis.map.qq.com/ws/geocoder/v1/` |
| 静态地图 | `https://apis.map.qq.com/ws/staticmap/v2` |
| 路径规划 | `https://apis.map.qq.com/ws/direction/v1/` |

### 10.2 腾讯天气服务

| 功能 | API端点 |
|------|---------|
| 实时天气 | `https://apis.map.qq.com/ws/weather/v1/` |

### 10.3 百度地图服务

| 功能 | 用途 |
|------|------|
| 全景静态图 | 地点详情页全景展示 (`getBaiduPanoramaUrl`) |

### 10.4 微信云开发

| 配置 | 值 |
|------|-----|
| 环境ID | cloud1-9grc0ja0405b042a |
| SDK | wx.cloud.init() |

### 10.5 云函数列表

| 云函数 | 说明 |
|--------|------|
| `login/` | 用户登录（获取openid，创建/更新用户记录） |
| `extractRouteFromLink/` | 从链接提取路线信息 (8.91KB) |
| `recognizePhoto/` | 照片识别云函数 (6.71KB) |
| `getUserInfo/` | 获取用户信息 |
| `parsePhotoGPS/` | 解析照片GPS信息 |
| `parseXiaohongshu/` | 解析小红书内容 |

### 10.6 高德地图小程序

| 字段 | 值 |
|------|-----|
| AppId | wxbfe0acb99cce0a56 |
| 用途 | 调起高德地图导航 |

---

## 11. 本地存储结构

### 11.1 存储Key一览

| Key | 数据类型 | 说明 |
|-----|----------|------|
| `userInfo` | Object | 用户登录信息 |
| `userWantFoods` | String[] | 美食想去ID列表 |
| `userWantSpots` | String[] | 景点想去ID列表 |
| `userCollectedFoods` | String[] | 美食收藏ID列表 |
| `userCollectedSpots` | String[] | 景点收藏ID列表 |
| `userCheckedIn` | String[] | 到访打卡ID列表 |
| `checkin_records` | Object[] | 打卡采集记录 |
| `userAddedShops` | Object[] | 用户添加的店铺 |
| `savedRoutes` | Object[] | 保存的路线 |
| `myGuides` | Object[] | 用户创建的攻略 |

### 11.2 云数据库集合

| 集合名 | 说明 | 状态 |
|--------|------|------|
| `users` | 用户账户表 | 已创建 |
| `places` | 地点数据 | 已创建 |
| `routes` | 路线数据 | 已创建 |
| `wantList` | 想去清单 | 已创建 |
| `collectedList` | 收藏列表 | 已创建 |
| `checkinRecords` | 打卡记录 | 已创建 |
| `userAddedShops` | 用户添加店铺 | 已创建 |
| `guides` | 攻略数据 | 已创建 |

### 11.3 数据迁移状态

项目正在从 localStorage 向微信云数据库迁移。`utils/db/migration.js` 负责将本地数据迁移到云端。

---

## 12. 运行与部署

### 12.1 环境要求

- 微信开发者工具 (最新版本)
- Node.js (用于 npm ci 安装依赖)
- 微信小程序AppID: `wxd63e0f59de062cd9`
- 基础库版本: 3.15.1+

### 12.2 本地运行步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd yummy
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **导入项目**
   - 打开微信开发者工具
   - 新建项目 → 选择本项目目录 → 填入AppID

4. **配置云开发**（如需要）
   - 开通云开发，创建云环境
   - 更新 `app.js` 中的 `env` 配置

5. **编译运行**
   - 点击「编译」按钮
   - 使用「真机调试」测试完整功能

### 12.3 关键常量

| 常量 | 值 | 说明 |
|------|-----|------|
| 默认中心纬度 | 22.4846 | 蛇口区域 |
| 默认中心经度 | 113.9046 | 蛇口区域 |
| 地图缩放级别 | 15 | 默认 |
| TabBar高度 | 50px | |
| 主色 | #47BFFE | 清新浅蓝 |

### 12.4 全局设计系统 (app.wxss)

CSS变量设计系统包含：
- **主色**: `--primary: #47BFFE` (清新浅蓝)
- **中性色**: 6级文字颜色层级
- **功能色**: success / warning / danger / info
- **间距系统**: xs ~ 3xl (8rpx ~ 128rpx)
- **圆角系统**: sm ~ full (12rpx ~ 9999rpx)
- **字体层级**: display, heading-1/2/3, body, body-sm, caption
- **扁平化设计**: 所有阴影设为 `none`

---

## 附录

### A. 错误处理约定

| 场景 | 处理方式 |
|------|----------|
| 定位失败 | 使用蛇口默认坐标 |
| API请求失败 | 静默失败，保持默认状态 |
| 数据加载失败 | 显示Toast提示 |
| 存储读写失败 | 打印日志，不影响流程 |

### B. config/ 配置

| 文件 | 说明 |
|------|------|
| `config/cover-pool.js` | 默认封面图池（5张美食封面 + 5张景点封面，来自腾讯COS + 高德） |

---

*本文档由代码分析自动生成，最后更新于 2026-06-26*
