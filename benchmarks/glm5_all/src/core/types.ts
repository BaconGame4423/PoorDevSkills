export interface ParsedFunction {
  id: string;
  expression: string;
  node: any;
  derivativeNode: any;
  derivativeExpr: string;
  color: string;
  derivativeColor: string;
}

export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface TooltipData {
  x: number;
  values: Array<{ fn: string; y: number; yPrime: number }>;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedFunction;
  error?: ParseError;
}

export interface ParseError {
  type: 'syntax' | 'domain' | 'unknown';
  message: string;
  rawError?: any;
}

export type ErrorType = 'syntax' | 'domain' | 'empty' | 'invalid';
