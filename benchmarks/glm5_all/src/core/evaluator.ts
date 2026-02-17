declare const math: any;

import { evaluateAt } from './parser';

export function evaluate(node: any, x: number): number | null {
  return evaluateAt(node, x);
}

export function sample(
  node: any,
  xMin: number,
  xMax: number,
  numPoints: number = 500
): Array<[number, number | null]> {
  const points: Array<[number, number | null]> = [];
  const step = (xMax - xMin) / (numPoints - 1);
  
  let lastValidY: number | null = null;
  const maxJump = (xMax - xMin) * 0.1;
  
  for (let i = 0; i < numPoints; i++) {
    const x = xMin + i * step;
    const y = evaluateAt(node, x);
    
    if (y !== null && lastValidY !== null && Math.abs(y - lastValidY) > maxJump) {
      points.push([x, null]);
    }
    
    points.push([x, y]);
    if (y !== null) lastValidY = y;
  }
  
  return points;
}

export function adaptiveSample(
  node: any,
  xMin: number,
  xMax: number,
  maxPoints: number = 1000
): Array<[number, number | null]> {
  const initialPoints = 50;
  const points: Array<[number, number | null]> = [];
  const step = (xMax - xMin) / (initialPoints - 1);
  
  for (let i = 0; i < initialPoints; i++) {
    const x = xMin + i * step;
    const y = evaluateAt(node, x);
    points.push([x, y]);
  }
  
  return refineSamples(node, points, maxPoints);
}

function refineSamples(
  node: any,
  points: Array<[number, number | null]>,
  maxPoints: number
): Array<[number, number | null]> {
  if (points.length >= maxPoints) return points;
  
  const newPoints: Array<[number, number | null]> = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    
    newPoints.push(points[i]);
    
    if (y0 !== null && y1 !== null && Math.abs(y1 - y0) > 0.5) {
      const midX = (x0 + x1) / 2;
      const midY = evaluateAt(node, midX);
      newPoints.splice(newPoints.length - 1, 0, [midX, midY]);
    }
  }
  
  if (newPoints.length > points.length && newPoints.length < maxPoints) {
    return refineSamples(node, newPoints, maxPoints);
  }
  
  return newPoints;
}

export function findRoots(
  node: any,
  xMin: number,
  xMax: number,
  tolerance: number = 1e-6
): number[] {
  const roots: number[] = [];
  const points = sample(node, xMin, xMax, 1000);
  
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    
    if (y0 !== null && y1 !== null && y0 * y1 < 0) {
      const root = bisection(node, x0, x1, tolerance);
      if (root !== null) roots.push(root);
    }
  }
  
  return roots;
}

function bisection(
  node: any,
  a: number,
  b: number,
  tol: number
): number | null {
  let fa = evaluateAt(node, a);
  let fb = evaluateAt(node, b);
  
  if (fa === null || fb === null) return null;
  if (fa * fb > 0) return null;
  
  for (let i = 0; i < 50; i++) {
    const c = (a + b) / 2;
    const fc = evaluateAt(node, c);
    
    if (fc === null) return null;
    
    if (Math.abs(fc) < tol || (b - a) / 2 < tol) {
      return c;
    }
    
    if (fa * fc < 0) {
      b = c;
      fb = fc;
    } else {
      a = c;
      fa = fc;
    }
  }
  
  return (a + b) / 2;
}
