#!/usr/bin/env python3
"""Test 8: Stage G/H — DB更新逻辑 + 前端视频显示验证
验证: videoService.js的DB更新逻辑, 前端视频轮询/显示链路"""
import json, sqlite3, sys, pathlib, re

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / 'backend-node' / 'data' / 'drama_generator.db'
VS_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'services' / 'videoService.js'
VC_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'services' / 'videoClient.js'
ROUTES_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'routes' / 'videos.js'

def main():
    errors = []
    warnings = []
    
    print("=== Test 8: DB更新 + 前端视频显示 ===")
    
    # ===== Part G: DB update logic =====
    print("\n[G] DB更新逻辑验证")
    
    vs_content = VS_PATH.read_text(encoding='utf-8')
    
    # G1: Check video_generations status update
    g_checks = [
        ('status=completed更新', 'status = ?, video_url = ?, local_path = ?'),
        ('completed_at写入', 'completed_at'),
        ('storyboard.video_url同步', 'UPDATE storyboards SET video_url'),
        ('video_url写入video_generations', 'video_generations SET'),
        ('failed状态写入', 'setVideoGenFailed'),
    ]
    
    for desc, pattern in g_checks:
        if pattern in vs_content:
            print(f"  ✓ {desc}")
        else:
            errors.append(f"videoService.js缺少: {desc}")
    
    # G2: Check DB table structure
    try:
        db = sqlite3.connect(str(DB_PATH))
        
        # video_generations table columns
        vg_cols = db.execute("PRAGMA table_info(video_generations)").fetchall()
        vg_col_names = [c[1] for c in vg_cols]
        required_vg_cols = ['status', 'video_url', 'local_path', 'storyboard_id', 'completed_at']
        for col in required_vg_cols:
            if col in vg_col_names:
                print(f"  ✓ video_generations有列 '{col}'")
            else:
                errors.append(f"video_generations缺少列 '{col}'!")
        
        # storyboards table columns
        sb_cols = db.execute("PRAGMA table_info(storyboards)").fetchall()
        sb_col_names = [c[1] for c in sb_cols]
        required_sb_cols = ['video_url', 'local_path']
        for col in required_sb_cols:
            if col in sb_col_names:
                print(f"  ✓ storyboards有列 '{col}'")
            else:
                errors.append(f"storyboards缺少列 '{col}'!")
        
        db.close()
    except Exception as e:
        errors.append(f"DB连接失败: {e}")
    
    # ===== Part H: Frontend video display =====
    print("\n[H] 前端视频显示验证")
    
    vc_content = VC_PATH.read_text(encoding='utf-8')
    
    # H1: ComfyUI poll produces video_url (checked in test 5)
    comfy_checks = [
        ('ComfyUI /history查询', '/history/'),
        ('ComfyUI outputs解析', 'promptData.outputs'),
        ('ComfyUI videos字段提取', 'nodeOutput.videos'),
        ('ComfyUI /view URL构建', '/view?'),
        ('ComfyUI images字段fallback', 'nodeOutput.images'),
    ]
    
    for desc, pattern in comfy_checks:
        if pattern in vc_content:
            print(f"  ✓ {desc}")
        else:
            errors.append(f"videoClient.js缺少: {desc}")
    
    # H2: videoService processes poll result
    vs_checks = [
        ('resolveRemoteVideoUrl处理', 'resolveRemoteVideoUrl'),
        ('downloadVideoToLocal下载', 'downloadVideoToLocal'),
        ('local_path存DB', 'local_path'),
        ('video_url存storyboard', 'storyboards SET video_url'),
    ]
    
    for desc, pattern in vs_checks:
        if pattern in vs_content:
            print(f"  ✓ {desc}")
        else:
            warnings.append(f"videoService.js缺少: {desc}")
    
    # H3: Frontend video display routes
    routes_content = ROUTES_PATH.read_text(encoding='utf-8')
    
    h3_checks = [
        ('GET list route', 'list'),
        ('GET single route', 'get'),
        ('POST create route', 'create'),
    ]
    
    for desc, pattern in h3_checks:
        if pattern in routes_content:
            print(f"  ✓ {desc}")
        else:
            errors.append(f"routes/videos.js缺少: {desc}")
    
    # H4: Static file serving for local_path
    # Check if Express serves /static/ from storage path
    app_path = PROJECT_ROOT / 'backend-node' / 'src' / 'app.js'
    try:
        app_content = app_path.read_text(encoding='utf-8')
        if '/static' in app_content or 'express.static' in app_content:
            print(f"  ✓ Express有static文件服务")
        else:
            warnings.append("app.js可能缺少static文件服务 — local_path视频可能无法通过URL访问")
    except:
        warnings.append("app.js无法读取 — 无法验证static文件服务")
    
    print(f"\n总计: {len(errors)}个错误, {len(warnings)}个警告")
    if errors:
        for e in errors: print(f"  ✗ {e}")
        sys.exit(1)
    else:
        print("✓ DB更新 + 前端视频显示测试通过!")
        sys.exit(0)

if __name__ == "__main__":
    main()
