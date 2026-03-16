// Socket事件处理模块
define('music/socket', [
	'music/state',
	'music/ui',
	'music/chat',
	'music/users'
], function (State, UI, Chat, Users) {
	const Socket = {};

	// 存储Users模块的引用
	let usersModule = null;

	// 设置Users模块引用
	Socket.setUsersModule = function (users) {
		usersModule = users;
	};

	// 处理播放事件
	Socket.onMusicPlay = function (data) {
		if (data.track) {
			console.log('[Music] Play event received:', data.track.name, '- Current playlist length:', State.playlist.length);
			State.currentTrack = data.track;

			// 不传递播放列表，等待 playlist.update 事件
			// 注意：不要在这里调用 UI.hidePlayOverlay()，让 UI.updateRoomUI 统一处理
			// 使用 setTimeout 确保 DOM 已完全渲染
			setTimeout(function() {
				UI.updateRoomUI({
					currentTrack: data.track,
					isPlaying: true,
					currentTime: data.currentTime || 0,
					startTime: data.startTime || 0,
					listeners: $('#listener-count').text() || 0,
				});
			}, 0);
		}
	};

	// 处理暂停事件（已禁用）
	Socket.onMusicPause = function (data) {
		console.log('[Music] Pause event received, ignoring as pause is disabled');
	};

	// 处理房间更新事件
	Socket.onRoomUpdate = function (data) {
		if (data.room) {
			State.currentTrack = data.room.currentTrack;
			// 使用 setTimeout 确保 DOM 已完全渲染
			setTimeout(function() {
				UI.updateRoomUI(data.room);
			}, 0);
		}
	};

	// 处理聊天事件
	Socket.onMusicChat = function (data) {
		// 判断是否是自己的消息
		const isOwn = data.message && data.message.uid && data.message.uid === parseInt(app.user.uid, 10);
		Chat.addChatMessage(data.message, isOwn);
	};

	// 处理播放列表更新事件
	Socket.onPlaylistUpdate = function (data) {
		if (data.playlist) {
			console.log('[Music] Playlist update received:', data.playlist.length, 'tracks');
			State.playlist = data.playlist;
			State.lastPlaylistJson = JSON.stringify(State.playlist);
			// 使用 setTimeout 确保 UI 已完全初始化
			setTimeout(function() {
				UI.updatePlaylistUI();
			}, 0);
		}
	};

	// 处理投票更新事件
	Socket.onVoteUpdate = function (data) {
		const userUid = parseInt(app.user.uid, 10);

		if (data.votes && data.votes.includes(userUid)) {
			// 用户已经投过票
			$('#vote-skip-btn').prop('disabled', true)
				.addClass('btn-secondary')
				.removeClass('btn-outline-primary')
				.html(`<i class="fa fa-check me-1"></i> 已投票 (${data.currentVotes || 0}/${data.requiredVotes || 0})`);
		} else {
			// 用户还没有投票或投票已重置，恢复按钮状态
			$('#vote-skip-btn').prop('disabled', false)
				.addClass('btn-outline-primary')
				.removeClass('btn-secondary')
				.html(`<i class="fa fa-forward me-1"></i> 投票切歌 (${data.currentVotes || 0}/${data.requiredVotes || 0})`);
		}
	};

	// 处理用户列表更新事件
	Socket.onUsersUpdate = function (data) {
		if (usersModule) {
			usersModule.onUsersUpdate(data);
		}
	};

	// 设置Socket事件监听
	Socket.setupSocketEvents = function () {
		socket.on('event:music.play', Socket.onMusicPlay);
		socket.on('event:music.room.update', Socket.onRoomUpdate);
		socket.on('event:music.chat', Socket.onMusicChat);
		socket.on('event:music.playlist.update', Socket.onPlaylistUpdate);
		socket.on('event:music.vote.update', Socket.onVoteUpdate);
		socket.on('event:music.users.update', Socket.onUsersUpdate);
	};

	// 启动心跳机制
	Socket.startHeartbeat = function () {
		// 每30秒发送一次心跳
		setInterval(function () {
			if (State.currentRoomId) {
				socket.emit('modules.music.heartbeat', { roomId: State.currentRoomId }).catch(err => {
					console.error('[Music] Heartbeat failed:', err);
				});
			}
		}, 30000);
	};

	return Socket;
});
