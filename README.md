# GuffLabs

[![npm version](https://img.shields.io/npm/v/gufflabs.svg)](https://www.npmjs.com/package/gufflabs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<div align="center">
  <h3>Lightweight GGUF Inference for JavaScript</h3>
</div>

GuffLabs is a high-performance JavaScript library for running GGUF language models in both Node.js and browser environments. Optimized specifically for the GGUF format, it provides a streamlined way to integrate LLMs into your JavaScript applications.

## ✨ Features

- 🚀 **GGUF Optimized** - Purpose-built for GGUF models with minimal overhead
- 🔄 **Universal JS** - Works in Node.js, browsers, and React applications
- 💨 **Lightweight** - Focused on essentials for smaller bundle size
- 🌊 **Streaming Responses** - Token-by-token generation for responsive UIs
- ⚛️ **React Integration** - Custom hooks for seamless React integration
- 🔧 **Environment Aware** - Automatically adapts to your runtime environment

## 📦 Installation

```bash
# Core package
npm install gufflabs

# Node.js dependency (required for Node.js usage)
npm install node-llama-cpp
```

## 🚀 Quick Start

### Node.js Usage

```javascript
const gufflabs = require('gufflabs');

async function main() {
  // Load a GGUF model
  const model = await gufflabs.loadModel('./models/llama-2-7b-chat.Q4_0.gguf', {
    contextSize: 2048,
    threads: 4
  });
  
  // Generate text
  const response = await gufflabs.generate(model, 
    'Explain quantum computing in simple terms:', {
    maxTokens: 100,
    temperature: 0.7
  });
  
  console.log(response);
  
  // Clean up when done
  gufflabs.unloadModel(model.id);
}

main().catch(console.error);
```

### Streaming Responses

```javascript
const model = await gufflabs.loadModel('./models/your-model.gguf');

await gufflabs.streamGenerate(
  model,
  'Write a story about a space explorer:',
  (token, isDone) => {
    if (!isDone) {
      // Append token to output as it's generated
      process.stdout.write(token);
    } else {
      console.log('\nGeneration complete!');
    }
  },
  { maxTokens: 200 }
);
```

### React Hooks

```jsx
import React, { useState, useEffect } from 'react';
import gufflabs from 'gufflabs';

function ChatComponent() {
  const { loadModel, listModels } = gufflabs.useModel(gufflabs.adapters.node);
  const { generate, cancelGeneration } = gufflabs.useGeneration(gufflabs.adapters.node);
  
  const [model, setModel] = useState(null);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Load model on component mount
    async function initModel() {
      try {
        const loadedModel = await loadModel('./models/model.gguf');
        setModel(loadedModel);
      } catch (error) {
        console.error('Failed to load model:', error);
      }
    }
    
    initModel();
    
    // Cleanup on unmount
    return () => {
      if (model) {
        gufflabs.unloadModel(model.id);
      }
    };
  }, []);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!model || !input.trim()) return;
    
    setIsLoading(true);
    
    try {
      const result = await generate(model, input, {
        maxTokens: 150,
        temperature: 0.7
      });
      
      setResponse(result);
    } catch (error) {
      console.error('Generation failed:', error);
      setResponse(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  /* Component JSX... */
}
```

## 📋 API Reference

### Core Functions

#### `loadModel(path, options)`

Loads a GGUF model from a file path.

```javascript
const model = await gufflabs.loadModel('./models/model.gguf', {
  contextSize: 2048,   // Token context window size
  threads: 4,          // CPU threads to use
  lowMemory: false,    // Low memory mode
  quantization: 'q4_0' // Quantization format used
});
```

#### `generate(model, prompt, options)`

Generates text using a loaded model.

```javascript
const text = await gufflabs.generate(model, 'Hello, world!', {
  maxTokens: 100,           // Maximum tokens to generate
  temperature: 0.7,         // Randomness (0.0-2.0)
  topP: 0.9,                // Nucleus sampling
  topK: 40,                 // Top-K sampling
  repetitionPenalty: 1.1,   // Discourage repetition
  stopSequences: ['###']    // Stop sequences
});
```

#### `streamGenerate(model, prompt, onToken, options)`

Streams generated tokens via callback.

```javascript
await gufflabs.streamGenerate(
  model,
  'Hello, world!',
  (token, isDone) => {
    // Handle each token as it's generated
    console.log(token);
  },
  { maxTokens: 100 }
);
```

### Model Management

```javascript
// Unload a model to free memory
gufflabs.unloadModel(model.id);

// List currently loaded models
const models = gufflabs.listModels();

// Clear all loaded models
gufflabs.clearModels();
```

### Tokenization

```javascript
// Convert text to token IDs
const tokens = await gufflabs.tokenize(model, 'Hello, world!');

// Convert token IDs back to text
const text = await gufflabs.detokenize(model, [13871, 11, 13327]);
```

### Utilities

GuffLabs includes utilities for prompt formatting, output processing, and more:

```javascript
// Format a chat prompt
const prompt = gufflabs.utils.formats.formatChatPrompt([
  { role: 'user', content: 'Hello, who are you?' },
  { role: 'assistant', content: 'I am an AI assistant.' },
  { role: 'user', content: 'Can you help me with JavaScript?' }
]);

// Clean model output
const cleaned = gufflabs.utils.formats.cleanOutput(response, {
  trimWhitespace: true,
  removeSpecialTokens: true
});

// Extract JSON from model response
const json = gufflabs.utils.formats.extractJSON(response);
```

## 🛠️ Environment Support

- **Node.js**: v14.0.0 or later
- **Browsers**: Modern browsers with WebAssembly support
- **React**: React 16.8+ (for hooks support)

## 📑 License

MIT

## 🧩 Related Projects

- [node-llama-cpp](https://github.com/ggerganov/llama.cpp) - Node.js bindings for llama.cpp
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Inference of LLaMA models in C/C++

---

<div align="center">
  Made with ❤️ by TypingPower</a>
</div>