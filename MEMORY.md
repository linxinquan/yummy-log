# 觅食图 - 项目上下文

## 基本信息
- **项目**：觅食图（me tour），微信小程序
- **目录**：`f:/美食地图APP/觅食图-小程序/`
- **AppID**：`wxd63e0f59de062cd9`
- **技术栈**：微信小程序原生 + 腾讯地图API + 腾讯云COS

## 技术规范

### 腾讯云COS（图片托管）
- 存储桶：`metour-1322296918`（广州，公有读私有写）
- 域名：`https://metour-1322296918.cos.ap-guangzhou.myqcloud.com`
- 路径格式：`images/foods/店名.jpg` → URL编码后访问
- 代码引用：`utils/foodData.js`、`utils/spotData.js`

### 腾讯地图API Keys
- 主力Key：`SWGBZ-7P2CB-LK2UO-JZYYV-6BZYQ-KEBUG`
- 静态图Key：`YLOBZ-VDFWB-AMSUJ-JCOQQ-GJ633-CTBR5`

### 坐标字段兼容
- V1店铺：`lat/lng`
- V2美食/景点：`latitude/longitude`
- 代码统一用 `shop.lat || shop.latitude`

### app.json 关键配置
```json
{
  "lazyCodeLoading": "requiredComponents",
  "requiredPrivateInfos": ["getLocation", "chooseLocation"]
}
```

## 数据

| 数据文件 | 内容 | 主键 |
|---|---|---|
| `utils/foodData.js` | 65家美食，ID 101-165，10个行政区 | `id` |
| `utils/spotData.js` | 66个景点，ID 101-238 | `id` |
| `utils/shopData.js` | 24家V1店铺，ID 1-24 | `id` |

## UI设计
- 主色 `#00D9C0`、深 `#00B5A6`、浅 `#E8FAF8`
- 背景 `#F0F9F8`、强调色 `#FF8B7E`、星星 `#FFB800`

## 打卡页面定位逻辑（2026-04-17 重构 ✅）

### 问题
- 原逻辑直接调 `wx.getLocation`，被拒后静默失败，用户不知道去哪开权限
- 无手动兜底，GPS 信号弱或室内时直接卡死

### 新定位架构（`pages/checkin/checkin.js`）
```
onGetLocation()
  └→ wx.getSetting() 权限检查
       ├── 已拒绝 → 弹窗引导去设置页 → 重试 or 手动选
       └── 未决定/已授权 → _doAutoLocation()
              └→ wx.getLocation → 逆地理(腾讯API) → 更新UI
                   ├── 失败 → _fallbackToChooseLocation()
                            └→ wx.chooseLocation() → 用户手动选地图
                                 ├── 选了 → 直接用选择结果
                                 └── 取消 → 用模糊名称，允许继续
```

### 新增函数
- `_doAutoLocation(clearTimer)`：自动定位 + 逆地理
- `_fallbackToChooseLocation()`：手动选地图兜底
- `onManualLocation()`：UI按钮触发手动选位置

### WXML 新增
- 手动定位入口（`manual-locate`，虚线边框，定位失败时可见）
- 修复：删除多余 `</view>` 闭合标签

### 待真机验证
- 权限被拒 → 弹窗引导去设置流程
- GPS 信号弱 → 自动触发手动选位置
- chooseLocation 正常返回数据 → 地址显示正确

## 快速参考
- **攻略导入**：`✅店名 📍地址 ⏰时间 👏推荐菜` 块格式
- **路线规划**：贪心最近邻算法，活跃版在 `pages/route/route`
- **打卡采集**：本地存储，`checkin_records` 为统一存储 key，入口在"我的"页面（`pages/checkin/checkin`）
- **待办/决策**：见 `decisions/` 和 `tasks/` 目录

## CloudBase 混元 AI 接入（✅ 已完成）

### 环境信息
- **云开发环境名称**：`cloud1-9grc0ja0405b042a`
- **微信云开发控制台**：https://cloud.weixin.qq.com
- **腾讯云 SCF 控制台**：https://console.cloud.tencent.com/scf（非同一系统，不能混用）

