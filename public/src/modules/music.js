// 音乐房间主模块
define('music', [
	'alerts',
	'music/state',
	'music/ui',
	'music/lyrics',
	'music/search',
	'music/chat',
	'music/volume',
	'music/socket',
	'music/users'
], function (alerts, State, UI, Lyrics, Search, Chat, Volume, Socket, Users) {
	// 将 Lyrics 模块注入到 UI 模块中，以便 UI 可以调用歌词功能
	UI.setLyricsModule(Lyrics);
	// 将 Users 模块注入到 Socket 模块中，以便 Socket 可以调用用户相关功能
	Socket.setUsersModule(Users);
	const Music = {};

	Music.init = function () {
		const isMusicRoomPage = $('.music-room-container').length > 0;

		if (!isMusicRoomPage) {
			return;
		}

		Music.removeListeners();

		Music.setupRoom();

		// 启动心跳机制
		Socket.startHeartbeat();

		$(window).one('action:ajaxify.start', function () {
			if (State.currentRoomId) {
				socket.emit('modules.music.leaveRoom', { roomId: State.currentRoomId });
				State.currentRoomId = null;
			}
		});
	};

	Music.removeListeners = function () {
		socket.removeListener('event:music.play', Socket.onMusicPlay);
		socket.removeListener('event:music.room.update', Socket.onRoomUpdate);
		socket.removeListener('event:music.chat', Socket.onMusicChat);
		socket.removeListener('event:music.playlist.update', Socket.onPlaylistUpdate);
		socket.removeListener('event:music.vote.update', Socket.onVoteUpdate);
		socket.removeListener('event:music.users.update', Socket.onUsersUpdate);

		$('#vote-skip-btn').off('click', Music.voteSkip);
		$('#search-track-btn').off('click', Search.searchMusic);
		$('.search-type-btn').off('click');
		// 搜索快捷键和分页会在 Search.initShortcuts 中绑定，这里不单独清理
		$('#send-chat-btn').off('click', Chat.sendChatMessage);
		$('#chat-input').off('keypress');
		$('#play-overlay').off('click', Music.onPlayOverlayClick);

		if (State.audioPlayer) {
			State.audioPlayer.removeEventListener('timeupdate', Lyrics.onTimeUpdate);
			State.audioPlayer.removeEventListener('ended', Music.onTrackEnded);
			State.audioPlayer.removeEventListener('loadedmetadata', Music.onMetadataLoaded);
			State.audioPlayer.removeEventListener('error', Music.onAudioError);
		}

		// 重置状态缓存
		State.lastPlaylistJson = null;
		State.playlist = [];
		State.currentTrack = null;
		State.lastTrackId = null;
		State.lastCoverUrl = null;
	};

	Music.setupRoom = function () {
		if (!$('.music-room-container').length) {
			return;
		}

		State.audioPlayer = document.getElementById('audio-player');
		if (!State.audioPlayer) {
			console.error('Audio player element not found');
		} else {
			State.audioPlayer.addEventListener('timeupdate', Lyrics.onTimeUpdate);
			State.audioPlayer.addEventListener('ended', Music.onTrackEnded);
			State.audioPlayer.addEventListener('loadedmetadata', Music.onMetadataLoaded);
			State.audioPlayer.addEventListener('error', Music.onAudioError);
		}

		const pathParts = window.location.pathname.split('/');
		if (pathParts.length >= 3) {
			State.currentRoomId = pathParts[2];
			Music.joinRoom(State.currentRoomId);
		}

		$('#vote-skip-btn').on('click', Music.voteSkip);

		$('#play-overlay').on('click', Music.onPlayOverlayClick);

		Volume.initVolumeControl();

		Users.init();

		// 初始化搜索类型按钮
		Search.initSearchTypeButtons();

		// 初始化搜索快捷键和分页
		Search.initShortcuts();

		$('#search-track-btn').on('click', function(e) {
			e.preventDefault();
			Search.searchMusic(false);
		});

		$('#send-chat-btn').on('click', Chat.sendChatMessage);
		$('#chat-input').on('keypress', function (e) {
			if (e.which === 13) {
				Chat.sendChatMessage();
			}
		});

		Search.bindSearchResultsEvents();

		Socket.setupSocketEvents();
	};

	Music.joinRoom = async function (roomId) {
		try {
			// 重置上次歌曲ID，确保重新进入房间时能正确获取歌词
			State.lastTrackId = null;

			try {
				await fetch('/api/music/cookie/1342466911', {
					credentials: 'include',
				});
				console.log('[Music] QQMusic cookie set successfully');
			} catch (err) {
				console.warn('[Music] Failed to set QQMusic cookie:', err);
			}

			// 获取网易云音乐cookie
			try {
				const response = await fetch('/api/music/netease/cookie', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include',
				});
				if (response.ok) {
					console.log('[Music] NetEase cookie set successfully');
				}
			} catch (err) {
				console.warn('[Music] Failed to set NetEase cookie:', err);
			}

			const response = await socket.emit('modules.music.joinRoom', { roomId: roomId });
			State.isHost = response.room.isHost;
			State.currentRoomId = roomId;

			UI.updateRoomUI(response.room);

			if (State.isFirstLoad && response.room.isPlaying && response.room.currentTrack) {
				console.log('[Music] First load with playing track, checking autoplay...');
				setTimeout(() => {
					if (State.audioPlayer && State.audioPlayer.paused) {
						console.log('[Music] Audio is paused on first load, showing overlay');
						UI.showPlayOverlay();
					}
				}, 500);
			}

			State.isFirstLoad = false;
		} catch (err) {
			console.error('Failed to join room:', err);
			alerts.alert({
				title: '错误',
				message: err.message || '加入房间失败',
				type: 'error',
				timeout: 3000,
			});
		}
	};

	Music.voteSkip = async function () {
		if (!State.currentRoomId) return;

		try {
			await socket.emit('modules.music.voteSkip', { roomId: State.currentRoomId });
		} catch (err) {
			console.error('Failed to vote skip:', err);
			alerts.alert({
				title: '错误',
				message: err.message || '投票失败',
				type: 'error',
				timeout: 3000,
			});
		}
	};

	Music.onMetadataLoaded = function () {
		if (!State.audioPlayer) return;
		$('#total-time').text(State.formatTime(State.audioPlayer.duration));
	};

	Music.onAudioError = function (e) {
		if (!State.audioPlayer) return;

		const error = State.audioPlayer.error;
		if (!error) return;

		console.error('[Music] Audio error:', {
			code: error.code,
			message: error.message,
			networkState: State.audioPlayer.networkState,
			readyState: State.audioPlayer.readyState,
			currentSrc: State.audioPlayer.currentSrc
		});

		// 处理403 Forbidden错误 (MEDIA_ERR_SRC_NOT_SUPPORTED)
		if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
			console.warn('[Music] 403 Forbidden or unsupported source, skipping to next track...');
			alerts.alert({
				title: '播放失败',
				message: '当前歌曲无法播放，自动切换到下一首',
				type: 'warning',
				timeout: 2000,
			});

			// 自动切换到下一首
			socket.emit('modules.music.playNext', { roomId: State.currentRoomId }).catch(err => {
				console.error('Failed to play next track:', err);
			});
		}
	};

	Music.onTrackEnded = function () {
		console.log('[Music] Track ended, checking playlist...');
		// 直接调用playNext,它会处理播放列表为空的情况
		socket.emit('modules.music.playNext', { roomId: State.currentRoomId }).catch(err => {
			console.error('Failed to play next track:', err);
		});
	};

	Music.onPlayOverlayClick = function () {
		if (!State.audioPlayer) {
			console.error('Audio player not found');
			return;
		}

		UI.hidePlayOverlay();

		if (State.currentTrack && State.currentTrack.url) {
			const audioUrl = State.currentTrack.url;

			// 检查URL是否有效
			if (!audioUrl || audioUrl.trim() === '') {
				console.error('[Music] Invalid track URL:', audioUrl);
				alerts.alert({
					title: '播放失败',
					message: '歌曲URL无效',
					type: 'error',
					timeout: 3000,
				});
				return;
			}

			// 更新音频源
			if (State.audioPlayer.src !== audioUrl) {
				console.log('[Music] Setting audio source:', audioUrl);
				State.audioPlayer.src = audioUrl;
			}

			const playPromise = State.audioPlayer.play();

			if (playPromise !== undefined) {
				playPromise.then(() => {
					console.log('[Music] Audio playback started successfully');
				}).catch(error => {
					console.error('[Music] Failed to play audio:', error);

					// 根据错误类型显示不同的提示
					let message = '无法播放音频，请检查您的浏览器设置';
					if (error.name === 'NotSupportedError' || error.message?.includes('no supported sources')) {
						message = '该音频格式不支持，请尝试其他歌曲';
						console.error('[Music] NotSupportedError details:', {
							url: audioUrl,
							mime: State.audioPlayer.canPlayType?.('audio/mpeg'),
							codecs: State.audioPlayer.canPlayType?.('audio/mp4; codecs="mp3"')
						});
					} else if (error.name === 'NotAllowedError') {
						message = '浏览器阻止了自动播放，请点击页面后再试';
					} else if (error.name === 'AbortError') {
						message = '播放被中断';
					}

					alerts.alert({
						title: '播放失败',
						message: message,
						type: 'error',
						timeout: 3000,
					});
				});
			}
		} else {
			console.log('[Music] No current track to play');
		}
	};

	$(window).on('action:ajaxify.start', function () {
		Music.removeListeners();
		if (State.audioPlayer) {
			State.audioPlayer.pause();
			State.audioPlayer.src = '';
		}
	});

	Music.showPlayOverlay = UI.showPlayOverlay;
	Music.hidePlayOverlay = UI.hidePlayOverlay;

	return Music;
});
