1）驾车（driving）路线规划


        该请求为GET请求

https://apis.map.qq.com/ws/direction/v1/driving/?from=39.915285,116.403857&to=39.915285,116.803857&waypoints=39.111,116.112;39.112,116.113&output=json&callback=cb&key=[你的key]

如有海外需求
点此查看海外版 →

参数说明

参数	必填	说明	示例
key	是	开发key	key=OB4BZ-D4W3U-****
from	是	起点位置坐标
格式：纬度在前，经度在后，半角逗号分隔。
注：系统将吸附就近道路作为起点，最大20公里内若无道路，会算路失败	from=40.034852,116.319820
from_poi	否	起点POI ID，传入后，优先级高于from（坐标）	from_poi=4077524088693206111
to	是	终点位置坐标，格式：lat,lng	to=39.771075,116.351395
to_poi	否	终点POI ID（可通过腾讯位置服务地点搜索服务得到），当目的地为较大园区、小区时，会以引导点做为终点（如出入口等），体验更优。
该参数优先级高于to（坐标），但是当目的地无引导点数据或POI ID失效时，仍会使用to（坐标）作为终点	to_poi=5371594408805356897
to_poiname	否	终点POI名称，当目的地为较大园区、小区时，会以引导点做为终点（如出入口等），体验更优
该参数优先级低于to（POI ID）、高于to（坐标），可以在无法获取POI ID时使用，但是当目的地无引导点数据或无法根据名称匹配POI或POI失效时，仍会使用to（坐标）作为终点
该参数仅在入参包含 policy=TRIP 时生效	to_poiname=清华大学附中
heading	否	[from辅助参数]在起点位置时的车头方向，数值型，取值范围0至360（0度代表正北，顺时针一周360度）
传入车头方向，对于车辆所在道路的判断非常重要，直接影响路线计算的效果	heading=175
speed	否	[from辅助参数]速度，单位：米/秒，默认3。 当速度低于1.39米/秒时，heading将被忽略	speed=5
accuracy	否	[from辅助参数]定位精度，单位：米，取>0数值，默认5。 当定位精度>30米时heading参数将被忽略	accuracy=30
road_type	否	[from辅助参数] 起点道路类型，可选值：
0 [默认]不考虑起点道路类型
1 在桥上；2 在桥下；3 在主路；4 在辅路；5 在对面；6 桥下主路；7 桥下辅路	车在辅路：
road_type=4
from_track	否	起点轨迹：
在真实的场景中，易受各种环境及设备精度影响，导致定位点产生误差，起点前段轨迹起到辅助参考作用，在车辆行驶中发起算路时，可对起点有修正作用。
轨迹中的每个定位点包含以下信息：
1.纬度
2.经度
3.速度：GPS速度，单位 米/秒，取不到传-1
4.精度：GPS精度, 单位毫米，取不到传-1
5.运动方向： gps方向，正北为0, 顺时针夹角，[0-360)，获取不到时传-1
6.设备方向：正北为0, 顺时针夹角，[0-360)，取不到传-1
7.时间：定位获取该点的时间，Unix时间戳，取不到传0
参数格式：
1.轨迹中最多支持传入50个点。
2.每个点之间英文分号分隔，时间顺序由旧到新（第一个点最早获取，最后一个点最新得到）
3.每个点中的信息用英文逗号分隔，并按以下顺序传入：
纬度,经度,速度,精度,运动方向,设备方向,时间;第2个点;第3个点……	from_track=40.037029,116.316633,16,500,160,-1,1529491290;
40.036634,116.317170,16,500,161,-1,1529491300;40.035977,
116.317663,16,500,159,-1,1529491310;40.035706,116.318328,
16,500,160,-1,1529491320;40.035090,116.319058,16,500,160,-1,1529491330;40.034852,116.319820,16,500,160,-1,1529491340
waypoints	否	途经点，格式：lat1,lng1;lat2,lng2;… 最大支持30个，超过30个之后的将被忽略	waypoints=39.951004,116.571980
waypoint_order	否	途经点智能排序，可选值：
0 [默认]不排序（按入参途经点顺序）
1 智能排序：对途经点以最顺路方式排序并规划路线，排序途经点最多16个，本参数属于高级付费参数，如需试用请提交商务合作开通试用。	waypoint_order=1
with_dest	否	途经点智能排序是否考虑终点：
1 [默认]考虑终点，以最优排序最终到达指定终点（to参数）
0 不考虑终点（to参数），仅对途经点排序并规划路线，终点参数将忽略（排序后的最后一个途经点将作为终点）	with_dest=1
departure_time	否	设置未来出发时间，参数传入后会使用指定时间的预测路况计算预计到达时间 及 路况信息（speed）,参数值格式为Unix时间戳，取值范围从当时时间到未来7天内的任意时间
本参数属于高级付费参数，如需试用请提交商务合作开通试用。
departure_time=1579477696
plate_number	否	车牌号，填入后，路线引擎会根据车牌对限行区域进行避让，不填则不不考虑限行问题	plate_number=京X309KX
cartype	否	车辆类型（影响限行规则），取值：
0：[默认]普通汽车
1：新能源	cartype=1
policy	否	一、策略参数（以下四选一）
LEAST_TIME：[默认]参考实时路况，时间最短
PICKUP：网约车场景 – 接乘客
TRIP：网约车场景 – 送乘客
SHORT_DISTANCE：不参考路况，距离短（此策略会忽略所有单项偏好参数、车牌和车型，仅返回一条路线）
二、单项偏好参数
（可与策略参数并用，可多选，逗号分隔）
REAL_TRAFFIC：参考实时路况
LEAST_FEE：少收费
HIGHWAY_FIRST：高速优先
AVOID_HIGHWAY：不走高速
HIGHROAD_FIRST：大路优先
NAV_POINT_FIRST： 该策略会通过终点坐标查找所在地点（如小区/大厦等），并使用地点出入口做为目的地，使路径更为合理
PICKUP_ADSORB: 打车接驾起终点吸附（支持与SHORT_DISTANCE共用）
TRIP_ADSORB: 打车送驾起终点吸附（支持与SHORT_DISTANCE共用）	policy=LEAST_TIME
policy=LEAST_TIME,AVOID_HIGHWAY
avoid_polygons	否	避让区域：支持32个避让区域，每个区域最多可有16个顶点（如果是四边形则有4个坐标点，如果是五边形则有5个坐标点）
参数格式：
纬度在前，经度在后，用半角逗号 “,” 分隔，小数点后不超过6位，各经纬度之间用半角分号 “;” 分隔。各区域多边形间，用竖线符号分隔 “|”	格式示例：
坐标1纬度,坐标1经度;坐标2纬度,坐标2经度,…

