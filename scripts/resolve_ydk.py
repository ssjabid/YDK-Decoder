#!/usr/bin/env python3
"""
Print a human-readable breakdown of a .ydk (resolves passcodes -> card names
via the YGOPRODeck API). Handy for understanding an extracted meta deck.

Usage:  python scripts/resolve_ydk.py meta-decks/clown-crew.ydk
"""
import sys, json, urllib.request, collections

UA = {"User-Agent": "Mozilla/5.0 (YDK-Decoder resolver)"}


def parse(path):
    sec = {"main": [], "extra": [], "side": []}
    cur = None
    for ln in open(path, encoding="utf-8"):
        t = ln.strip()
        if t.startswith("#main"): cur = sec["main"]; continue
        if t.startswith("#extra"): cur = sec["extra"]; continue
        if t.startswith("!side") or t.startswith("#side"): cur = sec["side"]; continue
        if t.startswith("#") or not t: continue
        if t.isdigit() and cur is not None: cur.append(t)
    return sec


def main():
    path = sys.argv[1]
    sec = parse(path)
    allids = sorted(set(sec["main"] + sec["extra"] + sec["side"]))
    url = "https://db.ygoprodeck.com/api/v7/cardinfo.php?id=" + ",".join(allids)
    data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40))
    name = {}
    for c in data["data"]:
        name[str(c["id"])] = c["name"]
        for im in c.get("card_images", []):
            name.setdefault(str(im["id"]), c["name"])
    for label in ("main", "extra", "side"):
        cnt = collections.Counter(sec[label])
        print("=== %s (%d cards) ===" % (label, len(sec[label])))
        for cid, n in cnt.most_common():
            print("  %dx %s" % (n, name.get(cid, "??? " + cid)))
        print()


if __name__ == "__main__":
    main()
