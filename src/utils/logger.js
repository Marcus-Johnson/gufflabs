/**
 * Simple logging utilities
 * @module utils/logger
 */

const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
  };
  
  let config = {
    level: process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG,
    prefix: 'GGUF.js',
    useColors: true,
    timestamp: true,
    showInConsole: true
  };
  
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
    
    error: '\x1b[31m', 
    warn: '\x1b[33m',  
    info: '\x1b[36m',  
    debug: '\x1b[90m', 
    prefix: '\x1b[35m' 
  };
  
  const logStore = [];
  const MAX_LOG_STORE = 1000;
  
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
    
    if (config.timestamp) {
      const now = new Date().toISOString();
      if (config.useColors) {
        parts.push(`${COLORS.debug}[${now}]${COLORS.reset}`);
      } else {
        parts.push(`[${now}]`);
      }
    }
    
    if (config.prefix) {
      if (config.useColors) {
        parts.push(`${COLORS.prefix}[${config.prefix}]${COLORS.reset}`);
      } else {
        parts.push(`[${config.prefix}]`);
      }
    }
    
    if (config.useColors) {
      parts.push(`${COLORS[level.toLowerCase()]}[${level}]${COLORS.reset}`);
    } else {
      parts.push(`[${level}]`);
    }
    
    parts.push(message);
    
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
    
    if (levelValue > config.level) return;
    
    const formattedMessage = formatMessage(level, message, data);
    
    const logEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      formatted: formattedMessage
    };
    
    logStore.push(logEntry);
    if (logStore.length > MAX_LOG_STORE) {
      logStore.shift(); 
    }
    
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
  
  module.exports = {
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