参数示例：
&avoid_polygons=39.914845,116.301098;39.916030,116.324272;39.932749,116.320667;39.937619,116.305046
get_mp	否	是否返回多方案，取值：
0 [默认]仅返回一条路线方案
1 返回多方案（最多可返回三条方案供用户备选）	get_mp=1
get_speed	否	是否返回路况（道路速度），取值：
0 [默认]不返回路况
1 返回路况	get_speed=1
added_fields	否	返回指定标准附加字段，取值支持：
cities 路线途经行政区划信息(按路线途经顺序排序)
网约车场景参数：
route_id 路线ID，乘客选中路线时，后续作为唯一路线标识传给导航SDK发起导航
nav_session_id 导航算路会话ID
custom_route_info乘客熟路(个性化路线)信息	added_fields=cities;route_id,nav_session_id
is_cache	否	[网约车场景]控制是否缓存算路结果，取值：
0 不存
1 缓存（地图服务端缓存算路结果，用于后续乘客选路后，从服务端缓存取出所选路线，进行路线保护）	is_cache=0
passenger	否	[网约车场景]乘客/用户唯一标识
1.乘客个性化上车点
2.个性化路线（熟路）	passenger=685479652147
no_step	否	不返回路线引导信息，可使回包数据量更小，取值：
0[默认]返回路线引导信息
1不返回	no_step=1
service_level	否	服务性能设置，可选值：
0 标准算路（默认）
1 轻量算路，性能较优	service_level=1
路线解释性内容	否	解释当前路线的类型，例如避堵、避开封路等
本参数属于高级付费参数，如需试用请提交商务合作开通试用。

沿途交通事件	否	返回途中的一些交通事件，例如交通事故、交通管制、道路施工等。
本参数属于高级付费参数，如需试用请提交商务合作开通试用。

output	否	返回值类型：json、jsonp	output=json
callback	否	回调函数	callback=cb
返回值说明

