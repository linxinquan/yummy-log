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

## AI 图片识别（2026-04-24 ✅）

### 概述
在打卡页面新增拍照识别功能，可识别美食/景点名称并自动填充标题和描述。

### 技术架构
- **调用方式**：纯前端，无需云函数，通过 `wx.cloud.extend.AI.createModel().streamText()` 调用
- **模型**：在 CloudBase 控制台 → AI Agent → 自定义模型配置
- **模型标识符**：`modelscope-custom`（控制台配置的名称）
- **实际模型**：`Qwen/Qwen3.5-27B`（控制台里指向的模型）
- **图片传输**：上传到云存储 → 获取临时访问链接 → 传给 AI（不使用 Base64）

### 识别流程（`utils/recognizePhoto.js`）
1. 压缩图片（`quality: 20` + `width: 800`，目标 < 200KB）
2. 上传到云存储 `recognize_tmp/`
3. 获取临时访问链接
4. 调用 `wx.cloud.extend.AI.createModel('custom-custom').streamText()`
5. 流式收集响应 → 解析 JSON → 返回 `{ name, desc }`

### 关键代码（`pages/checkin/checkin.js`）
图片压缩必须同时设置 `quality` 和 `width`：
```javascript
wx.compressImage({
  src: photoPath,
  quality: 20,
  width: 800,
  compressedWidth: 800,
  compressedHeight: 800,
  success: (res) => resolve(res.tempFilePath),
  fail: (err) => { resolve(photoPath) }
})
```

### 测试入口（WXML 临时保留）
- `测AI` → `onTestAI()` 原始 hunyuan-exp 测试
- `测文本` → `onTestAIText()` 纯文本连通性测试
- `测MS` → `onTestModelScope()` ModelScope 图片测试

### 已修改文件
| 文件 | 改动 |
|------|------|
| `pages/checkin/checkin.js` | `_recognizePhoto()` 正式识别函数 + 测试函数 |
| `pages/checkin/checkin.wxml` | 三个测试按钮入口 |
| `pages/checkin/checkin.wxss` | 测试按钮样式（红/蓝/橙） |
| `utils/recognizePhoto.js` | 核心识别逻辑，纯前端 `wx.cloud.extend.AI` 方案 |
| `cloud/recognizeAIFood/` | 废弃，云函数调用 `custom-custom` 模型报 404，不适用 |

### 踩坑记录
1. **hunyuan-exp 不支持图片输入**：返回 400，切换到 ModelScope 解决
2. **Base64 传图失败**：原图 2.5MB → Base64 后 3.5MB，超请求体限制，放弃
3. **仅调 quality 压缩不够**：需同时限制 `width: 800` 尺寸才能降到 200KB 以下
4. **云函数调用模型报 404**：`cloud/recognizeAIFood` 用 `@cloudbase/node-sdk` 的 `ai.createModel('custom-custom')` → 404
   - 原因：`custom-custom` 模型标识符必须在 CloudBase 控制台正确配置/激活
   - 云函数中应该用 `@cloudbase/node-sdk` 的 `app.ai().createModel('xxx')`，但模型名称必须和控制台一致
5. **真机调试偶发找不到模型**：昨天用前端调用报"模型未找到"，今天好了 → 可能是控制台模型配置/部署有延迟，配置完成后需等待生效

### AI 模型选择对照
| 场景 | 模型 | 调用方式 | 说明 |
|------|------|---------|------|
| 打卡文案生成 | `hunyuan-2.0-instruct-20251111` | 云函数 `cloud.cloud.ai.model.generateText()` | 仅文本，配置在控制台 |
| 图片内容识别 | `Qwen/Qwen3.5-27B` | 前端 `wx.cloud.extend.AI.createModel('modelscope-custom').streamText()` | 需要控制台配置 `modelscope-custom` 指向该模型 |

---
*最后更新：2026-04-24（AI 图片识别 ✅，纯前端方案稳定）*

## AI 打卡文案生成改为前端直接调用（2026-04-27 ✅）

### 问题背景
- 云函数方案需要上传部署，调试不便
- 测试发现云函数调用失败，返回预设文案
- 前端直接调用方案更灵活，调试更方便

### 技术方案
- **调用方式**：前端直接调用 `wx.cloud.extend.AI.createModel('hunyuan-exp')`
- **模型**：`hunyuan-2.0-instruct-20251111`
- **提示词优化**：明确要求 AI 必须使用 `recognizeResult` 和 `recognizeDesc`
- **JSON 解析**：处理 markdown 代码块包裹的情况

