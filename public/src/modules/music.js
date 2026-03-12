// 全局变量，标记cookie是否已设置
let isCookieSet = false;

define('music', [
	'alerts',
], function (alerts) {
	const Music = {};

	let currentRoomId = null;
	let isHost = false;
	let playlist = [];
	let currentTrackIndex = -1;
	let audioPlayer = null;
	let lyricsLines = [];

	Music.init = function () {
		// 检查是否在音乐页面
		const isMusicRoomsPage = $('#create-music-room').length > 0;
		const isMusicRoomPage = $('.music-room-container').length > 0;

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
		if (!$('#create-music-room').length) {
			return;
		}

		// 加载房间列表
		loadRooms();

		// 创建房间按钮
		$('#create-music-room').on('click', function () {
			$('#create-room-modal').modal('show');
		});

		// 创建房间
		$('#create-room-btn').on('click', function () {
			const roomName = $('#room-name').val().trim();
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

		// 初始化音频播放器
		audioPlayer = document.getElementById('audio-player');
		if (!audioPlayer) {
			console.error('Audio player element not found');
		} else {
			// 音频播放事件
			audioPlayer.addEventListener('timeupdate', onTimeUpdate);
			audioPlayer.addEventListener('ended', onTrackEnded);
			audioPlayer.addEventListener('loadedmetadata', onMetadataLoaded);
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

		// 搜索音乐
		$('#search-track-btn').on('click', searchMusic);
		$('#music-search-input').on('keypress', function (e) {
			if (e.which === 13) {
				searchMusic();
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
			// 先设置QQ音乐Cookie（只设置一次）
			if (!isCookieSet) {
				try {
					await fetch('/api/music/cookie/3816852108', {
						credentials: 'include',
					});
					console.log('[Music] QQMusic cookie set successfully');
					isCookieSet = true;
				} catch (err) {
					console.warn('[Music] Failed to set QQMusic cookie:', err);
				}
			}

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
				$('#album-cover').html(`<img src="${room.currentTrack.cover}" alt="专辑封面">`);
			} else {
				$('#album-cover').html(`<i class="fa fa-music fa-5x"></i>`);
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
			playTrack(data.track);
			updateRoomUI({
				currentTrack: data.track,
				isPlaying: true,
				currentTime: data.currentTime,
			});
		}
	}

	function onMusicPause(data) {
		if (audioPlayer) {
			audioPlayer.pause();
		}
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
			if (audioPlayer && audioPlayer.src) {
				if (audioPlayer.paused) {
					audioPlayer.play();
					// 同步播放状态到服务器
					socket.emit('modules.music.play', { roomId: currentRoomId, track: getCurrentTrack() }).catch(err => {
						console.error('Failed to sync play:', err);
					});
				} else {
					audioPlayer.pause();
					// 同步暂停状态到服务器
					socket.emit('modules.music.pause', { roomId: currentRoomId }).catch(err => {
						console.error('Failed to sync pause:', err);
					});
				}
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

	// 播放歌曲
	function playTrack(track) {
		if (!audioPlayer || !track || !track.url) {
			console.error('Invalid track or audio player');
			return;
		}

		audioPlayer.src = track.url;
		audioPlayer.play().catch(err => {
			console.error('Failed to play audio:', err);
		});

		// 更新专辑封面
		if (track.cover) {
			$('#album-cover').html(`<img src="${track.cover}" alt="专辑封面">`);
		} else {
			$('#album-cover').html(`<i class="fa fa-music fa-5x"></i>`);
		}

		// 获取歌词
		fetchLyrics(track.id);

		// 更新播放按钮状态
		const playBtn = $('#play-btn');
		playBtn.html('<i class="fa fa-pause"></i>');
		playBtn.removeClass('btn-primary').addClass('btn-outline-primary');
	}

	// 获取歌词
	async function fetchLyrics(songId) {
		try {
			const response = await fetch(`/api/music/lyric/${songId}`, {
				credentials: 'include',
			});
			const data = await response.json();

			if (data.result === 100 && data.data && data.data.lyric) {
				parseLyrics(data.data.lyric);
			} else {
				$('#lyrics-container').html(`
					<div class="text-muted">
						<p>暂无歌词</p>
					</div>
				`);
			}
		} catch (err) {
			console.error('Failed to fetch lyrics:', err);
		}
	}

	// 解析歌词
	function parseLyrics(lrcText) {
		if (!lrcText) {
			$('#lyrics-container').html(`
				<div class="text-muted">
					<p>暂无歌词</p>
				</div>
			`);
			return;
		}

		const lines = lrcText.split('\n');
		lyricsLines = [];

		for (const line of lines) {
			const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
			if (match) {
				const minutes = parseInt(match[1]);
				const seconds = parseInt(match[2]);
				const milliseconds = parseInt(match[3]);
				const time = minutes * 60 + seconds + milliseconds / 1000;
				const text = match[4].trim();
				if (text) {
					lyricsLines.push({ time, text });
				}
			}
		}

		displayLyrics();
	}

	// 显示歌词
	function displayLyrics() {
		const container = $('#lyrics-container');

		if (lyricsLines.length === 0) {
			container.html(`
				<div class="text-muted">
					<p>暂无歌词</p>
				</div>
			`);
			return;
		}

		let html = '';
		for (let i = 0; i < lyricsLines.length; i++) {
			html += `<p class="lyric-line" data-time="${lyricsLines[i].time}" data-index="${i}">${lyricsLines[i].text}</p>`;
		}
		container.html(html);
	}

	// 音频时间更新事件
	function onTimeUpdate() {
		if (!audioPlayer) return;

		const currentTime = audioPlayer.currentTime;

		// 更新进度条
		const progress = (currentTime / audioPlayer.duration) * 100 || 0;
		$('#progress-bar').css('width', progress + '%');
		$('#current-time').text(formatTime(currentTime));

		// 如果没有歌词，直接返回
		if (lyricsLines.length === 0) return;

		let activeIndex = -1;

		// 找到当前时间对应的歌词行
		for (let i = 0; i < lyricsLines.length; i++) {
			if (lyricsLines[i].time <= currentTime) {
				activeIndex = i;
			} else {
				break;
			}
		}

		// 高亮当前歌词行
		if (activeIndex >= 0) {
			$('.lyric-line').removeClass('active').css('opacity', '0.5');
			const activeLine = $(`.lyric-line[data-index="${activeIndex}"]`);
			activeLine.addClass('active').css('opacity', '1');
			activeLine.css('font-size', '1.2em').css('font-weight', 'bold');

			// 滚动到当前歌词
			const container = $('#lyrics-container');
			const offset = activeLine.position().top - container.scrollTop() - container.height() / 2;
			container.animate({ scrollTop: container.scrollTop() + offset }, 200);
		}
	}

	// 音频元数据加载完成
	function onMetadataLoaded() {
		if (!audioPlayer) return;
		$('#total-time').text(formatTime(audioPlayer.duration));
	}

	// 音频播放结束
	function onTrackEnded() {
		if (isHost) {
			nextTrack();
		}
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

	// 搜索音乐
	async function searchMusic() {
		const keyword = $('#music-search-input').val().trim();
		if (!keyword) {
			alerts.alert({
				title: '提示',
				message: '请输入搜索关键词',
				type: 'info',
			});
			return;
		}

		try {
			const response = await fetch('/api/music/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					key: keyword,
					t: '0',
					pageSize: 10,
				}),
			});
			const data = await response.json();

			if (data.result !== 100 || !data.data.list || data.data.list.length === 0) {
				$('#search-results').hide();
				alerts.alert({
					title: '未找到',
					message: '未找到相关歌曲',
					type: 'info',
				});
				return;
			}

			// 显示搜索结果
			showSearchResults(data.data.list);
		} catch (err) {
			console.error('Search failed:', err);
			alerts.alert({
				title: '错误',
				message: '搜索失败，请稍后重试',
				type: 'error',
			});
		}
	}

	// 显示搜索结果
	function showSearchResults(songs) {
		const container = $('#search-results');

		let html = '';
		for (const song of songs) {
			const songName = song.songname || song.title || '未知歌曲';
			const singer = (song.singer || []).map(s => s.name).join(', ') || '未知歌手';
			const album = song.albumname || '';
			const songmid = song.songmid;
			const albummid = song.albummid || '';
			const duration = song.interval ? formatTime(song.interval) : '';
			// QQ Music album cover URL
			const coverUrl = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;

			html += `
				<div class="list-group-item d-flex justify-content-between align-items-center" data-songmid="${songmid}" data-albummid="${albummid}" data-songname="${songName}" data-singer="${singer}" data-cover="${coverUrl}">
					<div class="d-flex align-items-center" style="flex: 1; min-width: 0;">
						<img src="${coverUrl}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px; margin-right: 12px; flex-shrink: 0;" alt="${songName}">
						<div style="flex: 1; min-width: 0; overflow: hidden;">
							<div class="fw-bold text-truncate">${songName}</div>
							<small class="text-muted text-truncate">${singer} ${album ? '- ' + album : ''}</small>
						</div>
					</div>
					<div class="d-flex align-items-center flex-shrink-0">
						<small class="text-muted me-3">${duration}</small>
						<button class="btn btn-sm btn-primary add-song-btn">
							<i class="fa fa-plus"></i> 添加
						</button>
					</div>
				</div>
			`;
		}

		container.html(html);
		container.show();

		// 绑定添加按钮事件
		$('.add-song-btn').on('click', async function() {
			const item = $(this).closest('.list-group-item');
			const songmid = item.data('songmid');
			const songName = item.data('songname');
			const singer = item.data('singer');
			const coverUrl = item.data('cover');

			try {
				// 获取播放链接
				const response = await fetch(`/api/music/song/url/${songmid}`, {
					credentials: 'include',
				});
				const data = await response.json();

				if (data.result !== 100 || !data.data) {
					alerts.alert({
						title: '错误',
						message: '获取播放链接失败',
						type: 'error',
					});
					return;
				}

				const track = {
					id: songmid,
					name: songName,
					artist: singer,
					cover: coverUrl,
					url: data.data,
				};

				playlist.push(track);
				currentTrackIndex = playlist.length - 1;
				updatePlaylistUI();

				// 隐藏搜索结果
				$('#search-results').hide();

				// 如果是房主，立即播放
				if (isHost) {
					socket.emit('modules.music.play', { roomId: currentRoomId, track: track }).catch(err => {
						console.error('Failed to play track:', err);
					});
				}
			} catch (err) {
				console.error('Add song failed:', err);
				alerts.alert({
					title: '错误',
					message: '添加歌曲失败',
					type: 'error',
				});
			}
		});
	}

	function updatePlaylistUI() {
		const container = $('#playlist');

		if (playlist.length === 0) {
			container.html(`
				<div class="text-center text-muted py-4">
					<i class="fa fa-list fa-2x mb-2"></i>
					<p>播放列表为空</p>
					<p class="text-sm">搜索歌曲添加到播放列表</p>
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
						${track.cover ? `<img src="${track.cover}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 10px; flex-shrink: 0;">` : ''}
						<div class="me-2 flex-shrink-0">
							${active ? '<i class="fa fa-play"></i>' : '<span class="text-muted">' + (index + 1) + '</span>'}
						</div>
						<div style="flex: 1; min-width: 0; overflow: hidden;">
							<div class="text-truncate">${track.name}</div>
							<div class="text-sm ${active ? 'text-light' : 'text-muted'} text-truncate">${track.artist || '-'}</div>
						</div>
						${isHost ? `<button class="btn btn-sm btn-outline-danger remove-track-btn flex-shrink-0" data-index="${index}"><i class="fa fa-times"></i></button>` : ''}
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
		if (audioPlayer) {
			audioPlayer.pause();
			audioPlayer.src = '';
		}
	});

	return Music;
});