参数	类型	必有	说明
status	number	是	状态码，0为正常，其它为异常，详细请参阅状态码说明
message	string	是	状态说明
request_id	string	是	本次请求的唯一标识，由系统自动生成，用于追查结果有异常时使用
result	object	是	搜索结果
routes	array	是	路线方案（设置get_mp=1时可返回最多3条）
mode	string	是	方案交通方式，固定值：“DRIVING”
tags	array	否	方案标签，表明方案特色，详细说明见下文
示例：tags:[“LEAST_LIGHT”]
distance	number	是	方案总距离，单位：米
duration	number	是	方案估算时间（结合路况），单位：分钟
traffic_light_count	number	是	方案途经红绿灯个数
toll	number	是	高速过路费，单位：元
restriction	object	否	限行信息
status	number	是	限行状态码：
0 途经没有限行城市，或路线方案未涉及限行区域
1 途经包含有限行的城市
3 [设置车牌] 已避让限行
4 [设置车牌] 无法避开限行区域（本方案包含限行路段）
polyline	array	是	方案路线坐标点串（该点串经过压缩，解压请参考：polyline 坐标解压）
waypoints	array	否	途经点，（输入waypoints时才会有此结点返回）
当waypoint_order=0时，此列表与入参的waypoints顺序一致
当waypoint_order=1时，会以最优（路线最短）路线对入参的waypoints进行排序，再进行算路
title	string	否	途经点路名
location	object	否	途经点坐标
lat	number	否	纬度
lng	number	否	经度
polyline_idx	number	否	该途经点在polyline中的索引位置（数组下标位置）
duration	number	否	预估到达耗时，单位：分钟
distance	number	否	起点到该途经点的距离，单位：米
input_order_idx	number	否	当waypoint_order=1返回，该值对应途经点输入时的第几个途径点，0则表示该途经点为输入途经点参数时的第1个途经点，以此类推
taxi_fare	object	否	预估打车费
fare	number	否	预估打车费用，单位：元
cities	array	否	路线途经行政区划（按途经顺序排序），数组中每个对象为一个区划
adcode	number	否	途经行政区划的代码，代码对应的省市 区可参考行政区划接口
steps	array	是	路线步骤
instruction	string	是	阶段路线描述
polyline_idx	array	是	阶段路线坐标点串在方案路线坐标点串的位置
road_name	string	否	阶段路线路名
dir_desc	string	否	阶段路线方向
distance	number	是	阶段路线距离，单位：米
act_desc	string	否	阶段路线末尾动作：如：左转调头
accessorial_desc	string	否	末尾辅助动作：如：到达终点
speed	array	否	路况信息，只有设置get_speed=1才会返回
polyline_idx	array	否	阶段路线坐标点串，在路线坐标点串的位置
distance	number	否	路段距离，单位：米
speed	number	否	路段预估行驶速度，单位：千米/时
level	number	否	路况类型：
0:畅通 1:缓行 2:拥堵 3:无路况(大概率畅通) 4:严重拥堵
阶段路线末尾动作（act_desc）列表

左转
右转
偏左转
偏右转
左后转
右后转
左转掉头
直行
靠左
靠右
进入环岛
空
阶段路线方向（dir_desc）列表

东
东北
北
西北
西
西南
南
东南
“” 空（为空时，代表导航段有转弯且方向发生变化）
末尾辅助动作（accessorial_desc）列表

进入主路
进入辅路
出主路
进高速
进入匝道
进入隧道
进入中间岔道
进入右岔路
进入左岔路
进入右转专用道
进入左转专用道
进入服务区
进入调头车道
不要进入收费站
进入内部路
不要进入内部路
不要进入隧道
不要进入匝道
驶出高速
驶出当前高速
到达出口
到达收费站
到达途经地
到达目的地
到达目的地(在道路左侧)
到达目的地(在道路右侧)
到达入口
复杂路口右1
复杂路口右2
复杂路口右3
复杂路口右4
复杂路口右5
复杂路口左1
复杂路口左2
复杂路口左3
复杂路口左4
复杂路口左5



走第1个出口
走第2个出口
走第3个出口
走第4个出口
走第5个出口
走第6个出口
走第7个出口
到达途经点，走第1出口
到达途经点，走第2出口
到达途经点，走第3出口
到达途经点，走第4出口
到达途经点，走第5出口
到达途经点，走第6出口
到达途经点，走第7出口
到达途经点或目的地
注意不是右转
注意不是右后转
注意不是左转
注意不是左后转

上高架
不要上高架
下高架
不要下高架
上坡
下坡
不要上坡
不要下坡
上桥
下桥
不要上桥
不要下桥
走桥下
走小路
走河边
过天桥
过高架
不要走桥下
不要逆行

路线标签说明（result.routes[].tags[]）：

v1版本签：

“EXPERIENCE” 经验路线
“RECOMMEND” 推荐路线
“LEAST_LIGHT” 红绿灯少
“LEAST_TIME” 时间最短
“LEAST_DISTANCE” 距离最短
V2版标签（v2.0.4a新增）： 采用中文标签的方式，类型更为丰富，另外增了多方案横向对比得出的相对化标签（如距离长），列表如下：

“大众常走”
“避堵路线”
“经验路线”
“经验避堵”
“全程畅通”
“时间短”，“时间长”
“距离短”，“距离长”
“红绿灯少”，“红绿灯多”
“拥堵少”，“拥堵多”
“免费”，“收费”
“收费少”，“收费多”
“大路多”，“小路多”
“无高速”，“走高速”
“高速多”，“高速少”
“拐弯少”，“拐弯多”
其它路线解释性标签：

“FERRY” 路线中包含轮渡
“NARROW” 包含小路
示例：

