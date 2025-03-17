/**
 * GGUF inference engine
 * @module core/inference
 */

const { ModelContext, GenerationOptions } = require('./model');
const logger = require('../utils/logger');

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
  
  cancellationFlags.set(model.id, false);
  
  const generationOptions = new GenerationOptions(options);
  
  logger.info(`Generating with model: ${model.id}`);
  logger.debug('Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
  logger.debug('Options:', generationOptions);
  
  try {
    const tokens = await adapter.tokenize(model, prompt);
    logger.debug(`Tokenized prompt: ${tokens.length} tokens`);
    
    const context = new ModelContext({
      tokens,
      contextSize: model.metadata.contextSize || 2048
    });
    
    if (context.getContextLength() >= context.contextSize) {
      logger.warn(`Prompt exceeds context size: ${context.getContextLength()} tokens`);
      context.tokens = context.tokens.slice(-context.contextSize + 100);
    }
    
    const maxNewTokens = Math.min(
      generationOptions.maxTokens,
      context.getRemainingSpace() - 10
    );
    
    const outputTokens = await adapter.runInference(
      model,
      context,
      {
        ...generationOptions,
        maxTokens: maxNewTokens
      },
      () => cancellationFlags.get(model.id)
    );
    
    const outputText = await adapter.detokenize(model, outputTokens);
    
    logger.info(`Generated ${outputTokens.length} tokens`);
    return outputText;
  } catch (error) {
    if (cancellationFlags.get(model.id)) {
      logger.info('Generation was cancelled');
      return '';
    }
    
    logger.error(`Generation failed: ${error.message}`);
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
  
  cancellationFlags.set(model.id, false);
  
  const generationOptions = new GenerationOptions(options);
  
  logger.info(`Streaming with model: ${model.id}`);
  logger.debug('Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
  
  try {
    const tokens = await adapter.tokenize(model, prompt);
    
    const context = new ModelContext({
      tokens,
      contextSize: model.metadata.contextSize || 2048
    });
    
    if (context.getContextLength() >= context.contextSize) {
      logger.warn(`Prompt exceeds context size: ${context.getContextLength()} tokens`);
      context.tokens = context.tokens.slice(-context.contextSize + 100);
    }
    
    const maxNewTokens = Math.min(
      generationOptions.maxTokens,
      context.getRemainingSpace() - 10
    );
    
    const tokenCallback = async (tokenId) => {
      try {
        const tokenText = await adapter.detokenizeToken(model, tokenId);
        onToken(tokenText, false);
      } catch (error) {
        logger.error(`Token callback error: ${error.message}`);
      }
    };
    
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
    
    onToken('', true);
    logger.info('Streaming generation complete');
  } catch (error) {
    if (cancellationFlags.get(model.id)) {
      logger.info('Streaming was cancelled');
      onToken('', true);
      return;
    }
    
    logger.error(`Streaming failed: ${error.message}`);
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
    logger.warn('No model ID provided for cancellation');
    return false;
  }
  
  logger.info(`Cancelling generation for model: ${modelId}`);
  cancellationFlags.set(modelId, true);
  return true;
}

module.exports = {
  generate,
  streamGenerate,
  cancelGeneration
};