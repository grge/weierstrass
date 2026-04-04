import type { Expr, ParseError } from "./ast";

/** Tokenizer for expression strings. */
type Token =
  | { kind: "number"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "eof" };

class Tokenizer {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input.trim();
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private peekChar(): string | null {
    this.skipWhitespace();
    return this.pos < this.input.length ? this.input[this.pos] : null;
  }

  private consumeChar(): string {
    this.skipWhitespace();
    return this.input[this.pos++];
  }

  next(): Token {
    this.skipWhitespace();
    if (this.pos >= this.input.length) return { kind: "eof" };

    const ch = this.input[this.pos];

    // Numbers (including scientific notation)
    if (/[\d.]/.test(ch)) {
      const start = this.pos;
      while (this.pos < this.input.length && /[\d.eE+-]/.test(this.input[this.pos])) {
        this.pos++;
      }
      const numStr = this.input.slice(start, this.pos);
      const num = Number(numStr);
      if (!Number.isFinite(num)) {
        throw { message: `Invalid number: ${numStr}`, position: start };
      }
      return { kind: "number", value: num };
    }

    // Identifiers
    if (/[a-zA-Z_]/.test(ch)) {
      const start = this.pos;
      while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
        this.pos++;
      }
      const ident = this.input.slice(start, this.pos);
      return { kind: "ident", value: ident };
    }

    // Operators and parens
    if (ch === "(") {
      this.pos++;
      return { kind: "lparen" };
    }
    if (ch === ")") {
      this.pos++;
      return { kind: "rparen" };
    }
    if ("+-*/^".includes(ch)) {
      this.pos++;
      return { kind: "op", value: ch as "+" | "-" | "*" | "/" | "^" };
    }

    throw { message: `Unexpected character: ${ch}`, position: this.pos };
  }
}

class Parser {
  private tokenizer: Tokenizer;
  private currentToken: Token;

  constructor(input: string) {
    this.tokenizer = new Tokenizer(input);
    this.currentToken = this.tokenizer.next();
  }

  private advance() {
    this.currentToken = this.tokenizer.next();
  }

  private expect(kind: Token["kind"]): Token {
    if (this.currentToken.kind !== kind) {
      throw {
        message: `Expected ${kind}, got ${this.currentToken.kind}`,
        position: 0,
      };
    }
    const token = this.currentToken;
    this.advance();
    return token;
  }

  parse(): Expr {
    const expr = this.parseExpression();
    if (this.currentToken.kind !== "eof") {
      throw { message: "Unexpected tokens after expression", position: 0 };
    }
    return expr;
  }

  private parseExpression(): Expr {
    return this.parseSum();
  }

  private parseSum(): Expr {
    let left = this.parseProduct();
    while (
      this.currentToken.kind === "op" &&
      (this.currentToken.value === "+" || this.currentToken.value === "-")
    ) {
      const op = this.currentToken.value;
      this.advance();
      const right = this.parseProduct();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseProduct(): Expr {
    let left = this.parsePower();
    while (
      this.currentToken.kind === "op" &&
      (this.currentToken.value === "*" || this.currentToken.value === "/")
    ) {
      const op = this.currentToken.value;
      this.advance();
      const right = this.parsePower();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parsePower(): Expr {
    let base = this.parseUnary();
    if (
      this.currentToken.kind === "op" &&
      this.currentToken.value === "^"
    ) {
      this.advance();
      const exponentExpr = this.parseSignedInteger();
      if (exponentExpr.kind !== "literal" || !Number.isInteger(exponentExpr.value)) {
        throw {
          message: "Exponent must be an integer literal",
          position: 0,
        };
      }
      return { kind: "power", base, exponent: exponentExpr.value };
    }
    return base;
  }

  private parseSignedInteger(): Expr {
    if (this.currentToken.kind === "op" && this.currentToken.value === "-") {
      this.advance();
      const expr = this.parseSignedInteger();
      if (expr.kind === "literal") {
        return { kind: "literal", value: -expr.value };
      }
      return { kind: "unary", op: "-", operand: expr };
    }
    if (this.currentToken.kind === "op" && this.currentToken.value === "+") {
      this.advance();
      return this.parseSignedInteger();
    }
    return this.parsePrimary();
  }

  private parseUnary(): Expr {
    if (this.currentToken.kind === "op" && this.currentToken.value === "-") {
      this.advance();
      const operand = this.parseUnary();
      return { kind: "unary", op: "-", operand };
    }
    if (this.currentToken.kind === "op" && this.currentToken.value === "+") {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    if (this.currentToken.kind === "number") {
      const value = this.currentToken.value;
      this.advance();
      return { kind: "literal", value };
    }

    if (this.currentToken.kind === "ident") {
      const name = this.currentToken.value;
      this.advance();
      if (!["wp", "wpp", "g2", "g3"].includes(name)) {
        throw {
          message: `Unknown identifier: ${name}. Allowed: wp, wpp, g2, g3`,
          position: 0,
        };
      }
      return { kind: "identifier", name: name as "wp" | "wpp" | "g2" | "g3" };
    }

    if (this.currentToken.kind === "lparen") {
      this.advance();
      const expr = this.parseExpression();
      this.expect("rparen");
      return expr;
    }

    throw {
      message: `Unexpected token: ${this.currentToken.kind}`,
      position: 0,
    };
  }
}

export function parse(input: string): { expr: Expr } | { error: ParseError } {
  try {
    const parser = new Parser(input);
    const expr = parser.parse();
    return { expr };
  } catch (err: unknown) {
    const error = err as ParseError;
    return { error };
  }
}
