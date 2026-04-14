// -*- coding: utf-8 -*-
// V2 景点数据 - 共58个景点，覆盖深圳10个行政区
// V1原有点景点(101-128): 精确坐标 | 扩充景点(201+): 区域中心近似坐标

const spotData = [
  {
    "id": 101,
    "name": "中山公园",
    "district": "南山",
    "category": "公园",
    "rating": 4.7,
    "tags": [
      "荔枝飘香",
      "儿童乐园",
      "孙中山像",
      "明代城墙",
      "大草坪"
    ],
    "desc": "深圳最老的公园，到2025年正好100岁，藏在闹市中的百年绿洲，历史感与自然感并存。",
    "address": "深圳市南山区南头街道中山公园路",
    "lat": 22.543,
    "lng": 113.9237,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%B8%AD%E5%B1%B1%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "06:00-22:00"
  },
  {
    "id": 102,
    "name": "深圳欢乐谷",
    "district": "南山",
    "category": "主题乐园",
    "rating": 4.67,
    "tags": [
      "异域拍照",
      "玛雅水公园",
      "刺激游乐"
    ],
    "desc": "夏日必冲玛雅水公园，巨浪风暴造浪池与彩虹滑道组合，清凉刺激一夏。",
    "address": "深圳市南山区华侨城欢乐谷",
    "lat": 22.5378,
    "lng": 113.9726,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E6%AC%A2%E4%B9%90%E8%B0%B7.jpg",
    "free": false,
    "openHours": "09:30-22:00"
  },
  {
    "id": 103,
    "name": "海上世界",
    "district": "南山",
    "category": "海滨",
    "rating": 4.79,
    "tags": [
      "光影水舞",
      "环球美食",
      "滨海漫步",
      "艺术海岸"
    ],
    "desc": "夜幕降临，音乐喷泉随节拍起舞，明华轮静静停泊在城市灯火中，构成深圳最浪漫的海滨夜景。",
    "address": "深圳市南山区太子路海上世界",
    "lat": 22.4857,
    "lng": 113.9025,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B5%B7%E4%B8%8A%E4%B8%96%E7%95%8C.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 104,
    "name": "塘朗山公园",
    "district": "南山",
    "category": "山景",
    "rating": 4.72,
    "tags": [
      "野生猕猴",
      "免费开放",
      "日落熔金",
      "徒步登山"
    ],
    "desc": "深圳十峰之一，海拔432米，登顶极目阁可280度俯瞰深圳湾与香港岛，城市山海画卷一目了然。",
    "address": "深圳市南山区塘朗山公园",
    "lat": 22.5545,
    "lng": 113.9402,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%A1%98%E6%9C%97%E5%B1%B1%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "06:00-18:00"
  },
  {
    "id": 105,
    "name": "深圳湾公园",
    "district": "南山",
    "category": "海滨",
    "rating": 4.75,
    "tags": [
      "骑行",
      "日出",
      "海景",
      "候鸟",
      "超长海岸线"
    ],
    "desc": "深圳最长的海滨公园，绵延15公里的海岸线，是骑行、慢跑、看日出的绝佳之地。",
    "address": "深圳市南山区深圳湾公园",
    "lat": 22.4875,
    "lng": 113.9462,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E6%B9%BE%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 106,
    "name": "大沙河生态长廊",
    "district": "南山",
    "category": "公园",
    "rating": 4.68,
    "tags": [
      "骑行",
      "绿色廊道",
      "自然教育",
      "城市绿肺"
    ],
    "desc": "深圳的\"塞纳河\"，13.7公里的生态长廊串联大学城、深圳湾与科技园，适合骑行和徒步。",
    "address": "深圳市南山区大沙河生态长廊",
    "lat": 22.5431,
    "lng": 113.935,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%A4%A7%E6%B2%99%E6%B2%B3%E7%94%9F%E6%80%81%E9%95%BF%E5%BB%8A.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 107,
    "name": "荷兰花卉小镇",
    "district": "南山",
    "category": "特色小镇",
    "rating": 4.6,
    "tags": [
      "荷兰风情",
      "花卉",
      "拍照",
      "欧式建筑"
    ],
    "desc": "充满荷兰风情的特色小镇，色彩斑斓的建筑、郁金香花田和风车，让人仿佛置身欧洲。",
    "address": "深圳市南山区荷兰花卉小镇",
    "lat": 22.5432,
    "lng": 113.9712,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%8D%B7%E5%85%B0%E8%8A%B1%E5%8D%89%E5%B0%8F%E9%95%87.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 108,
    "name": "南头古城",
    "district": "南山",
    "category": "历史文化",
    "rating": 4.65,
    "tags": [
      "历史古城",
      "文创",
      "老街",
      "古城墙"
    ],
    "desc": "1700年历史的南头古城，是深圳城市发展的原点，如今成为文青聚集的创意街区。",
    "address": "深圳市南山区南头古城",
    "lat": 22.5425,
    "lng": 113.922,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%8D%97%E5%A4%B4%E5%8F%A4%E5%9F%8E.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 109,
    "name": "赤湾左炮台",
    "district": "南山",
    "category": "历史文化",
    "rating": 4.58,
    "tags": [
      "历史遗迹",
      "海景",
      "山顶观景",
      "免费"
    ],
    "desc": "鸦片战争历史遗迹，登顶可俯瞰赤湾港和深圳湾，视野开阔，是小众但震撼的打卡地。",
    "address": "深圳市南山区赤湾左炮台",
    "lat": 22.4768,
    "lng": 113.889,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%B5%A4%E6%B9%BE%E5%B7%A6%E7%82%AE%E5%8F%B0.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 110,
    "name": "价值工厂",
    "district": "南山",
    "category": "艺术",
    "rating": 4.62,
    "tags": [
      "工业风",
      "艺术展",
      "拍照",
      "创意园"
    ],
    "desc": "由废弃工厂改造的创意园区，保留工业遗迹的同时引入现代艺术，是文艺青年的朝圣地。",
    "address": "深圳市南山区价值工厂",
    "lat": 22.4845,
    "lng": 113.9012,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%BB%B7%E5%80%BC%E5%B7%A5%E5%8E%82.jpg",
    "free": true,
    "openHours": "09:00-21:00"
  },
  {
    "id": 111,
    "name": "蛇口海洋世界",
    "district": "南山",
    "category": "展馆",
    "rating": 4.63,
    "tags": [
      "海洋生物",
      "科普教育",
      "美人鱼表演",
      "亲子"
    ],
    "desc": "深圳最大的海洋馆，可以看到优雅的美人鱼表演和各种珍稀海洋生物。",
    "address": "深圳市南山区蛇口海洋世界",
    "lat": 22.485,
    "lng": 113.905,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%9B%87%E5%8F%A3%E6%B5%B7%E6%B4%8B%E4%B8%96%E7%95%8C.jpg",
    "free": false,
    "openHours": "09:00-18:00"
  },
  {
    "id": 112,
    "name": "华侨城湿地公园",
    "district": "南山",
    "category": "公园",
    "rating": 4.6,
    "tags": [
      "湿地生态",
      "观鸟",
      "生态教育",
      "自然"
    ],
    "desc": "城市中心的湿地绿洲，栖息着100多种鸟类，是深圳难得的生态观测点。",
    "address": "深圳市南山区华侨城湿地公园",
    "lat": 22.5338,
    "lng": 113.969,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%8D%8E%E4%BE%A8%E5%9F%8E%E6%B9%BF%E5%9C%B0%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "09:00-17:00"
  },
  {
    "id": 113,
    "name": "西丽生态公园",
    "district": "南山",
    "category": "公园",
    "rating": 4.57,
    "tags": [
      "自然探索",
      "亲子",
      "徒步",
      "城市绿肺"
    ],
    "desc": "西丽片区的城市公园，适合周末亲子郊游，公园内有多条徒步路线。",
    "address": "深圳市南山区西丽生态公园",
    "lat": 22.5695,
    "lng": 113.9205,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%A5%BF%E4%B8%BD%E7%94%9F%E6%80%81%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 114,
    "name": "荔香公园",
    "district": "南山",
    "category": "公园",
    "rating": 4.55,
    "tags": [
      "荔枝林",
      "晨练",
      "休闲",
      "花香"
    ],
    "desc": "以荔枝林闻名的社区公园，每年5月荔枝成熟时果香四溢，是体验深圳本土生活的好去处。",
    "address": "深圳市南山区荔香公园",
    "lat": 22.5501,
    "lng": 113.947,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%8D%94%E9%A6%99%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 115,
    "name": "杨梅坑",
    "district": "大鹏",
    "category": "海滨",
    "rating": 4.78,
    "tags": [
      "绝美海岸线",
      "徒步",
      "鹿嘴山庄",
      "电影取景地"
    ],
    "desc": "深圳最美海岸线之一，电影《美人鱼》的取景地，徒步或骑行都极佳。",
    "address": "深圳市大鹏新区杨梅坑",
    "lat": 22.548,
    "lng": 114.571,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%9D%A8%E6%A2%85%E5%9D%91.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 116,
    "name": "较场尾海滩",
    "district": "大鹏",
    "category": "海滨",
    "rating": 4.72,
    "tags": [
      "民宿村",
      "海边小镇",
      "沙滩",
      "冲浪"
    ],
    "desc": "深圳\"鼓浪屿\"，民宿林立的小清新海滩，适合周末度假，海边喝杯咖啡就是最好的慢生活。",
    "address": "深圳市大鹏新区较场尾",
    "lat": 22.5892,
    "lng": 114.4895,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%BE%83%E5%9C%BA%E5%B0%BE%E6%B5%B7%E6%BB%A9.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 117,
    "name": "大鹏所城",
    "district": "大鹏",
    "category": "历史文化",
    "rating": 4.7,
    "tags": [
      "明清古城",
      "历史",
      "鹏城之源",
      "小巷"
    ],
    "desc": "深圳\"鹏城\"之源的明清古城，拥有600多年历史，是深圳最具历史底蕴的地方。",
    "address": "深圳市大鹏新区大鹏所城",
    "lat": 22.589,
    "lng": 114.482,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%A4%A7%E9%B9%8F%E6%89%80%E5%9F%8E.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 118,
    "name": "东涌海滩",
    "district": "大鹏",
    "category": "海滨",
    "rating": 4.76,
    "tags": [
      "原生态",
      "沙滩",
      "潜水",
      "海岸线"
    ],
    "desc": "深圳最干净的海滩之一，沙质细腻，海水清澈，是潜水爱好者的隐秘宝地。",
    "address": "深圳市大鹏新区东涌",
    "lat": 22.5545,
    "lng": 114.5495,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%B8%9C%E6%B6%8C%E6%B5%B7%E6%BB%A9.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 119,
    "name": "西涌海滩",
    "district": "大鹏",
    "category": "海滨",
    "rating": 4.74,
    "tags": [
      "最长沙滩",
      "天文台",
      "星空",
      "自然"
    ],
    "desc": "深圳最长的沙滩，西涌天文台位于山顶，可俯瞰整片海湾，是观星的绝佳地点。",
    "address": "深圳市大鹏新区西涌",
    "lat": 22.524,
    "lng": 114.526,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%A5%BF%E6%B6%8C%E6%B5%B7%E6%BB%A9.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 120,
    "name": "桔钓沙",
    "district": "大鹏",
    "category": "海滨",
    "rating": 4.8,
    "tags": [
      "玻璃海",
      "白色沙滩",
      "帆船",
      "绝美"
    ],
    "desc": "深圳最美的海滩之一，碧蓝的海水和洁白的沙滩让人仿佛置身马尔代夫。",
    "address": "深圳市大鹏新区桔钓沙",
    "lat": 22.57,
    "lng": 114.55,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%A1%94%E9%92%93%E6%B2%99.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 121,
    "name": "七娘山",
    "district": "大鹏",
    "category": "山景",
    "rating": 4.73,
    "tags": [
      "深圳第二峰",
      "地质公园",
      "登山",
      "云海"
    ],
    "desc": "深圳第二高峰，海拔869米，登山可俯瞰大鹏半岛壮阔海景，天气好时云海翻涌极为壮观。",
    "address": "深圳市大鹏新区七娘山",
    "lat": 22.51,
    "lng": 114.495,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%B8%83%E5%A8%98%E5%B1%B1.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 122,
    "name": "官湖村",
    "district": "大鹏",
    "category": "特色小镇",
    "rating": 4.65,
    "tags": [
      "日式小镇",
      "海边",
      "清新",
      "沙滩"
    ],
    "desc": "深圳版\"镰仓\"，日系风格的小渔村，彩色房屋、沿海公路和灯塔，是文艺青年的拍照圣地。",
    "address": "深圳市大鹏新区官湖村",
    "lat": 22.607,
    "lng": 114.44,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%AE%98%E6%B9%96%E6%9D%91.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 123,
    "name": "背仔角",
    "district": "盐田",
    "category": "海滨",
    "rating": 4.68,
    "tags": [
      "绝美栈道",
      "海边徒步",
      "小众秘境",
      "免费"
    ],
    "desc": "小众但绝美的海边栈道，徒步路线人少景美，终点是一片清澈的海湾。",
    "address": "深圳市盐田区背仔角",
    "lat": 22.615,
    "lng": 114.32,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%83%8C%E4%BB%94%E8%A7%92.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 124,
    "name": "盐田海滨栈道",
    "district": "盐田",
    "category": "海滨",
    "rating": 4.82,
    "tags": [
      "超长栈道",
      "海景",
      "健身",
      "沿途风景"
    ],
    "desc": "世界上最长的海滨栈道，全长19.5公里，一边是碧蓝大海，一边是绿树青山，骑行或徒步皆宜。",
    "address": "深圳市盐田区海滨栈道",
    "lat": 22.65,
    "lng": 114.24,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E7%9B%90%E7%94%B0%E6%B5%B7%E6%BB%A8%E6%A0%88%E9%81%93.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 125,
    "name": "东部华侨城",
    "district": "盐田",
    "category": "主题乐园",
    "rating": 4.69,
    "tags": [
      "大侠谷",
      "茶溪谷",
      "温泉",
      "生态"
    ],
    "desc": "大型生态旅游区，大侠谷机动游戏刺激，茶溪谷风光秀美，是深圳周边度假的好去处。",
    "address": "深圳市盐田区东部华侨城",
    "lat": 22.638,
    "lng": 114.278,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%B8%9C%E9%83%A8%E5%8D%8E%E4%BE%A8%E5%9F%8E.jpg",
    "free": false,
    "openHours": "09:30-17:30"
  },
  {
    "id": 126,
    "name": "梧桐山",
    "district": "罗湖",
    "category": "山景",
    "rating": 4.85,
    "tags": [
      "深圳第一峰",
      "云海",
      "登山",
      "梧桐烟雨"
    ],
    "desc": "深圳最高峰，海拔943.7米，登顶可俯瞰深圳全景，\"梧桐烟雨\"是深圳八景之一。",
    "address": "深圳市罗湖区梧桐山",
    "lat": 22.5845,
    "lng": 114.19,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%A2%A7%E6%A1%90%E5%B1%B1.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 127,
    "name": "弘法寺",
    "district": "罗湖",
    "category": "文化",
    "rating": 4.75,
    "tags": [
      "祈福",
      "佛教",
      "仙湖",
      "素斋"
    ],
    "desc": "深圳最著名的寺庙，位于梧桐山脚下，香火旺盛，是深圳人祈福的首选之地。",
    "address": "深圳市罗湖区仙湖植物园弘法寺",
    "lat": 22.579,
    "lng": 114.18,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%BC%98%E6%B3%95%E5%AF%BA.jpg",
    "free": true,
    "openHours": "08:00-18:00"
  },
  {
    "id": 128,
    "name": "仙湖植物园",
    "district": "罗湖",
    "category": "公园",
    "rating": 4.73,
    "tags": [
      "植物王国",
      "天文台",
      "化石森林",
      "弘法寺"
    ],
    "desc": "占地546公顷的植物园，汇集了15000多种植物，化石森林和沙漠植物区尤其震撼。",
    "address": "深圳市罗湖区仙湖植物园",
    "lat": 22.576,
    "lng": 114.175,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%BB%99%E6%B9%96%E6%A4%8D%E7%89%A9%E5%9B%AD.jpg",
    "free": false,
    "openHours": "08:00-18:00"
  },
  {
    "id": 201,
    "name": "深圳市民中心",
    "district": "福田",
    "category": "地标",
    "rating": 4.6,
    "tags": [
      "城市地标",
      "夜景",
      "灯光秀",
      "CBD"
    ],
    "desc": "深圳城市客厅，福田区CBD核心，夜晚灯光秀璀璨，是深圳最具代表性的城市地标。",
    "address": "深圳市福田区福中三路市民中心",
    "lat": 22.5431,
    "lng": 114.0549,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%B8%82%E6%B0%91%E4%B8%AD%E5%BF%83.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 202,
    "name": "深圳博物馆",
    "district": "福田",
    "category": "展馆",
    "rating": 4.65,
    "tags": [
      "历史文化",
      "展览",
      "免费",
      "馆藏"
    ],
    "desc": "了解深圳发展史的最佳场所，常设展厅展示从远古到改革开放的历史变迁。",
    "address": "深圳市福田区福中路市民中心A区",
    "lat": 22.5425,
    "lng": 114.057,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%8D%9A%E7%89%A9%E9%A6%86.jpg",
    "free": true,
    "openHours": "10:00-18:00"
  },
  {
    "id": 203,
    "name": "深圳图书馆",
    "district": "福田",
    "category": "文化",
    "rating": 4.68,
    "tags": [
      "阅读",
      "自习",
      "建筑",
      "藏书"
    ],
    "desc": "深圳最大的图书馆，造型独特的\"水晶石\"建筑，藏书超400万册，是书虫的天堂。",
    "address": "深圳市福田区福中一路深圳市图书馆",
    "lat": 22.5418,
    "lng": 114.058,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%9B%BE%E4%B9%A6%E9%A6%86.jpg",
    "free": true,
    "openHours": "09:00-21:00"
  },
  {
    "id": 204,
    "name": "深圳当代艺术馆",
    "district": "福田",
    "category": "艺术",
    "rating": 4.62,
    "tags": [
      "当代艺术",
      "展览",
      "建筑",
      "设计"
    ],
    "desc": "造型独特的当代艺术馆，定期举办国内外当代艺术展，建筑本身就是一件艺术品。",
    "address": "深圳市福田区福中路当代艺术馆",
    "lat": 22.5415,
    "lng": 114.0555,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%BD%93%E4%BB%A3%E8%89%BA%E6%9C%AF%E9%A6%86.jpg",
    "free": true,
    "openHours": "10:00-18:00"
  },
  {
    "id": 205,
    "name": "笔架山公园",
    "district": "福田",
    "category": "公园",
    "rating": 4.7,
    "tags": [
      "城市绿肺",
      "登山",
      "草坪",
      "CBD后花园"
    ],
    "desc": "CBD旁的大型公园，登山可俯瞰市中心全景，草坪上野餐是周末的正确打开方式。",
    "address": "深圳市福田区皇岗路笔架山公园",
    "lat": 22.551,
    "lng": 114.062,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E7%AC%94%E6%9E%B6%E5%B1%B1%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 206,
    "name": "香蜜公园",
    "district": "福田",
    "category": "公园",
    "rating": 4.75,
    "tags": [
      "玫瑰园",
      "婚姻登记",
      "栈道",
      "花香"
    ],
    "desc": "以玫瑰花海闻名的浪漫公园，玫红栈道和玫瑰园是拍照圣地，旁边就是网红婚姻登记处。",
    "address": "深圳市福田区农园路香蜜公园",
    "lat": 22.5385,
    "lng": 114.0435,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E9%A6%99%E8%9C%9C%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 207,
    "name": "深圳园博园",
    "district": "福田",
    "category": "公园",
    "rating": 4.63,
    "tags": [
      "园林",
      "各地风情",
      "茶馆",
      "休闲"
    ],
    "desc": "荟萃中国各地及国际园林精华的公园，100多个展园各具特色，适合慢慢逛。",
    "address": "深圳市福田区深南大道园博园",
    "lat": 22.532,
    "lng": 114.04,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%9B%AD%E5%8D%9A%E5%9B%AD.jpg",
    "free": true,
    "openHours": "06:00-22:00"
  },
  {
    "id": 208,
    "name": "东门老街",
    "district": "罗湖",
    "category": "商业街",
    "rating": 4.55,
    "tags": [
      "老深圳",
      "购物",
      "美食",
      "历史"
    ],
    "desc": "深圳商业的发源地，老街改造后保留了历史韵味，是感受老深圳必去的地方。",
    "address": "深圳市罗湖区东门老街",
    "lat": 22.549,
    "lng": 114.131,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%B8%9C%E9%97%A8%E8%80%81%E8%A1%97.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 209,
    "name": "地王大厦",
    "district": "罗湖",
    "category": "地标",
    "rating": 4.6,
    "tags": [
      "城市地标",
      "高空夜景",
      "观光",
      "CBD"
    ],
    "desc": "曾经的深圳第一高楼，观光层可360度俯瞰深港两城，夜晚灯火璀璨。",
    "address": "深圳市罗湖区深南东路5002号地王大厦",
    "lat": 22.5455,
    "lng": 114.1265,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%9C%B0%E7%8E%8B%E5%A4%A7%E5%8E%A6.jpg",
    "free": false,
    "openHours": "09:00-22:00"
  },
  {
    "id": 210,
    "name": "洪湖公园",
    "district": "罗湖",
    "category": "公园",
    "rating": 4.65,
    "tags": [
      "荷花",
      "湖畔",
      "跑步",
      "休闲"
    ],
    "desc": "每年夏天荷花盛开时美不胜收，公园绿道是周边居民晨练的首选之地。",
    "address": "深圳市罗湖区文锦北路洪湖公园",
    "lat": 22.558,
    "lng": 114.1145,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B4%AA%E6%B9%96%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 211,
    "name": "深圳国际会展中心",
    "district": "宝安",
    "category": "地标",
    "rating": 4.65,
    "tags": [
      "全球最大",
      "展览",
      "建筑",
      "会议"
    ],
    "desc": "全球最大的会展中心，建筑面积相当于6座鸟巢，造型如海浪般优美。",
    "address": "深圳市宝安区福海街道深圳国际会展中心",
    "lat": 22.6195,
    "lng": 113.821,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%9B%BD%E9%99%85%E4%BC%9A%E5%B1%95%E4%B8%AD%E5%BF%83.jpg",
    "free": false,
    "openHours": "按展会时间"
  },
  {
    "id": 212,
    "name": "凤凰山森林公园",
    "district": "宝安",
    "category": "山景",
    "rating": 4.7,
    "tags": [
      "登山",
      "祈福",
      "寺庙",
      "自然"
    ],
    "desc": "宝安第一峰，海拔678米，山顶可俯瞰珠江口，凤凰古庙香火旺盛。",
    "address": "深圳市宝安区福永街道凤凰山",
    "lat": 22.704,
    "lng": 113.8585,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%87%A4%E5%87%B0%E5%B1%B1%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 213,
    "name": "西湾红树林公园",
    "district": "宝安",
    "category": "海滨",
    "rating": 4.68,
    "tags": [
      "红树林",
      "骑行",
      "日落",
      "航空限高"
    ],
    "desc": "深圳最美海滨公园之一，沿海骑行道视野开阔，日落时分的跨海大桥尤为壮观。",
    "address": "深圳市宝安区西乡街道西湾公园",
    "lat": 22.58,
    "lng": 113.843,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%A5%BF%E6%B9%BE%E7%BA%A2%E6%A0%91%E6%9E%97%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 214,
    "name": "立新湖公园",
    "district": "宝安",
    "category": "公园",
    "rating": 4.62,
    "tags": [
      "湖泊",
      "栈道",
      "看书",
      "休闲"
    ],
    "desc": "宝安版的\"西湖\"，环湖栈道12公里，湖边书吧是文艺青年的周末好去处。",
    "address": "深圳市宝安区福永街道立新湖",
    "lat": 22.701,
    "lng": 113.8305,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E7%AB%8B%E6%96%B0%E6%B9%96%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 215,
    "name": "观澜版画村",
    "district": "龙华",
    "category": "特色小镇",
    "rating": 4.75,
    "tags": [
      "客家古村",
      "版画",
      "花海",
      "文艺"
    ],
    "desc": "深圳最美的古村落之一，客家围屋与田园花海交织，是版画艺术家创作的天堂。",
    "address": "深圳市龙华区观澜街道版画村",
    "lat": 22.732,
    "lng": 114.0525,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%A7%82%E6%BE%9C%E7%89%88%E7%94%BB%E6%9D%91.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 216,
    "name": "观澜湖度假区",
    "district": "龙华",
    "category": "度假",
    "rating": 4.72,
    "tags": [
      "高尔夫",
      "温泉",
      "运动",
      "生态"
    ],
    "desc": "全球最大高尔夫球会，5A景区，配套设施完善，是深圳高端度假的首选目的地。",
    "address": "深圳市龙华区观澜高尔夫大道",
    "lat": 22.748,
    "lng": 114.064,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%A7%82%E6%BE%9C%E6%B9%96%E5%BA%A6%E5%81%87%E5%8C%BA.jpg",
    "free": false,
    "openHours": "全天"
  },
  {
    "id": 217,
    "name": "深圳八号仓",
    "district": "龙华",
    "category": "商业",
    "rating": 4.58,
    "tags": [
      "奥莱",
      "购物",
      "折扣",
      "亲子"
    ],
    "desc": "深圳最大的outlets品牌折扣店，国际名品折扣低至1折，是购物狂的朝圣地。",
    "address": "深圳市龙华区民治街道八号仓",
    "lat": 22.6795,
    "lng": 114.0295,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E5%85%AB%E5%8F%B7%E4%BB%93.jpg",
    "free": true,
    "openHours": "10:00-22:00"
  },
  {
    "id": 218,
    "name": "大运中心",
    "district": "龙岗",
    "category": "体育",
    "rating": 4.65,
    "tags": [
      "体育场馆",
      "演唱会",
      "夜景灯光",
      "大运馆"
    ],
    "desc": "2011年大运会主场馆，未来之门的造型美轮美奂，夜景灯光秀尤其震撼。",
    "address": "深圳市龙岗区大运中心",
    "lat": 22.7015,
    "lng": 114.238,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%A4%A7%E8%BF%90%E4%B8%AD%E5%BF%83.jpg",
    "free": false,
    "openHours": "按赛事时间"
  },
  {
    "id": 219,
    "name": "甘坑客家小镇",
    "district": "龙岗",
    "category": "特色小镇",
    "rating": 4.75,
    "tags": [
      "客家文化",
      "夜景",
      "文创",
      "小清新"
    ],
    "desc": "深圳新晋网红小镇，客家围屋与现代文创完美融合，夜晚灯笼亮起时如穿越古代。",
    "address": "深圳市龙岗区甘坑客家小镇",
    "lat": 22.702,
    "lng": 114.214,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E7%94%98%E5%9D%91%E5%AE%A2%E5%AE%B6%E5%B0%8F%E9%95%87.jpg",
    "free": false,
    "openHours": "09:00-22:00"
  },
  {
    "id": 220,
    "name": "大芬油画村",
    "district": "龙岗",
    "category": "艺术",
    "rating": 4.7,
    "tags": [
      "油画",
      "艺术",
      "文创",
      "世界最大村"
    ],
    "desc": "世界最大的商品油画生产和出口基地，被誉为\"中国油画第一村\"，艺术氛围浓厚。",
    "address": "深圳市龙岗区大芬油画村",
    "lat": 22.676,
    "lng": 114.2195,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%A4%A7%E8%8A%AC%E6%B2%B9%E7%94%BB%E6%9D%91.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 221,
    "name": "鹤湖新居",
    "district": "龙岗",
    "category": "历史文化",
    "rating": 4.65,
    "tags": [
      "客家围屋",
      "历史",
      "建筑",
      "免费"
    ],
    "desc": "深圳最大客家围屋之一，建筑规模宏大，免费开放，是了解客家文化的绝佳场所。",
    "address": "深圳市龙岗区鹤湖新居",
    "lat": 22.684,
    "lng": 114.231,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E9%B9%A4%E6%B9%96%E6%96%B0%E5%B1%85.jpg",
    "free": true,
    "openHours": "09:00-17:30"
  },
  {
    "id": 222,
    "name": "坪山文化聚落",
    "district": "坪山",
    "category": "文化",
    "rating": 4.68,
    "tags": [
      "图书馆",
      "剧院",
      "美术馆",
      "建筑"
    ],
    "desc": "坪山新文化地标，包含图书馆、美术馆、剧院三大场馆，建筑设计极具现代感。",
    "address": "深圳市坪山区坪山街道文化聚落",
    "lat": 22.6815,
    "lng": 114.35,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%9D%AA%E5%B1%B1%E6%96%87%E5%8C%96%E8%81%9A%E8%90%BD.jpg",
    "free": true,
    "openHours": "10:00-21:00"
  },
  {
    "id": 223,
    "name": "马峦山郊野公园",
    "district": "坪山",
    "category": "山景",
    "rating": 4.78,
    "tags": [
      "瀑布",
      "登山",
      "自然",
      "徒步"
    ],
    "desc": "深圳最美山野公园，瀑布群蔚为壮观，是深圳徒步爱好者私藏的绝佳目的地。",
    "address": "深圳市坪山区马峦山郊野公园",
    "lat": 22.708,
    "lng": 114.338,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E9%A9%AC%E5%B3%A6%E5%B1%B1%E9%83%8A%E9%87%8E%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 224,
    "name": "金龟村",
    "district": "坪山",
    "category": "特色小镇",
    "rating": 4.6,
    "tags": [
      "田园",
      "露营",
      "萤火虫",
      "客家"
    ],
    "desc": "深圳最文艺的村庄，萤火虫季极为浪漫，精品民宿和露营地让这里成为周末逃离城市的好选择。",
    "address": "深圳市坪山区石井街道金龟村",
    "lat": 22.6485,
    "lng": 114.372,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E9%87%91%E9%BE%9F%E6%9D%91.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 225,
    "name": "虹桥公园",
    "district": "光明",
    "category": "公园",
    "rating": 4.8,
    "tags": [
      "红色栈道",
      "超长步道",
      "夜景",
      "震撼"
    ],
    "desc": "全长4公里的红色栈道盘旋山间，航拍视角极为震撼，是深圳新晋网红打卡地。",
    "address": "深圳市光明区虹桥公园",
    "lat": 22.7705,
    "lng": 113.9275,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%99%B9%E6%A1%A5%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 226,
    "name": "欢乐田园",
    "district": "光明",
    "category": "公园",
    "rating": 4.72,
    "tags": [
      "花海",
      "农业",
      "采摘",
      "田园"
    ],
    "desc": "深圳最大的农业主题公园，大片花海随季节变化，是周末亲子游和拍照的好去处。",
    "address": "深圳市光明区欢乐田园",
    "lat": 22.763,
    "lng": 113.903,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%AC%A2%E4%B9%90%E7%94%B0%E5%9B%AD.jpg",
    "free": false,
    "openHours": "09:00-18:00"
  },
  {
    "id": 227,
    "name": "迳口村",
    "district": "光明",
    "category": "特色小镇",
    "rating": 4.65,
    "tags": [
      "古村",
      "荔枝林",
      "骑行",
      "艺术"
    ],
    "desc": "500年历史的广府古村，艺术气息浓厚，环村骑行可以感受深圳难得的田园慢生活。",
    "address": "深圳市光明区迳口村",
    "lat": 22.774,
    "lng": 113.941,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%BF%B3%E5%8F%A3%E6%9D%91.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 228,
    "name": "中英街",
    "district": "盐田",
    "category": "历史文化",
    "rating": 4.55,
    "tags": [
      "一国两制",
      "历史",
      "购物",
      "边贸"
    ],
    "desc": "世界唯一的\"一街两制\"街道，左边深圳右边香港，是独特的历史文化街区。",
    "address": "深圳市盐田区沙头角中英街",
    "lat": 22.655,
    "lng": 114.2375,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E4%B8%AD%E8%8B%B1%E8%A1%97.jpg",
    "free": false,
    "openHours": "09:00-18:00"
  },
  {
    "id": 229,
    "name": "大小梅沙",
    "district": "盐田",
    "category": "海滨",
    "rating": 4.65,
    "tags": [
      "老牌海滩",
      "深圳记忆",
      "海滨",
      "免费"
    ],
    "desc": "深圳最早的海滨浴场，承载了几代深圳人的海边记忆，也是来深圳必去的经典景点。",
    "address": "深圳市盐田区大梅沙海滨公园",
    "lat": 22.637,
    "lng": 114.296,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%A4%A7%E5%B0%8F%E6%A2%85%E6%B2%99.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 230,
    "name": "恩上湿地公园",
    "district": "盐田",
    "category": "公园",
    "rating": 4.68,
    "tags": [
      "高山湿地",
      "S型公路",
      "海景",
      "隐秘"
    ],
    "desc": "藏在梧桐山半山腰的高山湿地，S型公路航拍非常震撼，是小众但绝美的打卡地。",
    "address": "深圳市盐田区恩上水库",
    "lat": 22.626,
    "lng": 114.209,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%81%A9%E4%B8%8A%E6%B9%BF%E5%9C%B0%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 231,
    "name": "深圳世界之窗",
    "district": "南山",
    "category": "主题乐园",
    "rating": 4.65,
    "tags": [
      "世界名胜",
      "缩小版奇观",
      "演出",
      "拍照"
    ],
    "desc": "汇聚全球130多个著名景点的缩微版，从埃菲尔铁塔到长城，一天游遍全世界。",
    "address": "深圳市南山区深南大道9037号",
    "lat": 22.5341,
    "lng": 113.9718,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%B7%B1%E5%9C%B3%E4%B8%96%E7%95%8C%E4%B9%8B%E7%AA%97.jpg",
    "free": false,
    "openHours": "09:30-22:30"
  },
  {
    "id": 232,
    "name": "华侨城欢乐海岸",
    "district": "南山",
    "category": "海滨",
    "rating": 4.72,
    "tags": [
      "购物",
      "海景",
      "灯光秀",
      "美食"
    ],
    "desc": "深圳首个以海洋文化为主题的大型商业旅游项目，沿湖漫步、购物、美食一站搞定。",
    "address": "深圳市南山区白石路33号",
    "lat": 22.5355,
    "lng": 113.9745,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%8D%8E%E4%BE%A8%E5%9F%8E%E6%AC%A2%E4%B9%90%E6%B5%B7%E5%B2%B8.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 233,
    "name": "欢乐港湾",
    "district": "宝安",
    "category": "海滨",
    "rating": 4.7,
    "tags": [
      "摩天轮",
      "海景",
      "夜景",
      "购物"
    ],
    "desc": "宝安滨海新地标，拥有深圳最大摩天轮，夜晚璀璨灯光与海景交相辉映，是打卡宝安必去之地。",
    "address": "深圳市宝安区宝安中心区滨海文化公园",
    "lat": 22.5695,
    "lng": 113.8405,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E6%AC%A2%E4%B9%90%E6%B8%AF%E6%B9%BE.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 234,
    "name": "南山博物馆",
    "district": "南山",
    "category": "展馆",
    "rating": 4.65,
    "tags": [
      "历史文化",
      "免费",
      "展览",
      "馆藏"
    ],
    "desc": "展示南山区历史文化的综合性博物馆，常设展厅涵盖海上丝路、南头古城等深圳独特历史。",
    "address": "深圳市南山区南新路1819号",
    "lat": 22.5285,
    "lng": 113.9245,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%8D%97%E5%B1%B1%E5%8D%9A%E7%89%A9%E9%A6%86.jpg",
    "free": true,
    "openHours": "09:00-17:00"
  },
  {
    "id": 235,
    "name": "前海石公园",
    "district": "南山",
    "category": "公园",
    "rating": 4.6,
    "tags": [
      "奇石",
      "海景",
      "免费",
      "散步"
    ],
    "desc": "前海湾畔的特色公园，汇聚奇石景观，远眺深圳湾大桥，是前海地区难得的休闲绿地。",
    "address": "深圳市南山区前海深港现代服务业合作区",
    "lat": 22.5188,
    "lng": 113.8945,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E5%89%8D%E6%B5%B7%E7%9F%B3%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 236,
    "name": "莲花山公园",
    "district": "福田",
    "category": "公园",
    "rating": 4.78,
    "tags": [
      "邓小平像",
      "城市全景",
      "放风筝",
      "登山"
    ],
    "desc": "山顶矗立着邓小平铜像，是深圳精神的象征，登顶可俯瞰福田CBD全景，也是放风筝的圣地。",
    "address": "深圳市福田区莲花街道莲花山公园",
    "lat": 22.5528,
    "lng": 114.0545,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E8%8E%B2%E8%8A%B1%E5%B1%B1%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "06:00-23:00"
  },
  {
    "id": 237,
    "name": "阳台山森林公园",
    "district": "宝安",
    "category": "山景",
    "rating": 4.73,
    "tags": [
      "水库",
      "登山",
      "徒步",
      "云海"
    ],
    "desc": "深圳西部最高峰，海拔587米，山脚铁岗水库云雾缭绕，是深圳徒步爱好者的经典路线。",
    "address": "深圳市宝安区石岩街道阳台山森林公园",
    "lat": 22.6585,
    "lng": 113.9015,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E9%98%B3%E5%8F%B0%E5%B1%B1%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  },
  {
    "id": 238,
    "name": "石岩湿地公园",
    "district": "宝安",
    "category": "公园",
    "rating": 4.65,
    "tags": [
      "湿地",
      "观鸟",
      "骑行",
      "自然"
    ],
    "desc": "宝安区生态湿地公园，拥有丰富的湿地生态系统，是观鸟和骑行的好去处。",
    "address": "深圳市宝安区石岩街道石岩湿地公园",
    "lat": 22.659,
    "lng": 113.9145,
    "image": "https://metour-1322296918.cos.ap-guangzhou.myqcloud.com/images/spots/%E7%9F%B3%E5%B2%A9%E6%B9%BF%E5%9C%B0%E5%85%AC%E5%9B%AD.jpg",
    "free": true,
    "openHours": "全天"
  }
];

module.exports = { spotData };
