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
		$('#music-search-input').off('keypress');
		$('#prev-page-btn').off('click');
		$('#next-page-btn').off('click');
		$('#send-chat-btn').off('click', Chat.sendChatMessage);
		$('#chat-input').off('keypress');
		$('#play-overlay').off('click', Music.onPlayOverlayClick);

		if (State.audioPlayer) {
			State.audioPlayer.removeEventListener('timeupdate', Lyrics.onTimeUpdate);
			State.audioPlayer.removeEventListener('ended', Music.onTrackEnded);
			State.audioPlayer.removeEventListener('loadedmetadata', Music.onMetadataLoaded);
		}
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

		$('#search-track-btn').on('click', Search.searchMusic);
		$('#music-search-input').on('keypress', function (e) {
			if (e.which === 13) {
				Search.searchMusic();
			}
		});

		$('#prev-page-btn').on('click', function () {
			if (State.searchPageNo > 1) {
				State.searchPageNo--;
				Search.searchMusic(true);
			}
		});
		$('#next-page-btn').on('click', function () {
			if (State.searchPageNo < State.searchTotalPages) {
				State.searchPageNo++;
				Search.searchMusic(true);
			}
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
			if (!State.isCookieSet) {
				try {
					await fetch('/api/music/cookie/3816852108', {
						credentials: 'include',
					});
					console.log('[Music] QQMusic cookie set successfully');
					State.isCookieSet = true;
				} catch (err) {
					console.warn('[Music] Failed to set QQMusic cookie:', err);
				}
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
			});
		}
	};

	Music.onMetadataLoaded = function () {
		if (!State.audioPlayer) return;
		$('#total-time').text(State.formatTime(State.audioPlayer.duration));
	};

	Music.onTrackEnded = function () {
		// 检查播放列表中是否有歌曲
		if (State.playlist && State.playlist.length > 0) {
			socket.emit('modules.music.playNext', { roomId: State.currentRoomId }).catch(err => {
				console.error('Failed to play next track:', err);
			});
		} else {
			// 没有下一首歌曲，清除当前歌曲并恢复默认状态
			console.log('[Music] No next track in playlist, resetting player and lyrics');
			UI.resetPlayerAndLyrics();

			// 通知服务器暂停播放
			socket.emit('modules.music.pause', { roomId: State.currentRoomId }).catch(err => {
				console.error('Failed to pause:', err);
			});
		}
	};

	Music.onPlayOverlayClick = function () {
		if (!State.audioPlayer) {
			console.error('Audio player not found');
			return;
		}

		UI.hidePlayOverlay();

		if (State.currentTrack && State.currentTrack.url) {
			if (State.audioPlayer.src !== State.currentTrack.url) {
				State.audioPlayer.src = State.currentTrack.url;
			}

			const playPromise = State.audioPlayer.play();

			if (playPromise !== undefined) {
				playPromise.then(() => {
					console.log('[Music] Audio playback started successfully');
				}).catch(error => {
					console.error('[Music] Failed to play audio:', error);
					alerts.alert({
						title: '播放失败',
						message: '无法播放音频，请检查您的浏览器设置',
						type: 'error',
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
