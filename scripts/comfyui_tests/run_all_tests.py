#!/usr/bin/env python3
"""Run all ComfyUI tests. Test 6 only runs if 1-5 all pass.
8 tests covering the full LocalMiniDrama pipeline:
  Test 1: SSH + GPU
  Test 2: ComfyUI API + nodes + code
  Test 3: 全流程Pipeline验证 (local, no GPU)
  Test 4: 模型文件 + in_channels
  Test 5: VAE encode关键路径 (每个workflow的bug)
  Test 6: 完整I2V (仅1-5通过后才跑)
  Test 7: AI文本服务可达性
  Test 8: DB更新 + 前端视频显示
"""
import subprocess, sys, os, pathlib

TEST_DIR = pathlib.Path(__file__).parent
FLAG_DIR = TEST_DIR / '.test_flags'
FLAG_DIR.mkdir(exist_ok=True)

TESTS = [
    (1, 'test_1_ssh_connect.py', 'SSH + GPU', True),
    (2, 'test_2_comfyui_ready.py', 'ComfyUI API + nodes', True),
    (3, 'test_3_workflow_validate.py', '全流程Pipeline验证', False),
    (4, 'test_4_models_exist.py', '模型文件', True),
    (5, 'test_5_vae_encode.py', 'VAE encode关键路径', True),
    (6, 'test_6_full_i2v.py', '完整I2V(仅1-5通过后才跑)', True),
    (7, 'test_7_ai_text.py', 'AI文本服务可达性', False),
    (8, 'test_8_db_frontend.py', 'DB更新+前端显示', False),
]

def run_test(num, script, desc, needs_gpu):
    print(f"\n{'='*60}")
    print(f"▶ Test {num}: {desc} ({script})")
    print(f"{'='*60}")
    path = TEST_DIR / script
    if not path.exists():
        print(f"  ✗ 测试脚本不存在: {path}")
        (FLAG_DIR / f"test_{num}.failed").write_text('missing')
        return False
    
    r = subprocess.run([sys.executable, str(path)], capture_output=True, text=True, timeout=600)
    print(r.stdout)
    if r.stderr and r.returncode != 0:
        print(r.stderr[:500])
    
    passed = r.returncode == 0
    flag_name = f"test_{num}.{'passed' if passed else 'failed'}"
    (FLAG_DIR / flag_name).write_text('ok' if passed else 'fail')
    # Remove opposite flag
    opposite = FLAG_DIR / f"test_{num}.{'failed' if passed else 'passed'}"
    if opposite.exists():
        opposite.unlink()
    
    status = "✓ PASSED" if passed else "✗ FAILED"
    print(f"  {status}: {desc}")
    return passed

def main():
    print("╔══════════════════════════════════════════════════╗")
    print("║  LocalMiniDrama 全流程测试                      ║")
    print("║  11个workflow × 8层测试 × 8个Pipeline stage    ║")
    print("║  test6(完整I2V)仅test1-5全通过后才执行         ║")
    print("╚══════════════════════════════════════════════════╝")
    
    # Clear old flags
    for f in FLAG_DIR.iterdir():
        f.unlink()
    
    all_passed = True
    gpu_test_gate_passed = False
    
    for num, script, desc, needs_gpu in TESTS:
        # Test 6 requires tests 1-5 to pass
        if num == 6:
            all_prev = all(
                (FLAG_DIR / f"test_{j}.passed").exists()
                for j in range(1, 6)
            )
            if not all_prev:
                print(f"\n⚠ Test 1-5未全通过 — 跳过Test 6(完整I2V)")
                print("  修复失败的测试后再跑!")
                gpu_test_gate_passed = False
                continue
            gpu_test_gate_passed = True
        
        result = run_test(num, script, desc, needs_gpu)
        if not result:
            all_passed = False
    
    # Summary
    print(f"\n{'='*60}")
    print("测试结果汇总:")
    for num, script, desc, needs_gpu in TESTS:
        p_flag = FLAG_DIR / f"test_{num}.passed"
        f_flag = FLAG_DIR / f"test_{num}.failed"
        if p_flag.exists():
            status = "✓ PASSED"
        elif f_flag.exists():
            status = "✗ FAILED"
        else:
            status = "- SKIPPED"
        gpu_tag = " [需GPU]" if needs_gpu else " [本地]"
        print(f"  Test {num}: {desc}{gpu_tag} — {status}")
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED — 可以开GPU跑全流程!")
    else:
        print("\n⚠ 有测试失败 — 修复后再跑全流程!")
    
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
