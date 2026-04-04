import type { Expr } from "./ast";

/**
 * Generates GLSL code from an AST expression.
 * Assumes the following GLSL functions are available:
 * - cAdd, cSub, cMul, cDiv (complex arithmetic)
 * - cScale (real scalar * complex)
 * - cPowInt (complex power with integer exponent)
 * - v_wp, v_wpp (complex inputs)
 * - u_g2, u_g3 (uniform reals for g2, g3)
 */

export function codegenGlsl(expr: Expr): string {
  return exprToGlsl(expr);
}

function exprToGlsl(expr: Expr): string {
  switch (expr.kind) {
    case "literal": {
      const val = expr.value;
      return `vec2(${val}, 0.0)`;
    }
    case "identifier": {
      switch (expr.name) {
        case "wp":
          return "v_wp";
        case "wpp":
          return "v_wpp";
        case "g2":
          return `cScale(u_g2, vec2(1.0, 0.0))`;
        case "g3":
          return `cScale(u_g3, vec2(1.0, 0.0))`;
        default:
          throw new Error(`Unknown identifier: ${expr.name}`);
      }
    }
    case "unary": {
      const operand = exprToGlsl(expr.operand);
      if (expr.op === "-") {
        return `cScale(-1.0, ${operand})`;
      } else {
        return operand; // unary +
      }
    }
    case "binary": {
      const left = exprToGlsl(expr.left);
      const right = exprToGlsl(expr.right);
      switch (expr.op) {
        case "+":
          return `cAdd(${left}, ${right})`;
        case "-":
          return `cSub(${left}, ${right})`;
        case "*":
          return `cMul(${left}, ${right})`;
        case "/":
          return `cDiv(${left}, ${right})`;
      }
    }
    case "power": {
      const base = exprToGlsl(expr.base);
      return `cPowInt(${base}, ${expr.exponent})`;
    }
  }
}
