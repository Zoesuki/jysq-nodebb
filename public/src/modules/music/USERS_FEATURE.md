# 房间用户列表功能说明

## 功能描述
在收听人数左侧添加 hover 显示，展示当前房间的用户列表，并且随着用户进出实时更新。

## 功能特性

### 1. Hover 显示
- 鼠标悬停在"X 人正在收听"上时，显示用户列表弹出框
- 弹出框显示房间内所有用户
- 包含用户头像、用户名、房主标识、"你"标识

### 2. 实时更新
- 用户加入房间时，列表自动刷新
- 用户离开房间时，列表自动刷新
- 如果弹出框当前显示，会自动获取最新用户列表

### 3. 用户体验优化
- 300ms 延迟隐藏，给用户时间移动鼠标到弹出框
- 点击其他地方自动关闭弹出框
- 支持滚动查看更多用户
- 优雅的动画效果

## 实现细节

### 后端修改

#### 1. 新增 `getRoomUsers` 接口
**文件：** `src/socket.io/music.js`

```javascript
Music.getRoomUsers = async function (socket, data) {
	const { roomId } = data;
	const room = musicRooms.get(roomId);

	// 获取唯一的用户 ID 列表
	const uniqueUids = _.uniqBy(room.listeners, 'uid').map(l => l.uid);

	// 获取用户详细信息
	const user = require('../user');
	const usersData = await Promise.all(uniqueUids.map(async (uid) => {
		const userData = await user.getUserFields(uid, ['username', 'picture', 'uid']);
		return {
			uid: userData.uid,
			username: userData.username,
			picture: userData.picture || '/assets/images/default-avatar.png',
			isHost: userData.uid === room.hostId,
			isYou: userData.uid === socket.uid
		};
	}));

	return { users: usersData, total: usersData.length };
};
```

#### 2. 用户列表更新事件
在 `joinRoom` 和 `leaveRoom` 中添加用户列表更新事件：

```javascript
io.to(`music_room_${roomId}`).emit('event:music.users.update');
```

### 前端修改

#### 1. HTML 结构
**文件：** `src/views/music/room.tpl`

```html
<div class="track-info mb-4 position-relative">
	<h2 id="track-name" class="fw-bold mb-1">未播放</h2>
	<p id="track-artist" class="text-muted lead mb-2">-</p>
	<div id="room-info" class="badge rounded-pill bg-light text-dark px-3 py-2 shadow-sm cursor-pointer">
		<i class="fa fa-users text-primary me-2"></i>
		<span id="listener-count" class="fw-bold">0</span> 人正在收听
	</div>
	<!-- 用户列表弹出框 -->
	<div id="room-users-popover" class="room-users-popover shadow-lg rounded-3" style="display: none;">
		<div class="room-users-popover-header">
			<span class="fw-bold"><i class="fa fa-users me-2"></i>房间用户</span>
			<button class="close-popover">×</button>
		</div>
		<div class="room-users-popover-body">
			<div id="room-users-list" class="room-users-list"></div>
		</div>
	</div>
</div>
```

#### 2. CSS 样式
添加弹出框样式、用户列表项样式、滚动条样式等

#### 3. 新增 `users.js` 模块
**文件：** `public/src/modules/music/users.js`

主要功能：
- `fetchRoomUsers()` - 获取房间用户列表
- `renderRoomUsers()` - 渲染用户列表
- `init()` - 初始化 hover 事件监听

#### 4. 状态管理
**文件：** `public/src/modules/music/state.js`

添加：
```javascript
roomUsers: [],  // 存储房间用户列表
```

#### 5. Socket 事件
**文件：** `public/src/modules/music/socket.js`

添加用户列表更新事件监听：
```javascript
socket.on('event:music.users.update', Socket.onUsersUpdate);
```

#### 6. 主模块更新
**文件：** `public/src/modules/music/music.js`

- 引入 `music/users` 模块
- 在 `setupRoom()` 中调用 `Users.init()`
- 在 `removeListeners()` 中移除事件监听

## 数据结构

### 用户对象
```javascript
{
	uid: number,           // 用户 ID
	username: string,     // 用户名
	picture: string,       // 头像 URL
	isHost: boolean,       // 是否是房主
	isYou: boolean         // 是否是当前用户
}
```

## 事件流程

### 1. 用户加入房间
```
用户 A 加入房间
  ↓
joinRoom() 处理
  ↓
发送 event:music.room.update（更新人数）
  ↓
发送 event:music.users.update（通知用户列表更新）
  ↓
客户端接收事件
  ↓
如果弹出框显示，调用 fetchRoomUsers() 刷新列表
```

### 2. 用户离开房间
```
用户 A 离开房间
  ↓
leaveRoom() 处理
  ↓
发送 event:music.room.update（更新人数）
  ↓
发送 event:music.users.update（通知用户列表更新）
  ↓
客户端接收事件
  ↓
如果弹出框显示，调用 fetchRoomUsers() 刷新列表
```

### 3. Hover 显示用户列表
```
鼠标悬停在收听人数上
  ↓
调用 fetchRoomUsers()
  ↓
显示弹出框
  ↓
渲染用户列表
```

## 使用说明

### 查看房间用户
1. 将鼠标悬停在"X 人正在收听"上
2. 等待弹出框显示
3. 查看房间内所有用户

### 关闭弹出框
1. 将鼠标移出弹出框
2. 等待 300ms 后自动关闭
3. 或点击页面其他地方立即关闭

## 测试用例

### 功能测试
- [ ] Hover 能正确显示用户列表
- [ ] 用户列表显示正确的用户信息
- [ ] 房主标识正确显示
- [ ] "你"标识正确显示
- [ ] 弹出框能正确关闭
- [ ] 点击其他地方能关闭弹出框

### 实时更新测试
- [ ] 新用户加入时，弹出框内列表自动刷新
- [ ] 用户离开时，弹出框内列表自动刷新
- [ ] 房主转移时，房主标识自动更新
- [ ] 收听人数正确更新

### 边界情况测试
- [ ] 房间没有用户时，显示"房间里没有用户"
- [ ] 用户头像加载失败时，显示默认头像或首字母
- [ ] 用户名过长时，正确截断显示
- [ ] 用户列表超过弹出框高度时，能正常滚动

### 性能测试
- [ ] 用户列表获取响应时间 < 500ms
- [ ] 弹出框显示无卡顿
- [ ] 鼠标移动流畅，无闪烁
- [ ] 实时更新不影响歌曲播放

## 注意事项

1. **性能优化**：只在弹出框显示时才获取用户列表
2. **去重处理**：后端使用 `_.uniqBy` 确保用户唯一
3. **错误处理**：用户信息获取失败时使用默认值
4. **用户体验**：300ms 延迟避免鼠标移动时闪烁
5. **事件节流**：避免频繁请求用户列表

## 未来优化

1. **在线状态**：添加用户在线/离线状态指示
2. **用户交互**：支持点击用户查看资料
3. **搜索功能**：支持在用户列表中搜索用户
4. **排序选项**：支持按加入时间、房主等排序
5. **分页显示**：大量用户时支持分页
