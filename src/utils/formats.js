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
  
  if (systemPrompt) {
    if (useMarkdown) {
      prompt += `**${systemLabel}**: ${systemPrompt}\n\n`;
    } else {
      prompt += `${systemLabel}: ${systemPrompt}\n\n`;
    }
  }
  
  for (const message of messages) {
    let label = '';
    
    if (message.role === 'user') {
      label = userLabel;
    } else if (message.role === 'assistant') {
      label = assistantLabel;
    } else if (message.role === 'system') {
      label = systemLabel;
    }
    
    if (useMarkdown) {
      prompt += `**${label}**: ${message.content}\n\n`;
    } else {
      prompt += `${label}: ${message.content}\n\n`;
    }
  }
  
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
  
  instructionList.forEach((instruction, index) => {
    if (numbered) {
      formatted += `${index + 1}. ${instruction}\n`;
    } else {
      formatted += `- ${instruction}\n`;
    }
  });
  
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
  
  if (removeSpecialTokens) {
    cleaned = cleaned.replace(/<[^>]+>/g, '');
  }
  
  if (removeExtraNewlines) {
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }
  
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
  
  if (extractFromText) {
    const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                      text.match(/{[\s\S]*?}/);
    
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
  }
  
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    if (!fixBrokenJson) {
      return null;
    }
    
    try {
      let fixedJson = jsonText.replace(/'/g, '"');
      
      fixedJson = fixedJson.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
      
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
  
  const tokenCount = tokenCounter(text);
  if (tokenCount <= maxTokens) {
    return text;
  }
  
  const ellipsisTokens = tokenCounter(ellipsis);
  const effectiveMaxTokens = maxTokens - ellipsisTokens;
  
  const words = text.split(/\s+/);
  
  if (fromStart) {
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

module.exports = {
  formatChatPrompt,
  formatCompletionPrompt,
  formatInstructions,
  cleanOutput,
  extractJSON,
  templatePrompt,
  truncatePrompt
};