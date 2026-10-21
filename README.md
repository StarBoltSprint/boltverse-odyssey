Archive of box folder /workspace/pai-data2 (2026-10-21, approved by SmiR).
Tar split into 18 chunks of 90 MiB across branches archive/box-1021/pai-data2/part000..part005.
Total tar bytes 1692006400, tar sha256 2b513838c47b5d3c373b9ba85100c1df1ecd33cb81844d2be8a01668767490be.
Restore: fetch all part branches, cat pai-data2.tar.part-* (sorted) > pai-data2.tar, check sha256, tar xf pai-data2.tar -C /workspace, then sha256sum -c MANIFEST.sha256 from /workspace.
