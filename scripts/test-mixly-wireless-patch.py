"""Read-only validation of the Mixly integration transformation and toolbox."""
import importlib.util
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
script = ROOT / "scripts" / "sync-mixly-wireless-blocks.py"
spec = importlib.util.spec_from_file_location("mixly_wireless_installer", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

required = set(module.WIRELESS_TYPES)
for relative, fragment_name in module.FILE_FRAGMENTS.items():
    path = module.DEFAULT_MIXLY / relative
    original_bytes = path.read_bytes()
    original, encoding = module.decode_file(original_bytes)
    fragment = (module.FRAGMENTS / fragment_name).read_text("utf-8")
    updated, modified = module.install_snippet(relative, original, fragment)
    if modified:
        assert updated != original
    else:
        assert updated == original, "Already installed Mixly content was unexpectedly changed"
    assert updated.encode(encoding).startswith(b"\xef\xbb\xbf") == original_bytes.startswith(b"\xef\xbb\xbf")
    again, second_change = module.install_snippet(relative, updated, fragment)
    assert again == updated and not second_change, "Non-idempotent overlay " + relative
    if relative == "index.xml":
        legacy = updated
        for block_type in ("visionwiz_wireless_start", "visionwiz_wireless_configure"):
            marker = '<block type="' + block_type + '">'
            start = legacy.index(marker)
            end = legacy.index("</block>", start) + len("</block>")
            body = legacy[start:end]
            body = body.replace('name="QUALITY"><shadow type="math_number"><field name="NUM">25',
                                'name="QUALITY"><shadow type="math_number"><field name="NUM">35')
            body = body.replace('name="FPS"><shadow type="math_number"><field name="NUM">6',
                                'name="FPS"><shadow type="math_number"><field name="NUM">2')
            legacy = legacy[:start] + body + legacy[end:]
        migrated, changed = module.install_snippet(relative, legacy, fragment)
        assert changed and migrated == updated, "Old Mixly toolbox FPS defaults not migrated safely"
    elif relative == "generators/visionwiz_sync.js":
        legacy = updated.replace("valueToCode(block, 'FPS', Blockly.Python.ORDER_ATOMIC) || '6'",
                                 "valueToCode(block, 'FPS', Blockly.Python.ORDER_ATOMIC) || '2'")
        legacy = legacy.replace("valueToCode(block, 'QUALITY', Blockly.Python.ORDER_ATOMIC) || '25'",
                                "valueToCode(block, 'QUALITY', Blockly.Python.ORDER_ATOMIC) || '35'")
        migrated, changed = module.install_snippet(relative, legacy, fragment)
        assert changed and migrated == updated, "Old Mixly generator FPS defaults not migrated safely"
    if relative == "index.xml":
        start = updated.index('<category id="VESIBIT_IMAGE_SYNC"')
        close = updated.index("</category>", start)
        category = ET.fromstring(updated[start:close + len("</category>")])
        types = [elem.attrib["type"] for elem in category.iter("block")]
        assert required.issubset(set(types))
        assert "visionwiz_sync_init" in types and "visionwiz_sync_start" in types
        assert all(types.count(name) == 1 for name in required), "Duplicate blocks"
    elif relative.startswith("language/"):
        assert all("VESIBIT_WIRELESS_PREVIEW_" + x in updated
                   for x in ["START", "CONFIGURE", "STOP", "ACTIVE", "STATUS"])
    else:
        assert all(name in updated for name in required)
        assert "visionwiz_sync_start" in updated, "Original wired code was lost"
    print("[PASS]", "prepared" if modified else "already installed",
          "Mixly update:", relative, "encoding", encoding)

print("Mixly toolbox, generators, translations, BOM, and idempotence: PASS")
