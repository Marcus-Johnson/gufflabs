import require$$0 from 'fs';
import require$$1 from 'path';
import require$$4 from 'os';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

/**
 * Core model representation for GGUF models
 * @module core/model
 */

/**
 * Class representing a GGUF model
 */
let GGUFModel$2 = class GGUFModel {
    /**
     * Create a GGUF model
     * @param {Object} options - Model options
     * @param {string} options.id - Unique identifier for the model
     * @param {string} options.path - Path or URL to the model file
     * @param {Object} options.metadata - Model metadata
     * @param {Object} options.session - Model session (implementation specific)
     * @param {Object} options.tokenizer - Tokenizer for the model
     */
    constructor({ id, path, metadata = {}, session = null, tokenizer = null }) {
      this.id = id;
      this.path = path;
      this.metadata = metadata;
      this.session = session;
      this.tokenizer = tokenizer;
      this.lastUsed = Date.now();
      this.isLoaded = false;
      
      // Add default metadata if not provided
      if (!this.metadata.name) {
        this.metadata.name = id || path.split('/').pop();
      }
      
      if (!this.metadata.createdAt) {
        this.metadata.createdAt = new Date().toISOString();
      }
    }
    
    /**
     * Get model basic information
     * @returns {Object} Model info
     */
    getInfo() {
      return {
        id: this.id,
        name: this.metadata.name,
        path: this.path,
        isLoaded: this.isLoaded,
        lastUsed: this.lastUsed,
        ...this.metadata
      };
    }
    
    /**
     * Updates the model's last used timestamp
     */
    updateLastUsed() {
      this.lastUsed = Date.now();
    }
    
    /**
     * Unload the model to free resources
     */
    unload() {
      this.session = null;
      this.isLoaded = false;
    }
  };
  
  /**
   * Generation options for text inference
   */
  let GenerationOptions$2 = class GenerationOptions {
    /**
     * Create generation options
     * @param {Object} options - Generation parameters
     * @param {number} [options.maxTokens=100] - Maximum tokens to generate
     * @param {number} [options.temperature=0.7] - Sampling temperature (0-2)
     * @param {number} [options.topP=0.9] - Top-p sampling parameter (0-1)
     * @param {number} [options.topK=40] - Top-k sampling parameter
     * @param {number} [options.repetitionPenalty=1.1] - Penalty for repetition
     * @param {number} [options.seed] - Random seed for reproducibility
     * @param {string[]} [options.stopSequences] - Sequences to stop generation
     */
    constructor({
      maxTokens = 100,
      temperature = 0.7,
      topP = 0.9,
      topK = 40,
      repetitionPenalty = 1.1,
      seed,
      stopSequences = []
    } = {}) {
      this.maxTokens = maxTokens;
      this.temperature = temperature;
      this.topP = topP;
      this.topK = topK;
      this.repetitionPenalty = repetitionPenalty;
      this.seed = seed;
      this.stopSequences = stopSequences;
    }
  };
  
  /**
   * Model context for token sequence processing
   */
  let ModelContext$2 = class ModelContext {
    /**
     * Create a model context
     * @param {Object} options - Context options
     * @param {number[]} [options.tokens=[]] - Input tokens
     * @param {number} [options.contextSize=2048] - Maximum context size
     */
    constructor({ tokens = [], contextSize = 2048 } = {}) {
      this.tokens = tokens;
      this.contextSize = contextSize;
      this.outputTokens = [];
    }
    
    /**
     * Add new tokens to the context
     * @param {number[]} tokens - Tokens to add
     */
    addTokens(tokens) {
      this.tokens = [...this.tokens, ...tokens];
      
      // Truncate if context exceeds limit
      if (this.tokens.length > this.contextSize) {
        this.tokens = this.tokens.slice(-this.contextSize);
      }
    }
    
    /**
     * Add an output token
     * @param {number} token - Token to add
     */
    addOutputToken(token) {
      this.outputTokens.push(token);
    }
    
    /**
     * Get the current context length
     * @returns {number} Context length
     */
    getContextLength() {
      return this.tokens.length;
    }
    
    /**
     * Get the remaining context space
     * @returns {number} Remaining space
     */
    getRemainingSpace() {
      return this.contextSize - this.tokens.length;
    }
    
    /**
     * Clear all tokens from context
     */
    clear() {
      this.tokens = [];
      this.outputTokens = [];
    }
  };
  
  /**
   * Create a model ID from a path
   * @param {string} path - Model path
   * @returns {string} Model ID
   */
  function createModelId$2(path) {
    // Extract filename without extension
    const filename = path.split('/').pop().split('.')[0];
    
    // Create a simple hash from the full path
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${filename}-${Math.abs(hash).toString(16).substring(0, 8)}`;
  }
  
  var model = {
    GGUFModel: GGUFModel$2,
    GenerationOptions: GenerationOptions$2,
    ModelContext: ModelContext$2,
    createModelId: createModelId$2
  };

/**
 * Simple logging utilities for GGUF.js
 * @module utils/logger
 */

// Log levels
const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
  };
  
  // Default configuration
  let config = {
    level: process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
    prefix: 'GGUF.js',
    useColors: true,
    timestamp: true,
    showInConsole: true
  };
  
  // Color codes for console output
  const COLORS = {
    reset: '\x1b[0m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Level-specific colors
    error: '\x1b[31m', // red
    warn: '\x1b[33m',  // yellow
    info: '\x1b[36m',  // cyan
    debug: '\x1b[90m', // gray
    prefix: '\x1b[35m' // magenta
  };
  
  // Store for log entries (can be used for log retrieval in testing/debug UIs)
  const logStore = [];
  const MAX_LOG_STORE = 1000; // Maximum number of entries to keep
  
  /**
   * Configure the logger
   * @param {Object} options - Configuration options
   * @param {string} options.level - Log level ('none', 'error', 'warn', 'info', 'debug')
   * @param {string} options.prefix - Prefix for log messages
   * @param {boolean} options.useColors - Whether to use colors in console output
   * @param {boolean} options.timestamp - Whether to include timestamps
   * @param {boolean} options.showInConsole - Whether to show logs in console
   */
  function configure(options = {}) {
    if (options.level !== undefined) {
      if (typeof options.level === 'string') {
        const levelName = options.level.toUpperCase();
        if (LOG_LEVELS[levelName] !== undefined) {
          config.level = LOG_LEVELS[levelName];
        }
      } else if (typeof options.level === 'number') {
        config.level = options.level;
      }
    }
    
    if (options.prefix !== undefined) config.prefix = options.prefix;
    if (options.useColors !== undefined) config.useColors = !!options.useColors;
    if (options.timestamp !== undefined) config.timestamp = !!options.timestamp;
    if (options.showInConsole !== undefined) config.showInConsole = !!options.showInConsole;
  }
  
  /**
   * Format a log message
   * @private
   * @param {string} level - Log level name
   * @param {string} message - Log message
   * @param {Object|undefined} data - Additional data to log
   * @returns {string} Formatted log message
   */
  function formatMessage(level, message, data) {
    const parts = [];
    
    // Add timestamp if enabled
    if (config.timestamp) {
      const now = new Date().toISOString();
      if (config.useColors) {
        parts.push(`${COLORS.debug}[${now}]${COLORS.reset}`);
      } else {
        parts.push(`[${now}]`);
      }
    }
    
    // Add prefix if set
    if (config.prefix) {
      if (config.useColors) {
        parts.push(`${COLORS.prefix}[${config.prefix}]${COLORS.reset}`);
      } else {
        parts.push(`[${config.prefix}]`);
      }
    }
    
    // Add level
    if (config.useColors) {
      parts.push(`${COLORS[level.toLowerCase()]}[${level}]${COLORS.reset}`);
    } else {
      parts.push(`[${level}]`);
    }
    
    // Add message
    parts.push(message);
    
    // Format as string
    return parts.join(' ');
  }
  
  /**
   * Log a message at a specific level
   * @private
   * @param {string} level - Log level name
   * @param {string} message - Log message
   * @param {Object|undefined} data - Additional data to log
   */
  function log(level, message, data) {
    const levelValue = LOG_LEVELS[level.toUpperCase()];
    
    // Skip if log level is too low
    if (levelValue > config.level) return;
    
    // Format the message
    const formattedMessage = formatMessage(level, message);
    
    // Store in log history
    const logEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      formatted: formattedMessage
    };
    
    logStore.push(logEntry);
    if (logStore.length > MAX_LOG_STORE) {
      logStore.shift(); // Remove oldest entry
    }
    
    // Output to console if enabled
    if (config.showInConsole) {
      const consoleMethod = level.toLowerCase();
      
      if (console[consoleMethod]) {
        if (data !== undefined) {
          console[consoleMethod](formattedMessage, data);
        } else {
          console[consoleMethod](formattedMessage);
        }
      } else {
        console.log(formattedMessage);
      }
    }
    
    return logEntry;
  }
  
  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error|Object|undefined} error - Error object or additional data
   */
  function error(message, error) {
    let errorData;
    
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else {
      errorData = error;
    }
    
    return log('ERROR', message, errorData);
  }
  
  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object|undefined} data - Additional data
   */
  function warn(message, data) {
    return log('WARN', message, data);
  }
  
  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object|undefined} data - Additional data
   */
  function info(message, data) {
    return log('INFO', message, data);
  }
  
  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object|undefined} data - Additional data
   */
  function debug(message, data) {
    return log('DEBUG', message, data);
  }
  
  /**
   * Get all stored log entries
   * @returns {Array} Array of log entries
   */
  function getLogs() {
    return [...logStore];
  }
  
  /**
   * Clear stored log entries
   */
  function clearLogs() {
    logStore.length = 0;
  }
  
  /**
   * Create a logger instance with its own prefix
   * @param {string} prefix - Logger prefix
   * @returns {Object} Logger instance
   */
  function createLogger(prefix) {
    return {
      error: (message, data) => error(`[${prefix}] ${message}`, data),
      warn: (message, data) => warn(`[${prefix}] ${message}`, data),
      info: (message, data) => info(`[${prefix}] ${message}`, data),
      debug: (message, data) => debug(`[${prefix}] ${message}`, data)
    };
  }
  
  var logger$9 = {
    configure,
    error,
    warn,
    info,
    debug,
    getLogs,
    clearLogs,
    createLogger,
    LOG_LEVELS
  };

/**
 * GGUF model loader
 * @module core/loader
 */

const { GGUFModel: GGUFModel$1, createModelId: createModelId$1 } = model;
const logger$8 = logger$9;

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
  
  // Generate or use provided model ID
  const modelId = customModelId || createModelId$1(path);
  
  // Check if model is already loaded
  if (useCache && loadedModels.has(modelId)) {
    logger$8.info(`Using cached model: ${modelId}`);
    const cachedModel = loadedModels.get(modelId);
    cachedModel.updateLastUsed();
    return cachedModel;
  }
  
  logger$8.info(`Loading model from: ${path}`);
  logger$8.debug('Loading options:', { quantization, contextSize, lowMemory });
  
  try {
    // Create model instance
    const model = new GGUFModel$1({
      id: modelId,
      path,
      metadata: {
        ...metadata,
        quantization,
        contextSize,
        lowMemory
      }
    });
    
    // Initialize the model with the adapter
    const { session, tokenizer } = await adapter.initializeModel(path, {
      quantization,
      contextSize,
      lowMemory
    });
    
    model.session = session;
    model.tokenizer = tokenizer;
    model.isLoaded = true;
    
    // Store in cache if requested
    if (useCache) {
      loadedModels.set(modelId, model);
    }
    
    logger$8.info(`Model loaded successfully: ${modelId}`);
    return model;
  } catch (error) {
    logger$8.error(`Failed to load model: ${error.message}`);
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
    
    // Use adapter to free resources if provided
    if (adapter && adapter.freeModel) {
      adapter.freeModel(model);
    }
    
    // Unload the model
    model.unload();
    loadedModels.delete(modelId);
    
    logger$8.info(`Model unloaded: ${modelId}`);
    return true;
  }
  
  logger$8.warn(`Model not found for unloading: ${modelId}`);
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
    // Use adapter to free resources if provided
    if (adapter && adapter.freeModel) {
      adapter.freeModel(model);
    }
    
    model.unload();
  }
  
  loadedModels.clear();
  logger$8.info('All models unloaded from memory');
}

var loader$2 = {
  loadModel,
  unloadModel,
  getModel,
  listModels,
  clearModels
};

/**
 * GGUF inference engine
 * @module core/inference
 */

const { ModelContext: ModelContext$1, GenerationOptions: GenerationOptions$1 } = model;
const logger$7 = logger$9;

/**
 * Global cancellation flag for inference
 * @type {Map<string, boolean>}
 */
const cancellationFlags = new Map();

/**
 * Run text generation with a model
 * @param {GGUFModel} model - The loaded model
 * @param {string} prompt - Input prompt
 * @param {Object} [options={}] - Generation options
 * @param {Object} [adapter] - Environment-specific adapter
 * @returns {Promise<string>} Generated text
 */
async function generate(model, prompt, options = {}, adapter) {
  if (!adapter) {
    throw new Error('No adapter provided. Please use an environment-specific inference engine.');
  }
  
  if (!model || !model.isLoaded || !model.session) {
    throw new Error('Model not loaded properly');
  }
  
  // Reset cancellation flag
  cancellationFlags.set(model.id, false);
  
  // Normalize options
  const generationOptions = new GenerationOptions$1(options);
  
  logger$7.info(`Generating with model: ${model.id}`);
  logger$7.debug('Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
  logger$7.debug('Options:', generationOptions);
  
  try {
    // Tokenize the prompt
    const tokens = await adapter.tokenize(model, prompt);
    logger$7.debug(`Tokenized prompt: ${tokens.length} tokens`);
    
    // Create model context
    const context = new ModelContext$1({
      tokens,
      contextSize: model.metadata.contextSize || 2048
    });
    
    // Check context length
    if (context.getContextLength() >= context.contextSize) {
      logger$7.warn(`Prompt exceeds context size: ${context.getContextLength()} tokens`);
      // Truncate context if necessary
      context.tokens = context.tokens.slice(-context.contextSize + 100); // Leave room for generation
    }
    
    // Reserve tokens for generation
    const maxNewTokens = Math.min(
      generationOptions.maxTokens,
      context.getRemainingSpace() - 10 // Leave some buffer
    );
    
    // Run the inference
    const outputTokens = await adapter.runInference(
      model,
      context,
      {
        ...generationOptions,
        maxTokens: maxNewTokens
      },
      () => cancellationFlags.get(model.id)
    );
    
    // Detokenize the output
    const outputText = await adapter.detokenize(model, outputTokens);
    
    logger$7.info(`Generated ${outputTokens.length} tokens`);
    return outputText;
  } catch (error) {
    if (cancellationFlags.get(model.id)) {
      logger$7.info('Generation was cancelled');
      return '';
    }
    
    logger$7.error(`Generation failed: ${error.message}`);
    throw new Error(`Text generation failed: ${error.message}`);
  } finally {
    model.updateLastUsed();
  }
}

/**
 * Token callback type 
 * @callback TokenCallback
 * @param {string} token - Generated token
 * @param {boolean} isDone - Whether generation is complete
 */

/**
 * Run streaming text generation with a model
 * @param {GGUFModel} model - The loaded model
 * @param {string} prompt - Input prompt
 * @param {TokenCallback} onToken - Callback for each token
 * @param {Object} [options={}] - Generation options
 * @param {Object} [adapter] - Environment-specific adapter
 * @returns {Promise<void>}
 */
async function streamGenerate(model, prompt, onToken, options = {}, adapter) {
  if (!adapter) {
    throw new Error('No adapter provided. Please use an environment-specific inference engine.');
  }
  
  if (!model || !model.isLoaded || !model.session) {
    throw new Error('Model not loaded properly');
  }
  
  // Reset cancellation flag
  cancellationFlags.set(model.id, false);
  
  // Normalize options
  const generationOptions = new GenerationOptions$1(options);
  
  logger$7.info(`Streaming with model: ${model.id}`);
  logger$7.debug('Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
  
  try {
    // Tokenize the prompt
    const tokens = await adapter.tokenize(model, prompt);
    
    // Create model context
    const context = new ModelContext$1({
      tokens,
      contextSize: model.metadata.contextSize || 2048
    });
    
    // Check context length
    if (context.getContextLength() >= context.contextSize) {
      logger$7.warn(`Prompt exceeds context size: ${context.getContextLength()} tokens`);
      context.tokens = context.tokens.slice(-context.contextSize + 100);
    }
    
    // Reserve tokens for generation
    const maxNewTokens = Math.min(
      generationOptions.maxTokens,
      context.getRemainingSpace() - 10
    );
    
    // Token callback wrapper
    const tokenCallback = async (tokenId) => {
      try {
        const tokenText = await adapter.detokenizeToken(model, tokenId);
        onToken(tokenText, false);
      } catch (error) {
        logger$7.error(`Token callback error: ${error.message}`);
      }
    };
    
    // Run streaming inference
    await adapter.runInferenceStreaming(
      model,
      context,
      tokenCallback,
      {
        ...generationOptions,
        maxTokens: maxNewTokens
      },
      () => cancellationFlags.get(model.id)
    );
    
    // Signal completion
    onToken('', true);
    logger$7.info('Streaming generation complete');
  } catch (error) {
    if (cancellationFlags.get(model.id)) {
      logger$7.info('Streaming was cancelled');
      onToken('', true);
      return;
    }
    
    logger$7.error(`Streaming failed: ${error.message}`);
    onToken('', true);
    throw new Error(`Streaming text generation failed: ${error.message}`);
  } finally {
    model.updateLastUsed();
  }
}

/**
 * Cancel an ongoing generation
 * @param {GGUFModel|string} modelOrId - Model or model ID
 * @returns {boolean} Whether cancellation was set
 */
function cancelGeneration(modelOrId) {
  const modelId = typeof modelOrId === 'string' ? modelOrId : modelOrId.id;
  
  if (!modelId) {
    logger$7.warn('No model ID provided for cancellation');
    return false;
  }
  
  logger$7.info(`Cancelling generation for model: ${modelId}`);
  cancellationFlags.set(modelId, true);
  return true;
}

var inference$2 = {
  generate,
  streamGenerate,
  cancelGeneration
};

/**
 * Tokenization utilities for GGUF models
 * @module core/tokenizer
 */

const logger$6 = logger$9;

/**
 * Base tokenizer interface
 */
class BaseTokenizer {
  /**
   * Encode text to token IDs
   * @param {string} text - Text to encode
   * @returns {Array<number>} Token IDs
   */
  encode(text) {
    throw new Error('encode() method must be implemented by subclass');
  }

  /**
   * Decode token IDs to text
   * @param {Array<number>} tokens - Token IDs to decode
   * @returns {string} Decoded text
   */
  decode(tokens) {
    throw new Error('decode() method must be implemented by subclass');
  }

  /**
   * Decode a single token ID to text
   * @param {number} token - Token ID to decode
   * @returns {string} Decoded text for the token
   */
  decodeToken(token) {
    return this.decode([token]);
  }
}

/**
 * Simple fallback tokenizer that works at character level
 * Used when a model doesn't provide its own tokenizer
 */
class CharacterTokenizer extends BaseTokenizer {
  constructor() {
    super();
    this.encoder = new Map();
    this.decoder = new Map();
    
    // Initialize with basic ASCII characters
    for (let i = 0; i < 128; i++) {
      const char = String.fromCharCode(i);
      this.encoder.set(char, i);
      this.decoder.set(i, char);
    }

    // Add special tokens
    this.specialTokens = {
      BOS: 128, // Beginning of sequence
      EOS: 129, // End of sequence
      PAD: 130, // Padding
      UNK: 131, // Unknown
    };

    Object.entries(this.specialTokens).forEach(([name, id]) => {
      this.decoder.set(id, `<${name}>`);
    });
  }

  /**
   * Encode text to token IDs
   * @param {string} text - Text to encode
   * @returns {Array<number>} Token IDs
   */
  encode(text) {
    return Array.from(text).map(char => {
      if (this.encoder.has(char)) {
        return this.encoder.get(char);
      }
      return this.specialTokens.UNK; // Unknown token
    });
  }

  /**
   * Decode token IDs to text
   * @param {Array<number>} tokens - Token IDs to decode
   * @returns {string} Decoded text
   */
  decode(tokens) {
    return tokens.map(token => {
      if (this.decoder.has(token)) {
        return this.decoder.get(token);
      }
      return ''; // Skip unknown tokens
    }).join('');
  }
}

/**
 * BPE (Byte-Pair Encoding) tokenizer
 * Basic implementation of BPE tokenization used by many LLMs
 */
class BPETokenizer extends BaseTokenizer {
  /**
   * Create a BPE tokenizer
   * @param {Object} config - Tokenizer configuration
   * @param {Object} config.vocab - Vocabulary mapping (token string to ID)
   * @param {Array<Array<string>>} config.merges - BPE merge rules
   */
  constructor(config) {
    super();
    this.vocab = new Map(Object.entries(config.vocab || {}).map(([k, v]) => [k, Number(v)]));
    this.decoder = new Map(Array.from(this.vocab.entries()).map(([k, v]) => [v, k]));
    this.merges = config.merges || [];
    this.specialTokens = config.specialTokens || {};
    
    // Build merge pattern cache
    this.mergePatterns = new Map();
    this.buildMergePatterns();
  }

  /**
   * Build cached patterns for BPE merges
   */
  buildMergePatterns() {
    this.merges.forEach((pair, i) => {
      const [first, second] = pair;
      const pattern = new RegExp(`(?<=^|\\s)(${first})(${second})(?=\\s|$)`, 'g');
      this.mergePatterns.set(i, {
        pattern,
        replacement: `${first}${second}`
      });
    });
  }

  /**
   * Encode text using BPE algorithm
   * @param {string} text - Text to encode
   * @returns {Array<number>} Token IDs
   */
  encode(text) {
    if (!text) return [];
    
    // First, split into words and handle them separately
    return text.split(/(\s+)/).flatMap(part => {
      if (!part.trim()) {
        // For whitespace, simply look up in the vocabulary
        const whitespaceId = this.vocab.get(part) || this.vocab.get('<UNK>') || 0;
        return [whitespaceId];
      }
      
      // Start with characters
      let tokens = Array.from(part).map(c => c);
      
      // Apply BPE merges
      for (let i = 0; i < this.merges.length; i++) {
        const [first, second] = this.merges[i];
        
        let j = 0;
        while (j < tokens.length - 1) {
          if (tokens[j] === first && tokens[j + 1] === second) {
            tokens = [
              ...tokens.slice(0, j),
              first + second,
              ...tokens.slice(j + 2)
            ];
          } else {
            j++;
          }
        }
      }
      
      // Convert subwords to token IDs
      return tokens.map(token => {
        if (this.vocab.has(token)) {
          return this.vocab.get(token);
        }
        // Fall back to unknown token
        return this.vocab.get('<UNK>') || 0;
      });
    });
  }

  /**
   * Decode token IDs back to text
   * @param {Array<number>} tokens - Token IDs to decode
   * @returns {string} Decoded text
   */
  decode(tokens) {
    return tokens.map(token => {
      if (this.decoder.has(token)) {
        return this.decoder.get(token);
      }
      return ''; // Skip unknown tokens
    }).join('');
  }
}

/**
 * Creates a tokenizer from a vocabulary or model config
 * @param {Object} config - Tokenizer configuration
 * @returns {BaseTokenizer} Appropriate tokenizer instance
 */
function createTokenizer(config) {
  if (!config) {
    logger$6.warn('No tokenizer configuration provided, using fallback character tokenizer');
    return new CharacterTokenizer();
  }
  
  // Determine tokenizer type from config
  if (config.tokenizer_type === 'bpe' || config.merges) {
    logger$6.info('Creating BPE tokenizer');
    return new BPETokenizer(config);
  }
  
  // Add more tokenizer types here as needed
  
  // Fallback to character tokenizer
  logger$6.warn('Unknown tokenizer type, using fallback character tokenizer');
  return new CharacterTokenizer();
}

/**
 * Load a tokenizer from a file
 * @param {string} path - Path to tokenizer file
 * @param {Object} adapter - Environment adapter
 * @returns {Promise<BaseTokenizer>} Loaded tokenizer
 */
async function loadTokenizerFromFile(path, adapter) {
  try {
    if (!adapter || !adapter.readFile) {
      throw new Error('Environment adapter does not support file reading');
    }
    
    const data = await adapter.readFile(path);
    const config = JSON.parse(data);
    return createTokenizer(config);
  } catch (error) {
    logger$6.error(`Failed to load tokenizer from ${path}: ${error.message}`);
    return new CharacterTokenizer();
  }
}

/**
 * Extract a tokenizer from a GGUF model
 * This is model-specific and depends on the adapter implementation
 * @param {Object} model - GGUF model object
 * @param {Object} adapter - Environment adapter
 * @returns {Promise<BaseTokenizer>} Extracted tokenizer
 */
async function extractTokenizerFromModel(model, adapter) {
  try {
    if (!adapter || !adapter.extractTokenizer) {
      throw new Error('Environment adapter does not support tokenizer extraction');
    }
    
    const config = await adapter.extractTokenizer(model);
    return createTokenizer(config);
  } catch (error) {
    logger$6.error(`Failed to extract tokenizer from model: ${error.message}`);
    return new CharacterTokenizer();
  }
}

var tokenizer$1 = {
  BaseTokenizer,
  CharacterTokenizer,
  BPETokenizer,
  createTokenizer,
  loadTokenizerFromFile,
  extractTokenizerFromModel
};

/**
 * Node.js adapter for GGUF models
 * @module adapters/node
 */

const fs = require$$0;
const path = require$$1;
const logger$5 = logger$9;

// We'll use node-llama-cpp for GGUF model handling
// This needs to be installed as a dependency
let LlamaModel;
try {
  const llamaCpp = require('node-llama-cpp');
  LlamaModel = llamaCpp.LlamaModel;
} catch (error) {
  logger$5.warn('node-llama-cpp not found. Install it with: npm install node-llama-cpp');
  LlamaModel = null;
}

/**
 * Initialize a GGUF model in Node.js environment
 * @param {string} modelPath - Path to the model file
 * @param {Object} options - Model options
 * @returns {Promise<Object>} Session and tokenizer
 */
async function initializeModel$1(modelPath, options = {}) {
  if (!LlamaModel) {
    throw new Error('node-llama-cpp is required but not installed');
  }
  
  // Verify the model file exists
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model file not found: ${modelPath}`);
  }
  
  logger$5.info(`Initializing GGUF model from: ${modelPath}`);
  
  // Default options
  const {
    contextSize = 2048,
    quantization = 'q4_0',
    lowMemory = false,
    seed = Math.floor(Math.random() * 4294967295),
    threads = Math.max(1, require$$4.cpus().length / 2)
  } = options;
  
  // Normalize path to absolute
  const absolutePath = path.resolve(modelPath);
  
  try {
    // Initialize llama.cpp model
    const model = new LlamaModel({
      modelPath: absolutePath,
      contextSize,
      seed,
      threads,
      useMlock: !lowMemory,
      batchSize: 512,
      // Ensure proper mapping for quantization
      gpuLayers: 0 // Node.js typically doesn't use GPU
    });
    
    // Create a tokenizer interface
    const tokenizer = {
      encode: async (text) => model.tokenize(text),
      decode: async (tokens) => model.detokenize(tokens),
      decodeToken: async (token) => model.detokenize([token])
    };
    
    logger$5.info(`Model initialized successfully (context size: ${contextSize}, threads: ${threads})`);
    
    return {
      session: model,
      tokenizer
    };
  } catch (error) {
    logger$5.error(`Failed to initialize model: ${error.message}`);
    throw error;
  }
}

