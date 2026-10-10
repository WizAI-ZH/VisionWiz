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
        assert updated != original and len(updated) > len(original)
    else:
        assert updated == original, "Already installed Mixly content was unexpectedly changed"
    assert updated.encode(encoding).startswith(b"\xef\xbb\xbf") == original_bytes.startswith(b"\xef\xbb\xbf")
    again, second_change = module.install_snippet(relative, updated, fragment)
    assert again == updated and not second_change, "Non-idempotent overlay " + relative
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