{
    "status":0,                                             //状态码
    "message":"query ok",                                   //状态说明
    "result":{                                              //搜索结果
        "routes":[{                                                        //路线方案
            "mode":"DRIVING",                               //出行方式
            "distance":263178,                              //总距离（单位：米）
            "duration":277,                                 //估算时间（含路况，单位：分钟）
            "restriction":{"status":0},     //限行信息（本例为：路线方案未涉及限行区域）
            "polyline":[39.91522,116.403857,-20,-697,0,0,-40,170,0,0,-6162,305,... ...],
            //途经点，顺序与输入waypoints一致，输入此参数时，才会有此结点返回
           "waypoints":[
               {
            "id": "",
            "title": "",
            "location": {
              "lat": 39.942513,
              "lng": 116.351813
            },
            "polyline_idx": 382,
            "distance": 9395,
            "duration": 40,
            "input_order_idx": 0 //，当waypoint_order=1时返回该字段，0则表示该途经点为输入途经点参数时的第1个途经点
          },
          {
            "id": "",
            "title": "",
            "location": {
              "lat": 39.906198,
              "lng": 116.355882
            },
            "polyline_idx": 588,
            "distance": 16519,
            "duration": 63,
            "input_order_idx": 2//当waypoint_order=1时返回该字段，2则表示该途经点为输入途经点参数时的第3个途经点
          }
            ],
            //具体方案
            "steps":[{                                            //第一阶段路线
                "instruction":"沿东华门大街向西行驶74米,左转注意不是左后转",      //路线描述
                "polyline_idx":[0,7],                             //该阶段路线在【路线坐标点串】数组中的下标0-7
                "road_name":"东华门大街",                          //路线路名
                "dir_desc":"西",                                  //路线方向
                "distance":74,                                    //路线距离（米）
                "duration":1,                                     //方案估算时间（含路况）
                "act_desc":"左转",                                //路线末尾动作（非必有）
                "accessorial_desc":"注意不是左后转"
            },
            {   //第二阶段路线
                "instruction":"沿南池子大街向南行驶809米,右转",
                "polyline_idx":[8,15],
                "road_name":"南池子大街",
                "dir_desc":"南",
                "distance":809,
                "duration":1,
                "act_desc":"右转",
                "accessorial_desc":""
            },
 
            ... ...
 
            {   //最终阶段路线
                "instruction":"行驶425米,",
                "polyline_idx":[2020,2027],
                "road_name":"",
                "dir_desc":"",
                "distance":425,
                "act_desc":"",
                "accessorial_desc":""
            }],
            "tags":[
                 "RECOMMEND"
            ],
            "taxi_fare":{
                 "fare":898
            }
        }]
    }
}
前往示例中心 在线体验 ➤


2）步行（walking）路线规划


        请求URL示例：

https://apis.map.qq.com/ws/direction/v1/walking/?from=39.984042,116.307535&to=39.976249,116.316569&key=[你的key]

如有海外需求
点此查看海外版 →

参数说明：

参数	必填	说明	示例
key	是	开发key	key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-*****
from	是	起点位置坐标
格式：纬度在前，经度在后，半角逗号分隔。
注：系统将吸附就近道路作为起点，最大20公里内若无道路，则会算路失败	from=39.915285,116.403857
to	是	终点位置坐标，格式：lat,lng
注：直线距离过长或过短会算路失败，最短距离不小于10米，最长距离不超过300公里	to=39.915285,116.803857
to_poi	否	终点POI ID（可通过腾讯位置服务地点搜索服务得到），当目的地为较大园区、小区时，会以引导点做为终点（如出入口等），体验更优。
该参数优先级高于to（坐标），但是当目的地无引导点数据或POI ID失效时，仍会使用to（坐标）作为终点	to_poi=5371594408805356897
callback	否	回调函数	callback=cb
output	否	返回值类型：json、jsonp	output=json
响应结果

参数	类型	必有	说明
status	number	是	状态码，0为正常，其它为异常，详细请参阅状态码说明
message	string	是	状态说明
result	object	是	搜索结果
routes	array	是	路线方案
mode	string	是	方案交通方式，固定值：“WALKING”
distance	number	是	方案整体距离，单位：米
duration	number	是	方案估算时间，单位：分钟
direction	string	是	方案整体方向
polyline	array	是	方案路线坐标点串（该点串经过压缩，解压请参考：polyline 坐标解压）
steps	array	是	路线步骤
instruction	string	是	阶段路线描述
polyline_idx	array	是	阶段路线坐标点串在方案路线坐标点串的位置
road_name	string	否	阶段路线路名
dir_desc	string	否	阶段路线方向
distance	number	是	阶段路线距离，单位：米
act_desc	string	否	阶段路线末尾动作
type	number	是	阶段路线的步行设施类型（type），包含：
0普通道路，1过街天桥，2地下通道，3人行横道
阶段路线末尾动作（act_desc）列表

左转
右转
偏左转
偏右转
左后转
右后转
左转掉头
直行
空
阶段路线方向（dir_desc）列表

