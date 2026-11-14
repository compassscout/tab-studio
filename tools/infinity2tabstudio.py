# -*- coding: utf-8 -*-
"""把 Infinity 新标签页备份 (.infinity) 转成 TAB STUDIO 的导入备份 JSON。

用法：
    python tools/infinity2tabstudio.py <输入.infinity> <输出.json>

输出结构与「我的 → 备份与恢复」导出的 JSON 一致，可直接在 TAB STUDIO 里导入。
"""
import json, re, time, random, sys

def rid(p):
    return "%s-%012x" % (p, random.getrandbits(48))

def norm_url(u):
    u = (u or '').strip()
    if not u:
        return None
    if not re.match(r'^https?://', u):
        u = 'https://' + u
    return u

def tint(item):
    """把 Infinity 的图标背景映射成 TAB STUDIO 的 iconType/iconValue/color。"""
    bg = item.get('bgType')
    img = (item.get('bgImage') or '').strip()
    if bg == 'image' and re.match(r'^https?://', img):
        return {'iconType': 'upload', 'iconValue': img, 'color': '#4c8bf5'}
    if bg == 'color' and re.match(r'^#[0-9a-fA-F]{6}$', item.get('bgColor') or ''):
        return {'iconType': 'color', 'iconValue': item['bgColor'], 'color': item['bgColor']}
    return {'iconType': '', 'iconValue': '', 'color': '#4c8bf5'}

def convert(data):
    now = int(time.time() * 1000)
    try:
        pages_src = data['data']['site']['sites']
    except (KeyError, TypeError):
        raise SystemExit('输入不是有效的 Infinity 备份（缺少 data.site.sites）')

    sites, folders, pages_out = [], [], []
    seen_urls = set()

    for page in pages_src:
        page_item_ids = []
        for it in (page.get('items') or []):
            t = (it.get('type') or '').lower()
            if t == 'folder':
                member_ids = []
                for ch in (it.get('icons') or []):
                    url = norm_url(ch.get('url'))
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    sid = rid('site')
                    c = tint(ch)
                    sites.append({'id': sid, 'name': ch.get('name') or url, 'url': url,
                                  'color': c['color'], 'iconType': c['iconType'],
                                  'iconValue': c['iconValue'], 'createdAt': now,
                                  'lastAccessed': 0, 'visitCount': 0, 'pageId': ''})
                    member_ids.append(sid)
                if not member_ids:
                    continue
                folders.append({'id': rid('folder'), 'name': it.get('name') or '文件夹',
                                'iconIds': member_ids, 'pageId': '', 'createdAt': now})
                page_item_ids.append(folders[-1]['id'])
            else:
                url = norm_url(it.get('url'))
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                sid = rid('site')
                c = tint(it)
                sites.append({'id': sid, 'name': it.get('name') or url, 'url': url,
                              'color': c['color'], 'iconType': c['iconType'],
                              'iconValue': c['iconValue'], 'createdAt': now,
                              'lastAccessed': 0, 'visitCount': 0, 'pageId': ''})
                page_item_ids.append(sid)

        # 按 3×6=18 个位置切分页
        chunks = [page_item_ids[i:i + 18] for i in range(0, len(page_item_ids), 18)] or [[]]
        for chunk in chunks:
            pid = rid('page')
            pages_out.append({'id': pid, 'name': '第 %d 页' % (len(pages_out) + 1),
                              'siteIds': chunk, 'sortOrder': len(pages_out)})
            for sid in chunk:
                hit = [f for f in folders if sid in f.get('iconIds', [])]
                if hit:
                    hit[0]['pageId'] = pid
                else:
                    hit2 = [x for x in sites if x['id'] == sid]
                    if hit2:
                        hit2[0]['pageId'] = pid

    return {'version': 2, 'app': 'compass-newtab', 'formatVersion': 1,
            'exportedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now / 1000)),
            'data': {'sites': sites, 'folders': folders, 'pages': pages_out,
                     'wallpapers': [], 'todos': [], 'notes': []}}

def main(argv):
    if len(argv) != 3:
        raise SystemExit(__doc__)
    src, out = argv[1], argv[2]
    with open(src, encoding='utf-8') as f:
        data = json.load(f)
    payload = convert(data)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    d = payload['data']
    print('sites=%d folders=%d pages=%d -> %s'
          % (len(d['sites']), len(d['folders']), len(d['pages']), out))
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
