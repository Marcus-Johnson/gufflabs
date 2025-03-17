/**
 * Memory management utilities 
 * @module utils/memory
 */

const logger = require('./logger');

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
    
    if (typeof window !== 'undefined' && 
        window.performance && 
        'memory' in window.performance) {
      this.hasBrowserMemoryStats = true;
    } else {
      this.hasBrowserMemoryStats = false;
    }
    
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
    
    const record = {
      id,
      size,
      type: type || 'unknown',
      timestamp: Date.now(),
      description: description || ''
    };
    
    this.allocations.set(id, record);
    
    this.stats.allocated += size;
    this.stats.active += size;
    this.stats.allocations++;
    
    if (this.stats.active > this.stats.peak) {
      this.stats.peak = this.stats.active;
    }
    
    logger.debug(`Memory allocated: ${formatBytes(size)} (${type || 'unknown'})${description ? ` - ${description}` : ''}`);
    
    return id;
  }
  
  /**
   * Track a memory deallocation
   * @param {string} id - Allocation ID to free
   * @returns {boolean} Whether the allocation was found and freed
   */
  free(id) {
    const allocation = this.allocations.get(id);
    
    if (!allocation) {
      logger.warn(`Attempted to free unknown allocation: ${id}`);
      return false;
    }
    
    this.stats.freed += allocation.size;
    this.stats.active -= allocation.size;
    this.stats.frees++;
    
    this.allocations.delete(id);
    
    logger.debug(`Memory freed: ${formatBytes(allocation.size)} (${allocation.type})${allocation.description ? ` - ${allocation.description}` : ''}`);
    
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
    
    logger.info(`Freeing all ${count} memory allocations (${formatBytes(this.stats.active)})`);
    
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
    
    logger.info(`Freeing ${typeAllocations.length} '${type}' allocations`);
    
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
    const stats = {
      ...this.stats,
      allocatedFormatted: formatBytes(this.stats.allocated),
      freedFormatted: formatBytes(this.stats.freed),
      activeFormatted: formatBytes(this.stats.active),
      peakFormatted: formatBytes(this.stats.peak),
      activeAllocations: this.allocations.size
    };
    
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
    
    logger.info('Memory Usage Summary:');
    logger.info(`  Total Allocated: ${stats.allocatedFormatted}`);
    logger.info(`  Total Freed: ${stats.freedFormatted}`);
    logger.info(`  Active: ${stats.activeFormatted}`);
    logger.info(`  Peak: ${stats.peakFormatted}`);
    logger.info(`  Allocations: ${stats.allocations}`);
    logger.info(`  Frees: ${stats.frees}`);
    logger.info(`  Active Allocations: ${stats.activeAllocations}`);
    
    if (stats.browser) {
      logger.info('Browser Memory:');
      logger.info(`  Used JS Heap: ${stats.browser.usedJSHeapSizeFormatted}`);
      logger.info(`  Total JS Heap: ${stats.browser.totalJSHeapSizeFormatted}`);
      logger.info(`  JS Heap Limit: ${stats.browser.jsHeapSizeLimitFormatted}`);
    }
    
    if (stats.node) {
      logger.info('Node.js Memory:');
      logger.info(`  RSS: ${stats.node.rssFormatted}`);
      logger.info(`  Heap Total: ${stats.node.heapTotalFormatted}`);
      logger.info(`  Heap Used: ${stats.node.heapUsedFormatted}`);
      logger.info(`  External: ${stats.node.externalFormatted}`);
      logger.info(`  Array Buffers: ${stats.node.arrayBuffersFormatted}`);
    }
    
    if (detailed) {
      const byType = this.getAllocationsByType();
      
      logger.info('Allocations by Type:');
      for (const type in byType) {
        logger.info(`  ${type}: ${byType[type].count} allocations, ${byType[type].sizeFormatted}`);
      }
      
      if (detailed === 'full') {
        logger.info('All Allocations:');
        for (const allocation of this.allocations.values()) {
          logger.info(`  ${allocation.id}: ${formatBytes(allocation.size)} (${allocation.type})${allocation.description ? ` - ${allocation.description}` : ''}`);
        }
      }
    }
  }
  
  /**
   * Reset memory tracking stats (but keep allocations)
   */
  resetStats() {
    const active = this.stats.allocated - this.stats.freed;
    
    this.stats = {
      allocated: active,
      freed: 0,
      active,
      peak: active,
      allocations: this.allocations.size,
      frees: 0
    };
    
    logger.debug('Memory stats reset');
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
    const beforeStats = manager.getStats();
    
    const id = manager.allocate(0, { 
      type, 
      description: `Function call: ${description}`
    });
    
    try {
      const result = await fn.apply(this, args);
      
      const afterStats = manager.getStats();
      const memoryUsed = afterStats.active - beforeStats.active;
      
      manager.free(id);
      manager.allocate(memoryUsed, { 
        type, 
        description: `Result of: ${description}`
      });
      
      return result;
    } catch (error) {
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
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
    logger.debug('Triggered Node.js garbage collection');
    return true;
  } else if (typeof window !== 'undefined' && window.gc) {
    window.gc();
    logger.debug('Triggered browser garbage collection');
    return true;
  }
  
  logger.debug('Cannot trigger garbage collection (not available in this environment)');
  return false;
}

/**
 * Create a fixed-size memory pool for reusing allocations
 * @param {number} totalSize - Total pool size in bytes
 * @returns {Object} Memory pool interface
 */
function createMemoryPool(totalSize) {
  const buffer = typeof ArrayBuffer !== 'undefined' ? 
    new ArrayBuffer(totalSize) : 
    Buffer.alloc(totalSize);
  
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
      
      allocations.splice(index, 1);
      
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

const globalMemoryManager = new MemoryManager();

module.exports = {
  MemoryManager,
  formatBytes,
  withMemoryTracking,
  triggerGC,
  createMemoryPool,
  globalMemoryManager
};