东
东北
北
西北
西
西南
南
东南
“” 空（为空时，代表导航段有转弯且方向发生变化）
响应结果示例

{
    "status":0,                                                     //状态码
    "message":"query ok",                                           //状态说明
    "result":{                                                      //搜索结果
                "routes":[{                                         //路线方案，目前只提供一种
                    "mode":"WALKING",                               //出行方式
                    "distance":38385,                               //方案总距离（单位：米）
                    "duration":581,                                 //方案估算时间（含路况，单位：分钟）
                    "direction":"东",                               //方案整体方向
                    "polyline":[39.915219, 116.403857,0,12,40,1180,40,1520,0,80,... ...],//路线坐标点串
                    "steps":[
                        {                                           //第一阶段路线,起始位置，该阶段路线描述
                            "instruction":"从起点朝东,沿东华门大街步行239米,直行进入东安门大街",
                            "polyline_idx":[0,9],                   //路线在【路线坐标点串】数组中的下标0-9
                            "road_name":"东华门大街",               //道路名称(非必有)
                            "dir_desc":"东",                        //路线方向
                            "distance":239,                         //路线距离（单位：米）
                            "act_desc":"直行"                       //路线末尾动作（非必有）
                        },
 
                        ... ...
 
                        {                                           //最终阶段路线
                            "instruction":"步行255米,到达终点",
                            "polyline_idx":[1556,1567],
                            "road_name":"",
                            "dir_desc":"东",
                            "distance":255,
                            "act_desc":""
                        }]
                    }]
            }
}
前往示例中心 在线体验 ➤


3）骑行（bicycling）路线规划


        请求URL示例：

https://apis.map.qq.com/ws/direction/v1/bicycling/?from=39.984042,116.307535&to=39.980869,116.325238&key=[你的key]

如有海外需求
点此查看海外版 →

参数说明：

参数	必填	说明	示例
key	是	开发key	key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-*****
from	是	起点位置坐标
格式：纬度在前，经度在后，半角逗号分隔。
注：系统将吸附就近道路作为起点，最大20公里内若无道路，则会算路失败	from=39.915285,116.403857
to	是	终点位置坐标，格式：lat,lng
注：直线距离过长或过短会算路失败，最短距离不小于10米，最长距离不超过500公里	to=39.915285,116.803857
to_poi	否	终点POI ID（可通过腾讯位置服务地点搜索服务得到），当目的地为较大园区、小区时，会以引导点做为终点（如出入口等），体验更优。
该参数优先级高于to（坐标），但是当目的地无引导点数据或POI ID失效时，仍会使用to（坐标）作为终点	to_poi=5371594408805356897
added_fields	否	返回指定可选字段，支持：
ferry_count 路线中包乘坐含轮渡的次数	added_fields=ferry_count
callback	否	回调函数	callback=cb
output	否	返回值类型：json、jsonp	output=json
响应结果

参数	类型	必有	说明
status	number	是	状态码，0为正常，其它为异常，详细请参阅状态码说明
message	string	是	状态说明
result	object	是	搜索结果
routes	array	是	路线方案
mode	string	是	方案交通方式，固定值：“BICYCLING”
distance	number	是	方案整体距离，单位：米
duration	number	是	方案估算时间，单位：分钟
direction	string	是	方案整体方向
polyline	array	是	方案路线坐标点串（该点串经过压缩，解压请参考：polyline 坐标解压）
steps	array	是	路线步骤
instruction	string	是	阶段路线描述
polyline_idx	array	是	阶段路线坐标点串在方案路线坐标点串的位置
road_name	string	否	阶段路线路名
dir_desc	string	否	阶段路线方向
distance	number	是	阶段路线距离，单位：米
act_desc	string	否	阶段路线末尾动作
ferry_count	number	否	路线途经乘坐轮渡的次数（>=1时代表路线中包含轮渡）
注：本参数通过added_fields=ferry_count控制返回
阶段路线末尾动作（act_desc）列表

左转
右转
偏左转
偏右转
左后转
右后转
左转掉头
直行
空
阶段路线方向（dir_desc）列表

东
东北
北
西北
西
西南
南
东南
“” 空（为空时，代表导航段有转弯且方向发生变化）
响应结果示例

