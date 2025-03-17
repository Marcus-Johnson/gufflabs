/**
 * GuffLabs - Lightweight JavaScript package for GGUF language models
 * @module gguf
 */

const { GGUFModel, GenerationOptions, ModelContext, createModelId } = require('./core/model');
const loader = require('./core/loader');
const inference = require('./core/inference');
const tokenizer = require('./core/tokenizer');

const nodeAdapter = require('./adapters/node');
const browserAdapter = require('./adapters/browser');
const reactHooks = require('./adapters/react');

const logger = require('./utils/logger');
const memory = require('./utils/memory');
const streaming = require('./utils/streaming');
const formats = require('./utils/formats');

const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined';
const isReact = typeof window !== 'undefined' && typeof window.React !== 'undefined';

const getDefaultAdapter = () => {
  if (isNode) {
    return nodeAdapter;
  } else if (isBrowser) {
    return browserAdapter;
  }
  
  logger.warn('No environment-specific adapter detected, some features may not work properly');
  return null;
};

/**
 * Create an instance of GuffLabs with a specific adapter
 * @param {Object} adapter - The adapter to use
 * @returns {Object} GuffLabs instance
 */
function createInstance(adapter) {
  return {
    loadModel: (path, options) => loader.loadModel(path, options, adapter),
    unloadModel: (modelId) => loader.unloadModel(modelId, adapter),
    getModel: (modelId) => loader.getModel(modelId),
    listModels: () => loader.listModels(),
    clearModels: () => loader.clearModels(adapter),
    
    generate: (model, prompt, options) => inference.generate(model, prompt, options, adapter),
    streamGenerate: (model, prompt, onToken, options) => inference.streamGenerate(model, prompt, onToken, options, adapter),
    cancelGeneration: (modelOrId) => inference.cancelGeneration(modelOrId),
    
    tokenize: (model, text) => adapter.tokenize(model, text),
    detokenize: (model, tokens) => adapter.detokenize(model, tokens),
    
    ...(adapter.discoverModels ? { discoverModels: (dir) => adapter.discoverModels(dir) } : {}),
    
    ...(isReact ? {
      useModel: (options) => reactHooks.useModel(adapter, options),
      useGeneration: (options) => reactHooks.useGeneration(adapter, options),
      useChat: (options) => reactHooks.useChat(adapter, options)
    } : {})
  };
}

const defaultAdapter = getDefaultAdapter();
const defaultInstance = createInstance(defaultAdapter);

module.exports = {
  ...defaultInstance,
  
  GGUFModel,
  GenerationOptions,
  ModelContext,
  createModelId,
  
  createInstance,
  
  adapters: {
    node: nodeAdapter,
    browser: browserAdapter,
    react: reactHooks
  },
  
  tokenizer,
  
  utils: {
    logger,
    memory,
    streaming,
    formats
  },
  
  environment: {
    isNode,
    isBrowser,
    isReact
  },
  
  version: '0.1.0'
};