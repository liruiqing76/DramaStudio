import os
p = "/root/autodl-tmp/miniconda3/lib/python3.10/site-packages/torchaudio/_extension/utils.py"
c = open(p).read()
c = c.replace("def _check_cuda_version():", "def _check_cuda_version():\n    return")
open(p, "w").write(c)
print("Patched torchaudio CUDA check - done")
