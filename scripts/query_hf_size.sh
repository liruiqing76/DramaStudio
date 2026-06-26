#!/bin/bash
# 查询Wan2.2-Distill-Models文件大小
curl -s --max-time 15 "https://huggingface.co/api/models/lightx2v/Wan2.2-Distill-Models/tree/main" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for f in d:
    if f.get('size'):
        gb = f['size'] / (1024**3)
        print(f'{gb:.2f}GB\t{f[\"path\"]}')
"
