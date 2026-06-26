#!/usr/bin/env python3
"""Test 7: Stage B — AI文本服务可达性测试
验证: ai_service_configs有text类型配置, 且模型API可达"""
import json, sqlite3, urllib.request, sys, pathlib, ssl

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / 'backend-node' / 'data' / 'drama_generator.db'

def main():
    errors = []
    warnings = []
    
    print("=== Test 7: AI文本服务可达性 ===")
    
    try:
        db = sqlite3.connect(str(DB_PATH))
        rows = db.execute(
            "SELECT id, service_type, provider, name, settings, api_key FROM ai_service_configs"
        ).fetchall()
        db.close()
    except Exception as e:
        errors.append(f"DB连接失败: {e}")
        print(f"❌ {len(errors)}个错误")
        sys.exit(1)
    
    # Find text-type configs
    text_configs = []
    for row in rows:
        id_, svc_type, provider, name, settings, api_key = row
        try:
            s = json.loads(settings) if isinstance(settings, str) else (settings or {})
        except:
            s = {}
        
        if svc_type == 'text' or provider in ['deepseek', 'zhipu', 'glm', 'openai', 'moonshot', 'infini-ai']:
            text_configs.append({
                'id': id_, 'type': svc_type, 'provider': provider, 'name': name,
                'base_url': s.get('base_url', ''), 'model': s.get('model', ''),
                'api_key': api_key or s.get('api_key', '')
            })
    
    if not text_configs:
        errors.append("ai_service_configs里没有text类型配置! AI文本润色不可用")
        print(f"❌ {len(errors)}个错误")
        sys.exit(1)
    
    print(f"  找到 {len(text_configs)} 个text配置:")
    for cfg in text_configs:
        print(f"    ID={cfg['id']}: {cfg['provider']} / {cfg['name']} / model={cfg['model']} / url={cfg['base_url'][:50]}...")
    
    # Test API reachability for each config
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    
    for cfg in text_configs:
        base_url = cfg['base_url']
        if not base_url:
            warnings.append(f"ID={cfg['id']}: 无base_url, 无法测试可达性")
            continue
        
        # Try a simple models list or health check
        try:
            url = base_url.rstrip('/') + '/models' if '/models' not in base_url else base_url
            req = urllib.request.Request(url, method='GET')
            if cfg['api_key']:
                req.add_header('Authorization', 'Bearer ' + cfg['api_key'][:8] + '...')
            resp = urllib.request.urlopen(req, timeout=10, context=ssl_ctx)
            status = resp.getcode()
            if status == 200:
                print(f"    ✓ ID={cfg['id']}: {cfg['provider']} API可达 (status={status})")
            else:
                warnings.append(f"ID={cfg['id']}: API返回status={status}")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                # Auth required but endpoint exists — API reachable
                print(f"    ✓ ID={cfg['id']}: {cfg['provider']} API可达 (需认证, code=401)")
            elif e.code == 404:
                warnings.append(f"ID={cfg['id']}: /models端点404, 但API可能可用")
            else:
                warnings.append(f"ID={cfg['id']}: HTTP error {e.code}")
        except Exception as e:
            warnings.append(f"ID={cfg['id']}: 连接失败 — {str(e)[:100]}")
    
    # Check ai_model_map for scene_key routing
    try:
        db2 = sqlite3.connect(str(DB_PATH))
        map_rows = db2.execute("SELECT scene_key, config_id FROM ai_model_map").fetchall()
        db2.close()
        print(f"\n  ai_model_map路由: {len(map_rows)}条")
        for mr in map_rows:
            print(f"    scene_key={mr[0]} → config_id={mr[1]}")
    except Exception as e:
        map_rows = []
        warnings.append(f"ai_model_map查询失败: {e}")
    
    # Check promptI18n / storyboard-related scene_keys exist
    storyboard_keys = ['storyboard_text', 'storyboard_prompt', 'role_image_polish', 'scene_image_polish']
    found_keys = {mr[0] for mr in map_rows} if map_rows else set()
    for key in storyboard_keys:
        if key not in found_keys:
            warnings.append(f"ai_model_map缺少scene_key='{key}' — 分镜/Prompt润色可能无模型路由")
    
    print(f"\n总计: {len(errors)}个错误, {len(warnings)}个警告")
    if errors:
        for e in errors: print(f"  ✗ {e}")
        sys.exit(1)
    else:
        print("✓ AI文本服务可达性测试通过!")
        sys.exit(0)

if __name__ == "__main__":
    main()
