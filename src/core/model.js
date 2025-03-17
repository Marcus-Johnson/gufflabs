/**
 * Core model representation for GGUF models
 * @module core/model
 */

/**
 * Class representing a GGUF model
 */
class GGUFModel {
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
  }
  
  /**
   * Generation options for text inference
   */
  class GenerationOptions {
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
  }
  
  /**
   * Model context for token sequence processing
   */
  class ModelContext {
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
  }
  
  /**
   * Create a model ID from a path
   * @param {string} path - Model path
   * @returns {string} Model ID
   */
  function createModelId(path) {
    const filename = path.split('/').pop().split('.')[0];
    
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash = hash & hash;
    }
    
    return `${filename}-${Math.abs(hash).toString(16).substring(0, 8)}`;
  }
  
  module.exports = {
    GGUFModel,
    GenerationOptions,
    ModelContext,
    createModelId
  };