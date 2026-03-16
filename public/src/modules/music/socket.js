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
			UI.hidePlayOverlay();

			// 不传递播放列表，等待 playlist.update 事件
			UI.updateRoomUI({
				currentTrack: data.track,
				isPlaying: true,
				currentTime: data.currentTime || 0,
				startTime: data.startTime || 0,
				listeners: $('#listener-count').text() || 0,
			});
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
			UI.updateRoomUI(data.room);
		}
	};

	// 处理聊天事件
	Socket.onMusicChat = function (data) {
		Chat.addChatMessage(data.message, data.isOwn);
	};

	// 处理播放列表更新事件
	Socket.onPlaylistUpdate = function (data) {
		if (data.playlist) {
			console.log('[Music] Playlist update received:', data.playlist.length, 'tracks');
			State.playlist = data.playlist;
			State.lastPlaylistJson = JSON.stringify(State.playlist);
			UI.updatePlaylistUI();
		}
	};

	// 处理投票更新事件
	Socket.onVoteUpdate = function (data) {
		if (data.votes.includes(parseInt(app.user.uid, 10))) {
			$('#vote-skip-btn').prop('disabled', true).addClass('btn-secondary').removeClass('btn-outline-primary').html('<i class="fa fa-check me-1"></i> 已投票');
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
