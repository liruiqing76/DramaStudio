# 视频生成模型测试报告

## 测试环境
- **GPU**: RTX 4080 SUPER, 32G VRAM
- **ComfyUI**: v0.24.0 + WanVideoWrapper
- **WanVideoWrapper img_emb patch**: `if True:` (bypass meta device detection)
- **测试图片**: 25_ig_51c0cd60.png (720x480 storyboard frame)
- **SSH**: AutoDL westc区域, port 24427

## 模型配置一览

| DB ID | 名称 | 格式 | Workflow | 模式 |
|-------|------|------|----------|------|
| 13 | Wan2.2-5B-TI2V | fp8_e4m3fn_scaled_fast | wan22_5b_distill_i2v.json | 单步(TI2V) |
| 14 | Wan2.1-14B-I2V | fp8_e4m3fn | wan21_fp8_i2v.json | 单步(I2V) |
| 15 | Wan2.2-14B-I2V-GGUF | Q4_K_M | wan22_gguf_two_step_i2v.json | 两步(High+Low) |
| 17 | Wan2.2-14B-I2V-FP8 | fp8_e4m3fn_scaled | wan22_fp8_two_step_i2v.json | 两步(HIGH+LOW) |

## 模型文件清单

| 模型 | 文件 | 大小 | 位置 |
|------|------|------|------|
| wan2.1 14B fp8 | wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors | 16G | autodl-tmp |
| wan2.2 HIGH fp8 | Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors | 14G | autodl-tmp |
| wan2.2 LOW fp8 | Wan2_2-I2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors | 14G | autodl-tmp |
| wan2.2 GGUF HighNoise | Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf | 9G | /root |
| wan2.2 GGUF LowNoise | Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf | 9G | /root |
| 5B TI2V fp8 | Wan2_2-TI2V-5B_fp8_e4m3fn_scaled_KJ.safetensors | 5G | autodl-tmp |
| LoRA HIGH | Wan_2_2_I2V_A14B_HIGH_lightx2v_4step_lora_260412_rank_64_fp16.safetensors | 602M | autodl-tmp |
| LoRA LOW | Wan_2_2_I2V_A14B_LOW_lightx2v_4step_lora_260412_rank_64_fp16.safetensors | 602M | autodl-tmp |
| VAE 14B | wan_2.1_vae.safetensors | - | autodl-tmp |
| VAE 5B | Wan2_2_VAE_bf16.safetensors | - | autodl-tmp |
| CLIP Vision | clip_vision_h.safetensors | - | autodl-tmp |
| T5 Text | umt5_xxl_fp8_e4m3fn_scaled.safetensors | - | autodl-tmp |

## 测试结果

### 1. wan2.1 I2V 14B fp8 单步生成
- **Workflow**: wan21_fp8_i2v.json
- **Quantization**: fp8_e4m3fn (非scaled)
- **Steps**: 20, CFG: 1.0, Scheduler: unipc
- **分辨率**: 720x480, 41帧(5秒@25fps)
- **结果**: 🔄 测试中...

### 2. wan2.2 I2V 14B fp8 两步生成
- **Workflow**: wan22_fp8_two_step_i2v.json
- **Quantization**: fp8_e4m3fn_scaled (HIGH+LOW)
- **Steps**: 6 (lightx2v 4步蒸馏), CFG schedule, Scheduler: unipc
- **两步**: HIGH跑start=0→end=3, LOW接力start=3→end=-1
- **分辨率**: 720x480, 41帧
- **结果**: ⏳ 待测试

### 3. 5B TI2V fp8 单步生成
- **Workflow**: wan22_5b_distill_i2v.json
- **Quantization**: fp8_e4m3fn_scaled_fast
- **Steps**: 20, CFG: 1.0, Scheduler: unipc
- **模式**: TI2V (WanVideoEncode + WanVideoEmptyEmbeds)
- **VAE**: Wan2_2_VAE_bf16 (48ch)
- **结果**: ⏳ 待测试

### 4. wan2.2 GGUF Q4_K_M 两步生成
- **Workflow**: wan22_gguf_two_step_i2v.json
- **Quantization**: disabled (GGUF自带量化)
- **两步**: HighNoise跑start=0→end=3, LowNoise接力start=3→end=-1
- **结果**: ⏳ 待测试

## 已知问题与修复
1. **img_emb skip bug**: WanVideoWrapper model.py L2824 meta device检测误判GGUF/fp8为14B蒸馏,skip了img_emb→极差视频。修复: `if True:` 绕过检测 ✅
2. **WanVideoDecode tile参数**: 新版ComfyUI要求必填tile_x/tile_y/tile_stride_x/tile_stride_y ✅ 已添加
3. **WanVideoImageToVideoEncode参数**: 新版要求force_offload/start_latent_strength/end_latent_strength ✅ 已添加
4. **wan2.1 fp8非scaled**: PJMixers版本是标准fp8_e4m3fn,不是scaled版本,quantization必须用`fp8_e4m3fn` ✅ 已修复
5. **wan2.2两步生成**: 必须用HIGH先跑+LOW接力,不能单步 ✅ workflow已建
6. **LoRA路径bug**: WanVideoLoraSelect下拉列表有重复嵌套路径,但实际LoRA名: Wan_2_2_I2V_A14B_HIGH/LOW_lightx2v_4step_lora_260412_rank_64_fp16.safetensors

## 结论
（测试完成后填写）