{
    "status":0,                                                     //状态码
    "message":"query ok",                                           //状态说明
    "result":{                                                      //搜索结果
                "routes":[{                                         //路线方案，目前只提供一种
                    "mode":"BICYCLING",                               //出行方式
                    "distance":1861,                               //方案总距离（单位：米）
                    "duration":9,                                 //方案估算时间（含路况，单位：分钟）
                    "direction":"西",                               //方案整体方向
                    "polyline":[39.98409,116.30804,0,60,0,0,-540,-10.....],//路线坐标点串
                    "steps":[
                        {                                           //第一阶段路线,起始位置，该阶段路线描述
                            "instruction":"从起点朝北,行进7米,右后转进入彩和坊路",
                            "polyline_idx":[0,3],                   //路线在【路线坐标点串】数组中的下标0-9
                            "road_name":"",               //道路名称(非必有)
                            "dir_desc":"北",                        //路线方向
                            "distance":7,                         //路线距离（单位：米）
                            "act_desc":"右后转"                       //路线末尾动作（非必有）
                        },
 
                        ... ...
 
                        {                                           //最终阶段路线
                            "instruction":"沿中关村南路行进29米,到达终点",
                            "polyline_idx":[248,251],
                            "road_name":"中关村南路",
                            "dir_desc":"东",
                            "distance":29,
                            "act_desc":""
                        }]
                    }]
            }
}
前往示例中心 在线体验 ➤


4）电动车（ebicycling）路线规划
本功提供针对电动自行车的路线规划能力，服务充分考虑电动自行可通行的设施、道路，确保路线的合理性。

请求URL
https://apis.map.qq.com/ws/direction/v1/ebicycling/?from=23.020685,113.489096&to=23.019998,113.489190&key=[你的key]

请求参数
参数	必填	说明	示例
key	是	开发key	key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-*****
from	是	起点位置坐标
格式：纬度在前，经度在后，半角逗号分隔。
注：系统将吸附就近道路作为起点，最大20公里内若无道路，则会算路失败	from=39.915285,116.403857
to	是	终点位置坐标，格式：lat,lng	to=39.915285,116.803857
to_poi	否	终点POI ID（可通过腾讯位置服务地点搜索服务得到），当目的地为较大园区、小区时，会以引导点做为终点（如出入口等），体验更优。
该参数优先级高于to（坐标），但是当目的地无引导点数据或POI ID失效时，仍会使用to（坐标）作为终点	to_poi=5371594408805356897
added_fields	否	返回指定可选字段，支持：
ferry_count 路线中包乘坐含轮渡的次数	added_fields=ferry_count
callback	否	回调函数	callback=cb
output	否	返回值类型：json、jsonp	output=json
响应结果
参数	类型	必有	说明
status	number	是	状态码，0为正常，其它为异常，详细请参阅状态码说明
message	string	是	状态说明
result	object	是	搜索结果
routes	array	是	路线方案
mode	string	是	方案交通方式，固定值：“EBICYCLING”
distance	number	是	方案整体距离，单位：米
duration	number	是	方案估算时间，单位：分钟
direction	string	是	方案整体方向
polyline	array	是	方案路线坐标点串（该点串经过压缩，解压请参考：polyline 坐标解压）
steps	array	是	路线步骤
instruction	string	是	阶段路线描述
polyline_idx	array	是	阶段路线坐标点串在方案路线坐标点串的位置
road_name	string	否	阶段路线路名
dir_desc	string	否	阶段路线方向
distance	number	是	阶段路线距离，单位：米
act_desc	string	否	阶段路线末尾动作
ferry_count	number	否	路线途经乘坐轮渡的次数（>=1时代表路线中包含轮渡）
注：本参数通过added_fields=ferry_count控制返回
阶段路线末尾动作（act_desc）列表

左转
右转
偏左转
偏右转
左后转
右后转
左转掉头
直行
空
阶段路线方向（dir_desc）列表

东
东北
北
西北
西
西南
南
东南
“” 空（为空时，代表导航段有转弯且方向发生变化）
响应结果示例
{
    "status": 0,
    "message": "query ok",
    "result": {
        "routes": [
            {
                "mode": "EBICYCLING",
                "distance": 26,
                "duration": 0,
                "direction": "南",
                "polyline": [
                    23.020059,
                    113.489437,
                    -101,
                    -219,
                    0,
                    0,
                    -4,
                    -11
                ],
                "steps": [
                    {
                        "instruction": "从起点朝西南,行进26米,到达终点",
                        "polyline_idx": [
                            0,
                            7
                        ],
                        "road_name": "",
                        "dir_desc": "西南",
                        "distance": 26,
                        "act_desc": ""
                    }
                ]
            }
        ]
    }
}
前往示例中心 在线体验 ➤


5）公交（transit）路线规划


基于公共汽车、地铁、火车等公共交通工具，计算起到终点的路线换乘方案，同时提供少换乘、少步行等偏好设置，支持一次返回多条方案以供用户选择。

请求URL
https://apis.map.qq.com/ws/direction/v1/transit/?from=39.915285,116.403857&to=39.915285,116.603857&key=[你的key]

如有海外需求
点此查看海外版 →

