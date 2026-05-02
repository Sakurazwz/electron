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

  // 计算跑分
  static calculateScore(fps, maxFPS = 60, weight = 1) {
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

        for (float i = 0.0; i < 4.0; i++) {
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

  // 运行所有测试
  async runAllTests(onProgress) {
    this.isRunning = true;
    this.results = [];

    const tests = [
      { name: '2D 图形渲染', fn: () => this.run2DRenderTest() },
      { name: '粒子系统', fn: () => this.runParticleTest() },
      { name: '3D 渲染', fn: () => this.run3DRenderTest() },
      { name: '着色器计算', fn: () => this.runShaderComputeTest() },
      { name: '混合模式', fn: () => this.runBlendModeTest() }
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
