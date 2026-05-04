/**
 * GPU Benchmark 测试模块
 * 包含多种 GPU 性能测试项目
 */
class GPUBenchmark {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.isRunning = false;
    this.currentTest = null;
    this.results = [];
    this.onProgress = null;
    this.onResult = null;
    this.onComplete = null;
    this.onFPSUpdate = null;

    this.initWebGL();
  }

  initWebGL() {
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) {
      throw new Error('WebGL 不支持，无法进行 GPU 测试');
    }
  }

  // 获取 GPU 信息
  static getGPUInfo() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return { error: '浏览器不支持 WebGL' };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const info = {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
      aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
      alphaBits: gl.getParameter(gl.ALPHA_BITS),
      depthBits: gl.getParameter(gl.DEPTH_BITS),
      stencilBits: gl.getParameter(gl.STENCIL_BITS),
      redBits: gl.getParameter(gl.RED_BITS),
      greenBits: gl.getParameter(gl.GREEN_BITS),
      blueBits: gl.getParameter(gl.BLUE_BITS),
      maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
      maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      maxDrawBuffers: gl.getExtension('WEBGL_draw_buffers') ?
        gl.getExtension('WEBGL_draw_buffers').MAX_DRAW_BUFFERS_WEBGL : 1
    };

    // 估计显存
    info.estimatedMemory = GPUBenchmark.estimateGPUMemory(gl);

    if (debugInfo) {
      info.unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      info.unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }

    return info;
  }

  // 估计 GPU 显存
  static estimateGPUMemory(gl) {
    // 通过尝试创建大型纹理来估计显存
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    // 基于最大纹理尺寸和其他参数估算
    let estimatedMB = 0;

    if (maxTextureSize >= 16384) {
      estimatedMB = 8192; // 8GB+
    } else if (maxTextureSize >= 8192) {
      estimatedMB = 4096; // 4GB+
    } else if (maxTextureSize >= 4096) {
      estimatedMB = 2048; // 2GB+
    } else {
      estimatedMB = 1024; // 1GB
    }

    return estimatedMB;
  }

  // 计算跑分 - 满分对应240 FPS
  static calculateScore(fps, maxFPS = 240, weight = 1) {
    const normalizedFPS = Math.min(fps / maxFPS, 1);
    const score = Math.round(normalizedFPS * 10000 * weight);
    return score;
  }

  // 获取评级
  static getRating(totalScore) {
    if (totalScore >= 45000) return { text: '极优', class: 'rating-excellent' };
    if (totalScore >= 35000) return { text: '优秀', class: 'rating-good' };
    if (totalScore >= 25000) return { text: '一般', class: 'rating-average' };
    return { text: '需改进', class: 'rating-poor' };
  }

  // 创建着色器程序
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('着色器编译失败:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  // 创建着色器程序集合
  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('程序链接失败:', this.gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  // 二维图形渲染测试
  async run2DRenderTest(duration = 5000) {
    const gl = this.gl;
    const results = { name: '二维图形渲染', fps: [], score: 0 };
    let frameCount = 0;
    let startTime = performance.now();
    let testStartTime = startTime;

    // 简单的 2D 渲染着色器
    const vertexSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution;
        vec3 color = vec3(uv, 0.5 + 0.5 * sin(time));
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.createProgram(vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const timeLocation = gl.getUniformLocation(program, 'time');
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');

    return new Promise((resolve) => {
      const render = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - testStartTime;

        if (elapsed >= duration || !this.isRunning) {
          const avgFPS = frameCount / (elapsed / 1000);
          results.fps = avgFPS;
          results.score = GPUBenchmark.calculateScore(avgFPS, 60, 0.8);
          resolve(results);
          return;
        }

        frameCount++;
        if (this.onFPSUpdate) {
          this.onFPSUpdate(Math.round(1000 / (currentTime - startTime)));
        }
        startTime = currentTime;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(timeLocation, elapsed / 1000);
        gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
      };

      render();
    });
  }

  // 粒子系统测试
  async runParticleTest(duration = 5000, particleCount = 5000) {
    const gl = this.gl;
    const results = { name: '粒子系统渲染', fps: [], score: 0, particleCount };
    let frameCount = 0;
    let startTime = performance.now();
    let testStartTime = startTime;

    // 粒子着色器
    const vertexSource = `
      attribute vec2 position;
      attribute vec3 color;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = vec4(position, 0.0, 1.0);
        gl_PointSize = size;
      }
    `;

    const fragmentSource = `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0 - dist * 2.0);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.createProgram(vertexShader, fragmentShader);

    // 生成粒子数据
    const positions = new Float32Array(particleCount * 2);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 2] = (Math.random() - 0.5) * 2;
      positions[i * 2 + 1] = (Math.random() - 0.5) * 2;
      colors[i * 3] = Math.random();
      colors[i * 3 + 1] = Math.random();
      colors[i * 3 + 2] = Math.random();
      sizes[i] = Math.random() * 10 + 2;
    }

    const posBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();

    const positionLocation = gl.getAttribLocation(program, 'position');
    const colorLocation = gl.getAttribLocation(program, 'color');
    const sizeLocation = gl.getAttribLocation(program, 'size');

    return new Promise((resolve) => {
      const render = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - testStartTime;

        if (elapsed >= duration || !this.isRunning) {
          const avgFPS = frameCount / (elapsed / 1000);
          results.fps = avgFPS;
          results.score = GPUBenchmark.calculateScore(avgFPS, 60, 1.2);
          resolve(results);
          return;
        }

        frameCount++;
        if (this.onFPSUpdate) {
          this.onFPSUpdate(Math.round(1000 / (currentTime - startTime)));
        }
        startTime = currentTime;

        // 更新粒子位置
        for (let i = 0; i < particleCount; i++) {
          positions[i * 2] += Math.sin(elapsed * 0.001 + i) * 0.01;
          positions[i * 2 + 1] += Math.cos(elapsed * 0.001 + i) * 0.01;
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0.1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(sizeLocation);
        gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, particleCount);

        requestAnimationFrame(render);
      };

      render();
    });
  }

  // 3D 渲染测试
  async run3DRenderTest(duration = 5000) {
    const gl = this.gl;
    const results = { name: '3D 渲染', fps: [], score: 0 };
    let frameCount = 0;
    let startTime = performance.now();
    let testStartTime = startTime;

    // 简单的 3D 旋转立方体
    const vertexSource = `
      attribute vec3 position;
      attribute vec3 color;
      uniform mat4 mvpMatrix;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = mvpMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.createProgram(vertexShader, fragmentShader);

    // 立方体顶点数据
    const vertices = new Float32Array([
      // 前面
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      // 后面
      -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
      // 顶面
      -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
      // 底面
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
      // 右面
      0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
      // 左面
      -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5
    ]);

    const colors = new Float32Array([
      // 前面 - 红
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      // 后面 - 绿
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      // 顶面 - 蓝
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      // 底面 - 黄
      1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0,
      // 右面 - 品红
      1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1,
      // 左面 - 青
      0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const colorLocation = gl.getAttribLocation(program, 'color');
    const mvpMatrixLocation = gl.getUniformLocation(program, 'mvpMatrix');

    // 简单的矩阵运算
    const createRotationMatrix = (angleX, angleY) => {
      const cx = Math.cos(angleX), sx = Math.sin(angleX);
      const cy = Math.cos(angleY), sy = Math.sin(angleY);
      return new Float32Array([
        cy, 0, sy, 0,
        sx * sy, cx, -sx * cy, 0,
        -cx * sy, sx, cx * cy, 0,
        0, 0, 0, 1
      ]);
    };

    return new Promise((resolve) => {
      const render = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - testStartTime;

        if (elapsed >= duration || !this.isRunning) {
          const avgFPS = frameCount / (elapsed / 1000);
          results.fps = avgFPS;
          results.score = GPUBenchmark.calculateScore(avgFPS, 60, 1.0);
          resolve(results);
          return;
        }

        frameCount++;
        if (this.onFPSUpdate) {
          this.onFPSUpdate(Math.round(1000 / (currentTime - startTime)));
        }
        startTime = currentTime;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        const angle = elapsed * 0.001;
        const mvpMatrix = createRotationMatrix(angle, angle * 0.7);
        gl.uniformMatrix4fv(mvpMatrixLocation, false, mvpMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

        requestAnimationFrame(render);
      };

      render();
    });
  }

  // 着色器计算测试
  async runShaderComputeTest(duration = 5000) {
    const gl = this.gl;
    const results = { name: '着色器计算', fps: [], score: 0 };
    let frameCount = 0;
    let startTime = performance.now();
    let testStartTime = startTime;

    // 复杂的步步球着色器
    const vertexSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.263, 0.416, 0.557);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
        vec2 uv0 = uv;
        vec3 finalColor = vec3(0.0);

        for (float i = 0.0; i < 10.0; i++) {
          uv = fract(uv * 1.5) - 0.5;
          float d = length(uv) * exp(-length(uv0));
          vec3 col = palette(length(uv0) + i * 0.4 + time * 0.4);
          d = sin(d * 8.0 + time) / 8.0;
          d = abs(d);
          d = pow(0.01 / d, 1.2);
          finalColor += col * d;
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.createProgram(vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');
    const timeLocation = gl.getUniformLocation(program, 'time');

    return new Promise((resolve) => {
      const render = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - testStartTime;

        if (elapsed >= duration || !this.isRunning) {
          const avgFPS = frameCount / (elapsed / 1000);
          results.fps = avgFPS;
          results.score = GPUBenchmark.calculateScore(avgFPS, 60, 1.5);
          resolve(results);
          return;
        }

        frameCount++;
        if (this.onFPSUpdate) {
          this.onFPSUpdate(Math.round(1000 / (currentTime - startTime)));
        }
        startTime = currentTime;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);
        gl.uniform1f(timeLocation, elapsed / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
      };

      render();
    });
  }

  // 混合模式测试
  async runBlendModeTest(duration = 5000) {
    const gl = this.gl;
    const results = { name: '混合模式', fps: [], score: 0 };
    let frameCount = 0;
    let startTime = performance.now();
    let testStartTime = startTime;

    const layerCount = 10; // 多层混合

    const vertexSource = `
      attribute vec2 position;
      attribute vec2 texCoord;
      varying vec2 vTexCoord;
      void main() {
        vTexCoord = texCoord;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform float time;
      uniform float layer;
      void main() {
        vec3 color = vec3(
          sin(time + layer) * 0.5 + 0.5,
          cos(time + layer * 2.0) * 0.5 + 0.5,
          sin(time + layer * 3.0) * 0.5 + 0.5
        );
        float alpha = 0.3;
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.createProgram(vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const timeLocation = gl.getUniformLocation(program, 'time');
    const layerLocation = gl.getUniformLocation(program, 'layer');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return new Promise((resolve) => {
      const render = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - testStartTime;

        if (elapsed >= duration || !this.isRunning) {
          gl.disable(gl.BLEND);
          const avgFPS = frameCount / (elapsed / 1000);
          results.fps = avgFPS;
          results.score = GPUBenchmark.calculateScore(avgFPS, 60, 0.9);
          resolve(results);
          return;
        }

        frameCount++;
        if (this.onFPSUpdate) {
          this.onFPSUpdate(Math.round(1000 / (currentTime - startTime)));
        }
        startTime = currentTime;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(timeLocation, elapsed / 1000);

        for (let i = 0; i < layerCount; i++) {
          gl.uniform1f(layerLocation, i);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        requestAnimationFrame(render);
      };

      render();
    });
  }

  // 运行所有测试 - 只保留体积渲染压力测试
  async runAllTests(onProgress) {
    this.isRunning = true;
    this.results = [];

    const tests = [
      { name: '体积渲染 - 标准压力', fn: () => this.runVolumeShaderTest(5000, 8, 1000, 8.0, 1.0) },
      { name: '体积渲染 - 高压力', fn: () => this.runVolumeShaderTest(5000, 10, 1500, 10.0, 1.2) },
      { name: '体积渲染 - 极限压力', fn: () => this.runVolumeShaderTest(5000, 12, 2000, 12.0, 1.5) }
    ];

    for (let i = 0; i < tests.length; i++) {
      if (!this.isRunning) break;

      const test = tests[i];
      if (onProgress) {
        onProgress({
          progress: (i / tests.length) * 100,
          currentTest: test.name,
          status: 'running'
        });
      }

      try {
        const result = await test.fn();
        this.results.push(result);
      } catch (error) {
        console.error(`${test.name} 测试失败:`, error);
        this.results.push({
          name: test.name,
          fps: 0,
          score: 0,
          error: error.message
        });
      }
    }

    this.isRunning = false;

    if (onProgress) {
      onProgress({
        progress: 100,
        status: 'complete',
        results: this.results
      });
    }

    return {
      results: this.results,
      totalScore: this.results.reduce((sum, r) => sum + (r.score || 0), 0)
    };
  }

  // 体积渲染着色器测试 - 可调压力级别
  async runVolumeShaderTest(duration = 5000, iterations = 8, raySteps = 2000, maxDist = 12.0, weight = 2.0) {
    const gl = this.gl;
    const results = {
      name: `体积渲染 (迭代${iterations}次/步进${raySteps}步)`,
      fps: [],
      score: 0,
      config: { iterations, raySteps, maxDist, weight }
    };
    let frameCount = 0;
    let startTime = performance.now();
    let testStartTime = startTime;

    // 顶点着色器
    const vertexSource = `
      attribute vec4 position;
      varying vec3 dir, localdir;
      uniform vec3 right, forward, up, origin;
      uniform float x, y;
      void main() {
        gl_Position = position;
        dir = forward + right * position.x * x + up * position.y * y;
        localdir.x = position.x * x;
        localdir.y = position.y * y;
        localdir.z = -1.0;
      }
    `;

    // 3D 分形核函数 - 动态迭代次数
    const kernelSource = `
      float kernal(vec3 ver) {
        vec3 a = ver;
        for (int i = 0; i < ${iterations}; i++) {
          float b = length(a);
          float c = atan(a.y, a.x) * 8.0;
          float e = 1.0 / b;
          float d = acos(a.z / b) * 8.0;
          b = pow(b, 8.0);
          a = vec3(b * sin(d) * cos(c), b * sin(d) * sin(c), b * cos(d)) + ver;
          if (b > 6.0) break;
        }
        return 4.0 - a.x * a.x - a.y * a.y - a.z * a.z;
      }
    `;

    // 片段着色器 - 高压力光线步进
    const fragmentSource = `
      precision highp float;
      #define PI 3.14159265358979324
      #define M_L 0.3819660113
      #define M_R 0.6180339887
      #define MAXR 12
      #define SOLVER 12

      varying vec3 dir, localdir;
      uniform vec3 right, forward, up, origin;
      uniform float len;
      const float step = ${(1.0 / raySteps).toFixed(6)};

      ${kernelSource}

      void main() {
        vec3 color = vec3(0.0);
        int sign = 0;

        float v1 = kernal(origin + dir * (step * len));
        float v2 = kernal(origin);
        float r3_val = 0.0;

        for (int k = 2; k < ${raySteps + 2}; k++) {
          vec3 ver = origin + dir * (step * len * float(k));
          float v = kernal(ver);

          if (v > 0.0 && v1 < 0.0) {
            float r1 = step * len * float(k - 1);
            float r2 = step * len * float(k);
            float m1 = kernal(origin + dir * r1);
            float m2 = kernal(origin + dir * r2);
            for (int l = 0; l < SOLVER; l++) {
              float r3 = r1 * 0.5 + r2 * 0.5;
              float m3 = kernal(origin + dir * r3);
              if (m3 > 0.0) { r2 = r3; m2 = m3; }
              else { r1 = r3; m1 = m3; }
            }
            r3_val = r1 * 0.5 + r2 * 0.5;
            if (r3_val < ${maxDist.toFixed(1)} * len) { sign = 1; break; }
          }

          if (v < v1 && v1 > v2 && v1 < 0.0 && (v1 * 2.0 > v || v1 * 2.0 > v2)) {
            float r1 = step * len * float(k - 2);
            float r2 = step * len * (float(k) - 2.0 + 2.0 * M_L);
            float r3 = step * len * (float(k) - 2.0 + 2.0 * M_R);
            float r4 = step * len * float(k);
            float m2 = kernal(origin + dir * r2);
            float m3 = kernal(origin + dir * r3);
            for (int l = 0; l < MAXR; l++) {
              if (m2 > m3) {
                r4 = r3; r3 = r2; r2 = r4 * M_L + r1 * M_R;
                m3 = m2; m2 = kernal(origin + dir * r2);
              } else {
                r1 = r2; r2 = r3; r3 = r4 * M_R + r1 * M_L;
                m2 = m3; m3 = kernal(origin + dir * r3);
              }
            }
            if (m2 > 0.0) {
              float s1 = step * len * float(k - 2);
              float s2 = r2;
              float sm1 = kernal(origin + dir * s1);
              float sm2 = kernal(origin + dir * s2);
              for (int l = 0; l < SOLVER; l++) {
                float s3 = s1 * 0.5 + s2 * 0.5;
                float sm3 = kernal(origin + dir * s3);
                if (sm3 > 0.0) { s2 = s3; sm2 = sm3; }
                else { s1 = s3; sm1 = sm3; }
              }
              r3_val = s1 * 0.5 + s2 * 0.5;
              if (r3_val < ${maxDist.toFixed(1)} * len && r3_val > step * len) { sign = 1; break; }
            }
          }
          v2 = v1;
          v1 = v;
        }

        if (sign == 1) {
          vec3 ver = origin + dir * r3_val;
          float r1 = ver.x * ver.x + ver.y * ver.y + ver.z * ver.z;
          vec3 n;
          n.x = kernal(ver - right * (r3_val * 0.00025)) - kernal(ver + right * (r3_val * 0.00025));
          n.y = kernal(ver - up * (r3_val * 0.00025)) - kernal(ver + up * (r3_val * 0.00025));
          n.z = kernal(ver + forward * (r3_val * 0.00025)) - kernal(ver - forward * (r3_val * 0.00025));
          float r3n = n.x * n.x + n.y * n.y + n.z * n.z;
          n = n * (1.0 / sqrt(r3n));
          vec3 lv = normalize(localdir);
          vec3 reflectv = n * (-2.0 * dot(lv, n)) + lv;
          float lum = reflectv.x * 0.276 + reflectv.y * 0.920 + reflectv.z * 0.276;
          float amb = n.x * 0.276 + n.y * 0.920 + n.z * 0.276;
          lum = max(0.0, lum);
          lum = lum * lum * lum * lum;
          float shade = lum * 0.45 + amb * 0.25 + 0.3;
          n.x = sin(r1 * 10.0) * 0.5 + 0.5;
          n.y = sin(r1 * 10.0 + 2.05) * 0.5 + 0.5;
          n.z = sin(r1 * 10.0 - 2.05) * 0.5 + 0.5;
          color = n * shade;
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    if (!vertexShader) throw new Error('体积渲染顶点着色器编译失败');

    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) throw new Error('体积渲染片段着色器编译失败');

    const program = this.createProgram(vertexShader, fragmentShader);

    const positions = new Float32Array([
      -1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0,
      -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const glRight = gl.getUniformLocation(program, 'right');
    const glForward = gl.getUniformLocation(program, 'forward');
    const glUp = gl.getUniformLocation(program, 'up');
    const glOrigin = gl.getUniformLocation(program, 'origin');
    const glX = gl.getUniformLocation(program, 'x');
    const glY = gl.getUniformLocation(program, 'y');
    const glLen = gl.getUniformLocation(program, 'len');

    const len = 1.6;
    let ang1 = 2.8;
    const ang2 = 0.4;

    return new Promise((resolve) => {
      const render = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - testStartTime;

        if (elapsed >= duration || !this.isRunning) {
          const avgFPS = frameCount / (elapsed / 1000);
          results.fps = avgFPS;
          // 满分对应240 FPS，根据压力级别调整权重
          const levelWeight = iterations >= 12 ? 3.0 : iterations >= 10 ? 2.0 : 1.0;
          results.score = GPUBenchmark.calculateScore(avgFPS, 240, weight * levelWeight);
          resolve(results);
          return;
        }

        frameCount++;
        if (this.onFPSUpdate) {
          this.onFPSUpdate(Math.round(1000 / (currentTime - startTime)));
        }
        startTime = currentTime;

        ang1 += 0.01;

        gl.useProgram(program);

        gl.uniform1f(glX, 1.0);
        gl.uniform1f(glY, 1.0);
        gl.uniform1f(glLen, len);
        gl.uniform3f(glOrigin,
          len * Math.cos(ang1) * Math.cos(ang2),
          len * Math.sin(ang2),
          len * Math.sin(ang1) * Math.cos(ang2)
        );
        gl.uniform3f(glRight, Math.sin(ang1), 0, -Math.cos(ang1));
        gl.uniform3f(glUp,
          -Math.sin(ang2) * Math.cos(ang1),
          Math.cos(ang2),
          -Math.sin(ang2) * Math.sin(ang1)
        );
        gl.uniform3f(glForward,
          -Math.cos(ang1) * Math.cos(ang2),
          -Math.sin(ang2),
          -Math.sin(ang1) * Math.cos(ang2)
        );

        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
      };

      render();
    });
  }

  // 停止测试
  stop() {
    this.isRunning = false;
  }

  // 设置回调
  setCallbacks(callbacks) {
    this.onProgress = callbacks.onProgress || null;
    this.onFPSUpdate = callbacks.onFPSUpdate || null;
  }
}

// 暴露到全局
window.GPUBenchmark = GPUBenchmark;
