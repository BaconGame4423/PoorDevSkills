declare const math: any;

import { ParsedFunction, ParseResult, ParseError } from './types';
import { formatError, classifyError } from '../ui/error-display';

let functionIdCounter = 0;

const COLORS = [
  '#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#0891b2'
];
const DERIVATIVE_COLORS = [
  '#93c5fd', '#fca5a5', '#6ee7b7', '#c4b5fd', '#fdba74', '#67e8f9'
];

export function parse(expression: string): ParseResult {
  if (!expression || expression.trim() === '') {
    return {
      success: false,
      error: {
        type: 'empty',
        message: 'Please enter a function expression.',
      }
    };
  }

  const trimmed = expression.trim();
  
  try {
    const node = math.parse(trimmed);
    validateNode(node);
    
    let derivativeNode: any = null;
    let derivativeExpr = '';
    
    try {
      derivativeNode = math.derivative(trimmed, 'x');
      derivativeExpr = derivativeNode.toString();
    } catch (derivError) {
      derivativeExpr = 'Unable to compute derivative';
    }
    
    const colorIndex = functionIdCounter % COLORS.length;
    
    const parsedFn: ParsedFunction = {
      id: `fn-${functionIdCounter++}`,
      expression: trimmed,
      node,
      derivativeNode,
      derivativeExpr,
      color: COLORS[colorIndex],
      derivativeColor: DERIVATIVE_COLORS[colorIndex],
    };
    
    return { success: true, data: parsedFn };
    
  } catch (e: unknown) {
    const errorType = classifyError(e);
    const errorMessage = formatError(e);
    
    const parseError: ParseError = {
      type: errorType === 'invalid' ? 'syntax' : errorType as 'syntax' | 'domain' | 'unknown',
      message: errorMessage,
      rawError: e,
    };
    
    return {
      success: false,
      error: parseError,
    };
  }
}

export function parseWithFallback(expression: string, fallback?: ParsedFunction): ParseResult {
  const result = parse(expression);
  
  if (!result.success && fallback) {
    return { success: true, data: fallback };
  }
  
  return result;
}

export function validate(expression: string): { valid: boolean; error?: string } {
  if (!expression || expression.trim() === '') {
    return { valid: false, error: 'Expression is required.' };
  }
  
  try {
    const node = math.parse(expression.trim());
    validateNode(node);
    return { valid: true };
  } catch (e: unknown) {
    return { valid: false, error: formatError(e) };
  }
}

export function isValidExpression(expression: string): boolean {
  return validate(expression).valid;
}

function validateNode(node: any): void {
  const allowedFunctions = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh',
    'log', 'log10', 'log2', 'exp',
    'sqrt', 'abs', 'sign', 'floor', 'ceil', 'round',
    'pow', 'min', 'max',
    'pi', 'e',
  ]);
  
  node.traverse((n: any) => {
    if (n.isFunctionNode && n.fn?.name && !allowedFunctions.has(n.fn.name)) {
      throw new Error(`Unknown function: ${n.fn.name}`);
    }
    
    if (n.isSymbolNode && n.name !== 'x' && !allowedFunctions.has(n.name)) {
      if (!allowedFunctions.has(n.name)) {
        throw new Error(`Unknown variable: ${n.name}. Use 'x' as the variable.`);
      }
    }
  });
}

export function evaluateAt(node: any, x: number): number | null {
  try {
    const scope = { x };
    const result = node.compile().evaluate(scope);
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return null;
    }
    
    return result;
  } catch {
    return null;
  }
}

export function safeEvaluate(expression: string, x: number): number | null {
  try {
    const node = math.parse(expression);
    return evaluateAt(node, x);
  } catch {
    return null;
  }
}

export function createParsedFunction(expression: string, color?: string): ParsedFunction | null {
  const result = parse(expression);
  if (result.success && result.data) {
    if (color) {
      result.data.color = color;
    }
    return result.data;
  }
  return null;
}

export function getDerivativeExpression(expression: string): string | null {
  try {
    const derivNode = math.derivative(expression, 'x');
    return derivNode.toString();
  } catch {
    return null;
  }
}

export function resetIdCounter(): void {
  functionIdCounter = 0;
}
