/**
 * Tokenization utilities for GGUF models
 * @module core/tokenizer
 */

const logger = require('../utils/logger');

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
    
    for (let i = 0; i < 128; i++) {
      const char = String.fromCharCode(i);
      this.encoder.set(char, i);
      this.decoder.set(i, char);
    }

    this.specialTokens = {
      BOS: 128,
      EOS: 129, 
      PAD: 130, 
      UNK: 131, 
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
      return this.specialTokens.UNK; 
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
      return ''; 
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
    
    return text.split(/(\s+)/).flatMap(part => {
      if (!part.trim()) {
        const whitespaceId = this.vocab.get(part) || this.vocab.get('<UNK>') || 0;
        return [whitespaceId];
      }
      
      let tokens = Array.from(part).map(c => c);
      
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
      
      return tokens.map(token => {
        if (this.vocab.has(token)) {
          return this.vocab.get(token);
        }
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
      return ''; 
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
    logger.warn('No tokenizer configuration provided, using fallback character tokenizer');
    return new CharacterTokenizer();
  }
  
  if (config.tokenizer_type === 'bpe' || config.merges) {
    logger.info('Creating BPE tokenizer');
    return new BPETokenizer(config);
  }
    
  logger.warn('Unknown tokenizer type, using fallback character tokenizer');
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
    logger.error(`Failed to load tokenizer from ${path}: ${error.message}`);
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
    logger.error(`Failed to extract tokenizer from model: ${error.message}`);
    return new CharacterTokenizer();
  }
}

module.exports = {
  BaseTokenizer,
  CharacterTokenizer,
  BPETokenizer,
  createTokenizer,
  loadTokenizerFromFile,
  extractTokenizerFromModel
};