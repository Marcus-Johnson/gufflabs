/**
 * GGUF model loader
 * @module core/loader
 */

const { GGUFModel, createModelId } = require('./model');
const logger = require('../utils/logger');

/**
 * Model loading options
 * @typedef {Object} LoadOptions
 * @property {boolean} [useCache=true] - Whether to cache the model
 * @property {string} [quantization='q4_0'] - Quantization format to use
 * @property {number} [contextSize=2048] - Model context size
 * @property {boolean} [lowMemory=false] - Whether to use low memory mode
 * @property {string} [modelId] - Custom model ID (auto-generated if not provided)
 * @property {Object} [metadata] - Additional model metadata
 */

/**
 * Registry of loaded models
 * @type {Map<string, GGUFModel>}
 */
const loadedModels = new Map();

/**
 * Load a GGUF model
 * @param {string} path - Path or URL to the model file
 * @param {LoadOptions} [options={}] - Model loading options
 * @param {Object} [adapter] - Environment-specific adapter
 * @returns {Promise<GGUFModel>} Loaded model
 */
async function loadModel(path, options = {}, adapter) {
  if (!adapter) {
    throw new Error('No adapter provided. Please use an environment-specific loader.');
  }
  
  const {
    useCache = true,
    quantization = 'q4_0',
    contextSize = 2048,
    lowMemory = false,
    modelId: customModelId,
    metadata = {}
  } = options;
  
  const modelId = customModelId || createModelId(path);
  
  if (useCache && loadedModels.has(modelId)) {
    logger.info(`Using cached model: ${modelId}`);
    const cachedModel = loadedModels.get(modelId);
    cachedModel.updateLastUsed();
    return cachedModel;
  }
  
  logger.info(`Loading model from: ${path}`);
  logger.debug('Loading options:', { quantization, contextSize, lowMemory });
  
  try {
    const model = new GGUFModel({
      id: modelId,
      path,
      metadata: {
        ...metadata,
        quantization,
        contextSize,
        lowMemory
      }
    });
    
    const { session, tokenizer } = await adapter.initializeModel(path, {
      quantization,
      contextSize,
      lowMemory
    });
    
    model.session = session;
    model.tokenizer = tokenizer;
    model.isLoaded = true;
    
    if (useCache) {
      loadedModels.set(modelId, model);
    }
    
    logger.info(`Model loaded successfully: ${modelId}`);
    return model;
  } catch (error) {
    logger.error(`Failed to load model: ${error.message}`);
    throw new Error(`Failed to load GGUF model: ${error.message}`);
  }
}

/**
 * Unload a model from memory
 * @param {string} modelId - Model ID to unload
 * @param {Object} [adapter] - Environment-specific adapter
 * @returns {boolean} Whether the model was unloaded
 */
function unloadModel(modelId, adapter) {
  if (loadedModels.has(modelId)) {
    const model = loadedModels.get(modelId);
    
    if (adapter && adapter.freeModel) {
      adapter.freeModel(model);
    }
    
    model.unload();
    loadedModels.delete(modelId);
    
    logger.info(`Model unloaded: ${modelId}`);
    return true;
  }
  
  logger.warn(`Model not found for unloading: ${modelId}`);
  return false;
}

/**
 * Get a loaded model by ID
 * @param {string} modelId - Model ID
 * @returns {GGUFModel|null} The model or null if not found
 */
function getModel(modelId) {
  if (loadedModels.has(modelId)) {
    const model = loadedModels.get(modelId);
    model.updateLastUsed();
    return model;
  }
  return null;
}

/**
 * List all loaded models
 * @returns {GGUFModel[]} Array of loaded models
 */
function listModels() {
  return Array.from(loadedModels.values())
    .map(model => model.getInfo())
    .sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Clear all loaded models from memory
 * @param {Object} [adapter] - Environment-specific adapter
 */
function clearModels(adapter) {
  for (const [modelId, model] of loadedModels.entries()) {
    if (adapter && adapter.freeModel) {
      adapter.freeModel(model);
    }
    
    model.unload();
  }
  
  loadedModels.clear();
  logger.info('All models unloaded from memory');
}

module.exports = {
  loadModel,
  unloadModel,
  getModel,
  listModels,
  clearModels
};