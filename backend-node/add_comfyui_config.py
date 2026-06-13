import sqlite3
import json
from datetime import datetime

# 数据库连接
db_path = 'd:/zmzc-code/ai-drama-refs/LocalMiniDrama/backend-node/data/drama_generator.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# ComfyUI视频模型配置
comfyui_config = {
    'name': 'ComfyUI-Wan2.1',
    'provider': 'comfyui',
    'service_type': 'video',
    'api_protocol': 'comfyui',
    'base_url': 'http://connect.westc.seetacloud.com:8188',
    'api_key': '',
    'model': json.dumps(['wan2.1-t2v', 'wan2.1-i2v']),
    'default_model': 'wan2.1-t2v',
    'endpoint': '/prompt',
    'query_endpoint': '/history/{prompt_id}',
    'is_default': 1,
    'is_active': 1,
    'settings': json.dumps({
        'workflow': 'wan2.1-t2v',
        'timeout': 600,
        'poll_interval': 5
    }),
    'created_at': datetime.now().isoformat(),
    'updated_at': datetime.now().isoformat()
}

# 插入配置
try:
    cursor.execute('''
        INSERT INTO ai_service_configs 
        (name, provider, service_type, api_protocol, base_url, api_key, 
         model, default_model, endpoint, query_endpoint, 
         is_default, is_active, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        comfyui_config['name'],
        comfyui_config['provider'],
        comfyui_config['service_type'],
        comfyui_config['api_protocol'],
        comfyui_config['base_url'],
        comfyui_config['api_key'],
        comfyui_config['model'],
        comfyui_config['default_model'],
        comfyui_config['endpoint'],
        comfyui_config['query_endpoint'],
        comfyui_config['is_default'],
        comfyui_config['is_active'],
        comfyui_config['settings'],
        comfyui_config['created_at'],
        comfyui_config['updated_at']
    ))
    conn.commit()
    print(f"✅ ComfyUI配置已添加，ID: {cursor.lastrowid}")
except Exception as e:
    print(f"❌ 添加配置失败: {e}")

# 查看所有配置
cursor.execute('SELECT id, name, provider, service_type, is_default FROM ai_service_configs')
configs = cursor.fetchall()
print('\n=== 所有AI配置 ===')
for cfg in configs:
    print(f"ID:{cfg[0]} | {cfg[1]} | {cfg[2]} | {cfg[3]} | 默认:{cfg[4]}")

conn.close()