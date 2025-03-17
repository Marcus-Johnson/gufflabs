/**
 * Node.js adapter for GGUF models
 * @module adapters/node
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let LlamaModel;
try {
  const llamaCpp = require('node-llama-cpp');
  LlamaModel = llamaCpp.LlamaModel;
} catch (error) {
  logger.warn('node-llama-cpp not found. Install it with: npm install node-llama-cpp');
  LlamaModel = null;
}

/**
 * Initialize a GGUF model in Node.js environment
 * @param {string} modelPath - Path to the model file
 * @param {Object} options - Model options
 * @returns {Promise<Object>} Session and tokenizer
 */
async function initializeModel(modelPath, options = {}) {
  if (!LlamaModel) {
    throw new Error('node-llama-cpp is required but not installed');
  }
  
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model file not found: ${modelPath}`);
  }
  
  logger.info(`Initializing GGUF model from: ${modelPath}`);
  
  const {
    contextSize = 2048,
    quantization = 'q4_0',
    lowMemory = false,
    seed = Math.floor(Math.random() * 4294967295),
    threads = Math.max(1, require('os').cpus().length / 2)
  } = options;
  
  const absolutePath = path.resolve(modelPath);
  
  try {
    const model = new LlamaModel({
      modelPath: absolutePath,
      contextSize,
      seed,
      threads,
      useMlock: !lowMemory,
      batchSize: 512,
      gpuLayers: 0
    });
    
    const tokenizer = {
      encode: async (text) => model.tokenize(text),
      decode: async (tokens) => model.detokenize(tokens),
      decodeToken: async (token) => model.detokenize([token])
    };
    
    logger.info(`Model initialized successfully (context size: ${contextSize}, threads: ${threads})`);
    
    return {
      session: model,
      tokenizer
    };
  } catch (error) {
    logger.error(`Failed to initialize model: ${error.message}`);
    throw error;
  }
}

/**
 * Tokenize text with the model
 * @param {Object} model - The GGUF model
 * @param {string} text - Text to tokenize
 * @returns {Promise<number[]>} Token IDs
 */
async function tokenize(model, text) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  return model.session.tokenize(text);
}

/**
 * Detokenize tokens to text
 * @param {Object} model - The GGUF model
 * @param {number[]} tokens - Tokens to detokenize
 * @returns {Promise<string>} Detokenized text
 */
async function detokenize(model, tokens) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  return model.session.detokenize(tokens);
}

/**
 * Detokenize a single token
 * @param {Object} model - The GGUF model
 * @param {number} token - Token to detokenize
 * @returns {Promise<string>} Detokenized token text
 */
async function detokenizeToken(model, token) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  return model.session.detokenize([token]);
}

/**
 * Run inference with a model
 * @param {Object} model - The GGUF model
 * @param {Object} context - Model context
 * @param {Object} options - Generation options
 * @param {function} isCancelled - Function to check if generation is cancelled
 * @returns {Promise<number[]>} Generated token IDs
 */
async function runInference(model, context, options, isCancelled) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  const params = {
    nPredict: options.maxTokens,
    temperature: options.temperature,
    topP: options.topP,
    topK: options.topK,
    repeatPenalty: options.repetitionPenalty,
    seed: options.seed,
    stop: options.stopSequences || []
  };
  
  return new Promise((resolve, reject) => {
    try {
      const completion = model.session.generate({
        tokens: context.tokens,
        ...params
      });
      
      const outputTokens = [];
      
      for (const token of completion) {
        if (isCancelled && isCancelled()) {
          logger.info('Generation cancelled');
          break;
        }
        
        outputTokens.push(token);
        
        if (outputTokens.length >= params.nPredict) {
          break;
        }
      }
      
      resolve(outputTokens);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Run streaming inference with a model
 * @param {Object} model - The GGUF model
 * @param {Object} context - Model context
 * @param {function} onToken - Callback for each token
 * @param {Object} options - Generation options
 * @param {function} isCancelled - Function to check if generation is cancelled
 * @returns {Promise<void>}
 */
async function runInferenceStreaming(model, context, onToken, options, isCancelled) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  const params = {
    nPredict: options.maxTokens,
    temperature: options.temperature,
    topP: options.topP,
    topK: options.topK,
    repeatPenalty: options.repetitionPenalty,
    seed: options.seed,
    stop: options.stopSequences || []
  };
  
  return new Promise((resolve, reject) => {
    try {
      const completion = model.session.generate({
        tokens: context.tokens,
        ...params
      });
      
      let tokenCount = 0;
      
      for (const token of completion) {
        if (isCancelled && isCancelled()) {
          logger.info('Streaming generation cancelled');
          break;
        }
        
        onToken(token);
        tokenCount++;
        
        if (tokenCount >= params.nPredict) {
          break;
        }
      }
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Free resources used by a model
 * @param {Object} model - The model to free
 */
function freeModel(model) {
  if (model.session && typeof model.session.dispose === 'function') {
    model.session.dispose();
    logger.info(`Model resources freed: ${model.id}`);
  }
}

/**
 * Discover GGUF models in a directory
 * @param {string} directory - Directory to search
 * @returns {Promise<Object[]>} Array of model info objects
 */
async function discoverModels(directory) {
  if (!fs.existsSync(directory)) {
    logger.warn(`Model directory not found: ${directory}`);
    return [];
  }
  
  logger.info(`Searching for GGUF models in: ${directory}`);
  
  try {
    const files = fs.readdirSync(directory);
    const modelFiles = files.filter(file => file.toLowerCase().endsWith('.gguf'));
    
    const models = modelFiles.map(file => {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);
      
      const baseName = path.basename(file, '.gguf');
      const parts = baseName.split('.');
      const name = parts[0];
      const quantization = parts.length > 1 ? parts[1] : 'unknown';
      
      return {
        id: baseName,
        name: name,
        path: filePath,
        quantization,
        size: stats.size,
        createdAt: stats.birthtime.toISOString()
      };
    });
    
    logger.info(`Found ${models.length} GGUF models`);
    return models;
  } catch (error) {
    logger.error(`Error discovering models: ${error.message}`);
    return [];
  }
}

module.exports = {
  initializeModel,
  tokenize,
  detokenize,
  detokenizeToken,
  runInference,
  runInferenceStreaming,
  freeModel,
  discoverModels
};