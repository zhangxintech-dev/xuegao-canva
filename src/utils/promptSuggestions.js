const PROMPT_SUGGESTION_POOL = [
  '雨中魔法森林',
  '日式街面美食摄影',
  '瀑布水流飞溅',
  '雨天薰衣草花海',
  '赛博朋克猫咪咖啡馆',
  '雪山湖泊极光倒影',
  '玻璃温室里的水母',
  '复古胶片海边公路',
  '云端城堡儿童绘本',
  '未来感蓝色机甲少女',
  '国风山水里的飞鸟',
  '宇航员在花园午睡',
  '清晨厨房阳光早餐',
  '梦幻糖果色游乐园',
  '微缩世界森林车站',
  '水彩风樱花街道',
  '三只不同的小猫',
  '生成多角度分镜',
  '夏日田野环绕漫步',
  '极简白色产品海报',
  '电影感雨夜霓虹街头',
  '柔光棚拍香水广告',
  '机械蝴蝶停在花瓣上',
  '雪地里的红色小屋',
  '海底图书馆奇幻插画',
  '夕阳下的无人公路',
  '猫咪宇航员探索月球',
  '古风少女竹林回眸',
  '未来城市空中列车',
  '北欧木屋暖炉晚餐'
]

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5)

export const generatePromptSuggestions = () => {
  const count = Math.floor(Math.random() * 3) + 3
  return shuffle(PROMPT_SUGGESTION_POOL).slice(0, count)
}
