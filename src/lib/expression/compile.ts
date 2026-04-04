import { parse } from "./parser";
import { codegenGlsl } from "./codegen_glsl";
import type { Expr } from "./ast";

export type CompileResult =
  | { ok: true; glslBody: string }
  | { ok: false; error: string };

/**
 * Compile an expression string to GLSL code.
 * Returns either the generated GLSL expression body or an error message.
 */
export function compileExpression(exprStr: string): CompileResult {
  // Parse
  const parseResult = parse(exprStr);
  if ("error" in parseResult) {
    return { ok: false, error: parseResult.error.message };
  }

  // Validate
  const validationError = validateExpr(parseResult.expr);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // Codegen
  try {
    const glslBody = codegenGlsl(parseResult.expr);
    return { ok: true, glslBody };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Codegen error: ${message}` };
  }
}

/**
 * Semantic validation:
 * - Check expression depth/size limits
 * - All identifiers are valid
 * - Power exponents are integers
 */
function validateExpr(expr: Expr, depth: number = 0): string | null {
  const MAX_DEPTH = 50;
  if (depth > MAX_DEPTH) {
    return "Expression too deeply nested";
  }

  switch (expr.kind) {
    case "literal":
      return null;
    case "identifier":
      return null; // Already validated in parser
    case "unary":
      return validateExpr(expr.operand, depth + 1);
    case "binary":
      return (
        validateExpr(expr.left, depth + 1) ||
        validateExpr(expr.right, depth + 1)
      );
    case "power":
      if (!Number.isInteger(expr.exponent)) {
        return "Power exponent must be an integer";
      }
      return validateExpr(expr.base, depth + 1);
  }
}
