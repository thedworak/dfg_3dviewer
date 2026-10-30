#!/usr/bin/env python3
"""Rewrites `} from 'three';` imports in viewer/js/jsm<BUILD>/**/*.js to a
relative `build/three.module.js` path. Run from the repository root.

usage: ./scripts/three-rewrite.py OLD_BUILD [BUILD]

Updating three.js itself (e.g. to r172) is still manual:
  wget https://github.com/mrdoob/three.js/archive/refs/tags/r172.zip && unzip r172.zip
  cp -R three.js-r172/build/* viewer/build/
  cp -R three.js-r172/examples/jsm/* viewer/js/jsm/
"""

import os
import sys


def fix_links(path: str) -> None:
    # One "../" per directory level, minus one: viewer/js/jsm/a.js -> ../../
    depth = path.removeprefix("./").count("/") - 1
    if depth <= 0:
        return
    base = "../" * depth
    print(base)
    with open(path, encoding="utf-8", newline="") as fh:
        lines = fh.readlines()
    target = f"}} from '{base}build/three.module.js';"
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.writelines(line.replace("} from 'three';", target, 1) for line in lines)


def main() -> int:
    build = sys.argv[2] if len(sys.argv) > 2 else ""
    for dirpath, _, filenames in os.walk(f"viewer/js/jsm{build}/"):
        for filename in filenames:
            if filename.endswith(".js"):
                fix_links(os.path.join(dirpath, filename))
    return 0


if __name__ == "__main__":
    sys.exit(main())
