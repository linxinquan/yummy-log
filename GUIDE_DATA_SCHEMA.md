# 攻略数据结构说明

这份文档说明项目里“攻略对象”当前实际使用的数据结构，以及每个字段被哪些页面使用。

## 1. 攻略对象是什么

- 一条攻略卡片对应的一整份数据。
- 会被这些页面使用：
  - 总攻略页
  - 区县攻略页
  - 攻略详情页
  - 我的攻略页

## 2. 推荐的最小字段结构

```js
{
  id: 'guide-xxx',
  routeId: 'route-xxx',
  title: '深圳2天1夜漫游之旅',
  coverImage: '/images/covers/01.jpeg',
  city: '深圳市',
  duration: '2天',
  shopCount: 6,
  date: 1710000000000,
  author: '觅食者',
  authorAvatar: '/images/app-logo.jpg',
  content: [],
  daySections: []
}
```

## 3. 字段说明

### 3.1 基础字段

- `id`
  - 攻略自己的唯一编号。
  - 用来区分每一条攻略。

- `routeId`
  - 这条攻略原来对应的路线编号。
  - 主要用于判断某条路线是否已经发布过攻略。

- `title`
  - 攻略标题。
  - 例如：`深圳2天1夜漫游之旅`。

- `coverImage`
  - 攻略封面图。
  - 用在攻略列表卡片、详情页头图、我的攻略页卡片。

- `city`
  - 城市信息。
  - 用在总攻略页、区县攻略页、攻略详情页。

- `author`
  - 作者名。
  - 用在总攻略页、区县攻略页卡片作者区域。

- `authorAvatar`
  - 作者头像。
  - 用在总攻略页、区县攻略页卡片作者区域。

### 3.2 列表展示字段

- `duration`
  - 行程时长文字。
  - 例如：`1天`、`2天`。
  - 总攻略页和区县攻略页直接显示这个字段。

- `shopCount`
  - 地点总数。
  - 虽然名字叫 `shopCount`，但当前实际含义更接近“地点数”。
  - 例如：`8`，页面会显示成 `2天 · 8个地点`。

- `date`
  - 攻略发布时间。
  - 主要给“我的攻略页”格式化显示日期。

### 3.3 详情核心字段

- `daySections`
  - 攻略详情最重要的字段。
  - 表示“按天分组的完整行程数据”。
  - 攻略详情页主要靠它来渲染：
    - 概览
    - 每天的地点列表
    - 地图路线

- `content`
  - 把所有地点摊平后的列表。
  - 不是攻略详情页的主结构。
  - 主要给“我的攻略页”和部分兼容逻辑使用。

## 4. daySections 结构

- `daySections` 是一个数组。
- 每一项代表一天的行程。

示例：

```js
[
  {
    id: 'day-0',
    title: '第一天',
    countText: '3 个地点',
    items: [
      {
        id: 'place-1',
        name: '世界之窗',
        image: '/images/covers/01.jpeg',
        tag: '景点',
        type: 'spot',
        lat: 22.5401,
        lng: 113.9734
      }
    ]
  }
]
```

### 4.1 每一天常见字段

- `id`
  - 这一天自己的编号。

- `title`
  - 这一天标题。
  - 例如：`第一天`。

- `countText`
  - 这一天有几个地点。
  - 例如：`3 个地点`。

- `items`
  - 这一天的地点列表。

### 4.2 items 里的地点字段

每个地点通常包含这些字段：

- `id`
- `name`
  - 地点名称。

- `image`
  - 地点图片。

- `tag`
  - 页面展示用的类型文案。
  - 例如：`美食`、`景点`、`文化展馆`。

- `type`
  - 更底层的类型值。
  - 例如：`food` / `spot`。

- `lat`
  - 纬度。

- `lng`
  - 经度。

- 以及一些交通相关字段
  - 用于地图与路线说明显示。

## 5. content 结构

- `content` 也是数组。
- 但它不是按天分组的。
- 可以理解成把 `daySections` 里的所有地点展开后得到的一份总列表。

主要用途：

- 我的攻略页封面兜底。
- 我的攻略页统计地点数量。
- 旧逻辑兼容。

## 6. 页面和字段的对应关系

### 6.1 总攻略页

主要使用这些字段：

- `title`
- `coverImage`
- `city`
- `duration`
- `shopCount`
- `author`
- `authorAvatar`

### 6.2 区县攻略页

主要使用这些字段：

- `title`
- `coverImage`
- `city`
- `duration`
- `shopCount`
- `author`
- `authorAvatar`

### 6.3 攻略详情页

主要使用这些字段：

- `title`
- `city`
- `coverImage`
- `daySections`

说明：

- 攻略详情页真正最依赖的是 `daySections`。
- 如果缺少 `daySections`，详情页就无法稳定渲染真实行程。

### 6.4 我的攻略页

主要使用这些字段：

- `title`
- `coverImage`
- `date`
- `shopCount`
- `content`

说明：

- `content` 目前还用于一些兼容逻辑。
- `date` 会被格式化为可读日期。

## 7. 当前建议保留的字段

建议保留：

- `id`
- `routeId`
- `title`
- `coverImage`
- `city`
- `duration`
- `shopCount`
- `date`
- `author`
- `authorAvatar`
- `content`
- `daySections`

## 8. 当前不属于必需字段的内容

以下字段目前不是这条链路里的必需字段：

- `desc`
- `category`
- `shops`
- `cityText`

如果后续没有新的页面依赖这些字段，可以继续不保留。

## 9. 一句话总结

- 列表页主要看“轻字段”：
  - 标题、封面、城市、天数、地点数、作者。

- 详情页主要看“重字段”：
  - `daySections`。

- 我的攻略页额外依赖：
  - `content`
  - `date`
  - `shopCount`
