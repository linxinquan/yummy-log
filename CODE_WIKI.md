# 觅食图 / Me Tour - Code Wiki

> 深圳蛇口美食探店地图 · 微信小程序代码文档
> 版本: V1.0.2 | 更新日期: 2026-04-01

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [模块职责](#3-模块职责)
4. [核心数据模型](#4-核心数据模型)
5. [关键函数说明](#5-关键函数说明)
6. [页面导航与路由](#6-页面导航与路由)
7. [依赖关系](#7-依赖关系)
8. [外部服务与API](#8-外部服务与api)
9. [本地存储结构](#9-本地存储结构)
10. [运行与部署](#10-运行与部署)

---

## 1. 项目概述

**觅食图**是一款面向深圳蛇口地区的美食探店小程序，提供地图浏览、店铺搜索、想去清单、路线规划、攻略导入、打卡采集等核心功能。

### 1.1 技术栈

| 类别 | 技术选型 |
|------|----------|
| 框架 | 微信小程序原生框架 |
| 地图 | 微信 Map 组件 + 腾讯地图 API |
| 云服务 | 微信云开发 (CloudBase) |
| 数据存储 | localStorage |
| 样式 | WXSS + Design System |
| 构建 | 微信开发者工具 |

### 1.2 项目结构

```
yummy-log/
├── app.js                    # 小程序入口
├── app.json                  # 全局配置
├── app.wxss                  # 全局样式
├── pages/                    # 页面目录
│   ├── index/               # 探索页（地图 + 店铺列表）
│   ├── wantgo/              # 想去清单页
│   ├── discover/            # 攻略发现页
│   ├── my/                  # 个人中心页
│   ├── shop-detail/         # 店铺详情页
│   ├── spot-detail/         # 景点详情页
│   ├── route/               # 路线规划页
│   ├── add-shop/            # 添加店铺页
│   ├── checkin/             # 打卡采集页
│   ├── collection/          # 采集记录页
│   ├── my-favorites/       # 我的收藏页
│   ├── my-guides/           # 我的攻略页
│   ├── my-route/            # 我的路线页
│   ├── district-guide/      # 区域攻略页
│   ├── guide-detail/        # 攻略详情页
│   ├── route-basic-edit/    # 路线基础编辑页
│   └── webview/             # 网页容器页
├── custom-tabbar/           # 自定义底部导航
├── utils/                   # 工具函数
├── cloud/                   # 云函数
├── design-system/           # 设计系统文档
└── images/                  # 静态资源
```

---

## 2. 技术架构

### 2.1 应用架构

```
┌─────────────────────────────────────────────────────────┐
│                      表现层 (UI)                        │
│  pages/  ·  custom-tabbar/  ·  images/  ·  styles/     │
├─────────────────────────────────────────────────────────┤
│                      业务逻辑层                          │
│  app.js (全局状态)  ·  各页面 .js (Page 逻辑)          │
├─────────────────────────────────────────────────────────┤
│                      数据服务层                          │
│  utils/util.js  ·  utils/checkinUtil.js              │
├─────────────────────────────────────────────────────────┤
│                      数据持久层                          │
│  localStorage  ·  微信云开发 (CloudBase)                │
├─────────────────────────────────────────────────────────┤
│                      外部服务层                          │
│  腾讯地图 API  ·  百度地图 API  ·  和风天气 API          │
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
    districtInfo: {},          // 行政区划信息 {city, district}
    centerLocation: {},        // 默认中心坐标 (蛇口)
    qqMapKey: '',              // 腾讯地图 Key
    baiduMapKey: '',          // 百度地图 Key
    locationDesc: ''          // 位置描述
  }
})
```

### 2.3 回调机制

提供两个关键的异步等待机制：

| 方法 | 用途 |
|------|------|
| `whenLocationReady(callback)` | 等待定位完成后执行回调 |
| `whenDistrictReady(callback)` | 等待区划信息获取完成后执行回调 |

---

## 3. 模块职责

### 3.1 页面模块

#### 探索页 (pages/index/)

| 文件 | 职责 |
|------|------|
| `index.js` | 地图展示、店铺/景点列表、分类筛选、想去功能 |
| `index.wxml` | 地图组件、底部抽屉、店铺卡片 |
| `discover.wxs` | WXS 脚本（过滤器、格式化） |

**核心功能：**
- 地图 + 底部抽屉双视图
- 美食/景点/酒店/饮品等分类筛选
- 距离/评分排序
- 广东21城市切换
- 想去/取消想去
- 位置选择器

#### 想去清单页 (pages/wantgo/)

| 文件 | 职责 |
|------|------|
| `wantgo.js` | 想去/路线/足迹三Tab、拖拽排序 |

**核心功能：**
- 想去清单（支持拖拽排序）
- 路线规划入口
- 到访足迹展示
- 项目移除

#### 路线规划页 (pages/route/)

| 文件 | 职责 |
|------|------|
| `route.js` | 贪心最近邻算法、双模式、导览导航 |

**核心功能：**
- 贪心最近邻路线优化
- 起点/终点自定义选择
- 出行方式切换（驾车/步行/公交）
- 全选/自选店铺
- 导览模式（逐步导航）
- 地图可视化

#### 店铺详情页 (pages/shop-detail/)

| 文件 | 职责 |
|------|------|
| `shop-detail.js` | 店铺信息展示、收藏、导航、电话拨打 |

**核心功能：**
- 店铺基础信息（评分/价格/营业时间）
- 推荐菜品展示
- 微信内置地图导航
- 电话拨打
- 收藏功能

#### 景点详情页 (pages/spot-detail/)

| 文件 | 职责 |
|------|------|
| `spot-detail.js` | 景点信息展示、收藏、导航、简介 |

**核心功能：**
- 景点介绍与标签
- 开放时间/门票信息
- 全景图展示
- 想去/收藏

#### 个人中心页 (pages/my/)

| 文件 | 职责 |
|------|------|
| `my.js` | 用户登录、数据统计、打卡地图、天气展示 |

**核心功能：**
- 快速登录（生成默认账号）
- 想去/足迹/添加店铺统计
- 打卡采集入口
- 双地图展示（景点/美食打卡点）
- 和风天气获取

#### 打卡采集页 (pages/checkin/)

| 文件 | 职责 |
|------|------|
| `checkin.js` | 拍照打卡、逆地理编码、AI描述生成 |

**核心功能：**
- 拍照或相册选择
- 腾讯地图逆地理编码
- AI诗意描述生成
- 打卡记录保存

#### 攻略页 (pages/discover/)

| 文件 | 职责 |
|------|------|
| `discover.js` | 攻略列表、区域分类、攻略导入 |

**核心功能：**
- 区域筛选（福田/南山/罗湖等）
- 精选攻略展示
- 小红书/大众点评攻略文本解析

#### 攻略详情页 (pages/guide-detail/)

| 文件 | 职责 |
|------|------|
| `guide-detail.js` | 攻略内容展示、店铺关联 |

**核心功能：**
- 攻略详情展示
- 店铺跳转
- 路线规划入口

#### 添加店铺页 (pages/add-shop/)

| 文件 | 职责 |
|------|------|
| `add-shop.js` | 用户添加新店铺 |

**核心功能：**
- 店铺基本信息录入
- 坐标拾取
- 图片上传

#### 其他页面

| 页面 | 职责 |
|------|------|
| `collection/` | 打卡记录列表展示 |
| `my-favorites/` | 收藏店铺列表 |
| `my-guides/` | 用户创建的攻略列表 |
| `my-route/` | 保存的路线列表 |
| `district-guide/` | 区域攻略列表 |
| `route-basic-edit/` | 路线基础编辑 |
| `webview/` | 网页容器 |

### 3.2 自定义组件

#### custom-tabbar/

自定义底部导航栏组件，包含5个Tab：

| Tab | 路径 | 图标 |
|-----|------|------|
| 探索 | `/pages/index/index` | 地图图标 |
| 想去 | `/pages/wantgo/wantgo` | 收藏图标 |
| 添加 | `/pages/add-shop/add-shop` | 十字图标 |
| 攻略 | `/pages/discover/discover` | 书本图标 |
| 我的 | `/pages/my/my` | 用户图标 |

**关键方法：**
- `updateSelected()` - 根据当前路由更新选中状态
- `switchTab(e)` - 切换Tab页面

### 3.3 工具模块

#### utils/util.js

核心工具函数库，包含：

| 函数 | 功能 |
|------|------|
| `getDistance()` | Haversine公式计算两点距离 |
| `planRoute()` | 贪心最近邻路线规划 |
| `formatDistance()` | 距离格式化显示 |
| `estimateTime()` | 出行时间估算 |
| `parseBlockBasedGuide()` | 攻略文本智能解析 |
| `openNavigation()` | 多地图导航选择 |
| `toggleLike()` | 想去/取消想去 |
| `toggleCollect()` | 收藏/取消收藏 |
| `saveData()` / `loadData()` | 本地存储读写 |
| `getSpotData()` | 获取景点数据 |
| `getNearbySpots()` | 获取附近景点 |

#### utils/checkinUtil.js

打卡采集专用工具：

| 函数 | 功能 |
|------|------|
| `reverseGeocode()` | 坐标逆地理编码 |
| `saveCheckin()` | 保存打卡记录 |
| `getCheckins()` | 获取打卡列表 |
| `getCheckinStats()` | 获取打卡统计 |
| `generateDescription()` | AI生成诗意描述 |

#### utils/markerIcons.js

地图标记图标管理：

| 函数 | 功能 |
|------|------|
| `getIconPath()` | 获取分类图标路径 |
| `getCategoryColor()` | 获取分类主色调 |
| `getCategoryEmoji()` | 获取分类emoji |
| `ensureIcons()` | 确保图标资源就绪 |

#### utils/shopData.js

美食店铺数据模块：

| 导出项 | 说明 |
|--------|------|
| `shops` | 蛇口地区24家美食店铺 |
| `foods` | 深圳全市65家美食店铺 |
| `shopNameMap` | 店铺别名映射表 |
| `startPoints` | 起点选项列表 |
| `categories` | 美食分类列表 |

#### utils/spotData.js

景点数据模块：

| 导出项 | 说明 |
|--------|------|
| `spotData` | 深圳58个景点数据，覆盖10个行政区 |

---

## 4. 核心数据模型

### 4.1 店铺数据 (Shop)

```javascript
{
  id: Number,           // 唯一标识
  name: String,         // 店铺名称
  emoji: String,        // emoji图标
  rating: Number,        // 评分 (1-5)
  price: Number,         // 人均价格
  category: String,      // 分类 (粤菜/小吃/其他)
  tags: String[],        // 标签 ['老字号', '糖水', '蛇口']
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

### 4.2 景点数据 (Spot)

```javascript
{
  id: Number,           // 唯一标识
  name: String,         // 景点名称
  district: String,     // 所属区域
  category: String,     // 分类 (公园/海滨/山景/展馆等)
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

### 4.3 打卡记录 (Checkin)

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

### 4.4 用户信息 (UserInfo)

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

## 5. 关键函数说明

### 5.1 路线规划算法

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

### 5.2 攻略文本解析

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

### 5.3 距离计算

**位置:** `utils/util.js` → `getDistance()`

```javascript
/**
 * 计算两点之间的距离（米）
 * 使用 Haversine 公式
 */
function getDistance(lat1, lng1, lat2, lng2)
```

### 5.4 导航功能

| 函数 | 导航方式 |
|------|----------|
| `openWechatNavigation()` | 微信内置地图 |
| `openGaodeNavigation()` | 高德地图APP |
| `openBaiduNavigation()` | 百度地图 |
| `openDirectNavigation()` | 微信导航 + 出行方式选择 |
| `openNavigation()` | 多地图选择器 |

### 5.5 想去/收藏功能

```javascript
// 想去功能
toggleLike(id, type = 'food')  // type: 'food' | 'spot'
isLiked(id, type = 'food')

// 收藏功能
toggleCollect(id, type = 'food')
isCollected(id, type = 'food')

// 存储key
// 'userWantFoods' - 美食想去ID列表
// 'userWantSpots' - 景点想去ID列表
// 'userCollectedFoods' - 美食收藏ID列表
// 'userCollectedSpots' - 景点收藏ID列表
```

### 5.6 打卡采集流程

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

## 6. 页面导航与路由

### 6.1 路由参数约定

| 页面 | 参数格式 | 示例 |
|------|----------|------|
| shop-detail | `?shopData=URL编码JSON` 或 `?id=数字` | `/shop-detail?shopData=%7B%22id%22%3A1%7D` |
| spot-detail | `?id=数字` | `/spot-detail?id=101` |
| route | `?type=food\|spot\|plan&ids=1,2,3` | `/route?type=food&ids=1,2,3` |
| guide-detail | `?guide=URL编码JSON` | `/guide-detail?guide=%7B%22id%22%3A1%7D` |
| district-guide | `?district=id&name=名称` | `/district-guide?district=nanshan&name=南山区` |

### 6.2 TabBar页面

必须在 `app.json` 的 `tabBar.list` 中注册：

```
pages/index/index      → 探索
pages/wantgo/wantgo    → 想去
pages/add-shop/add-shop → 添加
pages/discover/discover → 攻略
pages/my/my            → 我的
```

### 6.3 页面间跳转方式

| 场景 | 方法 |
|------|------|
| Tab间跳转 | `wx.switchTab()` |
| 非Tab跳转 | `wx.navigateTo()` |
| 刷新当前页 | `wx.redirectTo()` |
| 返回 | `wx.navigateBack()` |

---

## 7. 依赖关系

### 7.1 内部依赖图

```
app.js (全局入口)
├── utils/util.js (核心工具)
│   ├── utils/shopData.js
│   ├── utils/spotData.js
│   └── utils/markerIcons.js
├── utils/checkinUtil.js
├── custom-tabbar/index.js
└── pages/* (所有页面)

pages/index/index.js
├── app.js (全局状态)
├── utils/shopData.js
├── utils/spotData.js
├── utils/util.js
└── utils/markerIcons.js

pages/route/route.js
├── app.js
├── utils/shopData.js
└── utils/util.js

pages/my/my.js
├── app.js
├── utils/shopData.js
├── utils/util.js
└── utils/checkinUtil.js
```

### 7.2 npm依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| miniprogram-ci | ^2.1.31 | 小程序自动化构建/发布 |

---

## 8. 外部服务与API

### 8.1 腾讯地图服务

| 功能 | API端点 | Key |
|------|---------|-----|
| 逆地理编码 | `https://apis.map.qq.com/ws/geocoder/v1/` | YLBBZ-VLNWJ-HFSFO-5QBUJ-SJ633-CTBFF |
| 静态地图 | `https://apis.map.qq.com/ws/staticmap/v2` | YLOBZ-VDFWB-AMSUJ-JCOQQ-GJ633-CTBR5 |
| 打卡逆地理 | `https://apis.map.qq.com/ws/geocoder/v1/` | SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG |

### 8.2 百度地图服务

| 功能 | 用途 | Key |
|------|------|-----|
| 全景静态图 | 店铺详情页全景展示 | KuGlOjdoC0kmGUbU1Tw2OQyK6LKQ6gGa |

### 8.3 和风天气API

| 功能 | 端点 | Key |
|------|------|-----|
| 实时天气 | `https://devapi.qweather.com/v7/weather/now` | 6e62e8e03d5e4e7ebc4e95e9e7e0a5e5 |

### 8.4 微信云开发

| 配置 | 值 |
|------|-----|
| 环境ID | cloud1-9grc0ja0405b042a |
| SDK | wx.cloud.init() |

### 8.5 高德地图小程序

| 字段 | 值 |
|------|-----|
| AppId | wxbfe0acb99cce0a56 |
| 用途 | 调起高德地图导航 |

---

## 9. 本地存储结构

### 9.1 存储Key一览

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

### 9.2 打卡记录存储结构

```javascript
// key: 'checkin_records'
[
  {
    id: 'CK1ABCDEF',          // 唯一ID
    type: 'food',             // 'food' | 'spot'
    photoPath: '/xxx.jpg',    // 照片路径
    spotName: '百草堂糖水',   // 地点名
    address: '南山区蛇口街道渔村路43号',
    latitude: 22.4862,
    longitude: 113.9021,
    description: '清晨路过百草堂糖水...',
    date: '2026-04-01T10:30:00.000Z',
    city: '深圳'
  },
  // ...更多记录
]
```

---

## 10. 运行与部署

### 10.1 环境要求

- 微信开发者工具 (最新版本)
- Node.js (用于 npm ci 安装依赖)
- 微信小程序AppID

### 10.2 本地运行步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd yummy-log
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置AppID**
   - 打开 `project.config.json`
   - 设置 `appid` 为你的小程序AppID

4. **导入项目**
   - 打开微信开发者工具
   - 新建项目 → 选择本项目目录 → 填入AppID

5. **配置云开发**（可选）
   - 在微信开发者工具中开通云开发
   - 创建云环境
   - 更新 `app.js` 中的 `env` 配置

6. **编译运行**
   - 点击「编译」按钮
   - 使用「真机调试」测试完整功能

### 10.3 地图Key配置

在 `app.js` 中配置：

```javascript
globalData: {
  qqMapKey: 'YOUR_QQMAP_KEY',      // 腾讯地图Key
  baiduMapKey: 'YOUR_BAIDU_KEY',   // 百度地图Key
}
```

申请地址：
- [腾讯位置服务](https://lbs.qq.com/)
- [百度地图开放平台](https://lbsyun.baidu.com/)

### 10.4 自动化构建

使用 `miniprogram-ci` 进行自动化构建：

```bash
# 查看可用命令
npm run

# 或直接调用
npx miniprogram-ci
```

---

## 附录

### A. 设计系统概要

详见 `design-system/` 目录下的文档：

| 文件 | 内容 |
|------|------|
| `00-meta.md` | 设计原则与约束 |
| `01-tokens.md` | 设计令牌（颜色/字体/间距） |
| `02-components.md` | 组件库定义 |
| `03-patterns.md` | 交互模式 |
| `04-responsive.md` | 响应式规范 |
| `05-dos-donts.md` | 设计禁忌 |

### B. 关键常量

| 常量 | 值 | 说明 |
|------|-----|------|
| 默认中心纬度 | 22.4846 | 蛇口区域 |
| 默认中心经度 | 113.9046 | 蛇口区域 |
| 地图缩放级别 | 15 | 默认 |
| 标记图标大小 | 28px | PNG |
| TabBar高度 | 50px | |

### C. 错误处理约定

| 场景 | 处理方式 |
|------|----------|
| 定位失败 | 使用蛇口默认坐标 |
| API请求失败 | 静默失败，保持默认状态 |
| 数据加载失败 | 显示Toast提示 |
| 存储读写失败 | 打印日志，不影响流程 |

---

*本文档由代码分析自动生成，最后更新于 2026-05-08*