### 关键代码（`pages/checkin/checkin.js`）
```javascript
_generateAIContent() {
  const model = wx.cloud.extend.AI.createModel('hunyuan-exp')
  // 提示词中强调必须使用图片识别结果
  const recognizePart = recognizeResult
    ? `\n【重要：图片识别结果】\n识别到的内容：${recognizeResult}...\n请基于以上识别结果生成文案`
    : ''
  // ...
}
```

### 测试结果（✅）
- **测试数据**：`recognizeResult: "苦瓜柠檬茶"`, `recognizeDesc: "翠绿冰爽，萌猪坐镇，微苦后的回甘令人惊喜"`
- **生成文案**：
  - 标题：`苦瓜柠檬茶🐷翠绿萌趣沁心凉`
  - 正文：`翠绿冰爽的苦瓜柠檬茶，萌猪坐镇，微苦化甘意绵长，饮罢满心惊喜感叹！`
- **结论**：✅ 文案完美融合了识别结果和描述

### 已修改文件
| 文件 | 改动 |
|------|------|
| `pages/checkin/checkin.js` | 移除 `_generateAIContent()` 中的 `wx.cloud.callFunction`，改为直接调用混元 AI；删除 `_callHunyuanDirect()` 方法（已整合） |
| `cloud/generateAICheckin/index.js` | 保留（备用），但不再使用 |

### 提示词关键点
1. **SystemPrompt**：明确告知 AI "如果提供了图片识别结果，必须在文案中体现识别到的具体内容"
2. **UserPrompt**：使用 `【重要：图片识别结果】` 标记，强化指令
3. **效果**：AI 生成的文案会包含 `recognizeResult` 和 `recognizeDesc` 的内容

---
*最后更新：2026-04-29（新增 dataScript 数据脚本目录）*

## 图片识别打字机效果（2026-04-27 ✅）

### 实现方案
- `utils/recognizePhoto.js` 支持流式返回，通过 `onToken` 回调实时传递 token
- `pages/checkin/checkin.js` 实时解析 JSON 并更新 UI
- `pages/checkin/checkin.wxml` 添加光标动画效果

### 已修改文件
| 文件 | 改动 |
|------|------|
| `utils/recognizePhoto.js` | `recognizePhoto` 添加 `onToken` 回调参数；添加 `forceBase64` 参数（强制使用 base64，跳过云存储）；移除冗余的 `recognizePhotoStream` 和 `recognizePhotoTest` 函数 |
| `pages/checkin/checkin.js` | `_recognizePhoto` 使用流式回调；添加 `forceBase64` 标志；添加 `onToggleForceBase64` 事件处理 |
| `pages/checkin/checkin.wxml` | 添加 base64 模式切换开关；添加打字机光标效果 |
| `pages/checkin/checkin.wxss` | 添加 `.rb-result .cursor` 光标动画样式 |
| `utils/typewriter.js` | **新建** 打字机效果公共函数，支持可配置速度和完成回调 |

### forceBase64 参数说明
- `false`（默认）：先尝试云存储，失败则降级为 base64
- `true`（测试模式）：强制使用 base64，跳过云存储（方便网络不稳定时测试）

### 测试方式
在打卡页面 Step 1，打开"测试模式"开关，即可强制使用 base64 上传图片。

---

## 数据脚本目录（dataScript）

### 目录结构
```
dataScript/
├── foods/              # 美食图片备份
├── spots/              # 景点图片备份
├── foods.json          # 美食数据（JSON格式）
├── spots.json          # 景点数据（JSON格式）
├── shopData.json       # 店铺数据（JSON格式）
├── js2json.py          # JS转JSON脚本
├── js2json.js          # JS转JSON脚本（JS版本）
├── convert_data_to_json.py  # 数据转换脚本
├── upload_to_cos.py    # 上传到腾讯云COS
├── fix_paths.py        # 修复图片路径
├── fix_food_images.py  # 修复美食图片路径
├── fix_spot_images.py   # 修复景点图片路径
├── sync_cos_paths.py   # 同步COS路径
├── check_food.py       # 检查美食数据
├── debug_extract.py    # 调试提取
├── debug_food.py       # 调试美食数据
├── foodData_backup.js  # 美食数据备份
├── spotData_backup.js  # 景点数据备份
├── *.bak / *.bak2 / *.bak3  # 多版本备份
└── sync_log.txt        # 同步日志
```

