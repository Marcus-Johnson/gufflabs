/**
 * React hooks and utilities for GGUF models
 * @module adapters/react
 */

const hasReact = typeof window !== 'undefined' && 
                 (typeof window.React !== 'undefined' || 
                  typeof require === 'function' && (() => {
                    try { require('react'); return true; } 
                    catch { return false; }
                  })());

let React;
if (hasReact) {
  try {
    React = typeof window !== 'undefined' && window.React ? 
            window.React : require('react');
  } catch (error) {
    console.warn('React not found, hooks will not function properly');
  }
}

const { GGUFModel } = require('../core/model');
const loader = require('../core/loader');
const inference = require('../core/inference');
const logger = require('../utils/logger');

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
    const cleanup = effect();
    
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
  
  const loadModel = useCallback(async (path, loadOptions = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedModel = await loader.loadModel(path, loadOptions, adapter);
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
  
  const unloadModel = useCallback(async () => {
    if (model) {
      try {
        await loader.unloadModel(model.id, adapter);
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
  
  useEffect(() => {
    return () => {
      if (model && model.id) {
        try {
          loader.unloadModel(model.id, adapter);
        } catch (err) {
          logger.warn(`Failed to unload model on unmount: ${err.message}`);
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
      const response = await inference.generate(
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
    
    const wrappedOnToken = (token, isDone) => {
      if (!isCancelled.current) {
        fullOutput += token;
        setOutput(fullOutput);
        onToken(token, isDone);
      }
    };
    
    try {
      await inference.streamGenerate(
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
  
  const formatPrompt = useCallback((systemPrompt) => {
    let prompt = '';
    
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }
    
    for (const message of messages) {
      if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      } else if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    
    return prompt;
  }, [messages]);
  
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
      const prompt = formatPrompt(systemPrompt);
      
      const response = await inference.generate(
        model,
        prompt,
        genOptions,
        adapter
      );
      
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
    
    const assistantMessage = {
      id: Date.now(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, assistantMessage]);
    
    let fullResponse = '';
    
    const wrappedOnToken = (token, isDone) => {
      if (!isDone) {
        fullResponse += token;
        
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
        
        onToken(token, isDone);
      } else {
        onToken('', true);
      }
    };
    
    try {
      const prompt = formatPrompt(systemPrompt);
      
      await inference.streamGenerate(
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
  
  const ModelContext = React.createContext(null);
  const GenerationContext = React.createContext(null);
  
  const GGUFProvider = ({ children, initialOptions = {} }) => {
    const modelState = useModel(adapter, initialOptions);
    const generationState = useGeneration(adapter, initialOptions);
    
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

module.exports = {
  useModel,
  useGeneration,
  useChat,
  
  createGGUFContext: hasReact ? createGGUFContext : undefined,
  
  _react: {
    useState,
    useEffect,
    useCallback,
    useRef
  }
};