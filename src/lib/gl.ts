import type { GLResources, RenderParams } from "./types";
import quadVertSrc from "./shaders/quad.vert?raw";
import tileFrag from "./shaders/tile.frag?raw";
import screenFrag from "./shaders/screen.frag?raw";

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

export function createResources(gl: WebGLRenderingContext, tileSize: number): GLResources {
  const textureProgram = makeProgram(gl, quadVertSrc, tileFrag);
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
    textureProgram,
    screenProgram,
    quadBuffer,
    textureFramebuffer,
    tileTexture,
    tileSize,
    attribs: {
      textureApos: gl.getAttribLocation(textureProgram, "a_pos"),
      screenApos: gl.getAttribLocation(screenProgram, "a_pos"),
    },
    uniforms: {
      texture: {
        tau: uniform(gl, textureProgram, "u_tau"),
        mode: uniform(gl, textureProgram, "u_mode"),
        halo: uniform(gl, textureProgram, "u_halo"),
        terms: uniform(gl, textureProgram, "u_terms"),
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
