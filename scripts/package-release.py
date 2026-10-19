"""Build the Foundry release assets using only Python's standard library."""

import hashlib
import json
import posixpath
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "module.json").read_text())
package = json.loads((ROOT / "package.json").read_text())
version = manifest["version"]
assert version == package["version"], "Manifest and package versions must match"
assert re.fullmatch(r"\d+\.\d+\.\d+", version), "Choose a numeric release version"
repository = "https://github.com/eating1battery/fvtt-adventure-peak"
assert manifest["manifest"] == f"{repository}/releases/latest/download/module.json"
assert manifest["download"] == f"{repository}/releases/download/v{version}/adventurepeak.zip"

files = {"module.json", "README.md", "docs/design.md", "docs/development.md"}
files.update(manifest.get("styles", []))
files.update(language["path"] for language in manifest.get("languages", []))
pending = list(manifest.get("esmodules", []))
while pending:
    relative = pending.pop()
    if relative in files:
        continue
    files.add(relative)
    source = (ROOT / relative).read_text()
    for imported in re.findall(r'''(?:from\s+|import\s*)["'](\.[^"']+)["']''', source):
        pending.append(posixpath.normpath(posixpath.join(posixpath.dirname(relative), imported)))

for relative in files:
    path = (ROOT / relative).resolve()
    assert path.is_relative_to(ROOT) and path.is_file(), f"Invalid release asset: {relative}"

output = ROOT / "dist"
output.mkdir(exist_ok=True)
(output / "module.json").write_bytes((ROOT / "module.json").read_bytes())
with ZipFile(output / "adventurepeak.zip", "w", compression=ZIP_DEFLATED) as archive:
    for relative in sorted(files):
        info = ZipInfo(relative, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (ROOT / relative).read_bytes())
with ZipFile(output / "adventurepeak.zip") as archive:
    assert archive.testzip() is None
    assert archive.read("module.json") == (output / "module.json").read_bytes()
checksums = []
for name in ["module.json", "adventurepeak.zip"]:
    digest = hashlib.sha256((output / name).read_bytes()).hexdigest()
    checksums.append(f"{digest}  {name}\n")
(output / "SHA256SUMS").write_text("".join(checksums))
print(f"Built AdventurePeak {version}: {len(files)} files in dist/adventurepeak.zip")
