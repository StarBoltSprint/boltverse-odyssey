#!/usr/bin/env python3
"""Drop embedded images/textures from a GLB (the play page maps the native-res plate JPGs by material name,
so the GLB copies are never used). Geometry, UVs, material names and doubleSided are untouched."""
import json, struct, sys
src, dst = sys.argv[1:3]
b = open(src, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); rest = b[20 + n:]
for m in j.get('materials', []):
    m.get('pbrMetallicRoughness', {}).pop('baseColorTexture', None)
    for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'): m.pop(k, None)
    m.pop('extensions', None)
for k in ('images', 'textures', 'samplers'): j.pop(k, None)
j['extensionsUsed'] = [e for e in j.get('extensionsUsed', []) if e != 'KHR_materials_specular'] or None
if j['extensionsUsed'] is None: j.pop('extensionsUsed')
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
out = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<I', len(js)) + b'JSON' + js + rest
open(dst, 'wb').write(out)
