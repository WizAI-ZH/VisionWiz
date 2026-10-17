#!/usr/bin/env python3
"""Stage/validate optional VisionWiz wireless blocks in a local Mixly install.

Default is READ-ONLY:
  python scripts/sync-mixly-wireless-blocks.py --check

After inspecting the plan, an operator may opt in to install with backups:
  python scripts/sync-mixly-wireless-blocks.py --apply

Existing wired/UARTHS Blockly blocks are preserved. No .mpy compilation is
needed: these new blocks import the K210 wireless boot agent installed via
VisionWiz wireless initialization step 2.
"""
import argparse
import codecs
from datetime import datetime
from pathlib import Path
import re
import shutil
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
FRAGMENTS = ROOT / "integrations" / "mixly-wireless"
DEFAULT_MIXLY = (
    ROOT.parent / "mixly2.0-win32-x64_rc4" / "resources" / "app"
    / "src" / "boards" / "extend" / "micropython_k210_vesibit"
)
FILE_FRAGMENTS = {
    "blocks/visionwiz_sync.js": "visionwiz_sync.blocks.fragment.js",
    "generators/visionwiz_sync.js": "visionwiz_sync.generators.fragment.js",
    "index.xml": "visionwiz_sync.xml.fragment.xml",
    "language/en.js": "language.en.fragment.js",
    "language/zh-hans.js": "language.zh-hans.fragment.js",
    "language/zh-hant.js": "language.zh-hant.fragment.js",
}
WIRELESS_TYPES = (
    "visionwiz_wireless_start",
    "visionwiz_wireless_configure",
    "visionwiz_wireless_stop",
    "visionwiz_wireless_active",
    "visionwiz_wireless_status",
)


def decode_file(blob):
    if blob.startswith(codecs.BOM_UTF8):
        return blob.decode("utf-8-sig"), "utf-8-sig"
    try:
        return blob.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        return blob.decode("gb18030"), "gb18030"


def normalized_fragment(text, document):
    end = "\r\n" if document.count("\r\n") > document.count("\n") // 2 else "\n"
    return text.replace("\r\n", "\n").replace("\n", end).rstrip() + end


def upgrade_wireless_preview_defaults(filename, original):
    """Upgrade only new wireless defaults; never touch the original USB blocks."""
    if filename == "index.xml":
        updated = original
        for name in ("visionwiz_wireless_start", "visionwiz_wireless_configure"):
            block_pattern = re.compile(
                r'<block\b[^>]*type="' + name + r'"[^>]*>.*?</block>',
                re.DOTALL,
            )

            def replace_block(match):
                content = match.group(0)
                for field, old, new in (("QUALITY", "35", "25"), ("FPS", "2", "6")):
                    content = re.sub(
                        r'(<value name="' + field +
                        r'"><shadow type="math_number"><field name="NUM">)' +
                        old + r'(</field></shadow></value>)',
                        lambda value: value.group(1) + new + value.group(2),
                        content, count=1,
                    )
                return content

            updated = block_pattern.sub(replace_block, updated, count=1)
        return updated
    if filename == "generators/visionwiz_sync.js":
        index = original.index("function visionwizWirelessArgs(")
        head, tail = original[:index], original[index:]
        tail = tail.replace(
            "valueToCode(block, 'QUALITY', Blockly.Python.ORDER_ATOMIC) || '35'",
            "valueToCode(block, 'QUALITY', Blockly.Python.ORDER_ATOMIC) || '25'",
        ).replace(
            "valueToCode(block, 'FPS', Blockly.Python.ORDER_ATOMIC) || '2'",
            "valueToCode(block, 'FPS', Blockly.Python.ORDER_ATOMIC) || '6'",
        )
        return head + tail
    return original


