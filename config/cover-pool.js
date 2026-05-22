/**
 * 默认封面图池配置
 * 包含美食和景点各 5 张图片，用于路线、城市等场景的封面兜底
 * 直接使用 URL，避免从大数据集提取
 */

// 美食封面图池（5张）
const DEFAULT_FOOD_COVERS = [
  'https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/foods/shenzhen/%E7%99%BE%E8%8D%89%E5%A0%82%E7%B3%96%E6%B0%B4.jpg',
  'https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/foods/shenzhen/%E5%AE%9D%E7%8B%AE%E6%9D%82%E7%A2%8E%E5%B0%8F%E9%A3%9F%E9%A6%86.jpg',
  'https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/foods/shenzhen/%E5%98%89%E5%8D%8E%E5%B0%8F%E5%90%83%28%E8%9B%87%E5%8F%A3%E5%B8%82%E5%9C%BA%E5%BA%97%29.jpg',
  'https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/foods/shenzhen/%E6%8F%AD%E9%98%B3%E8%80%81%E4%BA%94%E7%B2%BF%E6%9D%A1%E6%B1%A4.jpg',
  'https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/foods/shenzhen/%E8%80%81%E5%85%B5%E7%89%9B%E8%B9%84%E5%BA%97.jpg'
]

// 景点封面图池（5张）
const DEFAULT_SPOT_COVERS = [
  'https://aos-comment.amap.com/UKFN9HT2M870QV5A_AIGC/dd68f5e6515ca08ee6504efc3528d057.jpeg',
  'https://aos-comment.amap.com/UKFN9HT2M870QV5A_AIGC/bbd355f0-2b92-462b-8ae6-45d29e8dda01.jpeg',
  'https://aos-comment.amap.com/UKFN9HT2M870QV5A_AIGC/307f367a052c448d5745eee7fc721aa6.jpeg',
  'https://aos-comment.amap.com/UKFN9HT2M870QV5A_AIGC/2b22889c-663c-4759-b9b3-7dd2494781a7_edit.jpeg',
  'https://aos-comment.amap.com/UKFN9HT2M870QV5A_AIGC/4ddaed61-f06d-483f-9ef9-814e511aa674.jpeg'
]

// 合并的封面图池（food + spot）
const DEFAULT_COVER_POOL = [...DEFAULT_FOOD_COVERS, ...DEFAULT_SPOT_COVERS]

module.exports = {
  DEFAULT_FOOD_COVERS,
  DEFAULT_SPOT_COVERS,
  DEFAULT_COVER_POOL
}
