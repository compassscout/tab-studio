#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""跨平台 zip 打包（zip 命令不存在时的后备），文件名以 UTF-8 标记存储。
用法: python pyzip.py <输出.zip> <工作目录> <相对文件或目录> [更多...]"""
import sys, os, zipfile


def main(argv):
    if len(argv) < 4:
        raise SystemExit(__doc__)
    out, base, items = argv[1], argv[2], argv[3:]
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
        for it in items:
            p = os.path.join(base, it)
            if os.path.isdir(p):
                for root, _dirs, files in os.walk(p):
                    for name in sorted(files):
                        full = os.path.join(root, name)
                        zf.write(full, os.path.relpath(full, base).replace(os.sep, '/'))
            elif os.path.isfile(p):
                zf.write(p, it.replace(os.sep, '/'))
            else:
                raise SystemExit('不存在: ' + p)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
