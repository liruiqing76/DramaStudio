#!/usr/bin/env python3
"""列出lightx2v/Wan2.1-Distill-Loras的所有文件，找配套workflow"""
import sys
sys.path.insert(0, '/root/autodl-tmp/miniconda3/lib/python3.10/site-packages')
from huggingface_hub import list_repo_files

files = list_repo_files("lightx2v/Wan2.1-Distill-Loras")
for f in files:
    print(f)
