/**
 * Streaming response utilities 
 * @module utils/streaming
 */

const logger = require('./logger');

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
      logger.warn('Attempted to write to a closed token stream');
      return false;
    }
    
    this.buffer.push(token);
    
    this._notifyConsumers();
    
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
      logger.warn('Attempted to write to a closed token stream');
      return false;
    }
    
    this.buffer.push(...tokens);
    
    this._notifyConsumers();
    
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
    
    for (const callback of this.doneCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.error('Error in stream done callback', error);
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
    
    if (onDone) {
      this.doneCallbacks.push(onDone);
    }
    
    if (this.buffer.length > 0) {
      for (const token of this.buffer) {
        try {
          onToken(token, false);
        } catch (error) {
          logger.error('Error in token consumer', error);
        }
      }
    }
    
    if (this.isEnded && onDone) {
      try {
        onDone();
      } catch (error) {
        logger.error('Error in stream done callback', error);
      }
    }
    
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
          logger.error('Error in token consumer', error);
        }
      }
    }
    
    if (this.isEnded) {
      for (const consumer of this.consumers) {
        try {
          consumer.onToken(null, true);
        } catch (error) {
          logger.error('Error in token consumer', error);
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
      
      if (jitter) {
        tokenDelay += Math.random() * maxJitter * 2 - maxJitter;
        tokenDelay = Math.max(0, tokenDelay);
      }
      
      setTimeout(processNextToken, tokenDelay);
    } else {
      stream.end();
    }
  }
  
  if (delay > 0) {
    setTimeout(processNextToken, 0);
  } else {
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
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API not available in this environment');
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }
  
  const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
  
  if (!response.body || !contentLength) {
    return response.arrayBuffer();
  }
  
  const reader = response.body.getReader();
  let receivedLength = 0;
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      break;
    }
    
    chunks.push(value);
    receivedLength += value.length;
    
    if (onProgress) {
      const percentage = contentLength ? Math.round((receivedLength / contentLength) * 100) : 0;
      onProgress(receivedLength, contentLength, percentage);
    }
  }
  
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
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize: ${response.status} ${response.statusText}`);
      }
      
      contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
      return contentLength;
    } catch (error) {
      logger.error('Error initializing chunked loader', error);
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
      
      loaded += buffer.byteLength;
      
      if (onProgress && contentLength > 0) {
        const percentage = Math.round((loaded / contentLength) * 100);
        onProgress(loaded, contentLength, percentage);
      }
      
      return buffer;
    } catch (error) {
      if (!cancelled) {
        logger.error(`Error loading chunk ${start}-${end}`, error);
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
    if (contentLength === 0) {
      await init();
    }
    
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

module.exports = {
  TokenStream,
  createTokenStream,
  collectStream,
  streamToString,
  fetchWithProgress,
  createChunkedLoader
};