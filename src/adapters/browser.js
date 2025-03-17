/**
 * Browser-specific adapter
 * @module adapters/browser
 */

const logger = require('../utils/logger');

const hasWebAssembly = typeof WebAssembly === 'object' && 
                        typeof WebAssembly.instantiate === 'function';

let wasmModule = null;
let wasmInstance = null;
let isInitialized = false;

const DEFAULT_WASM_URL = 'https://cdn.jsdelivr.net/npm/gguf.js/dist/wasm/gguf-web.wasm';

/**
 * Initialize the WASM environment
 * 
 * @param {Object} options - Initialization options
 * @param {string} [options.wasmUrl] - URL to the WASM binary
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initializeWasm(options = {}) {
  if (isInitialized) {
    return true;
  }
  
  if (!hasWebAssembly) {
    logger.error('WebAssembly is not supported in this browser');
    return false;
  }
  
  const wasmUrl = options.wasmUrl || DEFAULT_WASM_URL;
  
  try {
    logger.info(`Loading WASM from ${wasmUrl}`);
    
    const response = await fetch(wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }
    
    const wasmBinary = await response.arrayBuffer();
    
    wasmModule = await WebAssembly.compile(wasmBinary);
    
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 2048 });
    
    const importObject = {
      env: {
        memory,
        consoleLog: (ptr, len) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const text = new TextDecoder().decode(bytes);
          console.log(`[WASM] ${text}`);
        },
        consoleError: (ptr, len) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const text = new TextDecoder().decode(bytes);
          console.error(`[WASM] ${text}`);
        }
      }
    };
    
    wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
    
    isInitialized = true;
    logger.info('WASM initialized successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to initialize WASM: ${error.message}`);
    return false;
  }
}

/**
 * Initialize a GGUF model in the browser
 * 
 * @param {string|ArrayBuffer} modelPathOrData - Path to model or model data
 * @param {Object} options - Model options
 * @returns {Promise<Object>} Session and tokenizer objects
 */
