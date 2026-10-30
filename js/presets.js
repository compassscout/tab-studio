/* presets.js — 内置站点库（本地，无网络），图标统一走 Chrome 本地 favicon，失败回退品牌色 + 首字 */

export const CATEGORIES = [
  { id: 'popular', label: '受欢迎的', icon: 'i-star' },
  { id: 'apps', label: '应用', icon: 'i-globe' },
  { id: 'news', label: '新闻', icon: 'i-note' },
  { id: 'music', label: '音乐视频', icon: 'i-star' },
  { id: 'photos', label: '图片', icon: 'i-globe' },
  { id: 'shopping', label: '购物与团购', icon: 'i-folder' },
  { id: 'social', label: '社交与博客', icon: 'i-globe' },
  { id: 'sports', label: '体育与旅行', icon: 'i-globe' },
  { id: 'life', label: '生活方式', icon: 'i-note' },
  { id: 'games', label: '游戏与娱乐', icon: 'i-star' },
  { id: 'edu', label: '教育与招聘', icon: 'i-note' },
  { id: 'tech', label: '数码科技', icon: 'i-gear' },
  { id: 'finance', label: '金融', icon: 'i-globe' },
  { id: 'reading', label: '阅读', icon: 'i-note' },
  { id: 'others', label: '其他', icon: 'i-folder' },
];

