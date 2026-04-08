import type { GLResources, RenderParams } from "./types";
import quadVertSrc from "./shaders/quad.vert?raw";
import tileExprFrag from "./shaders/tile_expr.frag?raw";
import screenFrag from "./shaders/screen.frag?raw";
import complexGlsl from "./shaders/complex.glsl?raw";
import colourGlsl from "./shaders/colour.glsl?raw";

/** Assemble a shader source by replacing snippet markers with shared GLSL. */
export function assembleShader(src: string): string {
  return src
    .replace('// ── [complex.glsl]', complexGlsl)
    .replace('// ── [colour.glsl]', colourGlsl);
}

function makeShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
  }
  return shader;
}

function makeProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, makeShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, makeShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
  }
  return program;
}

function uniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const loc = gl.getUniformLocation(program, name);
  if (!loc) throw new Error(`Missing uniform: ${name}`);
  return loc;
}

function bindQuad(gl: WebGLRenderingContext, buffer: WebGLBuffer, attrib: number): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attrib);
  gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);
}

/**
 * Generate a tile shader with an injected expression body.
 * Replaces the EXPR_BODY marker with the compiled expression.
 */
export function generateExpressionShader(glslBody: string): string {
  return assembleShader(tileExprFrag.replace("/*__EXPR_BODY__*/", `return ${glslBody};`));
}

/**
 * Compile and update the tile shader with a new expression.
 * Returns success on compilation and uniform setup, or an error on failure.
 * On error, the tile shader is not updated and continues rendering with the previous expression.
 */
export function compileExpressionProgram(
  r: GLResources,
  glslBody: string
): { ok: true } | { ok: false; error: string } {
  const { gl } = r;
  const src = generateExpressionShader(glslBody);

  try {
    const newProgram = makeProgram(gl, quadVertSrc, src);

    // Replace previous tile shader
    gl.deleteProgram(r.textureProgram);

    r.textureProgram = newProgram;
    r.uniforms.texture = {
      tau: uniform(gl, newProgram, "u_tau"),
      mode: uniform(gl, newProgram, "u_mode"),
      halo: uniform(gl, newProgram, "u_halo"),
      terms: uniform(gl, newProgram, "u_terms"),
      g2: uniform(gl, newProgram, "u_g2"),
      g3: uniform(gl, newProgram, "u_g3"),
    };

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}


export function createResources(gl: WebGL2RenderingContext, tileSize: number): GLResources {
  // Create tile shader with default expression (wp)
  const tileProgram = makeProgram(gl, quadVertSrc, generateExpressionShader("v_wp"));
  const screenProgram = makeProgram(gl, quadVertSrc, screenFrag);

  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const tileTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tileTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tileSize, tileSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const textureFramebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, textureFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tileTexture, 0);
  const fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete (status 0x${fboStatus.toString(16)})`);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    gl,
    textureProgram: tileProgram,
    screenProgram,
    quadBuffer,
    textureFramebuffer,
    tileTexture,
    tileSize,
    attribs: {
      textureApos: gl.getAttribLocation(tileProgram, "a_pos"),
      screenApos: gl.getAttribLocation(screenProgram, "a_pos"),
    },
    uniforms: {
      texture: {
        tau: uniform(gl, tileProgram, "u_tau"),
        mode: uniform(gl, tileProgram, "u_mode"),
        halo: uniform(gl, tileProgram, "u_halo"),
        terms: uniform(gl, tileProgram, "u_terms"),
        g2: uniform(gl, tileProgram, "u_g2"),
        g3: uniform(gl, tileProgram, "u_g3"),
      },
      screen: {
        tile: uniform(gl, screenProgram, "u_tile"),
        resolution: uniform(gl, screenProgram, "u_resolution"),
        pan: uniform(gl, screenProgram, "u_pan"),
        zoom: uniform(gl, screenProgram, "u_zoom"),
        omega1: uniform(gl, screenProgram, "u_omega1"),
        omega2: uniform(gl, screenProgram, "u_omega2"),
        viewMode: uniform(gl, screenProgram, "u_view_mode"),
      },
    },
  };
}

export function destroyResources(r: GLResources): void {
  const { gl } = r;
  gl.deleteTexture(r.tileTexture);
  gl.deleteFramebuffer(r.textureFramebuffer);
  gl.deleteBuffer(r.quadBuffer);
  gl.deleteProgram(r.textureProgram);
  gl.deleteProgram(r.screenProgram);
}

export function render(r: GLResources, p: RenderParams): void {
  const { gl } = r;

  gl.disable(gl.DEPTH_TEST);

  gl.bindFramebuffer(gl.FRAMEBUFFER, r.textureFramebuffer);
  gl.viewport(0, 0, r.tileSize, r.tileSize);
  gl.useProgram(r.textureProgram);
  bindQuad(gl, r.quadBuffer, r.attribs.textureApos);
  gl.uniform2f(r.uniforms.texture.tau, p.tau.x, p.tau.y);
  gl.uniform1i(r.uniforms.texture.mode, p.mode);
  gl.uniform1f(r.uniforms.texture.halo, p.halo);
  gl.uniform1i(r.uniforms.texture.terms, Math.max(1, Math.min(20, Math.round(p.terms))));
  gl.uniform1f(r.uniforms.texture.g2, p.g2);
  gl.uniform1f(r.uniforms.texture.g3, p.g3);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, p.width, p.height);
  gl.clearColor(0.07, 0.05, 0.04, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(r.screenProgram);
  bindQuad(gl, r.quadBuffer, r.attribs.screenApos);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.tileTexture);
  gl.uniform1i(r.uniforms.screen.tile, 0);
  gl.uniform2f(r.uniforms.screen.resolution, p.width, p.height);
  gl.uniform2f(r.uniforms.screen.pan, p.pan.x, p.pan.y);
  gl.uniform1f(r.uniforms.screen.zoom, p.zoom);
  gl.uniform2f(r.uniforms.screen.omega1, p.omega1.x, p.omega1.y);
  gl.uniform2f(r.uniforms.screen.omega2, p.omega2.x, p.omega2.y);
  gl.uniform1i(r.uniforms.screen.viewMode, p.viewMode === "torus" ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
