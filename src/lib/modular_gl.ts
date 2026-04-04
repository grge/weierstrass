import { assembleShader } from "./gl";
import quadVertSrc from "./shaders/quad.vert?raw";
import tauModularFrag from "./shaders/tau_modular.frag?raw";
import type { RenderMode } from "./types";

export type ModularFunc = "j" | "delta" | "e4" | "e6";
const FUNC_INDEX: Record<ModularFunc, number> = { j: 0, delta: 1, e4: 2, e6: 3 };

type ModularResources = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  attribApos: number;
  uFunc: WebGLUniformLocation;
  uMode: WebGLUniformLocation;
  uXMin: WebGLUniformLocation;
  uXMax: WebGLUniformLocation;
  uYMin: WebGLUniformLocation;
  uYMax: WebGLUniformLocation;
  uTerms: WebGLUniformLocation;
};

function makeShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
  return s;
}

function makeProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, makeShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, makeShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? "program link failed");
  return p;
}

function u(gl: WebGLRenderingContext, p: WebGLProgram, name: string): WebGLUniformLocation {
  const loc = gl.getUniformLocation(p, name);
  if (!loc) throw new Error(`Missing uniform: ${name}`);
  return loc;
}

export function createModularResources(gl: WebGL2RenderingContext): ModularResources {
  const program = makeProgram(gl, quadVertSrc, assembleShader(tauModularFrag));
  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  return {
    gl, program, quadBuffer,
    attribApos: gl.getAttribLocation(program, "a_pos"),
    uFunc: u(gl, program, "u_func"),
    uMode: u(gl, program, "u_mode"),
    uXMin: u(gl, program, "u_x_min"),
    uXMax: u(gl, program, "u_x_max"),
    uYMin: u(gl, program, "u_y_min"),
    uYMax: u(gl, program, "u_y_max"),
    uTerms: u(gl, program, "u_terms"),
  };
}

export function destroyModularResources(r: ModularResources): void {
  r.gl.deleteBuffer(r.quadBuffer);
  r.gl.deleteProgram(r.program);
}

export function renderModular(
  r: ModularResources,
  func: ModularFunc,
  mode: RenderMode,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  width: number, height: number,
  tauTerms: number,
): void {
  const { gl } = r;
  gl.viewport(0, 0, width, height);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(r.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.quadBuffer);
  gl.enableVertexAttribArray(r.attribApos);
  gl.vertexAttribPointer(r.attribApos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(r.uFunc, FUNC_INDEX[func]);
  gl.uniform1i(r.uMode, mode);
  gl.uniform1f(r.uXMin, xMin);
  gl.uniform1f(r.uXMax, xMax);
  gl.uniform1f(r.uYMin, yMin);
  gl.uniform1f(r.uYMax, yMax);
  gl.uniform1i(r.uTerms, Math.max(5, Math.min(60, Math.round(tauTerms))));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