/** 默认首屏站点（首次安装写入） */
export const DEFAULT_SITES = [
  { name: '京东', url: 'https://www.jd.com', color: '#e1251b', cat: 'shopping' },
  { name: '淘宝', url: 'https://www.taobao.com', color: '#ff5000', cat: 'shopping' },
  { name: '百度', url: 'https://www.baidu.com', color: '#2932e1', cat: 'popular' },
  { name: '微博', url: 'https://weibo.com', color: '#e6162d', cat: 'social' },
  { name: '知乎', url: 'https://www.zhihu.com', color: '#0066ff', cat: 'social' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com', color: '#fb7299', cat: 'music' },
  { name: 'GitHub', url: 'https://github.com', color: '#24292f', cat: 'tech' },
  { name: '网易云音乐', url: 'https://music.163.com', color: '#e60026', cat: 'music' },
  { name: '豆瓣', url: 'https://www.douban.com', color: '#2eaf6d', cat: 'reading' },
  { name: '少数派', url: 'https://sspai.com', color: '#d54354', cat: 'tech' },
  { name: '爱奇艺', url: 'https://www.iqiyi.com', color: '#00be06', cat: 'music' },
];

export const PRESET_SITES = [
  { name: '百度', url: 'https://www.baidu.com', desc: '中文搜索引擎与综合服务入口', color: '#2932e1', cat: 'popular' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com', desc: '视频弹幕社区与创作者平台', color: '#fb7299', cat: 'popular' },
  { name: '知乎', url: 'https://www.zhihu.com', desc: '问答式知识社区', color: '#0066ff', cat: 'popular' },
  { name: '微博', url: 'https://weibo.com', desc: '公共舆论场与热点社交平台', color: '#e6162d', cat: 'popular' },
  { name: '淘宝', url: 'https://www.taobao.com', desc: '综合网络零售购物平台', color: '#ff5000', cat: 'popular' },
  { name: '京东', url: 'https://www.jd.com', desc: '自营电商与物流配送平台', color: '#e1251b', cat: 'popular' },
  { name: '小红书', url: 'https://www.xiaohongshu.com', desc: '生活方式分享社区', color: '#ff2741', cat: 'popular' },
  { name: '抖音', url: 'https://www.douyin.com', desc: '短视频与直播平台', color: '#111111', cat: 'popular' },

  { name: 'Google', url: 'https://www.google.com', desc: '全球搜索引擎', color: '#4285f4', cat: 'apps' },
  { name: 'Gmail', url: 'https://mail.google.com', desc: '网页邮箱', color: '#ea4335', cat: 'apps' },
  { name: 'Google 文档', url: 'https://docs.google.com', desc: '云端文档与表格协作', color: '#0f9d58', cat: 'apps' },
  { name: 'Google 翻译', url: 'https://translate.google.com', desc: '多语言在线翻译', color: '#4285f4', cat: 'apps' },
  { name: 'Google 日历', url: 'https://calendar.google.com', desc: '在线日程管理', color: '#1a73e8', cat: 'apps' },
  { name: 'Notion', url: 'https://www.notion.so', desc: '笔记、文档与知识库', color: '#000000', cat: 'apps' },
  { name: 'Figma', url: 'https://www.figma.com', desc: '在线协作设计工具', color: '#f24e1e', cat: 'apps' },
  { name: 'Canva', url: 'https://www.canva.com', desc: '在线平面设计', color: '#00c4cc', cat: 'apps' },

  { name: '新华网', url: 'http://www.xinhuanet.com', desc: '国家通讯社新闻门户', color: '#c0392b', cat: 'news' },
  { name: '人民网', url: 'http://www.people.com.cn', desc: '中央重点新闻网站', color: '#b03a2e', cat: 'news' },
  { name: '澎湃新闻', url: 'https://www.thepaper.cn', desc: '时政与思想类新闻平台', color: '#2c3e50', cat: 'news' },
  { name: '腾讯新闻', url: 'https://news.qq.com', desc: '综合新闻资讯', color: '#1677ff', cat: 'news' },
  { name: '36氪', url: 'https://36kr.com', desc: '科技创投资讯', color: '#4285f4', cat: 'news' },

  { name: '网易云音乐', url: 'https://music.163.com', desc: '在线音乐流媒体社区', color: '#e60026', cat: 'music' },
  { name: 'QQ音乐', url: 'https://y.qq.com', desc: '正版数字音乐平台', color: '#31c27c', cat: 'music' },
  { name: 'YouTube', url: 'https://www.youtube.com', desc: '全球视频分享平台', color: '#ff0000', cat: 'music' },
  { name: '爱奇艺', url: 'https://www.iqiyi.com', desc: '长视频综合平台', color: '#00be06', cat: 'music' },
  { name: '优酷', url: 'https://youku.com', desc: '长视频综合平台', color: '#1989fa', cat: 'music' },
  { name: '腾讯视频', url: 'https://v.qq.com', desc: '影视综艺在线观看', color: '#ff6a00', cat: 'music' },
  { name: 'Spotify', url: 'https://open.spotify.com', desc: '全球音乐流媒体', color: '#1db954', cat: 'music' },

  { name: '花瓣网', url: 'https://huaban.com', desc: '设计灵感与图片收藏', color: '#ec5163', cat: 'photos' },
  { name: 'Pixabay', url: 'https://pixabay.com', desc: '免费高清图片素材', color: '#1f9f55', cat: 'photos' },
  { name: 'Unsplash', url: 'https://unsplash.com', desc: '高质量摄影作品', color: '#111111', cat: 'photos' },
  { name: 'Pexels', url: 'https://www.pexels.com', desc: '免费图片与视频素材', color: '#05a081', cat: 'photos' },

  { name: '拼多多', url: 'https://www.pinduoduo.com', desc: '拼团社交电商', color: '#e02e24', cat: 'shopping' },
  { name: '美团', url: 'https://www.meituan.com', desc: '本地生活服务与团购', color: '#ffc300', cat: 'shopping' },
  { name: '当当', url: 'http://www.dangdang.com', desc: '网上图书百货商城', color: '#d94235', cat: 'shopping' },
  { name: '天猫', url: 'https://www.tmall.com', desc: '品牌旗舰店购物', color: '#ff0036', cat: 'shopping' },

  { name: 'GitHub', url: 'https://github.com', desc: '开发者代码托管社区', color: '#24292f', cat: 'social' },
  { name: 'X', url: 'https://x.com', desc: '短讯式社交网络', color: '#111111', cat: 'social' },
  { name: '豆瓣', url: 'https://www.douban.com', desc: '书影音评论与兴趣小组', color: '#2eaf6d', cat: 'social' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com', desc: '职业社交网络', color: '#0a66c2', cat: 'social' },

  { name: '虎扑', url: 'https://www.hupu.com', desc: '体育赛事与球迷社区', color: '#177245', cat: 'sports' },
  { name: '携程旅行', url: 'https://www.ctrip.com', desc: '机票酒店旅游预订', color: '#2577e3', cat: 'sports' },
  { name: '马蜂窝', url: 'https://www.mafengwo.cn', desc: '旅游攻略与目的地社区', color: '#c8372d', cat: 'sports' },
  { name: '飞猪', url: 'https://www.fliggy.com', desc: '在线旅行预订', color: '#ff6a00', cat: 'sports' },

  { name: '下厨房', url: 'https://www.xiachufang.com', desc: '菜谱与做饭社区', color: '#e26643', cat: 'life' },
  { name: '豆瓣同城', url: 'https://www.douban.com/explore', desc: '同城活动与兴趣', color: '#42bd56', cat: 'life' },
  { name: '知乎日报', url: 'https://daily.zhihu.com', desc: '精选问答每日推送', color: '#0084ff', cat: 'life' },

  { name: 'Steam', url: 'https://store.steampowered.com', desc: 'PC 游戏数字发行平台', color: '#1b2838', cat: 'games' },
  { name: 'TapTap', url: 'https://www.taptap.cn', desc: '手游发现与社区', color: '#2d3a4b', cat: 'games' },
  { name: '4399', url: 'https://www.4399.com', desc: '休闲网页小游戏', color: '#e8a13a', cat: 'games' },

  { name: '中国大学MOOC', url: 'https://www.icourse163.org', desc: '名校在线课程平台', color: '#c0392b', cat: 'edu' },
  { name: '慕课网', url: 'https://www.imooc.com', desc: 'IT 编程技能学习', color: '#ff6700', cat: 'edu' },
  { name: 'BOSS直聘', url: 'https://www.zhipin.com', desc: '在线招聘求职', color: '#269245', cat: 'edu' },

  { name: '少数派', url: 'https://sspai.com', desc: '数字工具与效率方法论', color: '#d54354', cat: 'tech' },
  { name: 'IT之家', url: 'https://www.ithome.com', desc: '科技资讯与数码新闻', color: '#3f8cff', cat: 'tech' },
  { name: '掘金', url: 'https://juejin.cn', desc: '技术开发者内容社区', color: '#1e80ff', cat: 'tech' },
  { name: 'V2EX', url: 'https://www.v2ex.com', desc: '开发者与创意工作者社区', color: '#333333', cat: 'tech' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com', desc: '程序员问答社区', color: '#f48024', cat: 'tech' },

  { name: '支付宝', url: 'https://www.alipay.com', desc: '支付与生活金融服务', color: '#1677ff', cat: 'finance' },
  { name: '同花顺', url: 'http://www.10jqka.com.cn', desc: '证券行情与财经数据', color: '#d43d33', cat: 'finance' },
  { name: '雪球', url: 'https://xueqiu.com', desc: '投资交流与行情', color: '#1e6fff', cat: 'finance' },

  { name: '微信读书', url: 'https://weread.qq.com', desc: '在线电子书阅读', color: '#07c160', cat: 'reading' },
  { name: '起点中文网', url: 'https://www.qidian.com', desc: '网络文学连载平台', color: '#c81e27', cat: 'reading' },
  { name: '豆瓣读书', url: 'https://book.douban.com', desc: '图书书评与书单', color: '#31a55f', cat: 'reading' },

  { name: '高德地图', url: 'https://ditu.amap.com', desc: '出行地图与路线导航', color: '#00a6a0', cat: 'others' },
  { name: '中国天气', url: 'https://www.weather.com.cn', desc: '中国天气网官方预报', color: '#4a90d9', cat: 'others' },
  { name: '12306', url: 'https://www.12306.cn', desc: '铁路客票查询与购买', color: '#1a6fc4', cat: 'others' },
];

export function presetsByCategory(catId, keyword = '') {
  const kw = String(keyword || '').trim().toLowerCase();
  return PRESET_SITES.filter((s) => {
    const catOk = kw ? true : (!catId || catId === 'all' || s.cat === catId);
    const kwOk = !kw || s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw) || s.url.includes(kw);
    return catOk && kwOk;
  });
}
