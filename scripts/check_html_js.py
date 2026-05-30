#!/usr/bin/env python3
"""Extract inline <script> blocks from an HTML file and node --check each.
Usage: python scripts/check_html_js.py decoder/ydk_decoder.html"""
import sys, re, subprocess, tempfile, os

path = sys.argv[1]
html = open(path, encoding="utf-8").read()
# inline <script> ... </script> blocks that have no src= attribute
blocks = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.DOTALL | re.IGNORECASE)
print("Found %d inline script block(s)" % len(blocks))
fail = 0
for i, b in enumerate(blocks):
    tf = tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8")
    tf.write(b)
    tf.close()
    try:
        r = subprocess.run(["node", "--check", tf.name], capture_output=True, text=True)
        if r.returncode == 0:
            print("  block %d: OK (%d chars)" % (i, len(b)))
        else:
            fail += 1
            print("  block %d: FAIL\n%s" % (i, r.stderr[:2000]))
    finally:
        os.unlink(tf.name)
sys.exit(1 if fail else 0)
