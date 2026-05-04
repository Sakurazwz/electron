/**
 * 应用程序逻辑
 * 连接 UI 与 GPU / CPU Benchmark 模块
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素引用 - 测试模式
  const gpuModeBtn = document.getElementById('gpu-mode-btn');
  const cpuModeBtn = document.getElementById('cpu-mode-btn');
  const combinedModeBtn = document.getElementById('combined-mode-btn');

  // GPU 信息元素
  const gpuInfoSection = document.getElementById('gpu-info-section');
  const gpuNameEl = document.getElementById('gpu-name');
  const webglVersionEl = document.getElementById('webgl-version');
  const webglRendererEl = document.getElementById('webgl-renderer');
  const gpuMemoryEl = document.getElementById('gpu-memory');

  // CPU 信息元素
  const cpuInfoSection = document.getElementById('cpu-info-section');
  const cpuCoresEl = document.getElementById('cpu-cores');
  const cpuMemoryEl = document.getElementById('cpu-memory');
  const cpuVendorEl = document.getElementById('cpu-vendor');
  const cpuPlatformEl = document.getElementById('cpu-platform');

  // 测试控制元素
  const testSectionTitle = document.getElementById('test-section-title');
  const testTypeSelect = document.getElementById('test-type');
  const gpuOptions = document.getElementById('gpu-options');
  const cpuOptions = document.getElementById('cpu-options');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');

  // 进度条
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // 测试显示区域
  const testVisualContainer = document.getElementById('test-visual-container');
  const testCanvas = document.getElementById('test-canvas');
  const testOverlay = document.getElementById('test-overlay');
  const currentFpsEl = document.getElementById('current-fps');
  const cpuTestStatus = document.getElementById('cpu-test-status');
  const coresCountEl = document.getElementById('cores-count');

  // 结果展示元素
  const resultsSection = document.getElementById('results-section');
  const resultsTitle = document.getElementById('results-title');
  const totalScoreEl = document.getElementById('total-score');
  const scoreRatingEl = document.getElementById('score-rating');
  const detailedResultsEl = document.getElementById('detailed-results');

  // 操作按钮
  const saveBtn = document.getElementById('save-btn');
  const shareBtn = document.getElementById('share-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyListEl = document.getElementById('history-list');

  // 测试模式: 'gpu' | 'cpu' | 'combined'
  let currentMode = 'gpu';
  let benchmark = null;
  let cpuBenchmark = null;

  // 初始化 GPU 信息
  function initGPUInfo() {
    const info = GPUBenchmark.getGPUInfo();

    if (info.error) {
      gpuNameEl.textContent = info.error;
      return;
    }

    gpuNameEl.textContent = info.unmaskedRenderer || info.renderer || '未知';
    webglVersionEl.textContent = info.version || '--';
    webglRendererEl.textContent = info.unmaskedVendor || info.vendor || '--';

    if (info.estimatedMemory) {
      gpuMemoryEl.textContent = `${info.estimatedMemory} MB (${info.maxTextureSize}x${info.maxTextureSize})`;
    } else {
      gpuMemoryEl.textContent = '--';
    }

    // 调整画布尺寸
    const container = testCanvas.parentElement;
    testCanvas.width = container.clientWidth;
    testCanvas.height = container.clientHeight;

    window.addEventListener('resize', () => {
      testCanvas.width = container.clientWidth;
      testCanvas.height = container.clientHeight;
    });
  }

  // 初始化 CPU 信息
  function initCPUInfo() {
    const info = CPUBenchmark.getCPUInfo();

    cpuCoresEl.textContent = info.hardwareConcurrency !== '未知'
      ? `${info.hardwareConcurrency} 核心`
      : '未知';
    cpuMemoryEl.textContent = info.deviceMemory !== '未知'
      ? `${info.deviceMemory} GB`
      : '未知';
    cpuVendorEl.textContent = info.vendor;
    cpuPlatformEl.textContent = info.platform || '未知';
  }

  // 切换测试模式
  function switchMode(mode) {
    currentMode = mode;
    console.log('切换模式到:', mode);

    // 更新按钮状态
    [gpuModeBtn, cpuModeBtn, combinedModeBtn].forEach(btn => {
      btn.classList.remove('active');
    });

    if (mode === 'gpu') {
      gpuModeBtn.classList.add('active');
      gpuInfoSection.classList.remove('hidden');
      cpuInfoSection.classList.add('hidden');
      gpuOptions.hidden = false;
      cpuOptions.hidden = true;
      testTypeSelect.value = 'all';
      testVisualContainer.classList.remove('hidden');
      resultsSection.classList.remove('cpu-mode');
      testSectionTitle.textContent = 'GPU 跑分测试';
      resultsTitle.textContent = 'GPU 测试结果';
    } else if (mode === 'cpu') {
      cpuModeBtn.classList.add('active');
      gpuInfoSection.classList.add('hidden');
      cpuInfoSection.classList.remove('hidden');
      gpuOptions.hidden = true;
      cpuOptions.hidden = false;
      testTypeSelect.value = 'cpu-all';
      testVisualContainer.classList.add('hidden');
      resultsSection.classList.add('cpu-mode');
      testSectionTitle.textContent = 'CPU 跑分测试';
      resultsTitle.textContent = 'CPU 测试结果';
    } else if (mode === 'combined') {
      combinedModeBtn.classList.add('active');
      gpuInfoSection.classList.remove('hidden');
      cpuInfoSection.classList.remove('hidden');
      gpuOptions.hidden = false;
      cpuOptions.hidden = false;
      testTypeSelect.value = 'all';
      testVisualContainer.classList.remove('hidden');
      resultsSection.classList.remove('cpu-mode');
      testSectionTitle.textContent = '综合跑分测试';
      resultsTitle.textContent = '综合测试结果';
    }

    // 重置结果显示
    resultsSection.classList.add('hidden');
    progressContainer.classList.add('hidden');
  }

  // 开始测试
  async function startBenchmark() {
    const testType = testTypeSelect.value;

    // 更新 UI 状态
    startBtn.disabled = true;
    stopBtn.disabled = false;
    progressContainer.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    try {
      let results;

      if (currentMode === 'gpu') {
        // GPU 测试
        testOverlay.classList.remove('hidden');
        benchmark = new GPUBenchmark(testCanvas);
        benchmark.setCallbacks({
          onFPSUpdate: (fps) => {
            currentFpsEl.textContent = fps;
          }
        });

        if (testType === 'all') {
          results = await benchmark.runAllTests((progress) => {
            progressFill.style.width = `${progress.progress}%`;
            if (progress.currentTest) {
              progressText.textContent = `正在测试: ${progress.currentTest}...`;
            }
            if (progress.status === 'complete') {
              progressText.textContent = 'GPU 测试完成!';
            }
          });
        } else {
          progressText.textContent = '测试中...';
          progressFill.style.width = '50%';

          const singleResult = await runSingleGPUTest(testType);
          results = {
            results: [singleResult],
            totalScore: singleResult.score
          };

          progressFill.style.width = '100%';
          progressText.textContent = 'GPU 测试完成!';
        }

        // 显示结果
        displayResults(results, 'gpu');

      } else if (currentMode === 'cpu') {
        // CPU 测试
        cpuTestStatus.classList.remove('hidden');
        coresCountEl.textContent = navigator.hardwareConcurrency || 4;

        cpuBenchmark = new CPUBenchmark();

        let cpuResults;
        if (testType === 'cpu-all') {
          cpuResults = await cpuBenchmark.runAllTests((progress) => {
            progressFill.style.width = `${progress.progress}%`;
            if (progress.currentTest) {
              progressText.textContent = `正在测试: ${progress.currentTest}...`;
            }
            if (progress.status === 'complete') {
              progressText.textContent = 'CPU 测试完战!';
            }
          });
        } else {
          progressText.textContent = '测试中...';
          progressFill.style.width = '50%';

          const singleResult = await cpuBenchmark.runSingleTest(testType);
          cpuResults = {
            results: [singleResult],
            totalScore: singleResult.score
          };

          progressFill.style.width = '100%';
          progressText.textContent = 'CPU 测试完成!';
        }

        // 显示结果
        displayResults(cpuResults, 'cpu');

      } else if (currentMode === 'combined') {
        // 综合测试
        testOverlay.classList.remove('hidden');
        cpuTestStatus.classList.remove('hidden');
        coresCountEl.textContent = navigator.hardwareConcurrency || 4;

        // 同时运行 GPU 和 CPU 测试
        benchmark = new GPUBenchmark(testCanvas);
        benchmark.setCallbacks({
          onFPSUpdate: (fps) => {
            currentFpsEl.textContent = fps;
          }
        });

        cpuBenchmark = new CPUBenchmark();

        progressText.textContent = '正在同时运行 GPU 和 CPU 测试...';

        const [gpuResults, cpuResults] = await Promise.all([
          benchmark.runAllTests((progress) => {
            const gpuProgress = progress.progress / 2;
            progressFill.style.width = `${gpuProgress}%`;
          }),
          cpuBenchmark.runAllTests((progress) => {
            const cpuProgress = 50 + progress.progress / 2;
            progressFill.style.width = `${cpuProgress}%`;
            if (progress.currentTest) {
              progressText.textContent = `CPU 测试: ${progress.currentTest}...`;
            }
          })
        ]);

        progressFill.style.width = '100%';
        progressText.textContent = '综合测试完成!';

        // 合并结果
        const combinedResults = {
          results: [
            ...gpuResults.results.map(r => ({ ...r, category: 'GPU' })),
            ...cpuResults.results.map(r => ({ ...r, category: 'CPU' }))
          ],
          totalScore: gpuResults.totalScore + cpuResults.totalScore,
          gpuScore: gpuResults.totalScore,
          cpuScore: cpuResults.totalScore
        };

        // 显示结果
        displayResults(combinedResults, 'combined');
      }

    } catch (error) {
      console.error('测试失败:', error);
      progressText.textContent = `测试失败: ${error.message}`;
      progressFill.style.width = '0%';
    } finally {
      // 恢复 UI 状态
      startBtn.disabled = false;
      stopBtn.disabled = true;
      testOverlay.classList.add('hidden');
      cpuTestStatus.classList.add('hidden');
    }
  }

  // 运行单个 GPU 测试
  async function runSingleGPUTest(type) {
    switch (type) {
      case 'volume-low':
        return await benchmark.runVolumeShaderTest(5000, 8, 1000, 8.0, 1.0);
      case 'volume-med':
        return await benchmark.runVolumeShaderTest(5000, 10, 1500, 10.0, 1.2);
      case 'volume-high':
        return await benchmark.runVolumeShaderTest(5000, 12, 2000, 12.0, 1.5);
      default:
        throw new Error('未知的测试类型: ' + type);
    }
  }

  // 停止测试
  function stopBenchmark() {
    if (benchmark) {
      benchmark.stop();
    }
    if (cpuBenchmark) {
      cpuBenchmark.stop();
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    progressText.textContent = '测试已取消';
  }

  // 显示结果
  function displayResults(results, mode) {
    const totalScore = results.totalScore;

    let rating;
    if (mode === 'cpu') {
      rating = CPUBenchmark.getRating(totalScore);
    } else {
      rating = GPUBenchmark.getRating(totalScore);
    }

    totalScoreEl.textContent = totalScore.toLocaleString();
    scoreRatingEl.textContent = rating.text;
    scoreRatingEl.className = `score-rating ${rating.class}`;

    // 清空并填充详细结果
    detailedResultsEl.innerHTML = '';

    results.results.forEach(result => {
      const card = document.createElement('div');
      card.className = 'detail-card';

      let content = `<h4>${result.name}</h4>`;
      content += `<div class="detail-score">${result.score.toLocaleString()}</div>`;

      if (mode === 'gpu' || (mode === 'combined' && result.category === 'GPU')) {
        // GPU 测试显示 FPS
        content += `<div class="detail-fps">平均 FPS: ${result.fps.toFixed(1)}</div>`;
        if (result.particleCount) {
          content += `<div class="detail-fps">粒子数: ${result.particleCount.toLocaleString()}</div>`;
        }
      } else {
        // CPU 测试显示运算速度
        content += `<div class="detail-ops">运算速度: ${result.opsPerSecond.toLocaleString()} ops/s</div>`;
        if (result.totalTime) {
          content += `<div class="detail-extra">总耗时: ${result.totalTime}</div>`;
        }
      }

      card.innerHTML = content;
      detailedResultsEl.appendChild(card);
    });

    // 综合测试显示分类汇总
    if (mode === 'combined') {
      const summaryCard = document.createElement('div');
      summaryCard.className = 'detail-card';
      summaryCard.style.gridColumn = '1 / -1';
      summaryCard.style.background = 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(255, 107, 107, 0.1))';
      summaryCard.innerHTML = `
        <h4>📊 测试汇总</h4>
        <div class="detail-score" style="background: linear-gradient(90deg, #00d4ff, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          GPU: ${results.gpuScore.toLocaleString()} | CPU: ${results.cpuScore.toLocaleString()}
        </div>
        <div class="detail-fps">综合总分: ${totalScore.toLocaleString()}</div>
      `;
      detailedResultsEl.insertBefore(summaryCard, detailedResultsEl.firstChild);
    }

    resultsSection.classList.remove('hidden');

    // 保存到历史记录
    saveToHistory(results, mode);
  }

  // 保存到历史记录
  function saveToHistory(results, mode) {
    const storageKey = mode === 'cpu' ? 'cpu-benchmark-history' :
                       mode === 'combined' ? 'combined-benchmark-history' :
                       'gpu-benchmark-history';

    let history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    const entry = {
      date: new Date().toISOString(),
      score: results.totalScore,
      mode: mode,
      gpu: gpuNameEl.textContent,
      cpu: `${cpuVendorEl.textContent} (${cpuCoresEl.textContent})`,
      results: results.results
    };

    if (mode === 'combined') {
      entry.gpuScore = results.gpuScore;
      entry.cpuScore = results.cpuScore;
    }

    history.unshift(entry);

    // 只保留最近 20 条
    if (history.length > 20) {
      history = history.slice(0, 20);
    }

    localStorage.setItem(storageKey, JSON.stringify(history));
    loadHistory();
  }

  // 加载历史记录
  function loadHistory() {
    // 根据当前模式加载对应的历史记录
    let storageKey;
    if (currentMode === 'cpu') {
      storageKey = 'cpu-benchmark-history';
    } else if (currentMode === 'combined') {
      storageKey = 'combined-benchmark-history';
    } else {
      storageKey = 'gpu-benchmark-history';
    }

    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (history.length === 0) {
      historyListEl.innerHTML = '<p class="empty-message">暂无记录</p>';
      return;
    }

    historyListEl.innerHTML = '';

    history.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const date = new Date(entry.date);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      let infoText = '';
      if (entry.mode === 'gpu') {
        infoText = entry.gpu;
      } else if (entry.mode === 'cpu') {
        infoText = entry.cpu;
      } else {
        infoText = `${entry.gpu} + ${entry.cpu}`;
      }

      item.innerHTML = `
        <div>
          <div class="history-date">${dateStr}</div>
          <div style="font-size: 0.85rem; color: #888;">${infoText}</div>
        </div>
        <div class="history-score">${entry.score.toLocaleString()}</div>
      `;

      historyListEl.appendChild(item);
    });
  }

  // 清空历史记录
  function clearHistory() {
    const storageKey = currentMode === 'cpu' ? 'cpu-benchmark-history' :
                       currentMode === 'combined' ? 'combined-benchmark-history' :
                       'gpu-benchmark-history';

    localStorage.removeItem(storageKey);
    loadHistory();
  }

  // 保存结果
  function saveResults() {
    const storageKey = currentMode === 'cpu' ? 'cpu-benchmark-history' :
                       currentMode === 'combined' ? 'combined-benchmark-history' :
                       'gpu-benchmark-history';

    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (history.length === 0) {
      alert('没有可保存的结果');
      return;
    }

    const latest = history[0];
    const data = {
      timestamp: latest.date,
      totalScore: latest.score,
      mode: latest.mode,
      gpu: latest.gpu,
      cpu: latest.cpu,
      results: latest.results,
      userAgent: navigator.userAgent
    };

    if (latest.mode === 'combined') {
      data.gpuScore = latest.gpuScore;
      data.cpuScore = latest.cpuScore;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const prefix = latest.mode === 'combined' ? 'combined' : latest.mode;
    a.download = `${prefix}-benchmark-${new Date().toISOString().slice(0, 10)}.json`;

    a.click();
    URL.revokeObjectURL(url);
  }

  // 分享结果
  function shareResults() {
    const storageKey = currentMode === 'cpu' ? 'cpu-benchmark-history' :
                       currentMode === 'combined' ? 'combined-benchmark-history' :
                       'gpu-benchmark-history';

    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (history.length === 0) {
      alert('没有可分享的结果');
      return;
    }

    const latest = history[0];
    let rating;

    if (latest.mode === 'cpu') {
      rating = CPUBenchmark.getRating(latest.score);
    } else {
      rating = GPUBenchmark.getRating(latest.score);
    }

    let text = '';
    if (latest.mode === 'gpu') {
      text = `我的 GPU 跑分结果：${latest.score.toLocaleString()} 分 (${rating.text})
显卡: ${latest.gpu}
测试日期: ${new Date(latest.date).toLocaleString()}`;
    } else if (latest.mode === 'cpu') {
      text = `我的 CPU 跑分结果：${latest.score.toLocaleString()} 分 (${rating.text})
处理器: ${latest.cpu}
测试日期: ${new Date(latest.date).toLocaleString()}`;
    } else {
      text = `我的综合跑分结果：${latest.score.toLocaleString()} 分 (${rating.text})
GPU: ${latest.gpuScore.toLocaleString()} 分
CPU: ${latest.cpuScore.toLocaleString()} 分
测试日期: ${new Date(latest.date).toLocaleString()}`;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('结果已复制到剪贴板');
      }).catch(() => {
        prompt('复制以下文本分享:', text);
      });
    } else {
      prompt('复制以下文本分享:', text);
    }
  }

  // 事件监听器
  gpuModeBtn.addEventListener('click', () => switchMode('gpu'));
  cpuModeBtn.addEventListener('click', () => switchMode('cpu'));
  combinedModeBtn.addEventListener('click', () => switchMode('combined'));
  startBtn.addEventListener('click', startBenchmark);
  stopBtn.addEventListener('click', stopBenchmark);
  saveBtn.addEventListener('click', saveResults);
  shareBtn.addEventListener('click', shareResults);
  clearHistoryBtn.addEventListener('click', clearHistory);

  // 初始化
  initGPUInfo();
  initCPUInfo();
  loadHistory();
});
