import io
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "fonts")

azerbaijani = "əƏğĞıİşŞçÇöÖüÜ"
russian = "".join(chr(c) for c in range(0x0410, 0x0450)) + "Ёё"
extra = "₼€№—–«»„“”‘’…"

ranges = {
    "latin": [(0x0000, 0x00FF), (0x0130, 0x0131), (0x011E, 0x011F), (0x015E, 0x015F),
              (0x018F, 0x018F), (0x0259, 0x0259), (0x0152, 0x0153), (0x02BB, 0x02BC),
              (0x02C6, 0x02C6), (0x02DA, 0x02DA), (0x02DC, 0x02DC), (0x0300, 0x0301),
              (0x0303, 0x0303), (0x0307, 0x0308), (0x0327, 0x0327), (0x2000, 0x206F),
              (0x20AC, 0x20AC), (0x20BC, 0x20BC), (0x2116, 0x2116), (0x2122, 0x2122),
              (0x2190, 0x2193), (0x2212, 0x2212), (0x2215, 0x2215)],
    "cyrillic": [(0x0400, 0x045F), (0x0490, 0x0491), (0x04B0, 0x04B1), (0x2116, 0x2116)],
}

families = {
    "display": {"source": "NotoSerifDisplay[wdth,wght].ttf", "axes": {"wdth": 100, "wght": (300, 400)}},
    "sans": {"source": "Mulish[wght].ttf", "axes": {"wght": (300, 700)}},
}

og = [("display", 400), ("sans", 500), ("sans", 700)]


def instance(path, axes):
    font = instancer.instantiateVariableFont(TTFont(path), axes)
    buffer = io.BytesIO()
    font.save(buffer)
    buffer.seek(0)
    return TTFont(buffer)


def codepoints(script):
    return [c for lo, hi in ranges[script] for c in range(lo, hi + 1)]


def options(web):
    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "calt", "locl", "ccmp", "mark", "mkmk", "lnum", "tnum", "pnum", "case"] if web else []
    opts.hinting = False
    opts.desubroutinize = True
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    if web:
        opts.flavor = "woff2"
    else:
        opts.drop_tables += ["GSUB", "GPOS", "GDEF", "STAT", "MVAR", "HVAR", "avar", "fvar", "gvar", "kern", "DSIG", "post"]
    return opts


def build(source_dir):
    os.makedirs(os.path.join(root, "og"), exist_ok=True)
    for family, spec in families.items():
        for script in ranges:
            font = instance(os.path.join(source_dir, spec["source"]), spec["axes"])
            opts = options(True)
            sub = subset.Subsetter(opts)
            sub.populate(unicodes=codepoints(script))
            sub.subset(font)
            target = os.path.join(root, f"{family}-{script}.woff2")
            font.flavor = "woff2"
            font.save(target)
            print(target, os.path.getsize(target))
    for family, weight in og:
        for script in ranges:
            spec = families[family]
            axes = {tag: (weight if tag == "wght" else value) for tag, value in spec["axes"].items()}
            font = instance(os.path.join(source_dir, spec["source"]), axes)
            sub = subset.Subsetter(options(False))
            sub.populate(unicodes=codepoints(script))
            sub.subset(font)
            target = os.path.join(root, "og", f"{family}-{script}-{weight}.ttf")
            font.save(target)
            print(target, os.path.getsize(target))


def check():
    failures = 0
    required = {"latin": azerbaijani + "₼", "cyrillic": russian}
    for name in sorted(os.listdir(root)) + [f"og/{n}" for n in sorted(os.listdir(os.path.join(root, "og")))]:
        if not name.endswith((".woff2", ".ttf")):
            continue
        script = "cyrillic" if "cyrillic" in name else "latin"
        cmap = TTFont(os.path.join(root, name)).getBestCmap()
        missing = [c for c in required[script] if ord(c) not in cmap]
        if script == "latin":
            missing += [c for c in "ABCabc0123456789.,:;!?" if ord(c) not in cmap]
        status = "ok" if not missing else "MISSING " + " ".join(f"U+{ord(c):04X}" for c in missing)
        print(f"{name:34} {len(cmap):4} glyphs  {script:8} {status}")
        failures += bool(missing)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "build":
        build(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == "check":
        check()
    else:
        print("Usage: python scripts/fonts.py build <source-dir> | check")
        sys.exit(2)