/**
 * Tokenize text with the model
 * @param {Object} model - The GGUF model
 * @param {string} text - Text to tokenize
 * @returns {Promise<number[]>} Token IDs
 */
async function tokenize$1(model, text) {
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
async function detokenize$1(model, tokens) {
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
async function detokenizeToken$1(model, token) {
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
async function runInference$1(model, context, options, isCancelled) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  // Configure generation parameters
  const params = {
    nPredict: options.maxTokens,
    temperature: options.temperature,
    topP: options.topP,
    topK: options.topK,
    repeatPenalty: options.repetitionPenalty,
    seed: options.seed,
    // Include stop sequences if provided
    stop: options.stopSequences || []
  };
  
  // Create a completion using the existing tokens
  return new Promise((resolve, reject) => {
    try {
      // Use the node-llama-cpp API for completion
      const completion = model.session.generate({
        tokens: context.tokens,
        ...params
      });
      
      const outputTokens = [];
      
      // Process token by token
      for (const token of completion) {
        // Check for cancellation
        if (isCancelled && isCancelled()) {
          logger$5.info('Generation cancelled');
          break;
        }
        
        outputTokens.push(token);
        
        // Check if we've reached the maximum tokens
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
async function runInferenceStreaming$1(model, context, onToken, options, isCancelled) {
  if (!model.session) {
    throw new Error('Model session not initialized');
  }
  
  // Configure generation parameters
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
      // Use the node-llama-cpp API for streaming
      const completion = model.session.generate({
        tokens: context.tokens,
        ...params
      });
      
      // Process tokens in a streaming fashion
      let tokenCount = 0;
      
      for (const token of completion) {
        // Check for cancellation
        if (isCancelled && isCancelled()) {
          logger$5.info('Streaming generation cancelled');
          break;
        }
        
        // Call token callback
        onToken(token);
        tokenCount++;
        
        // Check if we've reached the maximum tokens
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
function freeModel$1(model) {
  if (model.session && typeof model.session.dispose === 'function') {
    model.session.dispose();
    logger$5.info(`Model resources freed: ${model.id}`);
  }
}

/**
 * Discover GGUF models in a directory
 * @param {string} directory - Directory to search
 * @returns {Promise<Object[]>} Array of model info objects
 */
async function discoverModels(directory) {
  if (!fs.existsSync(directory)) {
    logger$5.warn(`Model directory not found: ${directory}`);
    return [];
  }
  
  logger$5.info(`Searching for GGUF models in: ${directory}`);
  
  try {
    const files = fs.readdirSync(directory);
    const modelFiles = files.filter(file => file.toLowerCase().endsWith('.gguf'));
    
    // Create model info objects
    const models = modelFiles.map(file => {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);
      
      // Parse basic model info from filename
      // Typical format: model-name.Q4_K_M.gguf
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
    
    logger$5.info(`Found ${models.length} GGUF models`);
    return models;
  } catch (error) {
    logger$5.error(`Error discovering models: ${error.message}`);
    return [];
  }
}

var node = {
  initializeModel: initializeModel$1,
  tokenize: tokenize$1,
  detokenize: detokenize$1,
  detokenizeToken: detokenizeToken$1,
  runInference: runInference$1,
  runInferenceStreaming: runInferenceStreaming$1,
  freeModel: freeModel$1,
  discoverModels
};

/**
 * Browser-specific adapter for GGUF.js
 * @module adapters/browser
 */

const logger$4 = logger$9;

// Check if WebAssembly is available
const hasWebAssembly = typeof WebAssembly === 'object' && 
                        typeof WebAssembly.instantiate === 'function';

// WASM module and instance
let wasmModule = null;
let wasmInstance = null;
let isInitialized = false;

// Default WASM URL - in production, this would point to your hosted WASM build
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
    logger$4.error('WebAssembly is not supported in this browser');
    return false;
  }
  
  const wasmUrl = options.wasmUrl || DEFAULT_WASM_URL;
  
  try {
    logger$4.info(`Loading WASM from ${wasmUrl}`);
    
    // Fetch the WASM binary
    const response = await fetch(wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }
    
    const wasmBinary = await response.arrayBuffer();
    
    // Compile the WASM module
    wasmModule = await WebAssembly.compile(wasmBinary);
    
    // Create memory and import object
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 2048 });
    
    // Define imports needed by the WASM module
    const importObject = {
      env: {
        memory,
        // Add required JavaScript functions that the WASM module can call
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
    
    // Instantiate the WASM module
    wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
    
    isInitialized = true;
    logger$4.info('WASM initialized successfully');
    return true;
  } catch (error) {
    logger$4.error(`Failed to initialize WASM: ${error.message}`);
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
  // Ensure WASM is initialized
  if (!isInitialized) {
    const initialized = await initializeWasm(options);
    if (!initialized) {
      throw new Error('WebAssembly initialization failed');
    }
  }
  
  let modelData;
  
  // Check if modelPathOrData is a path or ArrayBuffer
  if (typeof modelPathOrData === 'string') {
    logger$4.info(`Fetching model from ${modelPathOrData}`);
    
    try {
      const response = await fetch(modelPathOrData);
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`);
      }
      
      modelData = await response.arrayBuffer();
      logger$4.info(`Model fetched: ${modelData.byteLength} bytes`);
    } catch (error) {
      throw new Error(`Failed to fetch model: ${error.message}`);
    }
  } else if (modelPathOrData instanceof ArrayBuffer) {
    modelData = modelPathOrData;
    logger$4.info(`Using provided model data: ${modelData.byteLength} bytes`);
  } else {
    throw new Error('Model must be a URL string or ArrayBuffer');
  }
  
  try {
    // Create a shared buffer for the model data
    const modelBuffer = new Uint8Array(modelData);
    
    // In a real implementation, we'd now load the model into WASM memory
    // and call initialization functions
    
    // Get exports from WASM instance
    const exports = wasmInstance.exports;
    
    // Allocate memory for the model in WASM
    const modelPtr = exports.allocateMemory(modelBuffer.length);
    
    // Create a view into the WASM memory
    const memory = exports.memory;
    const memoryView = new Uint8Array(memory.buffer);
    
    // Copy model data to WASM memory
    memoryView.set(modelBuffer, modelPtr);
    
    // Call WASM function to load the model
    const modelId = exports.loadModel(modelPtr, modelBuffer.length, options.contextSize || 2048);
    
    if (modelId < 0) {
      throw new Error(`Failed to load model: error code ${modelId}`);
    }
    
    logger$4.info(`Model loaded with ID: ${modelId}`);
    
    // Create tokenizer interface
    const tokenizer = {
      encode: async (text) => {
        // Convert text to Uint8Array
        const textBytes = new TextEncoder().encode(text);
        
        // Allocate memory for the text
        const textPtr = exports.allocateMemory(textBytes.length);
        
        // Copy text to WASM memory
        memoryView.set(textBytes, textPtr);
        
        // Call WASM tokenize function
        const resultPtr = exports.tokenize(modelId, textPtr, textBytes.length);
        
        // Read result from memory
        const resultView = new DataView(memory.buffer);
        const tokenCount = resultView.getInt32(resultPtr, true);
        const tokensPtr = resultView.getInt32(resultPtr + 4, true);
        
        // Read tokens
        const tokens = [];
        for (let i = 0; i < tokenCount; i++) {
          tokens.push(resultView.getInt32(tokensPtr + i * 4, true));
        }
        
        // Free memory
        exports.freeMemory(textPtr);
        exports.freeMemory(resultPtr);
        
        return tokens;
      },
      
      decode: async (tokens) => {
        // Allocate memory for tokens
        const tokensPtr = exports.allocateMemory(tokens.length * 4);
        
        // Copy tokens to WASM memory
        const tokensView = new Int32Array(memory.buffer, tokensPtr, tokens.length);
        tokens.forEach((token, i) => tokensView[i] = token);
        
        // Call WASM detokenize function
        const resultPtr = exports.detokenize(modelId, tokensPtr, tokens.length);
        
        // Read result
        const resultView = new DataView(memory.buffer);
        const textLength = resultView.getInt32(resultPtr, true);
        const textPtr = resultView.getInt32(resultPtr + 4, true);
        
        // Extract text
        const textBytes = new Uint8Array(memory.buffer, textPtr, textLength);
        const text = new TextDecoder().decode(textBytes);
        
        // Free memory
        exports.freeMemory(tokensPtr);
        exports.freeMemory(resultPtr);
        
        return text;
      },
      
      decodeToken: async (token) => {
        // Allocate memory for token
        const tokenPtr = exports.allocateMemory(4);
        
        // Write token to memory
        const tokenView = new Int32Array(memory.buffer, tokenPtr, 1);
        tokenView[0] = token;
        
        // Call WASM detokenize function for single token
        const resultPtr = exports.detokenize(modelId, tokenPtr, 1);
        
        // Read result
        const resultView = new DataView(memory.buffer);
        const textLength = resultView.getInt32(resultPtr, true);
        const textPtr = resultView.getInt32(resultPtr + 4, true);
        
        // Extract text
        const textBytes = new Uint8Array(memory.buffer, textPtr, textLength);
        const text = new TextDecoder().decode(textBytes);
        
        // Free memory
        exports.freeMemory(tokenPtr);
        exports.freeMemory(resultPtr);
        
        return text;
      }
    };
    
    // Return session and tokenizer
    return {
      session: { modelId },
      tokenizer
    };
  } catch (error) {
    logger$4.error(`Failed to initialize model: ${error.message}`);
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
    // Get input tokens
    const inputTokens = context.tokens;
    
    // Allocate memory for input tokens
    const inputPtr = exports.allocateMemory(inputTokens.length * 4);
    
    // Copy input tokens to WASM memory
    const inputView = new Int32Array(exports.memory.buffer, inputPtr, inputTokens.length);
    inputTokens.forEach((token, i) => inputView[i] = token);
    
    // Prepare generation parameters
    const paramsPtr = exports.allocateMemory(40);  // Enough for all parameters
    const paramsView = new DataView(exports.memory.buffer, paramsPtr);
    
    let offset = 0;
    paramsView.setInt32(offset, options.maxTokens || 100, true); offset += 4;
    paramsView.setFloat32(offset, options.temperature || 0.7, true); offset += 4;
    paramsView.setFloat32(offset, options.topP || 0.9, true); offset += 4;
    paramsView.setInt32(offset, options.topK || 40, true); offset += 4;
    paramsView.setFloat32(offset, options.repetitionPenalty || 1.1, true); offset += 4;
    paramsView.setInt32(offset, options.seed || Math.floor(Math.random() * 4294967295), true);
    
    // Call WASM inference function
    const resultPtr = exports.generateText(
      modelId,
      inputPtr,
      inputTokens.length,
      paramsPtr
    );
    
    // Check for cancellation between batches
    const checkCancellation = () => {
      if (isCancelled && isCancelled()) {
        // Call WASM function to cancel generation
        exports.cancelGeneration(modelId);
        return true;
      }
      return false;
    };
    
    // Poll for results
    let completed = false;
    const outputTokens = [];
    
    while (!completed && !checkCancellation()) {
      // Check generation status
      const status = exports.getGenerationStatus(modelId);
      
      if (status === 0) {
        // Still generating, wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      } else if (status === 1) {
        // Generation complete
        completed = true;
        
        // Read result tokens
        const resultView = new DataView(exports.memory.buffer);
        const tokenCount = resultView.getInt32(resultPtr, true);
        const tokensPtr = resultView.getInt32(resultPtr + 4, true);
        
        // Extract tokens
        const tokenView = new Int32Array(exports.memory.buffer, tokensPtr, tokenCount);
        for (let i = 0; i < tokenCount; i++) {
          outputTokens.push(tokenView[i]);
        }
        
        // Free memory
        exports.freeMemory(inputPtr);
        exports.freeMemory(paramsPtr);
        exports.freeMemory(resultPtr);
      } else {
        // Error
        exports.freeMemory(inputPtr);
        exports.freeMemory(paramsPtr);
        throw new Error(`Generation failed with status code ${status}`);
      }
    }
    
    return outputTokens;
  } catch (error) {
    logger$4.error(`Inference error: ${error.message}`);
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
    // Similar setup as runInference
    const inputTokens = context.tokens;
    const inputPtr = exports.allocateMemory(inputTokens.length * 4);
    const inputView = new Int32Array(exports.memory.buffer, inputPtr, inputTokens.length);
    inputTokens.forEach((token, i) => inputView[i] = token);
    
    // Prepare parameters
    const paramsPtr = exports.allocateMemory(40);
    const paramsView = new DataView(exports.memory.buffer, paramsPtr);
    
    let offset = 0;
    paramsView.setInt32(offset, options.maxTokens || 100, true); offset += 4;
    paramsView.setFloat32(offset, options.temperature || 0.7, true); offset += 4;
    paramsView.setFloat32(offset, options.topP || 0.9, true); offset += 4;
    paramsView.setInt32(offset, options.topK || 40, true); offset += 4;
    paramsView.setFloat32(offset, options.repetitionPenalty || 1.1, true); offset += 4;
    paramsView.setInt32(offset, options.seed || Math.floor(Math.random() * 4294967295), true); offset += 4;
    paramsView.setInt32(offset, 1, true); // streaming flag
    
    // Start streaming generation
    exports.startStreamingGeneration(modelId, inputPtr, inputTokens.length, paramsPtr);
    
    // Poll for tokens
    while (true) {
      // Check for cancellation
      if (isCancelled && isCancelled()) {
        exports.cancelGeneration(modelId);
        break;
      }
      
      // Check for new token
      const tokenPtr = exports.getNextToken(modelId);
      
      if (tokenPtr === 0) {
        // No token available yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      } else if (tokenPtr === -1) {
        // End of generation
        break;
      } else {
        // Got a token, read it
        const token = new DataView(exports.memory.buffer).getInt32(tokenPtr, true);
        
        // Detokenize and call callback
        const tokenText = await detokenizeToken(model, token);
        await onToken(token);
        
        // Free token memory
        exports.freeMemory(tokenPtr);
      }
    }
    
    // Clean up
    exports.freeMemory(inputPtr);
    exports.freeMemory(paramsPtr);
  } catch (error) {
    logger$4.error(`Streaming inference error: ${error.message}`);
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
    logger$4.info(`Model resources freed: ${modelId}`);
  } catch (error) {
    logger$4.error(`Error freeing model: ${error.message}`);
  }
}

var browser = {
  initializeWasm,
  initializeModel,
  tokenize,
  detokenize,
  detokenizeToken,
  runInference,
  runInferenceStreaming,
  freeModel
};

function commonjsRequire(path) {
	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}

/**
 * React hooks and utilities for GGUF models
 * @module adapters/react
 */

// Check if React is available in the environment
const hasReact = typeof window !== 'undefined' && 
                 (typeof window.React !== 'undefined' || 
                  typeof commonjsRequire === 'function' && (() => {
                    try { require('react'); return true; } 
                    catch { return false; }
                  })());

// Import React if available
let React;
if (hasReact) {
  try {
    React = typeof window !== 'undefined' && window.React ? 
            window.React : require('react');
  } catch (error) {
    console.warn('React not found, hooks will not function properly');
  }
}
const loader$1 = loader$2;
const inference$1 = inference$2;
const logger$3 = logger$9;

/**
 * Use state in a React hook or plain object fallback
 * 
 * @param {any} initialValue - Initial state value
 * @returns {Array} [value, setValue]
 */
function useState(initialValue) {
  if (React && React.useState) {
    return React.useState(initialValue);
  } else {
    // Fallback implementation for non-React environments
    let value = initialValue;
    const setValue = (newValue) => {
      if (typeof newValue === 'function') {
        value = newValue(value);
      } else {
        value = newValue;
      }
    };
    return [value, setValue];
  }
}

/**
 * Use effect in a React hook or plain function fallback
 * 
 * @param {Function} effect - Effect function
 * @param {Array} deps - Dependencies array
 */
function useEffect(effect, deps) {
  if (React && React.useEffect) {
    return React.useEffect(effect, deps);
  } else {
    // Fallback implementation for non-React environments
    // Call effect immediately for non-React environment
    const cleanup = effect();
    
    // Return cleanup function if provided
    return cleanup;
  }
}

/**
 * Use callback in a React hook or plain function fallback
 * 
 * @param {Function} callback - Callback function
 * @param {Array} deps - Dependencies array
 * @returns {Function} Memoized callback
 */
function useCallback(callback, deps) {
  if (React && React.useCallback) {
    return React.useCallback(callback, deps);
  } else {
    // Fallback implementation for non-React environments
    return callback;
  }
}

/**
 * Use ref in a React hook or plain object fallback
 * 
 * @param {any} initialValue - Initial ref value
 * @returns {Object} Ref object
 */
function useRef(initialValue) {
  if (React && React.useRef) {
    return React.useRef(initialValue);
  } else {
    // Fallback implementation for non-React environments
    return { current: initialValue };
  }
}

/**
 * Hook to load and manage a GGUF model
 * 
 * @param {Object} adapter - Environment adapter
 * @param {Object} [options={}] - Hook options
 * @returns {Object} Model state and functions
 */
function useModel(adapter, options = {}) {
  const [model, setModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Load a model
  const loadModel = useCallback(async (path, loadOptions = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedModel = await loader$1.loadModel(path, loadOptions, adapter);
      setModel(loadedModel);
      return loadedModel;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [adapter]);
  
  // Unload the current model
  const unloadModel = useCallback(async () => {
    if (model) {
      try {
        await loader$1.unloadModel(model.id, adapter);
        setModel(null);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
    }
    return false;
  }, [model, adapter]);
  
  // Discover models in a directory (Node.js only)
  const discoverModels = useCallback(async (directory) => {
    if (!adapter.discoverModels) {
      setError('Model discovery not supported in this environment');
      return [];
    }
    
    try {
      return await adapter.discoverModels(directory);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [adapter]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (model && model.id) {
        // Try to unload the model on unmount
        try {
          loader$1.unloadModel(model.id, adapter);
        } catch (err) {
          logger$3.warn(`Failed to unload model on unmount: ${err.message}`);
        }
      }
    };
  }, [model, adapter]);
  
  return {
    model,
    isLoading,
    error,
    loadModel,
    unloadModel,
    discoverModels
  };
}

/**
 * Hook for text generation
 * 
 * @param {Object} adapter - Environment adapter
 * @param {Object} [options={}] - Hook options
 * @returns {Object} Generation state and functions
 */
function useGeneration(adapter, options = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [output, setOutput] = useState('');
  const isCancelled = useRef(false);
  
  // Generate text
  const generate = useCallback(async (model, prompt, genOptions = {}) => {
    if (!model || !model.isLoaded) {
      const error = new Error('Model not loaded properly');
      setError(error.message);
      throw error;
    }
    
    setIsGenerating(true);
    setError(null);
    setOutput('');
    isCancelled.current = false;
    
    try {
      const response = await inference$1.generate(
        model, 
        prompt, 
        genOptions, 
        adapter, 
        () => isCancelled.current
      );
      
      setOutput(response);
      return response;
    } catch (err) {
      if (!isCancelled.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
      return '';
    } finally {
      setIsGenerating(false);
    }
  }, [adapter]);
  
  // Stream generation
  const streamGenerate = useCallback(async (model, prompt, onToken, genOptions = {}) => {
    if (!model || !model.isLoaded) {
      const error = new Error('Model not loaded properly');
      setError(error.message);
      throw error;
    }
    
    setIsGenerating(true);
    setError(null);
    setOutput('');
    isCancelled.current = false;
    
    let fullOutput = '';
    
    // Create a wrapped onToken function that builds the full output
    const wrappedOnToken = (token, isDone) => {
      if (!isCancelled.current) {
        fullOutput += token;
        setOutput(fullOutput);
        onToken(token, isDone);
      }
    };
    
    try {
      await inference$1.streamGenerate(
        model, 
        prompt, 
        wrappedOnToken, 
        genOptions, 
        adapter, 
        () => isCancelled.current
      );
      
      return fullOutput;
    } catch (err) {
      if (!isCancelled.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
      return fullOutput;
    } finally {
      setIsGenerating(false);
    }
  }, [adapter]);
  
  // Cancel generation
  const cancelGeneration = useCallback(() => {
    isCancelled.current = true;
    setIsGenerating(false);
    return true;
  }, []);
  
  return {
    isGenerating,
    error,
    output,
    generate,
    streamGenerate,
    cancelGeneration
  };
}

/**
 * Hook for chat conversation state management
 * 
 * @param {Object} adapter - Environment adapter
 * @param {Object} [options={}] - Hook options
 * @returns {Object} Chat state and functions
 */
function useChat(adapter, options = {}) {
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  // Add a user message
  const addUserMessage = useCallback((content) => {
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    return userMessage;
  }, []);
  
  // Add an assistant message
  const addAssistantMessage = useCallback((content) => {
    const assistantMessage = {
      id: Date.now(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, assistantMessage]);
    return assistantMessage;
  }, []);
  
  // Format messages into a prompt
  const formatPrompt = useCallback((systemPrompt) => {
    let prompt = '';
    
    // Add system prompt if provided
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }
    
    // Add conversation history
    for (const message of messages) {
      if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      } else if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      }
    }
    
    // Add assistant prompt
    prompt += 'Assistant: ';
    
    return prompt;
  }, [messages]);
  
  // Generate a response
  const generateResponse = useCallback(async (
    model, 
    systemPrompt = '',
    genOptions = {}
  ) => {
    if (!model || !model.isLoaded) {
      const error = new Error('Model not loaded properly');
      setError(error.message);
      throw error;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Format the conversation into a prompt
      const prompt = formatPrompt(systemPrompt);
      
      // Generate a response
      const response = await inference$1.generate(
        model,
        prompt,
        genOptions,
        adapter
      );
      
      // Add the response to the conversation
      addAssistantMessage(response);
      
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [formatPrompt, addAssistantMessage, adapter]);
  
  // Stream a response
  const streamResponse = useCallback(async (
    model,
    onToken,
    systemPrompt = '',
    genOptions = {}
  ) => {
    if (!model || !model.isLoaded) {
      const error = new Error('Model not loaded properly');
      setError(error.message);
      throw error;
    }
    
    setIsGenerating(true);
    setError(null);
    
    // Create a placeholder for the assistant message
    const assistantMessage = {
      id: Date.now(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, assistantMessage]);
    
    let fullResponse = '';
    
    // Create a wrapped token handler that updates the message
    const wrappedOnToken = (token, isDone) => {
      if (!isDone) {
        fullResponse += token;
        
        // Update the assistant message
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages];
          const lastIndex = updatedMessages.length - 1;
          
          if (lastIndex >= 0 && updatedMessages[lastIndex].id === assistantMessage.id) {
            updatedMessages[lastIndex] = {
              ...updatedMessages[lastIndex],
              content: fullResponse
            };
          }
          
          return updatedMessages;
        });
        
        // Call the original callback
        onToken(token, isDone);
      } else {
        onToken('', true);
      }
    };
    
    try {
      // Format the conversation into a prompt
      const prompt = formatPrompt(systemPrompt);
      
      // Generate a streaming response
      await inference$1.streamGenerate(
        model,
        prompt,
        wrappedOnToken,
        genOptions,
        adapter
      );
      
      return fullResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [formatPrompt, adapter]);
  
  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return {
    messages,
    isGenerating,
    error,
    addUserMessage,
    addAssistantMessage,
    generateResponse,
    streamResponse,
    clearMessages,
    formatPrompt
  };
}

/**
 * Create a React context provider for GGUF models
 * Only available when React is present
 * 
 * @param {Object} adapter - Environment adapter
 * @returns {Object} Context provider and hooks
 */
function createGGUFContext(adapter) {
  if (!React) {
    throw new Error('React is required to create a context provider');
  }
  
  // Create contexts
  const ModelContext = React.createContext(null);
  const GenerationContext = React.createContext(null);
  
  // Provider component
  const GGUFProvider = ({ children, initialOptions = {} }) => {
    const modelState = useModel(adapter, initialOptions);
    const generationState = useGeneration(adapter, initialOptions);
    
    // Use React.createElement instead of JSX
    return React.createElement(
      ModelContext.Provider,
      { value: modelState },
      React.createElement(
        GenerationContext.Provider,
        { value: generationState },
        children
      )
    );
  };
  
  // Custom hooks to use the contexts
  const useGGUFModel = () => {
    const context = React.useContext(ModelContext);
    if (!context) {
      throw new Error('useGGUFModel must be used within a GGUFProvider');
    }
    return context;
  };
  
  const useGGUFGeneration = () => {
    const context = React.useContext(GenerationContext);
    if (!context) {
      throw new Error('useGGUFGeneration must be used within a GGUFProvider');
    }
    return context;
  };
  
  return {
    GGUFProvider,
    useGGUFModel,
    useGGUFGeneration
  };
}

var react = {
  // Core hooks
  useModel,
  useGeneration,
  useChat,
  
  // React context utilities (only available when React is present)
  createGGUFContext: hasReact ? createGGUFContext : undefined,
  
  // Expose React wrappers for testing
  _react: {
    useState,
    useEffect,
    useCallback,
    useRef
  }
};

/**
 * Memory management utilities for GGUF.js
 * @module utils/memory
 */

const logger$2 = logger$9;

/**
 * Memory allocation record
 * @typedef {Object} AllocationRecord
 * @property {string} id - Unique identifier
 * @property {number} size - Size in bytes
 * @property {string} [type] - Allocation type
 * @property {number} timestamp - Allocation timestamp
 * @property {string} [description] - Description
 */

/**
 * Memory usage stats
 * @typedef {Object} MemoryStats
 * @property {number} allocated - Total bytes allocated
 * @property {number} freed - Total bytes freed
 * @property {number} active - Active bytes (allocated - freed)
 * @property {number} peak - Peak memory usage
 * @property {number} allocations - Number of allocations
 * @property {number} frees - Number of frees
 */

/**
 * Memory manager class for tracking and optimizing memory usage
 */
class MemoryManager {
  constructor() {
    /**
     * Map of active allocations
     * @type {Map<string, AllocationRecord>}
     */
    this.allocations = new Map();
    
    /**
     * Allocation counter for generating IDs
     * @type {number}
     */
    this.counter = 0;
    
    /**
     * Memory usage statistics
     * @type {MemoryStats}
     */
    this.stats = {
      allocated: 0,
      freed: 0,
      active: 0,
      peak: 0,
      allocations: 0,
      frees: 0
    };
    
    // Set up automatic browser memory stats if available
    if (typeof window !== 'undefined' && 
        window.performance && 
        'memory' in window.performance) {
      this.hasBrowserMemoryStats = true;
    } else {
      this.hasBrowserMemoryStats = false;
    }
    
    // Set up automatic Node.js memory stats if available
    if (typeof process !== 'undefined' && 
        process.memoryUsage) {
      this.hasNodeMemoryStats = true;
    } else {
      this.hasNodeMemoryStats = false;
    }
  }
  
  /**
   * Track a memory allocation
   * @param {number} size - Size in bytes
   * @param {Object} [options] - Allocation options
   * @param {string} [options.type] - Allocation type
   * @param {string} [options.description] - Allocation description
   * @returns {string} Allocation ID
   */
  allocate(size, { type, description } = {}) {
    const id = `alloc_${++this.counter}`;
    
    // Create allocation record
    const record = {
      id,
      size,
      type: type || 'unknown',
      timestamp: Date.now(),
      description: description || ''
    };
    
    // Store the allocation
    this.allocations.set(id, record);
    
    // Update stats
    this.stats.allocated += size;
    this.stats.active += size;
    this.stats.allocations++;
    
    // Update peak usage
    if (this.stats.active > this.stats.peak) {
      this.stats.peak = this.stats.active;
    }
    
    logger$2.debug(`Memory allocated: ${formatBytes(size)} (${type || 'unknown'})${description ? ` - ${description}` : ''}`);
    
    return id;
  }
  
  /**
   * Track a memory deallocation
   * @param {string} id - Allocation ID to free
   * @returns {boolean} Whether the allocation was found and freed
   */
  free(id) {
    // Find the allocation
    const allocation = this.allocations.get(id);
    
    if (!allocation) {
      logger$2.warn(`Attempted to free unknown allocation: ${id}`);
      return false;
    }
    
    // Update stats
    this.stats.freed += allocation.size;
    this.stats.active -= allocation.size;
    this.stats.frees++;
    
    // Remove the allocation
    this.allocations.delete(id);
    
    logger$2.debug(`Memory freed: ${formatBytes(allocation.size)} (${allocation.type})${allocation.description ? ` - ${allocation.description}` : ''}`);
    
    return true;
  }
  
  /**
   * Free all tracked allocations
   * @returns {number} Number of allocations freed
   */
  freeAll() {
    const count = this.allocations.size;
    
    if (count === 0) {
      return 0;
    }
    
    logger$2.info(`Freeing all ${count} memory allocations (${formatBytes(this.stats.active)})`);
    
    const allocationIds = Array.from(this.allocations.keys());
    for (const id of allocationIds) {
      this.free(id);
    }
    
    return count;
  }
  
  /**
   * Free allocations of a specific type
   * @param {string} type - Allocation type to free
   * @returns {number} Number of allocations freed
   */
  freeByType(type) {
    let count = 0;
    
    const typeAllocations = Array.from(this.allocations.values())
      .filter(allocation => allocation.type === type);
    
    logger$2.info(`Freeing ${typeAllocations.length} '${type}' allocations`);
    
    for (const allocation of typeAllocations) {
      if (this.free(allocation.id)) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Get current memory usage statistics
   * @returns {Object} Memory stats
   */
  getStats() {
    // Start with tracked stats
    const stats = {
      ...this.stats,
      // Add user-friendly formatted values
      allocatedFormatted: formatBytes(this.stats.allocated),
      freedFormatted: formatBytes(this.stats.freed),
      activeFormatted: formatBytes(this.stats.active),
      peakFormatted: formatBytes(this.stats.peak),
      activeAllocations: this.allocations.size
    };
    
    // Add browser memory stats if available
    if (this.hasBrowserMemoryStats) {
      const memory = window.performance.memory;
      stats.browser = {
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSizeFormatted: formatBytes(memory.totalJSHeapSize),
        usedJSHeapSizeFormatted: formatBytes(memory.usedJSHeapSize),
        jsHeapSizeLimitFormatted: formatBytes(memory.jsHeapSizeLimit)
      };
    }
    
    // Add Node.js memory stats if available
    if (this.hasNodeMemoryStats) {
      const memory = process.memoryUsage();
      stats.node = {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers,
        rssFormatted: formatBytes(memory.rss),
        heapTotalFormatted: formatBytes(memory.heapTotal),
        heapUsedFormatted: formatBytes(memory.heapUsed),
        externalFormatted: formatBytes(memory.external),
        arrayBuffersFormatted: formatBytes(memory.arrayBuffers)
      };
    }
    
    return stats;
  }
  
  /**
   * Get current allocations
   * @returns {AllocationRecord[]} Array of allocations
   */
  getAllocations() {
    return Array.from(this.allocations.values());
  }
  
  /**
   * Get allocations grouped by type
   * @returns {Object} Allocations grouped by type
   */
  getAllocationsByType() {
    const byType = {};
    
    for (const allocation of this.allocations.values()) {
      const type = allocation.type || 'unknown';
      
      if (!byType[type]) {
        byType[type] = {
          count: 0,
          size: 0,
          allocations: []
        };
      }
      
      byType[type].count++;
      byType[type].size += allocation.size;
      byType[type].allocations.push(allocation);
    }
    
    // Add formatted sizes
    for (const type in byType) {
      byType[type].sizeFormatted = formatBytes(byType[type].size);
    }
    
    return byType;
  }
  
  /**
   * Log memory usage information
   * @param {boolean} [detailed=false] - Whether to include detailed allocation info
   */
  logMemoryUsage(detailed = false) {
    const stats = this.getStats();
    
    logger$2.info('Memory Usage Summary:');
    logger$2.info(`  Total Allocated: ${stats.allocatedFormatted}`);
    logger$2.info(`  Total Freed: ${stats.freedFormatted}`);
    logger$2.info(`  Active: ${stats.activeFormatted}`);
    logger$2.info(`  Peak: ${stats.peakFormatted}`);
    logger$2.info(`  Allocations: ${stats.allocations}`);
    logger$2.info(`  Frees: ${stats.frees}`);
    logger$2.info(`  Active Allocations: ${stats.activeAllocations}`);
    
    // Log browser memory if available
    if (stats.browser) {
      logger$2.info('Browser Memory:');
      logger$2.info(`  Used JS Heap: ${stats.browser.usedJSHeapSizeFormatted}`);
      logger$2.info(`  Total JS Heap: ${stats.browser.totalJSHeapSizeFormatted}`);
      logger$2.info(`  JS Heap Limit: ${stats.browser.jsHeapSizeLimitFormatted}`);
    }
    
    // Log Node.js memory if available
    if (stats.node) {
      logger$2.info('Node.js Memory:');
      logger$2.info(`  RSS: ${stats.node.rssFormatted}`);
      logger$2.info(`  Heap Total: ${stats.node.heapTotalFormatted}`);
      logger$2.info(`  Heap Used: ${stats.node.heapUsedFormatted}`);
      logger$2.info(`  External: ${stats.node.externalFormatted}`);
      logger$2.info(`  Array Buffers: ${stats.node.arrayBuffersFormatted}`);
    }
    
    // Log detailed allocation info if requested
    if (detailed) {
      const byType = this.getAllocationsByType();
      
      logger$2.info('Allocations by Type:');
      for (const type in byType) {
        logger$2.info(`  ${type}: ${byType[type].count} allocations, ${byType[type].sizeFormatted}`);
      }
      
      if (detailed === 'full') {
        logger$2.info('All Allocations:');
        for (const allocation of this.allocations.values()) {
          logger$2.info(`  ${allocation.id}: ${formatBytes(allocation.size)} (${allocation.type})${allocation.description ? ` - ${allocation.description}` : ''}`);
        }
      }
    }
  }
  
  /**
   * Reset memory tracking stats (but keep allocations)
   */
  resetStats() {
    // Calculate current active memory
    const active = this.stats.allocated - this.stats.freed;
    
    // Reset stats but keep active memory
    this.stats = {
      allocated: active,
      freed: 0,
      active,
      peak: active,
      allocations: this.allocations.size,
      frees: 0
    };
    
    logger$2.debug('Memory stats reset');
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Create a function wrapper that tracks memory usage
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Options
 * @param {string} [options.type='function'] - Allocation type
 * @param {string} [options.description] - Allocation description
 * @param {MemoryManager} [options.memoryManager] - Memory manager to use
 * @returns {Function} Wrapped function
 */
function withMemoryTracking(fn, options = {}) {
  const manager = options.memoryManager || globalMemoryManager;
  const type = options.type || 'function';
  const description = options.description || fn.name || 'anonymous function';
  
  return async function(...args) {
    // Track memory before function call
    const beforeStats = manager.getStats();
    
    // Record allocation for function execution
    const id = manager.allocate(0, { 
      type, 
      description: `Function call: ${description}`
    });
    
    try {
      // Execute the function
      const result = await fn.apply(this, args);
      
      // Calculate memory used
      const afterStats = manager.getStats();
      const memoryUsed = afterStats.active - beforeStats.active;
      
      // Update allocation size
      manager.free(id);
      manager.allocate(memoryUsed, { 
        type, 
        description: `Result of: ${description}`
      });
      
      return result;
    } catch (error) {
      // Free allocation on error
      manager.free(id);
      throw error;
    }
  };
}

/**
 * Try to trigger garbage collection (only works in debug environments)
 * @returns {boolean} Whether GC was triggered
 */
function triggerGC() {
  if (typeof commonjsGlobal !== 'undefined' && commonjsGlobal.gc) {
    // Node.js with --expose-gc flag
    commonjsGlobal.gc();
    logger$2.debug('Triggered Node.js garbage collection');
    return true;
  } else if (typeof window !== 'undefined' && window.gc) {
    // Some browsers in debug mode
    window.gc();
    logger$2.debug('Triggered browser garbage collection');
    return true;
  }
  
  logger$2.debug('Cannot trigger garbage collection (not available in this environment)');
  return false;
}

/**
 * Create a fixed-size memory pool for reusing allocations
 * @param {number} totalSize - Total pool size in bytes
 * @returns {Object} Memory pool interface
 */
function createMemoryPool(totalSize) {
  // Create the underlying buffer
  const buffer = typeof ArrayBuffer !== 'undefined' ? 
    new ArrayBuffer(totalSize) : 
    Buffer.alloc(totalSize);
  
  // Track allocations
  const allocations = [];
  let freeOffset = 0;
  
  return {
    /**
     * Allocate memory from the pool
     * @param {number} size - Size in bytes
     * @returns {Object} Allocation with buffer view
     */
    allocate(size) {
      if (freeOffset + size > totalSize) {
        throw new Error(`Memory pool out of space (${formatBytes(size)} requested, ${formatBytes(totalSize - freeOffset)} available)`);
      }
      
      const start = freeOffset;
      freeOffset += size;
      
      const view = typeof Uint8Array !== 'undefined' ? 
        new Uint8Array(buffer, start, size) : 
        Buffer.from(buffer, start, size);
      
      const allocation = { start, size, view };
      allocations.push(allocation);
      
      return allocation;
    },
    
    /**
     * Free a specific allocation
     * @param {Object} allocation - Allocation to free
     * @returns {boolean} Whether the free was successful
     */
    free(allocation) {
      const index = allocations.indexOf(allocation);
      if (index === -1) return false;
      
      // Remove the allocation
      allocations.splice(index, 1);
      
      // This is a simple implementation that doesn't reuse freed space
      // In a real implementation, you'd want to track free blocks and reuse them
      
      return true;
    },
    
    /**
     * Reset the pool (free all allocations)
     */
    reset() {
      allocations.length = 0;
      freeOffset = 0;
    },
    
    /**
     * Get pool usage information
     * @returns {Object} Pool info
     */
    getInfo() {
      return {
        totalSize,
        used: freeOffset,
        free: totalSize - freeOffset,
        allocations: allocations.length,
        usedFormatted: formatBytes(freeOffset),
        freeFormatted: formatBytes(totalSize - freeOffset),
        totalFormatted: formatBytes(totalSize)
      };
    }
  };
}

// Create a global memory manager instance
const globalMemoryManager = new MemoryManager();

var memory$1 = {
  MemoryManager,
  formatBytes,
  withMemoryTracking,
  triggerGC,
  createMemoryPool,
  globalMemoryManager
};

/**
 * Streaming response utilities for GGUF.js
 * @module utils/streaming
 */

const logger$1 = logger$9;

/**
 * A token stream implementation for handling sequential tokens
 */
class TokenStream {
  /**
   * Create a token stream
   * @param {Object} options - Stream options
   * @param {number} [options.bufferSize=1024] - Maximum number of tokens to buffer
   * @param {boolean} [options.autoFlush=true] - Whether to auto-flush the buffer when full
   */
  constructor(options = {}) {
    this.buffer = [];
    this.bufferSize = options.bufferSize || 1024;
    this.autoFlush = options.autoFlush !== false;
    this.isEnded = false;
    this.consumers = [];
    this.doneCallbacks = [];
  }
  
  /**
   * Write a token to the stream
   * @param {string|number} token - Token to write
   * @returns {boolean} Whether the write was successful
   */
  write(token) {
    if (this.isEnded) {
      logger$1.warn('Attempted to write to a closed token stream');
      return false;
    }
    
    // Add token to buffer
    this.buffer.push(token);
    
    // Notify consumers
    this._notifyConsumers();
    
    // Auto-flush if buffer is full
    if (this.autoFlush && this.buffer.length >= this.bufferSize) {
      this.flush();
    }
    
    return true;
  }
  
  /**
   * Write multiple tokens to the stream
   * @param {Array<string|number>} tokens - Tokens to write
   * @returns {boolean} Whether the write was successful
   */
  writeMany(tokens) {
    if (this.isEnded) {
      logger$1.warn('Attempted to write to a closed token stream');
      return false;
    }
    
    // Add tokens to buffer
    this.buffer.push(...tokens);
    
    // Notify consumers
    this._notifyConsumers();
    
    // Auto-flush if buffer is full
    if (this.autoFlush && this.buffer.length >= this.bufferSize) {
      this.flush();
    }
    
    return true;
  }
  
  /**
   * End the stream (no more tokens will be accepted)
   */
  end() {
    if (this.isEnded) return;
    
    this.isEnded = true;
    this._notifyConsumers();
    
    // Notify all done callbacks
    for (const callback of this.doneCallbacks) {
      try {
        callback();
      } catch (error) {
        logger$1.error('Error in stream done callback', error);
      }
    }
    this.doneCallbacks = [];
  }
  
  /**
   * Flush the buffer (clear tokens and free memory)
   */
  flush() {
    this.buffer = [];
  }
  
  /**
   * Subscribe to tokens from the stream
   * @param {Function} onToken - Callback for each token
   * @param {Function} [onDone] - Callback when stream is ended
   * @returns {Function} Unsubscribe function
   */
  subscribe(onToken, onDone) {
    const consumer = { onToken };
    this.consumers.push(consumer);
    
    // Add done callback if provided
    if (onDone) {
      this.doneCallbacks.push(onDone);
    }
    
    // Immediately notify of any existing tokens
    if (this.buffer.length > 0) {
      for (const token of this.buffer) {
        try {
          onToken(token, false);
        } catch (error) {
          logger$1.error('Error in token consumer', error);
        }
      }
    }
    
    // If stream is already ended, call onDone immediately
    if (this.isEnded && onDone) {
      try {
        onDone();
      } catch (error) {
        logger$1.error('Error in stream done callback', error);
      }
    }
    
    // Return unsubscribe function
    return () => {
      this.consumers = this.consumers.filter(c => c !== consumer);
      this.doneCallbacks = this.doneCallbacks.filter(cb => cb !== onDone);
    };
  }
  
  /**
   * Read all available tokens
   * @returns {Array} Array of tokens
   */
  read() {
    const tokens = [...this.buffer];
    return tokens;
  }
  
  /**
   * Notify all consumers of new tokens
   * @private
   */
  _notifyConsumers() {
    if (this.consumers.length === 0) return;
    
    while (this.buffer.length > 0) {
      const token = this.buffer.shift();
      
      for (const consumer of this.consumers) {
        try {
          consumer.onToken(token, false);
        } catch (error) {
          logger$1.error('Error in token consumer', error);
        }
      }
    }
    
    // If stream is ended, notify consumers with the final flag
    if (this.isEnded) {
      for (const consumer of this.consumers) {
        try {
          consumer.onToken(null, true);
        } catch (error) {
          logger$1.error('Error in token consumer', error);
        }
      }
      
      this.consumers = [];
    }
  }
  
  /**
   * Check if the stream has ended
   * @returns {boolean} Whether the stream has ended
   */
  isDone() {
    return this.isEnded;
  }
  
  /**
   * Get the number of remaining tokens in the buffer
   * @returns {number} Number of tokens in buffer
   */
  bufferedTokens() {
    return this.buffer.length;
  }
}

/**
 * Create a token stream from an array of tokens
 * @param {Array<string|number>} tokens - Tokens to stream
 * @param {Object} options - Stream options
 * @param {number} [options.delay=0] - Delay between tokens in milliseconds
 * @param {boolean} [options.jitter=false] - Whether to add random jitter to delay
 * @param {number} [options.maxJitter=10] - Maximum jitter in milliseconds
 * @returns {TokenStream} Token stream
 */
function createTokenStream(tokens, options = {}) {
  const stream = new TokenStream();
  
  if (!tokens || tokens.length === 0) {
    stream.end();
    return stream;
  }
  
  const delay = options.delay || 0;
  const jitter = options.jitter || false;
  const maxJitter = options.maxJitter || 10;
  
  let index = 0;
  
  function processNextToken() {
    if (index >= tokens.length) {
      stream.end();
      return;
    }
    
    stream.write(tokens[index++]);
    
    if (index < tokens.length) {
      let tokenDelay = delay;
      
      // Add jitter if enabled
      if (jitter) {
        tokenDelay += Math.random() * maxJitter * 2 - maxJitter;
        tokenDelay = Math.max(0, tokenDelay);
      }
      
      setTimeout(processNextToken, tokenDelay);
    } else {
      stream.end();
    }
  }
  
  // Start processing tokens
  if (delay > 0) {
    setTimeout(processNextToken, 0);
  } else {
    // Immediate processing for no delay
    stream.writeMany(tokens);
    stream.end();
  }
  
  return stream;
}

/**
 * Collect all tokens from a stream into a single value
 * @param {TokenStream} stream - Token stream to collect
 * @param {Function} [onProgress] - Callback for progress updates
 * @returns {Promise<Array>} Array of all tokens
 */
function collectStream(stream, onProgress = null) {
  return new Promise((resolve, reject) => {
    const tokens = [];
    
    stream.subscribe(
      (token, isDone) => {
        if (token !== null) {
          tokens.push(token);
          
          if (onProgress) {
            try {
              onProgress(tokens.length, token);
            } catch (error) {
              // Ignore errors in progress callback
            }
          }
        }
        
        if (isDone) {
          resolve(tokens);
        }
      },
      () => resolve(tokens)
    );
  });
}

/**
 * Convert a stream of tokens to a string
 * @param {TokenStream} stream - Token stream to collect
 * @param {Function} [decoder] - Function to decode tokens to strings
 * @param {Function} [onProgress] - Callback for progress updates
 * @returns {Promise<string>} Collected string
 */
function streamToString(stream, decoder = String, onProgress = null) {
  let result = '';
  
  return new Promise((resolve, reject) => {
    stream.subscribe(
      (token, isDone) => {
        if (token !== null) {
          const tokenStr = decoder(token);
          result += tokenStr;
          
          if (onProgress) {
            try {
              onProgress(result.length, tokenStr);
            } catch (error) {
              // Ignore errors in progress callback
            }
          }
        }
        
        if (isDone) {
          resolve(result);
        }
      },
      () => resolve(result)
    );
  });
}

/**
 * Fetch a resource with progress tracking
 * @param {string} url - URL to fetch
 * @param {Function} [onProgress] - Progress callback (loaded, total, percentage)
 * @returns {Promise<ArrayBuffer>} Fetched data
 */
async function fetchWithProgress(url, onProgress) {
  // Check for fetch API
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API not available in this environment');
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }
  
  // Get content length if available
  const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
  
  // If we can't stream or track progress, just return the buffer
  if (!response.body || !contentLength) {
    return response.arrayBuffer();
  }
  
  // Create a reader to stream the response
  const reader = response.body.getReader();
  let receivedLength = 0;
  const chunks = [];
  
  // Process the stream
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      break;
    }
    
    chunks.push(value);
    receivedLength += value.length;
    
    // Call progress callback
    if (onProgress) {
      const percentage = contentLength ? Math.round((receivedLength / contentLength) * 100) : 0;
      onProgress(receivedLength, contentLength, percentage);
    }
  }
  
  // Concatenate chunks into a single buffer
  const result = new Uint8Array(receivedLength);
  let position = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  
  return result.buffer;
}

/**
 * Create a chunked data loader for large files
 * @param {string} url - URL to the file
 * @param {number} [chunkSize=10*1024*1024] - Chunk size in bytes (default: 10MB)
 * @param {Function} [onProgress] - Progress callback
 * @returns {Object} Chunked loader interface
 */
function createChunkedLoader(url, chunkSize = 10 * 1024 * 1024, onProgress) {
  let contentLength = 0;
  let loaded = 0;
  let cancelled = false;
  
  /**
   * Initialize the loader and get content info
   * @returns {Promise<number>} Content length
   */
  async function init() {
    try {
      // Get content length with HEAD request
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize: ${response.status} ${response.statusText}`);
      }
      
      contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
      return contentLength;
    } catch (error) {
      logger$1.error('Error initializing chunked loader', error);
      throw error;
    }
  }
  
  /**
   * Load a specific chunk
   * @param {number} start - Start byte
   * @param {number} end - End byte
   * @returns {Promise<ArrayBuffer>} Chunk data
   */
  async function loadChunk(start, end) {
    if (cancelled) {
      throw new Error('Loading cancelled');
    }
    
    // Adjust end to not exceed content length
    if (contentLength > 0 && end > contentLength) {
      end = contentLength;
    }
    
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=${start}-${end - 1}` }
      });
      
      if (!response.ok && response.status !== 206) {
        throw new Error(`Failed to load chunk: ${response.status} ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      // Update progress
      loaded += buffer.byteLength;
      
      if (onProgress && contentLength > 0) {
        const percentage = Math.round((loaded / contentLength) * 100);
        onProgress(loaded, contentLength, percentage);
      }
      
      return buffer;
    } catch (error) {
      if (!cancelled) {
        logger$1.error(`Error loading chunk ${start}-${end}`, error);
        throw error;
      }
      throw new Error('Loading cancelled');
    }
  }
  
  /**
   * Load the entire file in chunks
   * @returns {Promise<ArrayBuffer>} Complete file data
   */
  async function loadAll() {
    // Initialize if not already done
    if (contentLength === 0) {
      await init();
    }
    
    // If content length is unknown, fallback to regular fetch
    if (contentLength === 0) {
      return fetchWithProgress(url, onProgress);
    }
    
    const chunks = [];
    let position = 0;
    
    while (position < contentLength) {
      const end = Math.min(position + chunkSize, contentLength);
      const chunk = await loadChunk(position, end);
      chunks.push(chunk);
      position = end;
      
      if (cancelled) {
        throw new Error('Loading cancelled');
      }
    }
    
    // Combine chunks
    const result = new Uint8Array(contentLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    return result.buffer;
  }
  
  /**
   * Cancel loading
   */
  function cancel() {
    cancelled = true;
  }
  
  /**
   * Get current loading status
   * @returns {Object} Status object
   */
  function getStatus() {
    return {
      contentLength,
      loaded,
      cancelled,
      progress: contentLength ? loaded / contentLength : 0
    };
  }
  
  return {
    init,
    loadChunk,
    loadAll,
    cancel,
    getStatus
  };
}

var streaming$1 = {
  TokenStream,
  createTokenStream,
  collectStream,
  streamToString,
  fetchWithProgress,
  createChunkedLoader
};

/**
 * Text formatting utilities for GGUF models
 * @module utils/formats
 */

/**
 * Formats a prompt for chat completion
 * 
 * @param {Array<Object>} messages - Array of message objects with role and content
 * @param {Object} options - Formatting options
 * @param {string} [options.systemPrompt=''] - System prompt to prepend
 * @param {boolean} [options.useMarkdown=false] - Whether to format in markdown
 * @param {string} [options.userLabel='User'] - Label for user messages
 * @param {string} [options.assistantLabel='Assistant'] - Label for assistant messages
 * @param {string} [options.systemLabel='System'] - Label for system messages
 * @returns {string} Formatted prompt
 */
function formatChatPrompt(messages, options = {}) {
  const {
    systemPrompt = '',
    useMarkdown = false,
    userLabel = 'User',
    assistantLabel = 'Assistant',
    systemLabel = 'System'
  } = options;

  let prompt = '';
  
  // Add system prompt if provided
  if (systemPrompt) {
    if (useMarkdown) {
      prompt += `**${systemLabel}**: ${systemPrompt}\n\n`;
    } else {
      prompt += `${systemLabel}: ${systemPrompt}\n\n`;
    }
  }
  
  // Add all messages
  for (const message of messages) {
    let label = '';
    
    // Determine the label based on role
    if (message.role === 'user') {
      label = userLabel;
    } else if (message.role === 'assistant') {
      label = assistantLabel;
    } else if (message.role === 'system') {
      label = systemLabel;
    }
    
    // Add the message with appropriate formatting
    if (useMarkdown) {
      prompt += `**${label}**: ${message.content}\n\n`;
    } else {
      prompt += `${label}: ${message.content}\n\n`;
    }
  }
  
  // Add final prompt for assistant response
  if (useMarkdown) {
    prompt += `**${assistantLabel}**: `;
  } else {
    prompt += `${assistantLabel}: `;
  }
  
  return prompt;
}

/**
 * Formats a completion prompt
 * 
 * @param {string} prompt - The completion prompt
 * @param {Object} options - Formatting options
 * @param {string} [options.suffix=''] - Text to append after the prompt
 * @param {string} [options.prefix=''] - Text to prepend before the prompt
 * @returns {string} Formatted prompt
 */
function formatCompletionPrompt(prompt, options = {}) {
  const { suffix = '', prefix = '' } = options;
  return `${prefix}${prompt}${suffix}`;
}

/**
 * Formats a list of instructions for instruction-following models
 * 
 * @param {string|Array<string>} instructions - Instruction or list of instructions
 * @param {Object} options - Formatting options
 * @param {string} [options.prefix='Instructions:'] - Text to prepend before instructions
 * @param {string} [options.suffix=''] - Text to append after instructions
 * @param {boolean} [options.numbered=false] - Whether to number the instructions
 * @returns {string} Formatted instructions
 */
function formatInstructions(instructions, options = {}) {
  const {
    prefix = 'Instructions:',
    suffix = '',
    numbered = false
  } = options;
  
  let instructionList = Array.isArray(instructions) ? instructions : [instructions];
  let formatted = prefix ? `${prefix}\n` : '';
  
  // Add each instruction
  instructionList.forEach((instruction, index) => {
    if (numbered) {
      formatted += `${index + 1}. ${instruction}\n`;
    } else {
      formatted += `- ${instruction}\n`;
    }
  });
  
  // Add suffix
  if (suffix) {
    formatted += `\n${suffix}`;
  }
  
  return formatted;
}

/**
 * Cleans and normalizes text output from the model
 * 
 * @param {string} text - Text to clean
 * @param {Object} options - Cleaning options
 * @param {boolean} [options.trimWhitespace=true] - Whether to trim whitespace
 * @param {boolean} [options.removeExtraNewlines=true] - Whether to remove extra newlines
 * @param {boolean} [options.removeSpecialTokens=true] - Whether to remove special tokens like <eos>
 * @returns {string} Cleaned text
 */
function cleanOutput(text, options = {}) {
  const {
    trimWhitespace = true,
    removeExtraNewlines = true,
    removeSpecialTokens = true
  } = options;
  
  let cleaned = text;
  
  // Remove special tokens
  if (removeSpecialTokens) {
    cleaned = cleaned.replace(/<[^>]+>/g, '');
  }
  
  // Remove extra newlines
  if (removeExtraNewlines) {
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }
  
  // Trim whitespace
  if (trimWhitespace) {
    cleaned = cleaned.trim();
  }
  
  return cleaned;
}

/**
 * Extracts and formats JSON response from model output
 * 
 * @param {string} text - Model output text
 * @param {Object} options - Formatting options
 * @param {boolean} [options.extractFromText=true] - Whether to extract JSON from text
 * @param {boolean} [options.fixBrokenJson=true] - Attempt to fix malformed JSON
 * @returns {Object|null} Parsed JSON object or null if parsing failed
 */
function extractJSON(text, options = {}) {
  const {
    extractFromText = true,
    fixBrokenJson = true
  } = options;
  
  let jsonText = text;
  
  // Extract JSON from text if requested
  if (extractFromText) {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                      text.match(/{[\s\S]*?}/);
    
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
  }
  
  // Try to parse the JSON
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    // If fixing broken JSON is not requested, return null
    if (!fixBrokenJson) {
      return null;
    }
    
    // Attempt to fix common JSON issues
    try {
      // Replace single quotes with double quotes
      let fixedJson = jsonText.replace(/'/g, '"');
      
      // Fix unquoted keys
      fixedJson = fixedJson.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
      
      // Fix trailing commas
      fixedJson = fixedJson.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      
      return JSON.parse(fixedJson);
    } catch (fixError) {
      return null;
    }
  }
}

/**
 * Creates a templated prompt with variable substitution
 * 
 * @param {string} template - Template string with {variable} placeholders
 * @param {Object} variables - Object containing variable values
 * @returns {string} Formatted prompt with substituted variables
 */
function templatePrompt(template, variables = {}) {
  return template.replace(/\{(\w+)\}/g, (match, variable) => {
    return variables[variable] !== undefined ? variables[variable] : match;
  });
}

/**
 * Truncates a prompt to fit within token limit
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum number of tokens
 * @param {Function} tokenCounter - Function to count tokens
 * @param {Object} options - Options for truncation
 * @param {boolean} [options.fromStart=true] - Truncate from start (keep end)
 * @param {string} [options.ellipsis='...'] - Ellipsis to use
 * @returns {string} Truncated text
 */
function truncatePrompt(text, maxTokens, tokenCounter, options = {}) {
  const {
    fromStart = true,
    ellipsis = '...'
  } = options;
  
  // If text is already within token limit, return as is
  const tokenCount = tokenCounter(text);
  if (tokenCount <= maxTokens) {
    return text;
  }
  
  // Reserve tokens for ellipsis
  const ellipsisTokens = tokenCounter(ellipsis);
  const effectiveMaxTokens = maxTokens - ellipsisTokens;
  
  // Split text into words
  const words = text.split(/\s+/);
  
  if (fromStart) {
    // Truncate from start (keep the end)
    let result = '';
    let currentTokens = 0;
    
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      const wordTokens = tokenCounter(word);
      
      if (currentTokens + wordTokens <= effectiveMaxTokens) {
        result = word + (result ? ' ' + result : '');
        currentTokens += wordTokens;
      } else {
        break;
      }
    }
    
    return ellipsis + ' ' + result;
  } else {
    // Truncate from end (keep the beginning)
    let result = '';
    let currentTokens = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordTokens = tokenCounter(word);
      
      if (currentTokens + wordTokens <= effectiveMaxTokens) {
        result += (result ? ' ' : '') + word;
        currentTokens += wordTokens;
      } else {
        break;
      }
    }
    
    return result + ' ' + ellipsis;
  }
}

var formats$1 = {
  formatChatPrompt,
  formatCompletionPrompt,
  formatInstructions,
  cleanOutput,
  extractJSON,
  templatePrompt,
  truncatePrompt
};

/**
 * GGUF.js - Lightweight JavaScript package for GGUF language models
 * @module gguf
 */

// Core functionality
const { GGUFModel, GenerationOptions, ModelContext, createModelId } = model;
const loader = loader$2;
const inference = inference$2;
const tokenizer = tokenizer$1;

// Adapters
const nodeAdapter = node;
const browserAdapter = browser;
const reactHooks = react;

// Utilities
const logger = logger$9;
const memory = memory$1;
const streaming = streaming$1;
const formats = formats$1;

// Determine environment
const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined';
const isReact = typeof window !== 'undefined' && typeof window.React !== 'undefined';

// Get the default adapter based on environment
const getDefaultAdapter = () => {
  if (isNode) {
    return nodeAdapter;
  } else if (isBrowser) {
    return browserAdapter;
  }
  
  // Fallback
  logger.warn('No environment-specific adapter detected, some features may not work properly');
  return null;
};

/**
 * Create an instance of GGUF.js with a specific adapter
 * @param {Object} adapter - The adapter to use
 * @returns {Object} GGUF.js instance
 */
function createInstance(adapter) {
  return {
    // Core model functionality
    loadModel: (path, options) => loader.loadModel(path, options, adapter),
    unloadModel: (modelId) => loader.unloadModel(modelId, adapter),
    getModel: (modelId) => loader.getModel(modelId),
    listModels: () => loader.listModels(),
    clearModels: () => loader.clearModels(adapter),
    
    // Text generation
    generate: (model, prompt, options) => inference.generate(model, prompt, options, adapter),
    streamGenerate: (model, prompt, onToken, options) => inference.streamGenerate(model, prompt, onToken, options, adapter),
    cancelGeneration: (modelOrId) => inference.cancelGeneration(modelOrId),
    
    // Tokenization
    tokenize: (model, text) => adapter.tokenize(model, text),
    detokenize: (model, tokens) => adapter.detokenize(model, tokens),
    
    // Additional functionality based on adapter
    ...(adapter.discoverModels ? { discoverModels: (dir) => adapter.discoverModels(dir) } : {}),
    
    // React hooks if in React environment
    ...(isReact ? {
      useModel: (options) => reactHooks.useModel(adapter, options),
      useGeneration: (options) => reactHooks.useGeneration(adapter, options),
      useChat: (options) => reactHooks.useChat(adapter, options)
    } : {})
  };
}

// Create a default instance with auto-detected adapter
const defaultAdapter = getDefaultAdapter();
const defaultInstance = createInstance(defaultAdapter);

// Export default instance with all functionality
var src = {
  // Default instance methods
  ...defaultInstance,
  
  // Core classes and functions
  GGUFModel,
  GenerationOptions,
  ModelContext,
  createModelId,
  
  // Factory function for custom instances
  createInstance,
  
  // Adapters
  adapters: {
    node: nodeAdapter,
    browser: browserAdapter,
    react: reactHooks
  },
  
  // Tokenization
  tokenizer,
  
  // Utilities
  utils: {
    logger,
    memory,
    streaming,
    formats
  },
  
  // Environment detection
  environment: {
    isNode,
    isBrowser,
    isReact
  },
  
  // Version information
  version: '0.1.0'
};

var index = /*@__PURE__*/getDefaultExportFromCjs(src);

export { index as default };
//# sourceMappingURL=gguf.esm.js.map
