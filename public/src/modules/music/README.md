# Music 模块文档

音乐房间功能模块，按功能拆分为多个子模块以提高可维护性。

## 模块结构

### 主模块
- `music.js` - 主入口模块，负责初始化和协调各个子模块

### 子模块
- `state.js` - 状态管理模块
  - 存储所有全局状态（房间ID、播放列表、当前歌曲等）
  - 提供工具函数（格式化时间等）

- `ui.js` - UI 更新模块
  - 更新房间 UI
  - 更新播放列表
  - 显示搜索结果
  - 处理页面背景
  - 管理播放覆盖层

- `lyrics.js` - 歌词处理模块
  - 获取歌词
  - 解析 LRC 格式歌词
  - 显示歌词
  - 同步歌词高亮和滚动

- `search.js` - 音乐搜索模块
  - 搜索音乐
  - 显示搜索结果
  - 处理分页
  - 添加歌曲到播放列表

- `chat.js` - 聊天模块
  - 发送聊天消息
  - 显示聊天消息
  - 处理系统消息

- `volume.js` - 音量控制模块
  - 初始化音量控制
  - 调节音量
  - 静音/取消静音
  - 本地存储音量设置

- `socket.js` - Socket 事件处理模块
  - 处理播放事件
  - 处理暂停事件
  - 处理房间更新事件
  - 处理聊天事件
  - 处理播放列表更新事件
  - 处理投票更新事件

## 依赖关系

```
music.js (主模块)
├── alerts
├── music/state
├── music/ui
│   ├── music/state
│   └── alerts
├── music/lyrics
│   └── music/state
├── music/search
│   ├── alerts
│   ├── music/state
│   └── music/ui
├── music/chat
├── music/volume
│   └── music/state
└── music/socket
    ├── music/state
    ├── music/ui
    └── music/chat
```

## 使用说明

所有模块通过 RequireJS 的 `define()` 函数定义，并返回一个包含公开 API 的对象。

### 主模块 API

- `Music.init()` - 初始化音乐房间
- `Music.removeListeners()` - 移除所有事件监听器
- `Music.showPlayOverlay()` - 显示播放覆盖层
- `Music.hidePlayOverlay()` - 隐藏播放覆盖层

### 子模块 API

每个子模块都有其特定的 API，详见各模块的源代码注释。

## 注意事项

1. 所有状态都通过 `state.js` 模块管理，其他模块通过依赖注入访问
2. Socket 事件监听在 `socket.js` 模块中统一管理
3. UI 更新操作集中在 `ui.js` 模块中
4. 模块间通信通过共享的 `state` 对象进行

## 开发建议

- 添加新功能时，考虑将其拆分为新的子模块
- 遵循单一职责原则，每个模块只负责一个功能领域
- 保持模块间的低耦合，通过依赖注入传递必要的模块
