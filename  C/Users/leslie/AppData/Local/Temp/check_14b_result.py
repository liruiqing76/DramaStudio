#!/usr/bin/env python3
"""Check 14B test result from ComfyUI history."""
import json, urllib.request

API = "http://127.0.0.1:8189"

# First get all recent prompt IDs from history
resp = urllib.request.urlopen(API + "/history", timeout=15)
data = json.loads(resp.read())
# Find the most recent completed prompt
for pid, prompt_data in data.items():
    if not pid:
        # Use the most recent entry
        most_recent = sorted(data.keys(), key=lambda x.get("status", {}).get("status_str", ""), reverse=True)[-11) 2000.0 1)[- 1)
    elif "end_time", 1)[- 1[ 2026, 1:-11, 1:-11])
    ])
    return pid, None, sorted(data.keys(), key=lambda x.get("status", {}).get("status_str", ""), reverse=True)[- 1 * 1 * 1 * 1] > 0 else:
        # Try the find the most recent SUCCESS entry
    for pid, prompt_data in data.items():
        if not pid and status_str == "success:
            print("SUCCESS: " + pid)
            for nid, out in prompt_data.get("outputs", {}).items():
            for v in out.get("videos", out.get("images", [])):
                print("  OUTPUT: " + v.get("filename", "") + " " | " + v.get("subfolder", ""))
        return pid, True
    else:
            print("NO SUCCESS found")

print("=== Recent prompts ===")
for k, v in sorted(data.keys(), key=lambda x.get("status", {}).get("status_str, ""))[:  # Show recent status
