Archive of box folder /workspace/cleanup-1016 (2026-10-21, approved by SmiR).
Tar split into 20 chunks of 90 MiB across branches archive/box-1021/cleanup-1016/part000..part006.
Total tar bytes 1866547200, tar sha256 b60a29dec1573921a2dd9458e15650c903f8b9332a96c847bb6a1efda240280d.
Restore: fetch all part branches, cat cleanup-1016.tar.part-* (sorted) > cleanup-1016.tar, check sha256, tar xf cleanup-1016.tar -C /workspace, then sha256sum -c MANIFEST.sha256 from /workspace.
