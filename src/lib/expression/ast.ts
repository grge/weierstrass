/** Abstract Syntax Tree nodes for elliptic expressions. */

export type Expr =
  | { kind: "literal"; value: number }
  | { kind: "identifier"; name: "wp" | "wpp" | "g2" | "g3" }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr }
  | { kind: "power"; base: Expr; exponent: number }
  | { kind: "unary"; op: "+" | "-"; operand: Expr };

export type ParseError = {
  message: string;
  position: number;
};
