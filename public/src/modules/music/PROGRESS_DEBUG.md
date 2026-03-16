# 进度条不更新问题修复说明

## 问题描述
点歌播放歌曲后，进度条没有实时更新，但歌曲可以正常播放。

## 问题原因
在模块拆分后，`Lyrics.onTimeUpdate` 函数只处理了歌词同步，忘记添加进度条更新逻辑。

## 解决方案

### 修改文件：`public/src/modules/music/lyrics.js`

在 `Lyrics.onTimeUpdate` 函数中添加进度条更新代码：

```javascript
// 音频时间更新时同步歌词和进度条
Lyrics.onTimeUpdate = function () {
    if (!State.audioPlayer) return;

    const currentTime = State.audioPlayer.currentTime;
    const duration = State.audioPlayer.duration;

    // 更新进度条（确保 duration 有效）
    if (duration && duration > 0 && !isNaN(duration)) {
        const progress = (currentTime / duration) * 100;
        $('#progress-bar').css('width', progress + '%');
    }
    $('#current-time').text(State.formatTime(currentTime));

    // 如果没有歌词，直接返回
    if (State.lyricsLines.length === 0) return;
    
    // ... 后续歌词处理代码
};
```

## 关键点

1. **事件监听器绑定**：在主模块中正确绑定了 `timeupdate` 事件
   ```javascript
   State.audioPlayer.addEventListener('timeupdate', Lyrics.onTimeUpdate);
   ```

2. **进度条计算**：使用 `currentTime / duration * 100` 计算百分比

3. **异常处理**：检查 `duration` 是否有效（非零且非 NaN）

4. **实时更新**：`timeupdate` 事件在音频播放时会持续触发（约每秒 4 次）

## 调试方法

如果进度条仍然不更新，可以使用以下方法调试：

### 1. 检查事件是否触发
在浏览器控制台中执行：
```javascript
// 检查 timeupdate 事件是否被监听
State.audioPlayer.getEventListeners('timeupdate')
```

### 2. 手动更新进度条
```javascript
// 手动触发更新
Lyrics.onTimeUpdate()
```

### 3. 检查音频状态
```javascript
// 检查音频播放器状态
console.log('当前时间:', State.audioPlayer.currentTime);
console.log('总时长:', State.audioPlayer.duration);
console.log('是否播放中:', !State.audioPlayer.paused);
console.log('音频源:', State.audioPlayer.src);
```

### 4. 检查进度条元素
```javascript
// 检查进度条 DOM 元素
console.log('进度条元素:', $('#progress-bar'));
console.log('当前宽度:', $('#progress-bar').css('width'));
console.log('当前时间文本:', $('#current-time').text());
```

## 可能的其他问题

### 问题 1：音频源加载失败
- **现象**：进度条不动，歌曲也不播放
- **原因**：音频 URL 无效或网络问题
- **解决**：检查网络请求和控制台错误

### 问题 2：duration 为 NaN
- **现象**：进度条显示为 0%
- **原因**：音频元数据未加载完成
- **解决**：等待 `loadedmetadata` 事件或使用默认值

### 问题 3：CSS 样式问题
- **现象**：进度条宽度已更新但看不见
- **原因**：CSS 样式被覆盖或 z-index 问题
- **解决**：检查进度条容器的样式

## 性能优化

`timeupdate` 事件触发频率较高（约每 250ms 一次），可以通过以下方式优化：

### 方案 1：使用 requestAnimationFrame
```javascript
let updateRequested = false;

Lyrics.onTimeUpdate = function () {
    if (!State.audioPlayer) return;

    if (!updateRequested) {
        updateRequested = true;
        requestAnimationFrame(() => {
            updateProgress();
            updateLyrics();
            updateRequested = false;
        });
    }
};
```

### 方案 2：节流更新
```javascript
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100; // ms

Lyrics.onTimeUpdate = function () {
    if (!State.audioPlayer) return;

    const now = Date.now();
    if (now - lastUpdateTime >= UPDATE_INTERVAL) {
        updateProgress();
        updateLyrics();
        lastUpdateTime = now;
    }
};
```

## 测试步骤

1. 播放一首歌曲
2. 观察进度条是否实时更新
3. 检查当前时间显示是否正确
4. 切换歌曲，验证进度条是否重置
5. 暂停歌曲，验证进度条是否停止更新
6. 继续播放，验证进度条是否继续更新

## 相关文件

- `public/src/modules/music/lyrics.js` - 歌词和进度条更新逻辑
- `public/src/modules/music/state.js` - 状态管理
- `public/src/modules/music.js` - 主模块，事件绑定
- `src/views/music/room.tpl` - 进度条 HTML 结构