请求参数
参数	必填	说明	示例
key	是	开发key	key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-*****
from	是	起点位置坐标，格式为纬度在前，经度在后，用半角逗号分隔	from=39.915285,116.403857
from_poi	否	起点POI ID，该参数优先级高于from（坐标）	from_poi=4077524088693206111
to	是	终点位置坐标，格式为纬度在前，经度在后，用半角逗号分隔	to=39.915285,116.803857
to_poi	否	终点POI ID（可通过腾讯位置服务地点搜索服务得到），当目的地为较大园区、小区时，会以引导点做为终点（如出入口等），体验更优。
该参数优先级高于to（坐标），但是当目的地无引导点数据或POI ID失效时，仍会使用to（坐标）作为终点	to_poi=5371594408805356897
departure_time	否	出发时间，用于过滤掉非运营时段的线路，
格式为Unix时间戳，默认使用当前时间	departure_time=1509357129
policy	否	路线计算偏好	1) 排序策略，以下四选一：
policy=LEAST_TIME：时间短（默认）
policy=LEAST_TRANSFER：少换乘
policy=LEAST_WALKING：少步行
policy=RECOMMEND：推荐策略，结合步行、换乘、耗时等多方面综合排序结果（与腾讯地图APP默认策略一致）
2) 额外限制条件
NO_SUBWAY：不坐地铁
ONLY_SUBWAY：只坐地铁
SUBWAY_FIRST：地铁优先
3) 排序策略与额外条件可同时使用，如：
policy=LEAST_TRANSFER,NO_SUBWAY
added_fields	否	附加字段：
line_color，地铁路线颜色	added_fields=line_color
callback	否	回调函数	callback=cb
output	否	返回值类型：json、jsonp	output=json

响应结果
参数	类型	必有	说明
status	number	是	状态码，0为正常，其它为异常，详细请参阅状态码说明
message	string	是	状态说明
result	object	是	计算结果
routes	array	是	路线方案
distance	number	是	方案整体距离，单位：米
duration	number	是	方案估算时间，单位：分钟
bounds	number	是	整体路线的外接矩形范围，可在地图显示时使用，
通过矩形西南+东北两个端点坐标定义而面，示例：
“39.901405,116.334023,39.940289,116.451720”
steps	array	是	一条完整公交路线可能会包含多种公共交通工具，各交通工具的换乘由步行路线串联起来，形成这样的结构（即 steps数组的结构）：
[步行 , 公交 , 步行 , 公交 , 步行(到终点)]
mode	string	是	本段交通方式，取值：
WALKING：步行
TRANSIT：公共交通工具
不同的方式，返回不同的数据结构，须根据该参数值来判断以哪种结构进行解析，各类具体定义见下文
其它字段	- -	是	随mode不同有不同字段返回，见下文

响应结果 - 交通方式 - 步行
本段为步行方式的对象结构，对应result.steps[]数组下的子对象（“mode”:“WALKING”）

参数	类型	必有	说明
mode	string	是	交通方式，固定值：“WALKING”，通过本参数判断数据结构类型
distance	number	是	本段step距离，单位：米
duration	number	是	估算时间，单位：分钟
direction	string	是	方案整体方向描述，如：“南”
polyline	array	是	路线坐标点串，可用于在地图中绘制路线
（坐标串经过压缩，解压与使用，请参考下文）
steps	array	否	分路段诱导信息
routes	array	是	路线方案
instruction	string	是	诱导描述，如 “沿东华门大街向西行驶74米”
polyline_idx	array	是	本路段点串在polyline中的数组下标位置，格式：
“polyline_idx”:[起始下标位置，结束下标位置]
详细使用见下文《polyline_idx说明》
road_name	string	否	本段路名
dir_desc	string	否	本段主要方向描述
distance	number	是	本段路线距离，单位：米
act_desc	string	否	本段末尾动作：如：左转调头

响应结果 - 交通方式 - 公共交通（TRANSIT）
本段为公共交通方式的对象结构，对应result.steps[]数组下的子对象（“mode”:“TRANSIT”）


1. 交通工具 - 公共汽车（“vehicle”：“BUS”）：
本段为公共交通的子对象，vehicle属性值为"BUS"

参数	类型	必有	说明
mode	string	是	交通方式，固定值：“TRANSIT”，通过本参数判断数据结构类型
lines	array	否	lines线路信息，因为起点到终点，可能存在多条线路可选，所以lines为数组，
而多条线路经过站点相同，所以数组第一会给出较完整信息，其它项则只返回路线名称等简要信息。
vehicle	string	是	交通工具：公交车（BUS）
id	string	是	线路唯一标识
title	string	是	线路名称
station_count	number	是	经停站数
running_status	number	是	线路运营状态，取值范围：
300：正常
301：可能错过末班车
302：首班车还未发出
303：停运
price	number	否	预估费用，单位：分，返回-1时为缺少票价信息
distance	number	是	路线距离，单位：米
duration	number	是	路线估算时间，单位：分钟
polyline	array	是	线路坐标点串，可用于在地图中绘制路线
（坐标串经过压缩，解压与使用，请参考下文）
destination	object	是	线路终点站，用于指示乘坐方向（环线则为下一站）
id	string	是	站点唯一标识
title	string	是	终点站名
start_time	string	否	首班车时间
end_time	string	否	末班车时间
geton	object	是	上车站
id	string	是	站点唯一标识
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
getoff	object	是	下车站
id	string	是	站点唯一标识
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
stations	object array	是	经停站列表
id	string	是	站点唯一标识
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度

