// src/utils/templateProcessor.js

// Process template variables like {{variable_name}}
const processTemplateVariables = (template, variables) => {
  if (!template || typeof template !== 'string') return template;
  
  return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    return variables[variableName] !== undefined ? variables[variableName] : match;
  });
};

// Extract available variables from template
const extractTemplateVariables = (template) => {
  if (!template) return [];
  
  const variables = new Set();
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
};

// Validate template variables
const validateTemplateVariables = (template, availableVariables) => {
  const usedVariables = extractTemplateVariables(template);
  const missingVariables = usedVariables.filter(v => !availableVariables.includes(v));
  
  return {
    isValid: missingVariables.length === 0,
    missingVariables
  };
};

module.exports = {
  processTemplateVariables,
  extractTemplateVariables,
  validateTemplateVariables
};