### 项目关键配置（已更新）
| 文件 | 关键内容 |
|------|---------|
| `project.config.json` | `"cloudfunctionRoot": "cloud/"` + `"envId": "cloud1-9grc0ja0405b042a"` |
| `cloudbaserc.json` | `"envId": "cloud1-9grc0ja0405b042a"`（在根目录，非 cloud/ 内） |
| `app.js` | `wx.cloud.init({ env: 'cloud1-9grc0ja0405b042a', traceUser: true })` |

### 云函数目录结构（❗ 踩坑核心）
```
觅食图-小程序/               ← 项目根目录
├── project.config.json      ← 关键：cloudfunctionRoot + envId
├── cloudbaserc.json         ← 在根目录，不在 cloud/ 内
└── cloud/                   ← cloudfunctionRoot 指向这里（直接放函数）
      └── generateAICheckin/  ← 每个云函数一个文件夹（不要套 functions/）
            ├── index.js
            └── package.json
```

### 踩坑记录（❗❗❗）
1. **目录层级错误**：最初把函数放在 `cloud/functions/generateAICheckin/` → 上传后报 ResourceNotFound.Function
   - 原因：`cloudfunctionRoot: "cloud/"` 意味着函数必须直接在 `cloud/` 下，不支持多层嵌套
   - 解决：移到 `cloud/generateAICheckin/`

2. **缺少 envId**：只配置了 `cloudfunctionRoot` 但没配 `envId`，开发者工具上传到错误/默认环境
   - 解决：在 `project.config.json` 添加 `"envId": "cloud1-9grc0ja0405b042a"`

3. **npm 不存在**：微信开发者工具终端报错"无法识别 npm"
   - 解决：不需要本地 npm，用「上传并部署：云端安装依赖」由云端自动安装

4. **微信/腾讯云控制台分离**：微信云开发的云函数 ≠ 腾讯云 SCF 云函数，是两套独立系统
   - 上传/管理：用微信开发者工具
   - 查看：微信云开发控制台 https://cloud.weixin.qq.com
   - 腾讯云 SCF 控制台 https://console.cloud.tencent.com/scf 看不到微信云函数

5. **重复创建导致混乱**：在微信云开发控制台和本地同时创建了 `functions` 和 `generateAICheckin`，导致列表混乱
   - 解决：统一用本地项目管理，右键部署

### 已完成代码修改
| 文件 | 改动内容 |
|------|---------|
| `project.config.json` | 新增 `"envId": "cloud1-9grc0ja0405b042a"` |
| `cloud/generateAICheckin/index.js` | **新建** 混元云函数：生成标题+故事感描述（微信云开发标准写法） |
| `cloud/generateAICheckin/package.json` | **新建**，依赖 `wx-server-sdk ~2.6.3` |
| `pages/checkin/checkin.js` | v1: AI打卡生成 + 打字机效果；v2: **定位逻辑完全重构**（三层保障 + chooseLocation兜底） |
| `pages/checkin/checkin.wxml` | v1: AI标题卡片、打字光标动画；v2: **手动定位入口按钮**，修复多余 `</view>` |
| `pages/checkin/checkin.wxss` | v1: `.ai-title-card` / `.cursor-blink`；v2: **`.manual-locate` 手动选择按钮样式** |
| `pages/discover/discover.js` | 新增 `_buildRecommendation()` 规则引擎推荐 |
| `pages/discover/discover.wxml` | 新增 AI 个性化推荐卡片 |
| `pages/discover/discover.wxss` | 新增 `.ai-recommend-card` 样式 |

### 云函数逻辑（generateAICheckin）
- **入口**：`exports.main = async (event, context) =>`
- **依赖**：wx-server-sdk ~2.6.3（云端自动安装）
- **调用方式**：`cloud.cloud.ai.model.generateText()`
- **模型**：`hunyuan-2.0-instruct-20251111`
- **入参**：`{ spotName, address, type ('food'|'spot'), city, region }`
- **返回**：`{ success, title, description }`
- **兜底**：失败时返回预设文案（按时间段/美食/景点类型随机选取）

