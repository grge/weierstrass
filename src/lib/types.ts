export type Vec2 = { x: number; y: number };

export type GLResources = {
  gl: WebGLRenderingContext;
  textureProgram: WebGLProgram;
  screenProgram: WebGLProgram;
  quadBuffer: WebGLBuffer;
  textureFramebuffer: WebGLFramebuffer;
  tileTexture: WebGLTexture;
  tileSize: number;
  attribs: {
    textureApos: number;
    screenApos: number;
  };
  uniforms: {
    texture: {
      tau: WebGLUniformLocation;
      mode: WebGLUniformLocation;
      halo: WebGLUniformLocation;
      terms: WebGLUniformLocation;
    };
    screen: {
      tile: WebGLUniformLocation;
      resolution: WebGLUniformLocation;
      pan: WebGLUniformLocation;
      zoom: WebGLUniformLocation;
      omega1: WebGLUniformLocation;
      omega2: WebGLUniformLocation;
      viewMode: WebGLUniformLocation;
    };
  };
};

export type DragState =
  | { kind: "pan"; x: number; y: number }
  | { kind: "omega1" }
  | { kind: "omega2" };

export type ColorMode = "classic" | "ember" | "dusk" | "contours";
export type ViewMode = "plane" | "torus";
export type RenderMode = 0 | 1 | 2 | 3;

export type RenderParams = {
  omega1: Vec2;
  omega2: Vec2;
  tau: Vec2;
  zoom: number;
  pan: Vec2;
  mode: RenderMode;
  halo: number;
  viewMode: ViewMode;
  terms: number;
  width: number;
  height: number;
};
