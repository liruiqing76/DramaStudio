"""
更新数据库配置：将 LTX Direct 推理服务设为默认视频provider
运行: python update_comfyui_ltx.py
"""
import json, os, sys

def main():
    # 读取或创建配置
    config_path = os.path.join(os.path.dirname(__file__), 'configs', 'config.yaml')
    print(f"Config: {config_path}")

    # 数据库配置（通过 SQLite）
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'database.sqlite')
    if not os.path.exists(db_path):
        # 搜索可能的 db 位置
        import glob
        candidates = glob.glob(os.path.join(os.path.dirname(__file__), '**', '*.sqlite'), recursive=True)
        for c in candidates:
            if 'database' in c.lower():
                db_path = c
                break

    print(f"Database: {db_path}")

    if not os.path.exists(db_path):
        print("⚠ Database not found, creating config entry...")
        print("Please manually configure the database or run the app first.")
        print("")
        print("=== Configuration to add to ai_service_configs ===")
        print(json.dumps({
            "service_type": "video",
            "provider": "ltx_direct",
            "api_protocol": "ltx_direct",
            "base_url": "http://localhost:8199",
            "is_default": True,
            "priority": 1,
            "timeout_seconds": 600,
            "remark": "LTX Video Direct Inference (bypassed ComfyUI)",
        }, indent=2, ensure_ascii=False))
        return

    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 检查表是否存在
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_service_configs'")
    if not cur.fetchone():
        print("⚠ ai_service_configs table not found")
        print("=== Manual config entry ===")
        print(json.dumps({
            "service_type": "video",
            "provider": "ltx_direct",
            "api_protocol": "ltx_direct",
            "base_url": "http://localhost:8199",
            "is_default": True,
            "priority": 1,
            "remark": "LTX Video Direct Inference",
        }, indent=2, ensure_ascii=False))
        return

    # Upsert ltx_direct video config
    config = {
        "service_type": "video",
        "provider": "ltx_direct",
        "api_protocol": "ltx_direct",
        "base_url": "http://localhost:8199",
        "is_default": "1",
        "is_active": "1",
        "priority": "1",
        "timeout_seconds": "600",
        "remark": "LTX Video Direct Inference (bypasses ComfyUI, uses diffusers directly)",
    }

    # Check if exists
    cur.execute("SELECT id FROM ai_service_configs WHERE service_type='video' AND api_protocol='ltx_direct'")
    existing = cur.fetchone()

    if existing:
        placeholders = ', '.join([f'{k}=?' for k in config.keys()])
        values = list(config.values()) + [existing['id']]
        cur.execute(f"UPDATE ai_service_configs SET {placeholders} WHERE id=?", values)
        print(f"✅ Updated existing config (id={existing['id']})")
    else:
        columns = ', '.join(config.keys())
        ph = ', '.join(['?' for _ in config])
        cur.execute(f"INSERT INTO ai_service_configs ({columns}) VALUES ({ph})", list(config.values()))
        print(f"✅ Inserted new config (id={cur.lastrowid})")

    # Set all other video configs as non-default
    cur.execute("UPDATE ai_service_configs SET is_default='0' WHERE service_type='video' AND api_protocol!='ltx_direct'")

    conn.commit()
    conn.close()
    print("✅ Database updated successfully")
    print(f"   Service: ltx_direct → http://localhost:8199")
    print(f"   T2V: POST /generate/t2v")
    print(f"   I2V: POST /generate/i2v")

if __name__ == "__main__":
    main()
