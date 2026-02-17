import { ParseError, ErrorType } from '../core/types';

const ERROR_MESSAGES: Record<string, string> = {
  'Unexpected end of expression': 'Expression is incomplete. Please complete the formula.',
  'Value expected': 'Missing value or operator in expression.',
  'Parenthesis ) expected': 'Missing closing parenthesis. Check your brackets.',
  'Parenthesis ( expected': 'Missing opening parenthesis.',
  'Operator expected': 'Invalid syntax. Check operators (+, -, *, /, ^).',
  'Undefined symbol': 'Unknown function or variable. Use x as the variable.',
};

const DOMAIN_ERRORS: Record<string, string> = {
  'sqrt': 'Cannot calculate square root of negative number.',
  'log': 'Cannot calculate logarithm of non-positive number.',
  'asin': 'Value must be between -1 and 1 for arcsine.',
  'acos': 'Value must be between -1 and 1 for arccosine.',
};

export function formatError(error: ParseError | Error | unknown): string {
  if (!error) return 'An unknown error occurred.';
  
  const parseError = error as ParseError;
  if (parseError.type && parseError.message) {
    return parseError.message;
  }
  
  const rawError = error as Error;
  const errorMsg = rawError?.message || String(error);
  
  for (const [pattern, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (errorMsg.includes(pattern)) {
      return friendly;
    }
  }
  
  for (const [fn, msg] of Object.entries(DOMAIN_ERRORS)) {
    if (errorMsg.toLowerCase().includes(fn)) {
      return msg;
    }
  }
  
  if (errorMsg.includes('NaN') || errorMsg.includes('Infinity')) {
    return 'Result is undefined for this input value.';
  }
  
  return `Invalid expression: ${errorMsg}`;
}

export function classifyError(error: unknown): ErrorType {
  if (!error) return 'unknown';
  
  const errorMsg = (error as Error)?.message || String(error);
  
  if (errorMsg.includes('Parenthesis') || 
      errorMsg.includes('expected') ||
      errorMsg.includes('Unexpected')) {
    return 'syntax';
  }
  
  if (errorMsg.includes('NaN') || 
      errorMsg.includes('Infinity') ||
      errorMsg.includes('domain')) {
    return 'domain';
  }
  
  if (errorMsg.includes('empty') || errorMsg.includes('required')) {
    return 'empty';
  }
  
  return 'invalid';
}

export function createErrorElement(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'error-display';
  el.className = 'error-display';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'polite');
  return el;
}

export function showError(container: HTMLElement, error: unknown): void {
  container.textContent = formatError(error);
  container.classList.add('visible');
  container.classList.remove('hidden');
}

export function hideError(container: HTMLElement): void {
  container.textContent = '';
  container.classList.remove('visible');
  container.classList.add('hidden');
}

export function getErrorDisplay(): HTMLElement | null {
  return document.getElementById('error-display');
}
