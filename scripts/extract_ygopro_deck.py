#!/usr/bin/env python3
"""
Extract a .ydk from a ygoprodeck.com deck page.

ygoprodeck deck pages embed every card as an image URL
(cards_small/<passcode>.jpg) inside #main_deck / #extra_deck / #side_deck
containers in the server-rendered HTML. We read those in order to rebuild
the sectioned .ydk. The passcodes may be alt-art ids, but the YGOPRODeck
API resolves those fine, so the decoder hydrates every card on import.

Usage:
    python extract_ygopro_deck.py <deck_url>            # prints .ydk to stdout
    python extract_ygopro_deck.py <deck_url> out.ydk    # writes to a file

Batch (one "name<TAB>url" per line on stdin), writes meta-decks/<slug>.ydk:
    python extract_ygopro_deck.py --batch < urls.txt
"""
import sys, re, os, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (YDK-Decoder meta extractor)"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

def _ids(region):
    return re.findall(r"cards_small/(\d+)\.jpg", region)

def extract(url):
    html = fetch(url)
    def pos(idv):
        m = re.search(r'id="%s"' % idv, html); return m.start() if m else -1
    pm, pe, ps = pos("main_deck"), pos("extra_deck"), pos("side_deck")
    end = len(html)
    main  = _ids(html[pm:pe if pe > 0 else end]) if pm >= 0 else []
    extra = _ids(html[pe:ps if ps > 0 else end]) if pe >= 0 else []
    side  = _ids(html[ps:end]) if ps >= 0 else []
    return main, extra, side

def to_ydk(main, extra, side, name="ygoprodeck extract"):
    return "\n".join(["#created by " + name, "#main"] + main + ["#extra"] + extra + ["!side"] + side) + "\n"

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--batch":
        os.makedirs("meta-decks", exist_ok=True)
        for line in sys.stdin:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = re.split(r"\t+|\s{2,}", line, 1)
            name, url = (parts[0], parts[1]) if len(parts) == 2 else (slug(line), line)
            try:
                m, e, s = extract(url.strip())
                path = os.path.join("meta-decks", slug(name) + ".ydk")
                open(path, "w", encoding="utf-8").write(to_ydk(m, e, s, name))
                sys.stderr.write("%-30s main=%d extra=%d side=%d -> %s\n" % (name, len(m), len(e), len(s), path))
            except Exception as ex:
                sys.stderr.write("FAILED %s: %s\n" % (name, ex))
    else:
        url = sys.argv[1]
        m, e, s = extract(url)
        ydk = to_ydk(m, e, s)
        if len(sys.argv) > 2:
            open(sys.argv[2], "w", encoding="utf-8").write(ydk)
            sys.stderr.write("main=%d extra=%d side=%d -> %s\n" % (len(m), len(e), len(s), sys.argv[2]))
        else:
            print(ydk)
            sys.stderr.write("main=%d extra=%d side=%d\n" % (len(m), len(e), len(s)))
