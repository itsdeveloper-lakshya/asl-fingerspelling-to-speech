import base64

images = [
    r'd:\ASL\data sign language\1000_F_239476187_ubtMkLeBSSBZ2p7dOwpVPKgDAJzwO999.jpg',
    r'd:\ASL\data sign language\stock-vector-sign-language-b-letter-hand-that-use-the-visual-manual-modality-to-convey-meaning-polygonal-space-1247384560.jpg'
]

out = 'const B64_IMAGES = [\n'
for path in images:
    with open(path, 'rb') as f:
        data = base64.b64encode(f.read()).decode('utf-8')
        out += f'  \x22data:image/jpeg;base64,{data}\x22,\n'
out += '];\n'

with open(r'd:\ASL\b64images.js', 'w') as f:
    f.write(out)
