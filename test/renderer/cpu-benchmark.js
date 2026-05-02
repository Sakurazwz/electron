/**
 * CPU Benchmark 测试模块
 * 包含多种 CPU 性能测试项目
 */
class CPUBenchmark {
  constructor() {
    this.isRunning = false;
    this.results = [];
    this.onProgress = null;
    this.onResult = null;
    this.onComplete = null;
    this.onFPSUpdate = null;
    this.worker = null;
  }

  // 获取 CPU 信息
  static getCPUInfo() {
    const info = {
      hardwareConcurrency: navigator.hardwareConcurrency || '未知',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      deviceMemory: navigator.deviceMemory || '未知',
    };

    // 推测 CPU 型号（仅供参考）
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('intel')) {
      info.vendor = 'Intel';
    } else if (ua.includes('amd')) {
      info.vendor = 'AMD';
    } else if (ua.includes('apple')) {
      info.vendor = 'Apple';
    } else {
      info.vendor = '未知';
    }

    return info;
  }

  // 计算跑分
  static calculateScore(operationsPerSecond, referenceOps = 1000000, weight = 1) {
    const normalizedScore = Math.min(operationsPerSecond / referenceOps, 5);
    const score = Math.round(normalizedScore * 10000 * weight);
    return score;
  }

  // 获取评级
  static getRating(totalScore) {
    if (totalScore >= 40000) return { text: '极优', class: 'rating-excellent' };
    if (totalScore >= 30000) return { text: '优秀', class: 'rating-good' };
    if (totalScore >= 20000) return { text: '一般', class: 'rating-average' };
    return { text: '需改进', class: 'rating-poor' };
  }

  // 整数运算测试
  async runIntegerTest(duration = 3000) {
    const results = { name: '整数运算', opsPerSecond: 0, score: 0 };
    let operations = 0;
    const startTime = performance.now();
    let lastTime = startTime;

    // 创建 Web Worker 来进行并行计算
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8);
    const workers = [];
    const workerOperations = new Array(workerCount).fill(0);

    const workerCode = `
      let ops = 0;
      let running = true;
      let startTime = performance.now();

      function calculate() {
        while (running && performance.now() - startTime < 100) {
          // 复杂的整数运算
          let a = Math.floor(Math.random() * 1000000);
          let b = Math.floor(Math.random() * 1000000);
          for (let i = 0; i < 1000; i++) {
            a = (a * b + i) % 1000000007;
            b = (a + b * i) % 1000000007;
            a = Math.abs(a - b);
            b = Math.abs(a + b);
            a = (a << 3) | (b >> 2);
            b = (b << 2) | (a >> 3);
          }
          ops++;
        }
        if (running) {
          setTimeout(calculate, 0);
        }
      }

      self.onmessage = function(e) {
        if (e.data === 'start') {
          startTime = performance.now();
          calculate();
        } else if (e.data === 'stop') {
          running = false;
          self.postMessage({ ops: ops });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      let completedWorkers = 0;
      let totalOps = 0;

      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        worker.onmessage = (e) => {
          if (e.data && e.data.ops !== undefined) {
            totalOps += e.data.ops;
            completedWorkers++;

            if (completedWorkers === workerCount) {
              const elapsed = (performance.now() - startTime) / 1000;
              const opsPerSecond = (totalOps * 1000) / elapsed;
              results.opsPerSecond = Math.round(opsPerSecond);
              results.score = CPUBenchmark.calculateScore(opsPerSecond, 50000, 1.0);

              URL.revokeObjectURL(workerUrl);
              resolve(results);
            }
          }
        };

        worker.postMessage('start');
      }

      // 设定时间后停止
      setTimeout(() => {
        workers.forEach(w => w.postMessage('stop'));
      }, duration);
    });
  }

  // 浮点数运算测试
  async runFloatTest(duration = 3000) {
    const results = { name: '浮点数运算', opsPerSecond: 0, score: 0 };
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 8);
    const workers = [];

    const workerCode = `
      let ops = 0;
      let running = true;

      function calculate() {
        let startTime = performance.now();
        while (running && performance.now() - startTime < 100) {
          // 复杂的浮点数运算
          let a = Math.random();
          let b = Math.random();
          for (let i = 0; i < 1000; i++) {
            a = Math.sin(a) * Math.cos(b) + Math.tan(a * b);
            b = Math.sqrt(Math.abs(a)) + Math.pow(b, 1.5);
            a = Math.log(Math.abs(a) + 1) * Math.exp(b * 0.1);
            b = Math.atan2(a, b) + Math.PI;
            a = a * b - b / (a + 0.001);
          }
          ops++;
        }
        if (running) {
          setTimeout(calculate, 0);
        }
      }

      self.onmessage = function(e) {
        if (e.data === 'start') {
          calculate();
        } else if (e.data === 'stop') {
          running = false;
          self.postMessage({ ops: ops });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const startTime = performance.now();
      let completedWorkers = 0;
      let totalOps = 0;

      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        worker.onmessage = (e) => {
          if (e.data && e.data.ops !== undefined) {
            totalOps += e.data.ops;
            completedWorkers++;

            if (completedWorkers === workerCount) {
              const elapsed = (performance.now() - startTime) / 1000;
              const opsPerSecond = (totalOps * 1000) / elapsed;
              results.opsPerSecond = Math.round(opsPerSecond);
              results.score = CPUBenchmark.calculateScore(opsPerSecond, 30000, 1.2);

              URL.revokeObjectURL(workerUrl);
              resolve(results);
            }
          }
        };

        worker.postMessage('start');
      }

      setTimeout(() => {
        workers.forEach(w => w.postMessage('stop'));
      }, duration);
    });
  }

  // 内存操作测试
  async runMemoryTest(duration = 3000) {
    const results = { name: '内存操作', opsPerSecond: 0, score: 0 };
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4);
    const workers = [];

    const workerCode = `
      let ops = 0;
      let running = true;

      function calculate() {
        const arraySize = 1000000;
        const arrays = [];

        // 创建多个大数组
        for (let i = 0; i < 5; i++) {
          arrays.push(new Float64Array(arraySize));
        }

        let startTime = performance.now();
        while (running && performance.now() - startTime < 100) {
          // 内存操作测试
          for (let arr of arrays) {
            for (let i = 0; i < 10000; i++) {
              const idx = Math.floor(Math.random() * arraySize);
              arr[idx] = Math.random();
              arr[(idx + 1) % arraySize] = arr[idx] * 2;
              arr[(idx + 2) % arraySize] = arr[idx] + arr[(idx + 1) % arraySize];
            }
          }
          ops++;
        }

        // 清理内存
        arrays.length = 0;

        if (running) {
          setTimeout(calculate, 0);
        }
      }

      self.onmessage = function(e) {
        if (e.data === 'start') {
          calculate();
        } else if (e.data === 'stop') {
          running = false;
          self.postMessage({ ops: ops });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const startTime = performance.now();
      let completedWorkers = 0;
      let totalOps = 0;

      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        worker.onmessage = (e) => {
          if (e.data && e.data.ops !== undefined) {
            totalOps += e.data.ops;
            completedWorkers++;

            if (completedWorkers === workerCount) {
              const elapsed = (performance.now() - startTime) / 1000;
              const opsPerSecond = (totalOps * 1000) / elapsed;
              results.opsPerSecond = Math.round(opsPerSecond);
              results.score = CPUBenchmark.calculateScore(opsPerSecond, 1000, 0.8);

              URL.revokeObjectURL(workerUrl);
              resolve(results);
            }
          }
        };

        worker.postMessage('start');
      }

      setTimeout(() => {
        workers.forEach(w => w.postMessage('stop'));
      }, duration);
    });
  }

  // 排序算法测试
  async runSortTest() {
    const results = { name: '排序算法', opsPerSecond: 0, score: 0 };
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4);
    const workers = [];
    const testSizes = [1000, 5000, 10000, 50000];

    const workerCode = `
      function quickSort(arr, left = 0, right = arr.length - 1) {
        if (left < right) {
          const pivotIndex = partition(arr, left, right);
          quickSort(arr, left, pivotIndex - 1);
          quickSort(arr, pivotIndex + 1, right);
        }
        return arr;
      }

      function partition(arr, left, right) {
        const pivot = arr[Math.floor((left + right) / 2)];
        let i = left;
        let j = right;

        while (i <= j) {
          while (arr[i] < pivot) i++;
          while (arr[j] > pivot) j--;
          if (i <= j) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            i++;
            j--;
          }
        }
        return i;
      }

      function mergeSort(arr) {
        if (arr.length <= 1) return arr;
        const mid = Math.floor(arr.length / 2);
        const left = mergeSort(arr.slice(0, mid));
        const right = mergeSort(arr.slice(mid));
        return merge(left, right);
      }

      function merge(left, right) {
        const result = [];
        let i = 0, j = 0;
        while (i < left.length && j < right.length) {
          if (left[i] < right[j]) result.push(left[i++]);
          else result.push(right[j++]);
        }
        return result.concat(left.slice(i)).concat(right.slice(j));
      }

      let totalTime = 0;
      let totalOps = 0;

      self.onmessage = function(e) {
        if (e.data.sizes) {
          const sizes = e.data.sizes;

          sizes.forEach(size => {
            // 测试快速排序
            let arr = Array.from({length: size}, () => Math.random());
            let start = performance.now();
            quickSort([...arr]);
            totalTime += performance.now() - start;
            totalOps++;

            // 测试归并排序
            arr = Array.from({length: size}, () => Math.random());
            start = performance.now();
            mergeSort([...arr]);
            totalTime += performance.now() - start;
            totalOps++;
          });

          self.postMessage({
            totalOps: totalOps,
            totalTime: totalTime,
            opsPerSecond: Math.round((totalOps * 1000) / Math.max(totalTime, 1))
          });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      let completedWorkers = 0;
      let totalOps = 0;
      let totalTime = 0;

      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        worker.onmessage = (e) => {
          if (e.data && e.data.opsPerSecond !== undefined) {
            totalOps += e.data.totalOps;
            totalTime += e.data.totalTime;
            completedWorkers++;

            if (completedWorkers === workerCount) {
              const opsPerSecond = Math.round((totalOps * 1000) / Math.max(totalTime, 1));
              results.opsPerSecond = opsPerSecond;
              results.score = CPUBenchmark.calculateScore(opsPerSecond, 100, 1.0);
              results.totalTime = totalTime.toFixed(2) + 'ms';

              URL.revokeObjectURL(workerUrl);
              resolve(results);
            }
          }
        };

        worker.postMessage({ sizes: testSizes });
      }
    });
  }

  // 加密/哈希计算测试
  async runCryptoTest(duration = 3000) {
    const results = { name: '加密计算', opsPerSecond: 0, score: 0 };
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4);
    const workers = [];

    const workerCode = `
      // 简单的哈希函数
      function djb2Hash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return hash;
      }

      // 简单的加密
      function simpleEncrypt(data, key) {
        let result = '';
        for (let i = 0; i < data.length; i++) {
          result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
      }

      function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      }

      let ops = 0;
      let running = true;

      function calculate() {
        let startTime = performance.now();
        while (running && performance.now() - startTime < 100) {
          const data = generateRandomString(100);
          const key = generateRandomString(16);

          // 哈希计算
          djb2Hash(data);
          djb2Hash(key);

          // 加密计算
          simpleEncrypt(data, key);

          ops++;
        }
        if (running) {
          setTimeout(calculate, 0);
        }
      }

      self.onmessage = function(e) {
        if (e.data === 'start') {
          calculate();
        } else if (e.data === 'stop') {
          running = false;
          self.postMessage({ ops: ops });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const startTime = performance.now();
      let completedWorkers = 0;
      let totalOps = 0;

      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        worker.onmessage = (e) => {
          if (e.data && e.data.ops !== undefined) {
            totalOps += e.data.ops;
            completedWorkers++;

            if (completedWorkers === workerCount) {
              const elapsed = (performance.now() - startTime) / 1000;
              const opsPerSecond = (totalOps * 1000) / elapsed;
              results.opsPerSecond = Math.round(opsPerSecond);
              results.score = CPUBenchmark.calculateScore(opsPerSecond, 50000, 0.9);

              URL.revokeObjectURL(workerUrl);
              resolve(results);
            }
          }
        };

        worker.postMessage('start');
      }

      setTimeout(() => {
        workers.forEach(w => w.postMessage('stop'));
      }, duration);
    });
  }

  // 运行所有测试
  async runAllTests(onProgress) {
    this.isRunning = true;
    this.results = [];

    const tests = [
      { name: '整数运算', fn: () => this.runIntegerTest() },
      { name: '浮点数运算', fn: () => this.runFloatTest() },
      { name: '内存操作', fn: () => this.runMemoryTest() },
      { name: '排序算法', fn: () => this.runSortTest() },
      { name: '加密计算', fn: () => this.runCryptoTest() }
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
          opsPerSecond: 0,
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

  // 运行单个测试
  async runSingleTest(type) {
    switch (type) {
      case 'cpu-all':
      case 'all':
        // 运行所有测试
        return await this.runAllTests();
      case 'cpu-integer':
      case 'integer':
        return await this.runIntegerTest();
      case 'cpu-float':
      case 'float':
        return await this.runFloatTest();
      case 'cpu-memory':
      case 'memory':
        return await this.runMemoryTest();
      case 'cpu-sort':
      case 'sort':
        return await this.runSortTest();
      case 'cpu-crypto':
      case 'crypto':
        return await this.runCryptoTest();
      default:
        throw new Error('未知的测试类型: ' + type);
    }
  }

  // 停止测试
  stop() {
    this.isRunning = false;
  }

  // 设置回调
  setCallbacks(callbacks) {
    this.onProgress = callbacks.onProgress || null;
  }
}

// 暴露到全局
window.CPUBenchmark = CPUBenchmark;
