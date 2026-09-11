// Test i2v video generation on remote ComfyUI via SSH tunnel
// Uses an existing image already on the server
const http = require('http');

async function submitWorkflow(workflow) {
  const body = JSON.stringify({ prompt: workflow });
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 8188, path: '/prompt',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('Prompt submit status:', res.statusCode);
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Prompt parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getHistory(prompt_id) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 8188, path: `/history/${prompt_id}`, method: 'GET' };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('History parse error')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('=== Testing Wan2.1 I2V on Remote ComfyUI ===\n');

  // Use existing image on the server
  const imageName = '25_ig_51c0cd60.png';
  console.log('[1] Using existing image:', imageName);

  // Build workflow with official FP8 model (from ModelScope mirror)
  const workflow = {
    "1": { "class_type": "WanVideoModelLoader", "inputs": { "model": "Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors", "base_precision": "bf16", "quantization": "fp8_e4m3fn", "load_device": "offload_device", "attention_mode": "sdpa" } },
    "2": { "class_type": "LoadWanVideoT5TextEncoder", "inputs": { "model_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "precision": "bf16", "load_device": "offload_device", "quantization": "fp8_e4m3fn" } },
    "3": { "class_type": "WanVideoTextEncode", "inputs": { "t5": ["2", 0], "model_to_offload": ["1", 0], "positive_prompt": "A beautiful woman walking through a garden, cinematic lighting", "negative_prompt": "low quality, blurry, distorted", "force_offload": true, "device": "gpu" } },
    "4": { "class_type": "WanVideoVAELoader", "inputs": { "model_name": "wan_2.1_vae.safetensors", "precision": "bf16" } },
    "5": { "class_type": "CLIPVisionLoader", "inputs": { "clip_name": "clip_vision_h.safetensors" } },
    "6": { "class_type": "LoadImage", "inputs": { "image": imageName } },
    "7": { "class_type": "WanVideoClipVisionEncode", "inputs": { "clip_vision": ["5", 0], "image_1": ["6", 0], "strength_1": 1.0, "strength_2": 1.0, "crop": "center", "combine_embeds": "average", "force_offload": true } },
    "8": { "class_type": "WanVideoImageToVideoEncode", "inputs": { "vae": ["4", 0], "clip_embeds": ["7", 0], "start_image": ["6", 0], "width": 1280, "height": 720, "num_frames": 33, "noise_aug_strength": 0.03, "start_latent_strength": 1.0, "end_latent_strength": 1.0, "force_offload": true, "enable_vae_tiling": false } },
    "9": { "class_type": "WanVideoSampler", "inputs": { "model": ["1", 0], "image_embeds": ["8", 0], "text_embeds": ["3", 0], "steps": 20, "cfg": 5.0, "shift": 5.0, "seed": 12345, "force_offload": true, "scheduler": "unipc", "riflex_freq_index": 0, "denoise_strength": 1.0, "image_embeds_strength": 1.0 } },
    "10": { "class_type": "WanVideoDecode", "inputs": { "vae": ["4", 0], "samples": ["9", 0], "enable_vae_tiling": true, "tile_x": 128, "tile_y": 128, "tile_stride_x": 64, "tile_stride_y": 64 } },
    "11": { "class_type": "CreateVideo", "inputs": { "images": ["10", 0], "fps": 25 } },
    "12": { "class_type": "SaveVideo", "inputs": { "filename_prefix": "test_i2v", "video": ["11", 0], "format": "auto", "codec": "auto" } }
  };

  // Submit workflow
  console.log('\n[2] Submitting workflow...');
  let result;
  try {
    result = await submitWorkflow(workflow);
    console.log('Prompt result:', JSON.stringify(result));
  } catch (e) {
    console.error('Prompt submit failed:', e.message);
    return;
  }

  if (!result.prompt_id) {
    console.error('No prompt_id in result:', result);
    return;
  }

  // Poll for completion
  console.log('\n[3] Polling for completion (prompt_id:', result.prompt_id + ')...');
  for (let i = 0; i < 60; i++) {
    await sleep(10000); // 10 seconds
    try {
      const history = await getHistory(result.prompt_id);
      const promptData = history[result.prompt_id];
      if (promptData && promptData.status) {
        console.log(`  Poll ${i+1}: status = ${promptData.status.state}`);
        if (promptData.status.state === 'success') {
          console.log('\n=== SUCCESS ===');
          console.log('Outputs:', JSON.stringify(promptData.outputs, null, 2));
          return;
        } else if (promptData.status.state === 'failed') {
          console.log('\n=== FAILED ===');
          console.log('Errors:', JSON.stringify(promptData.status.messages, null, 2));
          return;
        }
      } else {
        console.log(`  Poll ${i+1}: no status yet`);
      }
    } catch (e) {
      console.log(`  Poll ${i+1}: error - ${e.message}`);
    }
  }
  console.log('\n=== TIMEOUT ===');
}

runTest().catch(console.error);
