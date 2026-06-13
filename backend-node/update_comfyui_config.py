import sqlite3
import json
from datetime import datetime

db_path = 'd:/zmzc-code/ai-drama-refs/LocalMiniDrama/backend-node/data/drama_generator.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 更新ComfyUI配置使用公网IP
cursor.execute('''
    UPDATE ai_service_configs 
    SET base_url = ?, 
        updated_at = ?
    WHERE id = 8
''', (
    'http://116.172.93.163:8188',
    datetime.now().isoformat()
))

conn.commit()
print('✅ ComfyUI配置已更新为公网IP')
print('   地址: http://116.172.93.163:8188')

# 禁用其他视频模型，使用ComfyUI作为默认
cursor.execute('''
    UPDATE ai_service_configs 
    SET is_default = 0 
    WHERE service_type = "video" AND id != 8
''')
conn.commit()
print('✅ ComfyUI已设为默认视频模型')

# 查看最终配置
cursor.execute('SELECT id, name, provider, base_url, is_default FROM ai_service_configs WHERE service_type = "video"')
configs = cursor.fetchall()
print('\n=== 视频模型配置 ===')
for cfg in configs:
    print(f'ID:{cfg[0]} | {cfg[1]} | {cfg[2]} | {cfg[3]} | 默认:{cfg[4]}')

conn.close()
print('\n配置完成！')
