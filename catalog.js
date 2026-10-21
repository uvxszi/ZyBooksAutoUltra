// WebLLM 0.2.85 supported models. Only matching, bundled WebGPU libraries are offered.
export const CATALOG = [
  {
    "model": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
    "model_id": "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
    "model_lib": "runtime/qwen-0.wasm",
    "low_resource_required": true,
    "vram_required_MB": 944.62,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 277996288,
    "label": "Qwen 2.5 Coder 0.5B",
    "family": "Coding",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    "model_id": "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    "model_lib": "runtime/qwen-1.wasm",
    "low_resource_required": false,
    "vram_required_MB": 1629.75,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 868547584,
    "label": "Qwen 2.5 Coder 1.5B",
    "family": "Coding",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    "model_id": "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    "model_lib": "runtime/qwen-2.wasm",
    "low_resource_required": true,
    "vram_required_MB": 2504.76,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2.5-3B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 1736187904,
    "label": "Qwen 2.5 Coder 3B",
    "family": "Coding",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
    "model_id": "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
    "model_lib": "runtime/model-6e9bbb8a3304.wasm",
    "low_resource_required": false,
    "vram_required_MB": 5106.67,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 4284263424,
    "label": "Qwen 2.5 Coder 7B",
    "family": "Coding",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC",
    "model_id": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    "model_lib": "runtime/model-6e9bbb8a3304.wasm",
    "low_resource_required": false,
    "vram_required_MB": 5106.67,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 4284263424,
    "label": "Qwen 2.5 7B",
    "family": "General",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f16_1-MLC",
    "model_id": "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    "model_lib": "runtime/model-5e4a5228a8c4.wasm",
    "vram_required_MB": 5001,
    "low_resource_required": false,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3_1-8B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 4517404672,
    "label": "Llama 3.1 8B",
    "family": "General",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
    "model_id": "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
    "model_lib": "runtime/model-5e4a5228a8c4.wasm",
    "vram_required_MB": 4876.13,
    "low_resource_required": false,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3_1-8B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 4517404672,
    "label": "Hermes 3 Llama 3.1 8B",
    "family": "General",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    "model_id": "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    "model_lib": "runtime/model-9f388cf5f65e.wasm",
    "vram_required_MB": 4573.39,
    "low_resource_required": false,
    "required_features": [
      "shader-f16"
    ],
    "overrides": {
      "context_window_size": 4096,
      "sliding_window_size": -1
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Mistral-7B-Instruct-v0.3-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 4077395968,
    "label": "Mistral 7B v0.3",
    "family": "General"
  },
  {
    "model": "https://huggingface.co/mlc-ai/gemma-2-9b-it-q4f16_1-MLC",
    "model_id": "gemma-2-9b-it-q4f16_1-MLC",
    "model_lib": "runtime/model-cbf0937eeeb7.wasm",
    "vram_required_MB": 6422.01,
    "low_resource_required": false,
    "required_features": [
      "shader-f16"
    ],
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/gemma-2-9b-it-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 5199330304,
    "label": "Gemma 2 9B",
    "family": "General"
  },
  {
    "model": "https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC",
    "model_id": "Phi-3.5-mini-instruct-q4f16_1-MLC",
    "model_lib": "runtime/model-8a9491d462f3.wasm",
    "vram_required_MB": 3672.07,
    "low_resource_required": false,
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Phi-3.5-mini-instruct-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 2149644288,
    "label": "Phi 3.5 Mini 3.8B",
    "family": "General",
    "required_features": [
      "shader-f16"
    ]
  },
  {
    "model": "https://huggingface.co/mlc-ai/Llama-2-13b-chat-hf-q4f16_1-MLC",
    "model_id": "Llama-2-13b-chat-hf-q4f16_1-MLC",
    "model_lib": "runtime/model-4bdcf98ffbe8.wasm",
    "vram_required_MB": 11814.09,
    "low_resource_required": false,
    "required_features": [
      "shader-f16"
    ],
    "overrides": {
      "context_window_size": 4096
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-2-13b-chat-hf-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 7322019840,
    "label": "Llama 2 13B",
    "family": "General"
  },
  {
    "model": "https://huggingface.co/mlc-ai/Qwen3.5-9B-q4f16_1-MLC",
    "model_id": "Qwen3.5-9B-q4f16_1-MLC",
    "model_lib": "runtime/qwen35-9b.wasm",
    "vram_required_MB": 6433.01,
    "low_resource_required": false,
    "overrides": {
      "context_window_size": 4096,
      "max_history_size": 1
    },
    "remoteLibrary": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3.5-9B-q4f16_1_cs1k-webgpu.wasm",
    "downloadBytes": 5038040064,
    "label": "Qwen 3.5 9B",
    "family": "General",
    "required_features": [
      "shader-f16"
    ]
  }
];
export const appConfig = {cacheBackend:'indexeddb', model_list: CATALOG.map(m=>({...m,model_lib:new URL(m.model_lib, import.meta.url).href}))};
