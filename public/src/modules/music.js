define('music', [
	'bootbox',
	'alerts',
], function (bootbox, alerts) {
	const Music = {};

	let currentRoomId = null;
	let isHost = false;
	let playlist = [];
	let currentTrackIndex = -1;

	Music.init = function () {
		// 检查是否在音乐页面
		const isMusicRoomsPage = $('#create-music-room').length > 0;
		const isMusicRoomPage = $('.music-room-container').length > 0;
		// console.log(isMusicRoomPage,isMusicRoomsPage);

		if (!isMusicRoomsPage && !isMusicRoomPage) {
			return;
		}

		// 先移除旧的事件监听器
		Music.removeListeners();

		if (isMusicRoomsPage) {
			setupRoomList();
		}

		if (isMusicRoomPage) {
			setupRoom();
		}
	};

	Music.removeListeners = function () {
		socket.removeListener('event:music.play', onMusicPlay);
		socket.removeListener('event:music.pause', onMusicPause);
		socket.removeListener('event:music.room.update', onRoomUpdate);
		socket.removeListener('event:music.chat', onMusicChat);
	};

	function setupRoomList() {
		console.log('[Music] setupRoomList 被调用');

		if (!$('#create-music-room').length) {
			console.log('[Music] 未找到 #create-music-room 元素');
			return;
		}

		console.log('[Music] 找到创建房间按钮，开始设置事件监听');

		// 加载房间列表
		loadRooms();

		// 创建房间按钮
		$('#create-music-room').on('click', function () {
			console.log('[Music] 创建房间按钮被点击');
			$('#create-room-modal').modal('show');
		});

		// 创建房间
		$('#create-room-btn').on('click', function () {
			console.log('[Music] 创建按钮被点击');
			const roomName = $('#room-name').val().trim();
			console.log('[Music] 房间名称:', roomName);

			if (!roomName) {
				alerts.alert({
					title: '错误',
					message: '请输入房间名称',
					type: 'error',
				});
				return;
			}

			// 生成房间ID
			const roomId = 'room-' + Date.now();
			console.log('[Music] 生成房间ID:', roomId);

			// 添加房间描述（可选）
			const roomDescription = $('#room-description').val().trim();
			console.log('[Music] 房间描述:', roomDescription);

			// 重定向到房间页面
			console.log('[Music] 即将重定向到:', '/music/' + roomId);
			ajaxify.go('/music/' + roomId);

			$('#create-room-modal').modal('hide');
		});

		// 加入房间
		$(document).on('click', '.join-room-btn', function () {
			const roomId = $(this).data('room-id');
			ajaxify.go('/music/' + roomId);
		});

		// 定时刷新房间列表
		setInterval(loadRooms, 30000);
	}

	async function loadRooms() {
		try {
			const response = await socket.emit('modules.music.getRooms');
			updateRoomsList(response.rooms);
		} catch (err) {
			console.error('Failed to load rooms:', err);
		}
	}

	function updateRoomsList(rooms) {
		const container = $('#rooms-list');

		if (!rooms || rooms.length === 0) {
			container.html(`
				<div class="text-center text-muted py-5">
					<i class="fa fa-music fa-3x mb-3"></i>
					<p>暂无活跃房间，创建一个开始吧！</p>
				</div>
			`);
			return;
		}

		let html = '';
		rooms.forEach(function (room) {
			html += `
				<div class="card room-item mb-2">
					<div class="card-body">
						<div class="d-flex justify-content-between align-items-center">
							<div>
								<h6 class="mb-1">房间 #${room.roomId}</h6>
								<p class="text-sm text-muted mb-1">
									${room.currentTrack ? room.currentTrack.name : '未播放'}
								</p>
								<div class="text-sm">
									<i class="fa fa-users"></i> ${room.listeners} 人在听
									${room.isPlaying ? '<span class="badge bg-success ms-2">播放中</span>' : ''}
								</div>
							</div>
							<button class="btn btn-primary btn-sm join-room-btn" data-room-id="${room.roomId}">
								加入
							</button>
						</div>
					</div>
				</div>
			`;
		});

		container.html(html);
	}

	function setupRoom() {
		if (!$('.music-room-container').length) {
			return;
		}

		// 从URL获取房间ID
		const pathParts = window.location.pathname.split('/');
		if (pathParts.length >= 3) {
			currentRoomId = pathParts[2];
			joinRoom(currentRoomId);
		}

		// 播放控制
		$('#play-btn').on('click', togglePlay);
		$('#prev-btn').on('click', prevTrack);
		$('#next-btn').on('click', nextTrack);

		// 添加音乐
		$('#add-track-btn').on('click', addTrack);
		$('#music-url-input').on('keypress', function (e) {
			if (e.which === 13) {
				addTrack();
			}
		});

		// 发送聊天消息
		$('#send-chat-btn').on('click', sendChatMessage);
		$('#chat-input').on('keypress', function (e) {
			if (e.which === 13) {
				sendChatMessage();
			}
		});

		// 设置Socket事件监听
		setupSocketEvents();
	}

	async function joinRoom(roomId) {
		try {
			const response = await socket.emit('modules.music.joinRoom', { roomId: roomId });
			isHost = response.room.isHost;
			currentRoomId = roomId;
			updateRoomUI(response.room);
		} catch (err) {
			console.error('Failed to join room:', err);
			alerts.alert({
				title: '错误',
				message: err.message || '加入房间失败',
				type: 'error',
			});
		}
	}

	function updateRoomUI(room) {
		$('#listener-count').text(room.listeners);

		if (room.currentTrack) {
			$('#track-name').text(room.currentTrack.name);
			$('#track-artist').text(room.currentTrack.artist || '-');

			if (room.currentTrack.cover) {
				$('#album-cover').html(`<img src="${room.currentTrack.cover}" alt="专辑封面" style="width: 100%; height: 100%; object-fit: cover;">`);
			}

			// 更新播放按钮状态
			const playBtn = $('#play-btn');
			if (room.isPlaying) {
				playBtn.html('<i class="fa fa-pause"></i>');
				playBtn.removeClass('btn-primary').addClass('btn-outline-primary');
			} else {
				playBtn.html('<i class="fa fa-play"></i>');
				playBtn.removeClass('btn-outline-primary').addClass('btn-primary');
			}

			// 更新进度
			if (room.currentTime) {
				$('#current-time').text(formatTime(room.currentTime));
			}
		}

		// 更新房主状态
		if (isHost) {
			$('#play-btn').prop('disabled', false);
			$('#prev-btn').prop('disabled', false);
			$('#next-btn').prop('disabled', false);
		} else {
			$('#play-btn').prop('disabled', true);
			$('#prev-btn').prop('disabled', true);
			$('#next-btn').prop('disabled', true);
		}
	}

	function onMusicPlay(data) {
		if (data.track) {
			currentTrackIndex = playlist.findIndex(t => t.id === data.track.id);
			updateRoomUI({
				currentTrack: data.track,
				isPlaying: true,
				currentTime: data.currentTime,
			});
		}
	}

	function onMusicPause(data) {
		updateRoomUI({
			currentTrack: getCurrentTrack(),
			isPlaying: false,
			currentTime: data.currentTime,
		});
	}

	function onRoomUpdate(data) {
		if (data.room) {
			updateRoomUI(data.room);
		}
	}

	function onMusicChat(data) {
		addChatMessage(data.message, data.isOwn);
	}

	function setupSocketEvents() {
		socket.on('event:music.play', onMusicPlay);
		socket.on('event:music.pause', onMusicPause);
		socket.on('event:music.room.update', onRoomUpdate);
		socket.on('event:music.chat', onMusicChat);
	}

	async function togglePlay() {
		if (!isHost) return;

		try {
			if (isPlaying()) {
				await socket.emit('modules.music.pause', { roomId: currentRoomId });
			} else {
				const track = getCurrentTrack();
				if (track) {
					await socket.emit('modules.music.play', { roomId: currentRoomId, track: track });
				}
			}
		} catch (err) {
			console.error('Failed to toggle play:', err);
		}
	}

	function isPlaying() {
		return $('#play-btn').find('i').hasClass('fa-pause');
	}

	async function prevTrack() {
		if (!isHost || playlist.length === 0) return;

		if (currentTrackIndex > 0) {
			currentTrackIndex--;
			const track = playlist[currentTrackIndex];
			try {
				await socket.emit('modules.music.play', { roomId: currentRoomId, track: track });
			} catch (err) {
				console.error('Failed to play prev track:', err);
			}
		}
	}

	async function nextTrack() {
		if (!isHost || playlist.length === 0) return;

		if (currentTrackIndex < playlist.length - 1) {
			currentTrackIndex++;
			const track = playlist[currentTrackIndex];
			try {
				await socket.emit('modules.music.play', { roomId: currentRoomId, track: track });
			} catch (err) {
				console.error('Failed to play next track:', err);
			}
		}
	}

	function addTrack() {
		const url = $('#music-url-input').val().trim();
		if (!url) return;

		// 解析音乐链接
		const track = parseMusicUrl(url);
		if (track) {
			playlist.push(track);
			updatePlaylistUI();
			$('#music-url-input').val('');

			// 如果是房主且列表为空，自动播放
			if (isHost && playlist.length === 1) {
				currentTrackIndex = 0;
				socket.emit('modules.music.play', { roomId: currentRoomId, track: track }).catch(err => {
					console.error('Failed to play track:', err);
				});
			}
		} else {
			alerts.alert({
				title: '错误',
				message: '不支持的音乐链接格式',
				type: 'error',
			});
		}
	}

	function parseMusicUrl(url) {
		// 简单的音乐链接解析（实际项目中应该对接音乐平台API）
		let name = '未知歌曲';
		let artist = '未知艺人';
		let cover = null;

		if (url.includes('music.163.com')) {
			// 网易云音乐
			name = '网易云音乐';
			cover = 'https://p2.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg';
		} else if (url.includes('y.qq.com')) {
			// QQ音乐
			name = 'QQ音乐';
			cover = 'https://y.qq.com/music/common/upload/t_music_splash/logo.png';
		} else {
			name = '外部音乐';
		}

		return {
			id: 'track-' + Date.now(),
			name: name,
			artist: artist,
			cover: cover,
			url: url,
		};
	}

	function updatePlaylistUI() {
		const container = $('#playlist');

		if (playlist.length === 0) {
			container.html(`
				<div class="text-center text-muted py-4">
					<i class="fa fa-list fa-2x mb-2"></i>
					<p>播放列表为空</p>
					<p class="text-sm">添加音乐链接开始听歌</p>
				</div>
			`);
			return;
		}

		let html = '';
		playlist.forEach(function (track, index) {
			const active = index === currentTrackIndex;
			html += `
				<div class="list-group-item ${active ? 'active' : ''}" data-index="${index}">
					<div class="d-flex align-items-center">
						<div class="me-3">
							${active ? '<i class="fa fa-play"></i>' : '<span class="text-muted">' + (index + 1) + '</span>'}
						</div>
						<div class="flex-grow-1">
							<div>${track.name}</div>
							<div class="text-sm ${active ? 'text-light' : 'text-muted'}">${track.artist || '-'}</div>
						</div>
						${isHost ? `<button class="btn btn-sm btn-outline-danger remove-track-btn" data-index="${index}"><i class="fa fa-times"></i></button>` : ''}
					</div>
				</div>
			`;
		});

		container.html(html);

		// 删除歌曲按钮
		$('.remove-track-btn').on('click', function () {
			if (!isHost) return;
			const index = $(this).data('index');
			playlist.splice(index, 1);
			if (currentTrackIndex >= index) {
				currentTrackIndex--;
			}
			updatePlaylistUI();
		});
	}

	function sendChatMessage() {
		const input = $('#chat-input');
		const message = input.val().trim();
		if (!message) return;

		// 添加到聊天界面
		addChatMessage({
			username: app.user.username,
			uid: app.user.uid,
			content: message,
			timestamp: Date.now(),
		}, true);

		input.val('');

		// 广播到房间（这里简化处理，实际应该通过Socket发送）
		// socket.emit('modules.music.sendChat', { roomId: currentRoomId, message: message });
	}

	function addChatMessage(message, isOwn) {
		const container = $('#chat-messages');

		// 移除占位符
		container.find('.text-center.text-muted').remove();

		const time = new Date(message.timestamp).toLocaleTimeString();
		const html = `
			<div class="chat-message ${isOwn ? 'own' : ''} mb-2">
				<div class="d-flex ${isOwn ? 'flex-row-reverse' : ''}">
					<div class="mx-2">
						<img src="${message.picture || '/assets/images/default-avatar.png'}" class="rounded-circle" style="width: 32px; height: 32px;">
					</div>
					<div>
						<div class="text-sm ${isOwn ? 'text-end' : ''} text-muted">
							<strong>${message.username}</strong> <span class="ms-2">${time}</span>
						</div>
						<div class="message-content ${isOwn ? 'bg-primary text-white' : 'bg-light'} p-2 rounded">
							${message.content}
						</div>
					</div>
				</div>
			</div>
		`;

		container.append(html);
		container.scrollTop(container[0].scrollHeight);
	}

	function getCurrentTrack() {
		if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
			return playlist[currentTrackIndex];
		}
		return null;
	}

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return mins + ':' + (secs < 10 ? '0' : '') + secs;
	}

	// 监听页面跳转事件，清理事件监听器
	$(window).on('action:ajaxify.start', function () {
		Music.removeListeners();
	});

	return Music;
});