### 说明
- **图片备份**：`foods/` 和 `spots/` 存放本地图片，用于上传到COS或GitHub备份
- **JSON数据**：原始数据文件，与 `utils/` 下的JS文件内容同步
- **Python脚本**：数据处理和上传工具
- **备份文件**：数据更新前自动备份的版本

### 工作流程
1. 编辑 Excel 数据 → 生成 JSON → 运行脚本同步到 COS
2. 更新 `utils/` 下的 JS 文件
3. 原图备份在 `dataScript/foods/` 和 `dataScript/spots/`

---

## 图片识别改为云函数调用（2026-05-12 ✅）

### 修改原因
1. **混元模型限制**：混元免费版不支持多模态（图片输入），且不支持通过`wx.cloud.extend.AI.createModel`调用第三方模型（如Qwen）
2. **API Key安全**：前端直连ModelScope API存在Key泄露风险
3. **方案调整**：改用云函数调用ModelScope Qwen API，保障Key安全

### 技术架构
- **调用方式**：前端通过`wx.cloud.callFunction`调用云函数
- **云函数**：`cloud/recognizePhoto/index.js`
- **模型**：`Qwen/Qwen3.5-27B`（ModelScope多模态）
- **API**：ModelScope OpenAI兼容API `https://api-inference.modelscope.cn/v1/chat/completions`
- **图片传输**：上传到云存储 → 获取临时访问链接 → 传给AI（不使用Base64）

### 云函数配置
- **超时设置**：创建`cloud/recognizePhoto/config.json`，设置`"timeout": 60`（秒）
- **原因**：默认3秒超时，调用外部AI API需要更长时间
- **环境变量**：API Key优先读取`process.env.MODELSCOPE_API_KEY`，兜底使用测试Key

### 关键代码（`cloud/recognizePhoto/index.js`）
```javascript
// HTTP POST 请求封装（Promise）
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: headers
    }
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => { chunks.push(chunk) })
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString()
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data })
        }
      })
    })
    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })
}
```

### 前端调用链路
```
用户选择图片
  → onChoosePhoto()
    → _recognizePhoto()
      → utils/recognizePhoto.js → wx.cloud.callFunction('recognizePhoto')
        → 云函数调用ModelScope Qwen API
          → 返回 { success, name, desc }
            → 更新UI显示识别结果
```

### 已删除内容
1. **测试函数**：
   - `onTestAIGenerate()` - 测试混元AI生成
   - `_callHunyuanDirectTest()` - 测试专用直接调用混元



### 已修改文件
| 文件 | 改动 |
|------|------|
| `utils/recognizePhoto.js` | 改为调用云函数`recognizePhoto`，删除前端直连API代码和混元分支 |
| `cloud/recognizePhoto/index.js` | **新建** 云函数：调用ModelScope Qwen API |
| `cloud/recognizePhoto/package.json` | **新建** 云函数依赖配置 |
| `cloud/recognizePhoto/config.json` | **新建** 超时配置（30秒） | 好像没用，在控制台已配置60s
| `pages/checkin/checkin.js` | 删除测试函数、未使用字段、混元相关代码 |

### 踩坑记录
1. **云函数超时（3秒）** → 创建`config.json`设置`timeout: 30`
2. **云函数不支持`cloud.callContainer`** → 改用Node.js原生`https`模块调用外部API
3. **`process.env`拼写错误** → 修正为`process.env.MODELSCOPE_API_KEY`
4. **Buffer拼接错误** → 重写`httpPost`函数正确拼接响应Buffer

### TODO
- [ ] 部署云函数后测试调用是否正常
- [ ] 在云开发控制台配置环境变量`MODELSCOPE_API_KEY`
- [ ] 测试不同网络环境下云函数调用稳定性

---

## TODO

- [ ] **路线页面 Loading 状态**
  - 问题：步行/公交模式下串行请求多段路线，每段间隔 1100ms，3个店铺需要约 3.3 秒，用户无感知
  - 方案：增加全局 Loading 提示，或进入页面时预加载所有出行方式的路线

- [ ] **打卡入口统一，AI 自动分类**
  - 问题：当前有"美食打卡"和"景点打卡"两个独立入口，需要用户先选择类型
  - 方案：合并为单一打卡入口，用户拍照后由 AI 识别内容类型（美食/景点），自动分类存储
  - 好处：简化用户操作，无需思考"我该去哪个入口"