def install_snippet(filename, original, snippet):
    """Pure, idempotent transformation; original outside files untouched."""
    marker = "visionwiz_wireless_start" if filename != "index.xml" else 'type="visionwiz_wireless_start"'
    if filename.startswith("language/"):
        marker = "VESIBIT_WIRELESS_PREVIEW_START"
    if marker in original:
        # All expected block definitions must be present. Half-installed
        # blocks are not silently "repaired" by adding duplicates.
        expected = WIRELESS_TYPES if filename.endswith(".js") and filename.startswith(("blocks/", "generators/")) else ()
        if filename == "index.xml":
            expected = WIRELESS_TYPES
        if filename.startswith("language/"):
            expected = ("VESIBIT_WIRELESS_PREVIEW_START", "VESIBIT_WIRELESS_PREVIEW_STATUS_TOOLTIP")
        if not all(token in original for token in expected):
            raise ValueError("Detected incomplete wireless Blockly update in " + filename)
        updated = upgrade_wireless_preview_defaults(filename, original)
        return updated, updated != original

    fragment = normalized_fragment(snippet, original)
    end = "\r\n" if "\r\n" in original else "\n"
    if filename == "index.xml":
        ET.fromstring("<root>" + snippet + "</root>")
        category = re.search(
            r'<category\b[^>]*\bid=["\']VESIBIT_IMAGE_SYNC["\'][^>]*>',
            original, re.IGNORECASE,
        )
        if not category:
            raise ValueError("Original wired VisionWiz category not found in Mixly index.xml")
        category_end = original.find("</category>", category.end())
        if category_end < 0:
            raise ValueError("VisionWiz category closing tag not found")
        body = original[category.end():category_end]
        if "visionwiz_sync_start" not in body:
            raise ValueError("Expected existing wired image-sync blocks are missing")
        indent = "      "
        to_insert = end + end.join(indent + row if row else "" for row in fragment.rstrip().splitlines()) + end
        return original[:category_end] + to_insert + original[category_end:], True

    if filename.startswith("language/"):
        symbol = {"en.js": "En", "zh-hans.js": "ZhHans",
                  "zh-hant.js": "ZhHant"}[Path(filename).name]
        anchor = re.search(
            r"^.*\b" + symbol + r"\.VESIBIT_IMAGE_SYNC_IS_STREAMING_TOOLTIP\s*=[^\r\n]*$",
            original, re.MULTILINE,
        )
        if not anchor:
            raise ValueError("Expected wired image-sync language anchor missing in " + filename)
        return original[:anchor.end()] + end + fragment.rstrip(end) + original[anchor.end():], True

    if filename.startswith("blocks/") and "visionwiz_sync_init" not in original:
        raise ValueError("Existing wired image-sync block missing; refusing overlay")
    if filename.startswith("generators/") and "visionwiz_sync_start" not in original:
        raise ValueError("Existing wired image-sync generator missing; refusing overlay")
    return original.rstrip() + end + end + fragment, True


def plan_updates(mixly_root):
    updates = []
    for relative_path, fragment_name in FILE_FRAGMENTS.items():
        path = mixly_root / relative_path
        if not path.is_file():
            raise FileNotFoundError("Mixly file missing: " + str(path))
        blob = path.read_bytes()
        original, encoding = decode_file(blob)
        snippet = (FRAGMENTS / fragment_name).read_text("utf-8")
        changed, needed = install_snippet(relative_path, original, snippet)
        if needed:
            patched = changed.encode(encoding)
            assert patched != blob, "Update plan has no actual modifications"
            updates.append((path, blob, patched))
        print(("[UPDATE] " if needed else "[EXISTS] ") + relative_path +
              " [" + encoding + "]")
    return updates


def apply_updates(mixly_root, updates):
    if not updates:
        print("[DONE] All five wireless blocks and three languages already exist.")
        return
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = mixly_root / ".visionwiz-wireless-backups" / stamp
    backup.mkdir(parents=True, exist_ok=False)
    print("[BACKUP]", backup)
    for dest, content, _patched in updates:
        archived = backup / dest.relative_to(mixly_root)
        archived.parent.mkdir(parents=True, exist_ok=True)
        archived.write_bytes(content)
    applied = []
    try:
        for dest, _original, patched in updates:
            # The fallback .tmp remains in the original directory so replace
            # stays on the same filesystem. Original bytes are backed up.
            temp = dest.with_suffix(dest.suffix + ".visionwiz.tmp")
            temp.write_bytes(patched)
            temp.replace(dest)
            applied.append(dest)
        print("[DONE] Added 5 wireless image-sync blocks; all wired blocks preserved.")
    except Exception:
        for dest in reversed(applied):
            dest.write_bytes((backup / dest.relative_to(mixly_root)).read_bytes())
        raise


def main():
    parser = argparse.ArgumentParser(description="VisionWiz wireless preview Blockly integration")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--check", action="store_true", help="Read-only planned update (default)")
    action.add_argument("--apply", action="store_true", help="Back up and install to external Mixly")
    action.add_argument("--verify-installed", action="store_true",
                        help="Read-only check that all six Mixly files are installed")
    parser.add_argument("--mixly-root", type=Path, default=DEFAULT_MIXLY,
                        help="Path to micropython_k210_vesibit board directory")
    args = parser.parse_args()
    target = args.mixly_root.resolve()
    if not target.is_dir():
        parser.error("Mixly board directory not found: " + str(target))
    updates = plan_updates(target)
    print("[PLAN]", len(updates), "files need changes")
    if args.verify_installed:
        if updates:
            raise RuntimeError(str(len(updates)) + " Mixly files are still missing wireless blocks")
        print("[VERIFIED] All five wireless blocks and three languages are installed")
    elif args.apply:
        apply_updates(target, updates)
    else:
        print("[READ-ONLY] No external files were changed. Add --apply to opt in.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("[FAILED]", error, file=sys.stderr)
        raise SystemExit(1)