2. 交通工具 - 地铁（“vehicle”：“SUBWAY”）：
本段为公共交通的子对象，vehicle属性值为"SUBWAY"

参数	类型	必有	说明
mode	string	是	交通方式，固定值：“TRANSIT”，通过本参数判断数据结构类型
lines	array	否	lines线路信息，因为起点到终点，可能存在多条线路可选，所以lines为数组，
而多条线路经过站点相同，所以数组第一会给出较完整信息，其它项则只返回路线名称等简要信息。
vehicle	string	是	交通工具：公交车（BUS）
id	string	是	线路唯一标识
title	string	是	线路名称
station_count	number	是	经停站数
running_status	number	是	线路运营状态，取值范围：
300：正常
301：可能错过末班车
302：首班车还未发出
303：停运
price	number	否	预估费用，单位：分，返回-1时为缺少票价信息
distance	number	是	路线距离，单位：米
duration	number	是	路线估算时间，单位：分钟
polyline	array	是	线路坐标点串，可用于在地图中绘制路线
（坐标串经过压缩，解压与使用，请参考下文）
destination	object	是	终点站，用于表明乘坐方向，环线线路为下一站
id	string	是	站点唯一标识
title	string	是	终点站名
start_time	string	否	首班车时间
end_time	string	否	末班车时间
geton	object	是	上车站
id	string	是	站点唯一标识
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
exit	object	否	出入口
id	string	否	唯一标识
title	string	否	出入口名称
getoff	object	是	下车站
id	string	是	站点唯一标识
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
exit	object	否	出入口
id	string	否	唯一标识
title	string	否	出入口名称
stations	object array	是	途经站列表
id	string	是	站点唯一标识
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
line_color	string	否	地铁路线颜色，设置added_fields=line_color时返回，如："#0060A4"

3. 交通工具 - 火车（“vehicle”：“RAIL”）：
本段为公共交通的子对象，vehicle属性值为"RAIL"

参数	类型	必有	说明
mode	string	是	交通方式，固定值：“TRANSIT”，通过本参数判断数据结构类型
lines	array	否	lines线路信息，因为起点到终点，可能存在多条线路可选，所以lines为数组，
而多条线路经过站点相同，所以数组第一会给出较完整信息，其它项则只返回路线名称等简要信息。
vehicle	string	是	交通工具：铁路（RAIL）
title	string	是	车次名称
station_count	number	是	经停站数
running_status	number	是	线路运营状态，取值范围：
300：正常
301：可能错过末班车
302：首班车还未发出
303：停运
price	number	否	票价，单位：元，返回-1时代表无票价信息
distance	number	是	距离，单位：米
duration	number	是	估算时间，单位：分钟
departure_time	string	否	发车时间
arrival_time	string	否	到达时间
days_count	number	否	耗时天数，1为当天到达，2为隔天到达，以此类推
polyline	array	是	线路坐标点串，可用于在地图中绘制路线
注：火车路线仅返回途经车站的坐标，并非完整铁路线坐标
（坐标串经过压缩，解压与使用，请参考下文）
destination	object	是	目的地站点
id	string	是	站点唯一标识，目前火车站点始终为"0"
title	string	是	站名
geton	object	是	上车站
id	string	是	站点唯一标识，目前火车站点始终为"0"
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
getoff	object	是	下车站
id	string	是	站点唯一标识，目前火车站点始终为"0"
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度
stations	object array	是	途经站列表
title	string	是	站点名称
location	object	是	站点经纬度坐标
lat	number	是	纬度
lng	number	是	经度

polyline 坐标解压
polyline为数值型一维数组，格式为：
[坐标1纬度 , 坐标1经度 , 坐标2纬度 , 坐标2经度 , 坐标3纬度 , 坐标3经度…]，
第一个坐标为原始未被压缩过的，之后的使用前向差分进行压缩，解压方法如下：

var coors=[50.243916,127.496637,-345,-1828,19867,-26154];
for (var i = 2; i < coors.length ; i++)
{coors[i] = coors[i-2] + coors[i]/1000000}

polyline_idx说明
下图为polyline的数组结构，路线全程的坐标点串都在polyline中， "polyline_idx"表达的是路段点串在polyline中的数组下标位置（而非坐标个数位置）的开始到结束序号，举个例子，假设某路段(steps)在polyline中是第4到第6个坐标，则polyline_idx为 “polyline_idx”:[6,11]