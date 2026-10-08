import re
import sys
import zlib
import requests

data = requests.get(sys.argv[1], timeout=40).content
print(f"HTTP PDF: {len(data)} bytes", file=sys.stderr)
streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", data, re.S)
for index, stream in enumerate(streams):
    try:
        decoded = zlib.decompress(stream)
    except zlib.error:
        continue
    if sys.argv[2].encode() not in decoded:
        continue
    lines = []
    for arr in re.findall(rb"\[(.*?)\]\s*TJ", decoded, re.S):
        pieces = re.findall(rb"\((?:\\.|[^\\)])*\)", arr)
        line = b"".join(p[1:-1] for p in pieces)
        if line.strip():
            lines.append(line.decode("latin1", "replace"))
    print(f"--- stream {index} ---")
    print("\n".join(lines))