### 前端调用链路
```
用户点击"生成"
  → onGenerate()
    → _generateAIContent()  [wx.cloud.callFunction: name='generateAICheckin']
      → 云函数调用混元 AI
        → _typewriterEffect()  [打字机动画展示]
          → _getFallbackContent()  [AI 失败兜底]
```

### discover.js 个性化推荐规则
- 新用户（<3次打卡）：引导探索南山区
- 美食型用户（foodCount > spotCount）：推荐景点
- 景点型用户：推荐美食
- 时段感知：早/午/下午茶/晚餐/夜宵 推荐不同类型

## 文档
- `PRD-觅食图.md` - 产品需求文档（V2.0）

## 路线页面地图优化（2026-04-22）

### 问题背景
- 切换出行方式（驾车/步行/公交）时，地图路线不更新，只更新了时间
- 路线规划使用直线连接，不够真实

### 技术方案

#### 1. 腾讯地图路径规划 API 接入
- **驾车**：`ws/direction/v1/driving/`，支持 `waypoints` 途经点（最多30个）
- **步行**：`ws/direction/v1/walking/`，**不支持途经点**
- **公交**：`ws/direction/v1/transit/`，**不支持途经点**

#### 2. 不同出行方式的处理策略

| 出行方式 | 处理方式 | 请求间隔 |
|---------|---------|---------|
| 驾车 | 单次请求，使用 `waypoints` 参数传递所有途经点 | - |
| 步行/公交 | 分段串行请求（起点→店铺1→店铺2→...→终点）| 1100ms |

#### 3. 关键代码结构（`pages/route/route.js`）
```javascript
// 主入口：根据出行方式分发
_fetchRealRoute(allPoints, routeColor, markers, startPoint, routeShops) {
  if (mode === 'driving' && effectivePoints.length > 2) {
    this._fetchDrivingRoute(...)  // 驾车：单次请求
  } else {
    this._fetchSegmentedRoute(...) // 步行/公交：分段请求
  }
}

// 分段请求实现
_fetchSegmentedRoute(segments, ...) {
  // 串行请求，每段间隔 1100ms 避免限流
  // 相邻段去重连接点
}
```

#### 4. Polyline 坐标解析（腾讯地图特殊格式）
```javascript
_parsePolyline(polyline) {
  // 第一个点：绝对坐标（度）
  // 后续点：相对增量（百万分之一度），需除以 1,000,000
  if (i === 0) {
    points.push({ latitude: polyline[i], longitude: polyline[i+1] })
  } else {
    points.push({
      latitude: prev.latitude + polyline[i] / 1000000,
      longitude: prev.longitude + polyline[i+1] / 1000000
    })
  }
}
```

#### 5. 出行方式颜色区分
| 方式 | 颜色 |
|-----|------|
| 驾车 | `#4A90D9` 蓝色 |
| 公交 | `#9B59B6` 紫色 |
| 步行 | `#27AE60` 绿色 |

#### 6. 终点返回起点的特殊处理
当终点类型为 `return` 且坐标与起点相同时：
- 驾车模式：正常处理（API 支持环形路线）
- 步行/公交：去掉重复终点，以最后一个店铺作为终点

### 踩坑记录
1. **Key 无效（status 190）** → 更换为正确的腾讯地图 Key
2. **限流（status 120）** → 并行改串行，增加 1100ms 间隔
3. **起终点坐标错误（status 374）** → 步行不支持起点终点相同，需特殊处理
4. **Polyline 解析错误** → 腾讯地图格式：首点绝对坐标，后续增量需除以 1,000,000

### TODO（待优化）
1. **增加 Loading 状态**
   - 问题：步行/公交模式下串行请求多段路线，每段间隔 1100ms，3个店铺需要约 3.3 秒，用户无感知
   - 方案：增加全局 Loading 提示，或进入页面时预加载所有出行方式的路线

2. **路线缓存机制**
   - 问题：每次切换出行方式都重新调用 API，浪费请求且体验差
   - 方案：缓存三种模式的路线数据，切换时直接读取缓存，无需重复请求
   - 缓存结构：`{ drive: {...}, walk: {...}, transit: {...} }`

---
*最后更新：2026-04-22（路线地图优化 ✅）*
