/* presets.js — 内置本地预设站点库（无网络请求），16 个分类自编通用知名站点 */

export const CATEGORIES = [
  { id: 'popular', label: '受欢迎的' },
  { id: 'shared', label: '用户分享' },
  { id: 'apps', label: '应用' },
  { id: 'news', label: '新闻' },
  { id: 'musicvideo', label: '音乐视频' },
  { id: 'images', label: '图片' },
  { id: 'shopping', label: '购物与团购' },
  { id: 'social', label: '社交与博客' },
  { id: 'sports', label: '体育与旅行' },
  { id: 'lifestyle', label: '生活方式' },
  { id: 'games', label: '游戏与娱乐' },
  { id: 'edu', label: '教育与招聘' },
  { id: 'digital', label: '数码科技' },
  { id: 'finance', label: '金融' },
  { id: 'reading', label: '阅读' },
  { id: 'others', label: '其他' },
];

export const PRESET_SITES = [
  { name: '百度', url: 'https://www.baidu.com', desc: '中文搜索引擎与综合服务入口', cat: 'popular', iconType: 'color', color: '#4c8bf5' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com', desc: '视频弹幕社区与创作者平台', cat: 'popular', iconType: 'color', color: '#fb7299' },
  { name: '淘宝', url: 'https://www.taobao.com', desc: '综合网络零售购物平台', cat: 'popular', iconType: 'color', color: '#ff6b6b' },
  { name: '京东', url: 'https://www.jd.com', desc: '自营电商与物流配送平台', cat: 'popular', iconType: 'color', color: '#e67e22' },
  { name: '微博', url: 'https://weibo.com', desc: '公共舆论场与热点社交平台', cat: 'popular', iconType: 'color', color: '#f5a623' },
  { name: '知乎', url: 'https://www.zhihu.com', desc: '问答式知识社区', cat: 'shared', iconType: 'color', color: '#3366ff' },
  { name: '小红书', url: 'https://www.xiaohongshu.com', desc: '生活方式分享社区', cat: 'shared', iconType: 'color', color: '#ff2741' },
  { name: '豆瓣', url: 'https://www.douban.com', desc: '书影音评论与兴趣小组', cat: 'shared', iconType: 'color', color: '#2eaf6d' },
  { name: '在线文档', url: 'https://docs.google.com', desc: '云端文档表格协作工具', cat: 'apps', iconType: 'color', color: '#0f9d58' },
  { name: '翻译', url: 'https://translate.google.com', desc: '多语言在线翻译工具', cat: 'apps', iconType: 'color', color: '#4285f4' },
  { name: '日历', url: 'https://calendar.google.com', desc: '在线日程日历工具', cat: 'apps', iconType: 'color', color: '#e53935' },
  { name: '计算器', url: 'https://www.google.com/search?q=calculator', desc: '搜索引擎内置计算器', cat: 'apps', iconType: 'color', color: '#5b8def' },
  { name: '新华网', url: 'http://www.xinhuanet.com', desc: '国家通讯社新闻门户', cat: 'news', iconType: 'color', color: '#c0392b' },
  { name: '人民网', url: 'http://www.people.com.cn', desc: '中央重点新闻网站', cat: 'news', iconType: 'color', color: '#b03a2e' },
  { name: '澎湃新闻', url: 'https://www.thepaper.cn', desc: '时政与思想类新闻平台', cat: 'news', iconType: 'color', color: '#2c3e50' },
  { name: '腾讯新闻', url: 'https://news.qq.com', desc: '综合新闻资讯客户端网页版', cat: 'news', iconType: 'color', color: '#1677ff' },
  { name: '网易云音乐', url: 'https://music.163.com', desc: '在线音乐流媒体社区', cat: 'musicvideo', iconType: 'color', color: '#e60026' },
  { name: 'QQ音乐', url: 'https://y.qq.com', desc: '正版数字音乐平台', cat: 'musicvideo', iconType: 'color', color: '#31c27c' },
  { name: '优酷', url: 'https://youku.com', desc: '长视频综合平台', cat: 'musicvideo', iconType: 'color', color: '#1989fa' },
  { name: 'YouTube', url: 'https://www.youtube.com', desc: '全球视频分享平台', cat: 'musicvideo', iconType: 'color', color: '#ff0000' },
  { name: '花瓣网', url: 'https://huaban.com', desc: '设计灵感与图片收藏', cat: 'images', iconType: 'color', color: '#ec5163' },
  { name: 'Pixabay', url: 'https://pixabay.com', desc: '免费高清图片素材站', cat: 'images', iconType: 'color', color: '#1f9f55' },
  { name: 'Unsplash', url: 'https://unsplash.com', desc: '高质量摄影作品分享', cat: 'images', iconType: 'color', color: '#111111' },
  { name: '拼多多', url: 'https://www.pinduoduo.com', desc: '拼团社交电商平台', cat: 'shopping', iconType: 'color', color: '#e02e24' },
  { name: '美团', url: 'https://www.meituan.com', desc: '本地生活服务与团购', cat: 'shopping', iconType: 'color', color: '#ffc300' },
  { name: '当当', url: 'http://www.dangdang.com', desc: '网上图书百货商城', cat: 'shopping', iconType: 'color', color: '#d94235' },
  { name: 'GitHub', url: 'https://github.com', desc: '开发者代码托管社区', cat: 'social', iconType: 'color', color: '#24292f' },
  { name: '知乎专栏', url: 'https://zhuanlan.zhihu.com', desc: '深度长文写作平台', cat: 'social', iconType: 'color', color: '#0066ff' },
  { name: 'X（Twitter）', url: 'https://x.com', desc: '短讯式社交网络', cat: 'social', iconType: 'color', color: '#1da1f2' },
  { name: '虎扑', url: 'https://www.hupu.com', desc: '体育赛事与球迷社区', cat: 'sports', iconType: 'color', color: '#177245' },
  { name: '携程旅行', url: 'https://www.ctrip.com', desc: '机票酒店旅游预订', cat: 'sports', iconType: 'color', color: '#2577e3' },
  { name: '马蜂窝', url: 'https://www.mafengwo.cn', desc: '旅游攻略与目的地社区', cat: 'sports', iconType: 'color', color: '#c8372d' },
  { name: '下厨房', url: 'https://www.xiachufang.com', desc: '菜谱与做饭社区', cat: 'lifestyle', iconType: 'color', color: '#e26643' },
  { name: '豆瓣生活', url: 'https://www.douban.com/explore', desc: '日常兴趣与同城活动', cat: 'lifestyle', iconType: 'color', color: '#42bd56' },
  { name: '知乎日报', url: 'https://daily.zhihu.com', desc: '精选问答每日推送', cat: 'lifestyle', iconType: 'color', color: '#0084ff' },
  { name: 'Steam', url: 'https://store.steampowered.com', desc: 'PC 游戏数字发行平台', cat: 'games', iconType: 'color', color: '#1b2838' },
  { name: 'TapTap', url: 'https://www.taptap.cn', desc: '手游发现与社区平台', cat: 'games', iconType: 'color', color: '#2d3a4b' },
  { name: '4399小游戏', url: 'https://www.4399.com', desc: '休闲 Flash 与网页小游戏集合', cat: 'games', iconType: 'color', color: '#e8a13a' },
  { name: '中国大学MOOC', url: 'https://www.icourse163.org', desc: '名校在线课程平台', cat: 'edu', iconType: 'color', color: '#c0392b' },
  { name: '慕课网', url: 'https://www.imooc.com', desc: 'IT 编程技能学习平台', cat: 'edu', iconType: 'color', color: '#ff6700' },
  { name: 'BOSS直聘', url: 'https://www.zhipin.com', desc: '在线招聘求职平台', cat: 'edu', iconType: 'color', color: '#269245' },
  { name: '少数派', url: 'https://sspai.com', desc: '数字工具与效率方法论', cat: 'digital', iconType: 'color', color: '#d54354' },
  { name: 'IT之家', url: 'https://www.ithome.com', desc: '科技资讯与数码新闻', cat: 'digital', iconType: 'color', color: '#3f8cff' },
  { name: '掘金', url: 'https://juejin.cn', desc: '技术开发者内容社区', cat: 'digital', iconType: 'color', color: '#1e80ff' },
  { name: '支付宝', url: 'https://www.alipay.com', desc: '支付与生活金融服务', cat: 'finance', iconType: 'color', color: '#1677ff' },
  { name: '中国人民银行', url: 'http://www.pbc.gov.cn', desc: '中央银行官网与政策发布', cat: 'finance', iconType: 'color', color: '#8b1a1a' },
  { name: '同花顺', url: 'http://www.10jqka.com.cn', desc: '证券行情与财经数据', cat: 'finance', iconType: 'color', color: '#d43d33' },
  { name: '微信读书', url: 'https://weread.qq.com', desc: '在线电子书阅读平台', cat: 'reading', iconType: 'color', color: '#07c160' },
  { name: '起点中文网', url: 'https://www.qidian.com', desc: '网络文学连载平台', cat: 'reading', iconType: 'color', color: '#c81e27' },
  { name: '豆瓣读书', url: 'https://book.douban.com', desc: '图书书评与书单社区', cat: 'reading', iconType: 'color', color: '#31a55f' },
  { name: '地图', url: 'https://ditu.amap.com', desc: '出行地图与路线导航', cat: 'others', iconType: 'color', color: '#00a6a0' },
  { name: '天气', url: 'https://www.weather.com.cn', desc: '中国天气网官方预报', cat: 'others', iconType: 'color', color: '#4a90d9' },
];

export const PRESET_ICONS = {
  globe: '🌐', search: '🔍', mail: '✉️', doc: '📄', music: '🎵', game: '🎮',
  shop: '🛒', news: '📰', travel: '🧭', tool: '🛠️', star: '⭐', book: '📖',
};

export function presetsByCategory(catId, keyword = '') {
  const kw = keyword.trim().toLowerCase();
  return PRESET_SITES.filter((s) => {
    const catOk = !catId || catId === 'all' || s.cat === catId;
    const kwOk = !kw || s.name.toLowerCase().includes(kw) || s.desc.toLowerCase().includes(kw);
    return catOk && kwOk;
  });
}