async function initializeModel(modelPathOrData, options = {}) {
  if (!isInitialized) {
    const initialized = await initializeWasm(options);
    if (!initialized) {
      throw new Error('WebAssembly initialization failed');
    }
  }
  
  let modelData;
  
  if (typeof modelPathOrData === 'string') {
    logger.info(`Fetching model from ${modelPathOrData}`);
    
    try {
      const response = await fetch(modelPathOrData);
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`);
      }
      
      modelData = await response.arrayBuffer();
      logger.info(`Model fetched: ${modelData.byteLength} bytes`);
    } catch (error) {
      throw new Error(`Failed to fetch model: ${error.message}`);
    }
  } else if (modelPathOrData instanceof ArrayBuffer) {
    modelData = modelPathOrData;
    logger.info(`Using provided model data: ${modelData.byteLength} bytes`);
  } else {
    throw new Error('Model must be a URL string or ArrayBuffer');
  }
  
  try {
    const modelBuffer = new Uint8Array(modelData);
  
    const exports = wasmInstance.exports;
    
    const modelPtr = exports.allocateMemory(modelBuffer.length);
    
    const memory = exports.memory;
    const memoryView = new Uint8Array(memory.buffer);
    
    memoryView.set(modelBuffer, modelPtr);
    
    const modelId = exports.loadModel(modelPtr, modelBuffer.length, options.contextSize || 2048);
    
    if (modelId < 0) {
      throw new Error(`Failed to load model: error code ${modelId}`);
    }
    
    logger.info(`Model loaded with ID: ${modelId}`);
    
    const tokenizer = {
      encode: async (text) => {
        const textBytes = new TextEncoder().encode(text);
        
        const textPtr = exports.allocateMemory(textBytes.length);
        
        memoryView.set(textBytes, textPtr);
        
        const resultPtr = exports.tokenize(modelId, textPtr, textBytes.length);
        
        const resultView = new DataView(memory.buffer);
        const tokenCount = resultView.getInt32(resultPtr, true);
        const tokensPtr = resultView.getInt32(resultPtr + 4, true);
        
        const tokens = [];
        for (let i = 0; i < tokenCount; i++) {
          tokens.push(resultView.getInt32(tokensPtr + i * 4, true));
        }
        
        exports.freeMemory(textPtr);
        exports.freeMemory(resultPtr);
        
        return tokens;
      },
      
      decode: async (tokens) => {
        const tokensPtr = exports.allocateMemory(tokens.length * 4);
        
        const tokensView = new Int32Array(memory.buffer, tokensPtr, tokens.length);
        tokens.forEach((token, i) => tokensView[i] = token);
        
        const resultPtr = exports.detokenize(modelId, tokensPtr, tokens.length);
        
        const resultView = new DataView(memory.buffer);
        const textLength = resultView.getInt32(resultPtr, true);
        const textPtr = resultView.getInt32(resultPtr + 4, true);
        
        const textBytes = new Uint8Array(memory.buffer, textPtr, textLength);
        const text = new TextDecoder().decode(textBytes);
        
        exports.freeMemory(tokensPtr);
        exports.freeMemory(resultPtr);
        
        return text;
      },
      
      decodeToken: async (token) => {
        const tokenPtr = exports.allocateMemory(4);
        
        const tokenView = new Int32Array(memory.buffer, tokenPtr, 1);
        tokenView[0] = token;
        
        const resultPtr = exports.detokenize(modelId, tokenPtr, 1);
        
        const resultView = new DataView(memory.buffer);
        const textLength = resultView.getInt32(resultPtr, true);
        const textPtr = resultView.getInt32(resultPtr + 4, true);
        
        const textBytes = new Uint8Array(memory.buffer, textPtr, textLength);
        const text = new TextDecoder().decode(textBytes);
        
        exports.freeMemory(tokenPtr);
        exports.freeMemory(resultPtr);
        
        return text;
      }
    };
    
    return {
      session: { modelId },
      tokenizer
    };
  } catch (error) {
    logger.error(`Failed to initialize model: ${error.message}`);
    throw error;
  }
}

/**
 * Tokenize text with a model
 * 
 * @param {Object} model - The model
 * @param {string} text - Text to tokenize
 * @returns {Promise<number[]>} Array of token IDs
 */
async function tokenize(model, text) {
  if (!model.tokenizer) {
    throw new Error('Model tokenizer not initialized');
  }
  
  return model.tokenizer.encode(text);
}

/**
 * Detokenize tokens to text
 * 
 * @param {Object} model - The model
 * @param {number[]} tokens - Tokens to detokenize
 * @returns {Promise<string>} Detokenized text
 */
async function detokenize(model, tokens) {
  if (!model.tokenizer) {
    throw new Error('Model tokenizer not initialized');
  }
  
  return model.tokenizer.decode(tokens);
}

/**
 * Detokenize a single token
 * 
 * @param {Object} model - The model
 * @param {number} token - Token to detokenize
 * @returns {Promise<string>} Detokenized token
 */
async function detokenizeToken(model, token) {
  if (!model.tokenizer) {
    throw new Error('Model tokenizer not initialized');
  }
  
  return model.tokenizer.decodeToken(token);
}

/**
 * Run inference with a model
 * 
 * @param {Object} model - The model
 * @param {Object} context - The context containing tokens
 * @param {Object} options - Generation options
 * @param {Function} isCancelled - Function to check if generation is cancelled
 * @returns {Promise<number[]>} Generated tokens
 */
async function runInference(model, context, options, isCancelled) {
  if (!isInitialized || !wasmInstance) {
    throw new Error('WASM not initialized');
  }
  
  const exports = wasmInstance.exports;
  const { modelId } = model.session;
  
  try {
    const inputTokens = context.tokens;
    
    const inputPtr = exports.allocateMemory(inputTokens.length * 4);
    
    const inputView = new Int32Array(exports.memory.buffer, inputPtr, inputTokens.length);
    inputTokens.forEach((token, i) => inputView[i] = token);
    
    const paramsPtr = exports.allocateMemory(40);
    const paramsView = new DataView(exports.memory.buffer, paramsPtr);
    
    let offset = 0;
    paramsView.setInt32(offset, options.maxTokens || 100, true); offset += 4;
    paramsView.setFloat32(offset, options.temperature || 0.7, true); offset += 4;
    paramsView.setFloat32(offset, options.topP || 0.9, true); offset += 4;
    paramsView.setInt32(offset, options.topK || 40, true); offset += 4;
    paramsView.setFloat32(offset, options.repetitionPenalty || 1.1, true); offset += 4;
    paramsView.setInt32(offset, options.seed || Math.floor(Math.random() * 4294967295), true);
    
    const resultPtr = exports.generateText(
      modelId,
      inputPtr,
      inputTokens.length,
      paramsPtr
    );
    
    const checkCancellation = () => {
      if (isCancelled && isCancelled()) {
        exports.cancelGeneration(modelId);
        return true;
      }
      return false;
    };
    
    let completed = false;
    const outputTokens = [];
    
    while (!completed && !checkCancellation()) {
      const status = exports.getGenerationStatus(modelId);
      
      if (status === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      } else if (status === 1) {
        completed = true;
        
        const resultView = new DataView(exports.memory.buffer);
        const tokenCount = resultView.getInt32(resultPtr, true);
        const tokensPtr = resultView.getInt32(resultPtr + 4, true);
        
        const tokenView = new Int32Array(exports.memory.buffer, tokensPtr, tokenCount);
        for (let i = 0; i < tokenCount; i++) {
          outputTokens.push(tokenView[i]);
        }
        
        exports.freeMemory(inputPtr);
        exports.freeMemory(paramsPtr);
        exports.freeMemory(resultPtr);
      } else {
        exports.freeMemory(inputPtr);
        exports.freeMemory(paramsPtr);
        throw new Error(`Generation failed with status code ${status}`);
      }
    }
    
    return outputTokens;
  } catch (error) {
    logger.error(`Inference error: ${error.message}`);
    throw error;
  }
}

/**
 * Run streaming inference with a model
 * 
 * @param {Object} model - The model
 * @param {Object} context - The context containing tokens
 * @param {Function} onToken - Callback for each generated token
 * @param {Object} options - Generation options
 * @param {Function} isCancelled - Function to check if generation is cancelled
 * @returns {Promise<void>}
 */
async function runInferenceStreaming(model, context, onToken, options, isCancelled) {
  if (!isInitialized || !wasmInstance) {
    throw new Error('WASM not initialized');
  }
  
  const exports = wasmInstance.exports;
  const { modelId } = model.session;
  
  try {
    const inputTokens = context.tokens;
    const inputPtr = exports.allocateMemory(inputTokens.length * 4);
    const inputView = new Int32Array(exports.memory.buffer, inputPtr, inputTokens.length);
    inputTokens.forEach((token, i) => inputView[i] = token);
    
    const paramsPtr = exports.allocateMemory(40);
    const paramsView = new DataView(exports.memory.buffer, paramsPtr);
    
    let offset = 0;
    paramsView.setInt32(offset, options.maxTokens || 100, true); offset += 4;
    paramsView.setFloat32(offset, options.temperature || 0.7, true); offset += 4;
    paramsView.setFloat32(offset, options.topP || 0.9, true); offset += 4;
    paramsView.setInt32(offset, options.topK || 40, true); offset += 4;
    paramsView.setFloat32(offset, options.repetitionPenalty || 1.1, true); offset += 4;
    paramsView.setInt32(offset, options.seed || Math.floor(Math.random() * 4294967295), true); offset += 4;
    paramsView.setInt32(offset, 1, true);
    
    exports.startStreamingGeneration(modelId, inputPtr, inputTokens.length, paramsPtr);
    
    while (true) {
      if (isCancelled && isCancelled()) {
        exports.cancelGeneration(modelId);
        break;
      }
      
      const tokenPtr = exports.getNextToken(modelId);
      
      if (tokenPtr === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      } else if (tokenPtr === -1) {
        break;
      } else {
        const token = new DataView(exports.memory.buffer).getInt32(tokenPtr, true);
        
        const tokenText = await detokenizeToken(model, token);
        await onToken(token);
        
        exports.freeMemory(tokenPtr);
      }
    }
    
    exports.freeMemory(inputPtr);
    exports.freeMemory(paramsPtr);
  } catch (error) {
    logger.error(`Streaming inference error: ${error.message}`);
    throw error;
  }
}

/**
 * Free resources used by a model
 * 
 * @param {Object} model - The model to free
 */
function freeModel(model) {
  if (!isInitialized || !wasmInstance || !model.session) {
    return;
  }
  
  try {
    const { modelId } = model.session;
    wasmInstance.exports.freeModel(modelId);
    logger.info(`Model resources freed: ${modelId}`);
  } catch (error) {
    logger.error(`Error freeing model: ${error.message}`);
  }
}

module.exports = {
  initializeWasm,
  initializeModel,
  tokenize,
  detokenize,
  detokenizeToken,
  runInference,
  runInferenceStreaming,
  freeModel
};