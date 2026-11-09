"""Generate the Pixel Art News favicon set from one 16x16 pixel grid.

Writes favicon.svg, favicon.ico (32x32 PNG inside), apple-touch-icon.png
(180x180 on ink) and preview.png (256x256) into the output directory.

    python3 web/scripts/make_favicon.py web/public && rm web/public/preview.png
Pure standard library: PNGs are encoded by hand with zlib.
"""
import struct
import sys
import zlib

GRID = [
    "..G..........G..",
    "...G........G...",
    "....G......G....",
    "OOOOOOOOOOOOOOOO",
    "OPPPPPPPPPPPPPPO",
    "OPBBBBBBBBBBBBPO",
    "OPBBBBBBBBBRRBPO",
    "OPBBBBBBBBBRRBPO",
    "OPBBBBBBBBBBBBPO",
    "OPAAAAABBBBBBBPO",
    "OPIIIIIIIIIIBBPO",
    "OPBBBBBBBBBBBBPO",
    "OPPPPPPPPPPPPPPO",
    "OOOOOOOOOOOOOOOO",
    "..GG........GG..",
    "................",
]
COLORS = {
    "O": "#0b0b14",  # --ink outline
    "P": "#f4f1e6",  # --paper bezel
    "B": "#4aa3ff",  # WORLD accent screen
    "R": "#e3262f",  # LIVE dot
    "A": "#ffb03b",  # kicker tab
    "I": "#0b0b14",  # headline bar
    "G": "#8a8a99",  # antennas and feet: visible on light and dark tabs
}
assert len(GRID) == 16 and all(len(r) == 16 for r in GRID)


def rgba(hex_color):
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def svg():
    rects = []
    for y, row in enumerate(GRID):
        x = 0
        while x < 16:
            c = row[x]
            run = 1
            while x + run < 16 and row[x + run] == c:
                run += 1
            if c != ".":
                rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{COLORS[c]}"/>')
            x += run
    body = "".join(rects)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" '
        f'shape-rendering="crispEdges">{body}</svg>\n'
    )


def png(size, pad=0, background=None):
    """Nearest-neighbour scale of GRID into a size x size RGBA PNG."""
    inner = size - 2 * pad
    bg = rgba(background) if background else (0, 0, 0, 0)
    rows = []
    for py in range(size):
        line = bytearray([0])  # filter type: none
        for px in range(size):
            gx, gy = px - pad, py - pad
            c = "."
            if 0 <= gx < inner and 0 <= gy < inner:
                c = GRID[gy * 16 // inner][gx * 16 // inner]
            line += bytes(rgba(COLORS[c]) if c != "." else bg)
        rows.append(bytes(line))

    def chunk(kind, data):
        out = struct.pack(">I", len(data)) + kind + data
        return out + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(b"".join(rows), 9))
        + chunk(b"IEND", b"")
    )


def ico(png_bytes, size):
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(png_bytes), 6 + 16)
    return header + entry + png_bytes


out = sys.argv[1]
open(f"{out}/favicon.svg", "w").write(svg())
open(f"{out}/favicon.ico", "wb").write(ico(png(32), 32))
# 16 grid px * 11 = 176, so 2px of ink padding makes 180 with no blurry scaling.
open(f"{out}/apple-touch-icon.png", "wb").write(png(180, pad=2, background="#0b0b14"))
open(f"{out}/preview.png", "wb").write(png(256))
print("ok")
