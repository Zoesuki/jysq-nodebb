// 全局变量，标记cookie是否已设置
let isCookieSet = false;

define('music', [
	'alerts',
], function (alerts) {
	const Music = {};

	let currentRoomId = null;
	let isHost = false;
	let playlist = [];
	let currentTrack = null;
	let audioPlayer = null;
	let lyricsLines = [];
	// 搜索分页相关变量
	let searchPageNo = 1;
	let searchTotalPages = 1;
	let searchKeyword = '';

	Music.init = function () {
		// 检查是否在音乐房间页面
		const isMusicRoomPage = $('.music-room-container').length > 0;

		if (!isMusicRoomPage) {
			return;
		}

		// 先移除旧的事件监听器
		Music.removeListeners();

		setupRoom();

		// 注册页面跳转钩子，离开房间
		$(window).one('action:ajaxify.start', function () {
			if (currentRoomId) {
				socket.emit('modules.music.leaveRoom', { roomId: currentRoomId });
				currentRoomId = null;
			}
		});
	};

	Music.removeListeners = function () {
		// 移除 Socket 事件监听器
		socket.removeListener('event:music.play', onMusicPlay);
		socket.removeListener('event:music.pause', onMusicPause);
		socket.removeListener('event:music.room.update', onRoomUpdate);
		socket.removeListener('event:music.chat', onMusicChat);
		socket.removeListener('event:music.playlist.update', onPlaylistUpdate);
		socket.removeListener('event:music.vote.update', onVoteUpdate);

		// 移除 DOM 事件监听器 - 防止重复绑定
		$('#play-btn').off('click');
		$('#prev-btn').off('click');
		$('#next-btn').off('click');
		$('#vote-skip-btn').off('click');
		$('#search-track-btn').off('click', searchMusic);
		$('#music-search-input').off('keypress');
		$('#prev-page-btn').off('click');
		$('#next-page-btn').off('click');
		$('#send-chat-btn').off('click', sendChatMessage);
		$('#chat-input').off('keypress');
		$('#search-results').off('click', '.add-song-btn');

		// 移除音频播放器事件监听器
		if (audioPlayer) {
			audioPlayer.removeEventListener('timeupdate', onTimeUpdate);
			audioPlayer.removeEventListener('ended', onTrackEnded);
			audioPlayer.removeEventListener('loadedmetadata', onMetadataLoaded);
		}
	};

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
		$('#vote-skip-btn').on('click', voteSkip);

		// 音量控制
		initVolumeControl();

		// 搜索音乐
		$('#search-track-btn').on('click', searchMusic);
		$('#music-search-input').on('keypress', function (e) {
			if (e.which === 13) {
				searchMusic();
			}
		});

		// 搜索分页
		$('#prev-page-btn').on('click', function () {
			if (searchPageNo > 1) {
				searchPageNo--;
				searchMusic(true);
			}
		});
		$('#next-page-btn').on('click', function () {
			if (searchPageNo < searchTotalPages) {
				searchPageNo++;
				searchMusic(true);
			}
		});

		// 发送聊天消息
		$('#send-chat-btn').on('click', sendChatMessage);
		$('#chat-input').on('keypress', function (e) {
			if (e.which === 13) {
				sendChatMessage();
			}
		});

		// 绑定搜索结果事件
		bindSearchResultsEvents();

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

	let lastTrackId = null;
	let lastCoverUrl = null;
	let lastPlaylistJson = null;

	function updateRoomUI(room) {
		$('#listener-count').text(room.listeners);

		// 更新投票显示
		if (room.votes) {
			// 如果当前用户已经投票，禁用按钮
			if (room.votes.includes(parseInt(app.user.uid, 10))) {
				$('#vote-skip-btn').prop('disabled', true).addClass('btn-secondary').removeClass('btn-outline-primary').html('<i class="fa fa-check me-1"></i> 已投票');
			} else {
				$('#vote-skip-btn').prop('disabled', false).addClass('btn-outline-primary').removeClass('btn-secondary').html('<i class="fa fa-forward me-1"></i> 投票切歌');
			}
		}

		// 同步播放列表 (仅当发生变化时更新 UI)
		if (room.playlist && Array.isArray(room.playlist)) {
			const currentPlaylistJson = JSON.stringify(room.playlist);
			let playlistChanged = false;
			
			if (lastPlaylistJson !== currentPlaylistJson) {
				lastPlaylistJson = currentPlaylistJson;
				playlist = room.playlist;
				playlistChanged = true;
			}
			
			// 更新当前播放
			if (room.currentTrack) {
				if (!currentTrack || room.currentTrack.id !== currentTrack.id) {
					currentTrack = room.currentTrack;
					playlistChanged = true;
				}
			} else if (currentTrack) {
				currentTrack = null;
				playlistChanged = true;
			}

			if (playlistChanged) {
				updatePlaylistUI();
			}
		}

		if (room.currentTrack) {
			$('#track-name').text(room.currentTrack.name);
			$('#track-artist').text(room.currentTrack.artist || '-');

			const albumCover = $('#album-cover');
			if (room.currentTrack.cover) {
				// 仅当封面 URL 改变时才更新，防止重复加载
				if (lastCoverUrl !== room.currentTrack.cover) {
					lastCoverUrl = room.currentTrack.cover;
					albumCover.html(`<img src="${room.currentTrack.cover}" alt="专辑封面" class="rounded-circle shadow-lg" onerror="this.onerror=null; $(this).replaceWith('<i class=\'fa fa-music fa-5x\'></i>'); $('.music-room-bg').css('background-image', 'none');">`);
					// 更新页面背景图
					updatePageBackground(room.currentTrack.cover);
				}
			} else {
				lastCoverUrl = null;
				albumCover.html(`<i class="fa fa-music fa-5x"></i>`);
				// 清除背景图
				clearPageBackground();
			}

			// 获取歌词 (如果歌曲发生变化)
			if (lastTrackId !== room.currentTrack.id) {
				lastTrackId = room.currentTrack.id;
				fetchLyrics(room.currentTrack.id);
			}

			// 更新播放按钮状态和封面旋转
			const playBtn = $('#play-btn');
			if (room.isPlaying) {
				playBtn.html('<i class="fa fa-pause"></i>');
				playBtn.removeClass('btn-primary').addClass('btn-outline-primary');
				albumCover.addClass('playing');
			} else {
				playBtn.html('<i class="fa fa-play"></i>');
				playBtn.removeClass('btn-outline-primary').addClass('btn-primary');
				albumCover.removeClass('playing');
			}

			// 同步音频播放器的播放进度
			if (audioPlayer && room.currentTrack.url) {
				// 计算目标播放时间
				let targetTime = room.currentTime || 0;
				if (room.isPlaying && room.startTime > 0) {
					targetTime = (Date.now() - room.startTime) / 1000;
				}

				// 如果当前播放的歌曲与房间中的歌曲不同，设置新的歌曲
				if (audioPlayer.src !== room.currentTrack.url) {
					audioPlayer.src = room.currentTrack.url;
					
					// 加载音频后设置时间
					audioPlayer.onloadeddata = function() {
						if (targetTime > 0) {
							audioPlayer.currentTime = targetTime;
						}
						if (room.isPlaying) {
							audioPlayer.play().catch(function(e) {
								console.warn('[Music] Autoplay blocked or failed:', e);
							});
						} else {
							audioPlayer.pause();
						}
					};
				} else {
					// 歌曲相同，检查播放状态
					if (room.isPlaying) {
						if (audioPlayer.paused) {
							audioPlayer.play().catch(function(e) {
								console.warn('[Music] Play blocked or failed:', e);
							});
						}
						// 只有当时间差距较大时才进行进度同步，避免播放抖动
						if (Math.abs(audioPlayer.currentTime - targetTime) > 2) {
							audioPlayer.currentTime = targetTime;
						}
					} else {
						if (!audioPlayer.paused) {
							audioPlayer.pause();
						}
						audioPlayer.currentTime = targetTime;
					}
				}
				
				// 更新进度显示
				const displayTime = room.isPlaying ? (audioPlayer.currentTime || targetTime) : targetTime;
				$('#current-time').text(formatTime(displayTime));
				const progress = (displayTime / audioPlayer.duration) * 100 || 0;
				$('#progress-bar').css('width', progress + '%');
			}
		}

		// 更新房主状态 - 房主不再拥有控制播放的特权，所有控制通过投票或自动流程完成
		$('#play-btn').prop('disabled', true);
		$('#prev-btn').prop('disabled', true);
		$('#next-btn').prop('disabled', true);
	}

	// 更新页面背景图
	function updatePageBackground(coverUrl) {
		$('.music-room-bg').css('background-image', `url(${coverUrl})`);
	}

	// 清除页面背景图
	function clearPageBackground() {
		$('.music-room-bg').css('background-image', 'none');
	}

	function onMusicPlay(data) {
		if (data.track) {
			currentTrack = data.track;
			
			// 立即从本地播放列表中移除正在播放的这首歌，防止重复显示
			playlist = playlist.filter(t => t.id !== data.track.id);
			lastPlaylistJson = JSON.stringify(playlist); // 同步更新缓存
			
			updateRoomUI({
				currentTrack: data.track,
				isPlaying: true,
				currentTime: data.currentTime || 0,
				startTime: data.startTime || 0,
				listeners: $('#listener-count').text() || 0,
				playlist: playlist,
			});
		}
	}

	function onMusicPause(data) {
		updateRoomUI({
			currentTrack: getCurrentTrack(),
			isPlaying: false,
			currentTime: data.currentTime,
			startTime: 0,
			listeners: $('#listener-count').text() || 0,
			playlist: playlist,
		});
	}

	function onRoomUpdate(data) {
		if (data.room) {
			currentTrack = data.room.currentTrack;
			updateRoomUI(data.room);
		}
	}

	function onMusicChat(data) {
		addChatMessage(data.message, data.isOwn);
	}

	function onPlaylistUpdate(data) {
		if (data.playlist) {
			playlist = data.playlist;
			lastPlaylistJson = JSON.stringify(playlist); // 同步更新缓存，防止 updateRoomUI 重复触发
			updatePlaylistUI();
		}
	}

	function onVoteUpdate(data) {
		if (data.votes.includes(parseInt(app.user.uid, 10))) {
			$('#vote-skip-btn').prop('disabled', true).addClass('btn-secondary').removeClass('btn-outline-primary').html('<i class="fa fa-check me-1"></i> 已投票');
		}
	}

	function setupSocketEvents() {
		socket.on('event:music.play', onMusicPlay);
		socket.on('event:music.pause', onMusicPause);
		socket.on('event:music.room.update', onRoomUpdate);
		socket.on('event:music.chat', onMusicChat);
		socket.on('event:music.playlist.update', onPlaylistUpdate);
		socket.on('event:music.vote.update', onVoteUpdate);
	}

	async function voteSkip() {
		if (!currentRoomId) return;
		
		try {
			await socket.emit('modules.music.voteSkip', { roomId: currentRoomId });
		} catch (err) {
			console.error('Failed to vote skip:', err);
			alerts.alert({
				title: '错误',
				message: err.message || '投票失败',
				type: 'error',
			});
		}
	}

	async function togglePlay() {
		// 功能已禁用，保持空实现或移除调用
		return;
	}

	function isPlaying() {
		return $('#play-btn').find('i').hasClass('fa-pause');
	}

	// 播放歌曲
	function playTrack(track, currentTime = 0) {
		if (!audioPlayer || !track || !track.url) {
			console.error('Invalid track or audio player');
			return;
		}

		audioPlayer.src = track.url;
		
		// 如果有当前时间，设置播放进度
		if (currentTime > 0) {
			audioPlayer.currentTime = currentTime;
		}
		
		audioPlayer.play().catch(err => {
			console.error('Failed to play audio:', err);
		});

		// 更新专辑封面
		if (track.cover) {
			$('#album-cover').html(`<img src="${track.cover}" alt="专辑封面" class="rounded-circle shadow-lg" onerror="this.onerror=null; $(this).replaceWith('<i class=\'fa fa-music fa-5x\'></i>'); $('.music-room-bg').css('background-image', 'none');">`);
			// 更新页面背景图
			updatePageBackground(track.cover);
		} else {
			$('#album-cover').html(`<i class="fa fa-music fa-5x"></i>`);
			// 清除背景图
			clearPageBackground();
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
	let lastSyncTime = 0;
	function onTimeUpdate() {
		if (!audioPlayer) return;

		const currentTime = audioPlayer.currentTime;

		// 更新进度条
		const progress = (currentTime / audioPlayer.duration) * 100 || 0;
		$('#progress-bar').css('width', progress + '%');
		$('#current-time').text(formatTime(currentTime));

		// 同步播放进度给服务器（如果是房主）
		// 使用 startTime 后，房主不再需要频繁同步，只有在手动调整进度或每隔 10 秒同步一次作为兜底
		if (isHost && currentRoomId) {
			const timeDiff = Math.abs(currentTime - lastSyncTime);
			if (timeDiff > 10 || (timeDiff > 2 && !audioPlayer.paused)) {
				lastSyncTime = currentTime;
				socket.emit('modules.music.sync', { roomId: currentRoomId, currentTime: currentTime }).catch(err => {
					console.error('Failed to sync playback time:', err);
				});
			}
		}

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
			const activeLine = $(`.lyric-line[data-index="${activeIndex}"]`);

			// 只在行索引变化时才滚动和高亮
			if (!activeLine.hasClass('active')) {
				$('.lyric-line').removeClass('active').css({
					'opacity': '0.5',
					'font-size': 'inherit',
					'font-weight': 'normal'
				});

				activeLine.addClass('active').css({
					'opacity': '1',
					'font-size': '1.2em',
					'font-weight': 'bold'
				});

				// 滚动到当前歌词
				const container = $('#lyrics-container');
				const containerHeight = container.height();
				const containerScrollTop = container.scrollTop();
				const lineHeight = activeLine.outerHeight();
				const lineTop = activeLine.position().top + containerScrollTop;

				// 计算滚动位置，使当前歌词居中
				const scrollTo = lineTop - (containerHeight / 2) + (lineHeight / 2);
				container.stop().animate({ scrollTop: scrollTo }, 300);
			}
		}
	}

	// 音频元数据加载完成
	function onMetadataLoaded() {
		if (!audioPlayer) return;
		$('#total-time').text(formatTime(audioPlayer.duration));
	}

	// 音频播放结束
	function onTrackEnded() {
		// 房主负责触发下一首逻辑，服务器端 Music.play 会处理播放列表移除
		if (isHost && playlist.length > 0) {
			socket.emit('modules.music.play', { roomId: currentRoomId, track: playlist[0] }).catch(err => {
				console.error('Failed to play next track:', err);
			});
		}
	}

	async function prevTrack() {
		// 功能已禁用
		return;
	}

	async function nextTrack() {
		// 功能已禁用，切歌由投票逻辑触发
		return;
	}

	// 搜索音乐
	async function searchMusic(isPageChange = false) {
		const keyword = $('#music-search-input').val().trim();
		if (!keyword && !isPageChange) {
			alerts.alert({
				title: '提示',
				message: '请输入搜索关键词',
				type: 'info',
			});
			return;
		}

		// 如果是分页切换，使用之前的关键词
		if (isPageChange) {
			searchKeyword = searchKeyword || keyword;
		} else {
			searchKeyword = keyword;
			searchPageNo = 1; // 新搜索时重置到第一页
		}

		try {
			const response = await fetch('/api/music/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					key: searchKeyword,
					t: '0',
					pageNo: searchPageNo,
					pageSize: 10,
				}),
			});
			const data = await response.json();

			if (data.result !== 100 || !data.data.list || data.data.list.length === 0) {
				$('#search-results-container').hide();
				alerts.alert({
					title: '未找到',
					message: '未找到相关歌曲',
					type: 'info',
				});
				return;
			}

			// 更新分页信息
			searchTotalPages = Math.ceil((data.data.total || data.data.list.length) / 10);
			updatePaginationUI();

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
							<i class="fa fa-plus"></i>
						</button>
					</div>
				</div>
			`;
		}

		container.html(html);
		$('#search-results-container').show();
	}

	// 更新分页UI
	function updatePaginationUI() {
		$('#current-page').text(searchPageNo);
		$('#prev-page-btn').prop('disabled', searchPageNo <= 1);
		$('#next-page-btn').prop('disabled', searchPageNo >= searchTotalPages);
	}

	// 绑定搜索结果的事件
	function bindSearchResultsEvents() {
		// 先移除旧的事件监听器
		$('#search-results').off('click', '.add-song-btn');
		$('#playlist').off('click', '.remove-track-btn');

		// 绑定添加按钮事件
		$('#search-results').on('click', '.add-song-btn', async function() {
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

				// 将歌曲添加到播放列表
				const addResponse = await socket.emit('modules.music.addToPlaylist', { roomId: currentRoomId, track: track });
				if (addResponse && addResponse.alreadyExists) {
					alerts.alert({
						title: '提示',
						message: '歌曲已在播放列表中',
						type: 'info',
					});
				}

				// 隐藏搜索结果
				$('#search-results-container').hide();
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
				<div class="text-center text-muted py-5">
					<i class="fa fa-compact-disc fa-3x mb-3 opacity-25 fa-spin"></i>
					<p>播放列表为空</p>
					<p class="text-sm">快去搜索并添加你喜欢的歌曲吧</p>
				</div>
			`);
			return;
		}

		let html = '';
		playlist.forEach(function (track, index) {
			// 如果歌曲正在播放，不显示在待播列表中
			if (currentTrack && track.id === currentTrack.id) {
				return;
			}

			html += `
				<div class="list-group-item d-flex align-items-center border-0 mb-2 rounded-3 shadow-sm" data-trackid="${track.id}">
					<div class="flex-shrink-0 me-3">
						${track.cover ? `<img src="${track.cover}" class="rounded-3 shadow-sm" style="width: 48px; height: 48px; object-fit: cover;" onerror="this.onerror=null; $(this).replaceWith('<div class=\'bg-light rounded-3 d-flex align-items-center justify-content-center\' style=\'width: 48px; height: 48px;\'><i class=\'fa fa-music text-muted\'></i></div>');">` : '<div class="bg-light rounded-3 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;"><i class="fa fa-music text-muted"></i></div>'}
					</div>
					<div class="flex-grow-1 overflow-hidden me-2">
						<div class="text-truncate fw-bold mb-0">${track.name}</div>
						<div class="text-xs text-muted text-truncate d-flex justify-content-between">
							<span>${track.artist || '-'}</span>
							<span class="text-primary opacity-75 small"><i class="fa fa-user-plus me-1"></i>${track.addedBy || '系统'}</span>
						</div>
					</div>
				</div>
			`;
		});

		container.html(html);
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

		// 处理系统消息
		if (message.system) {
			const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			const systemHtml = `
				<div class="chat-message system text-center my-2">
					<span class="badge rounded-pill bg-light text-muted border shadow-sm px-3 py-2">
						<i class="fa fa-info-circle me-1"></i> ${message.content} <small class="ms-2 opacity-75">${time}</small>
					</span>
				</div>
			`;
			container.append(systemHtml);
			container.scrollTop(container[0].scrollHeight);
			return;
		}

		const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		const html = `
			<div class="chat-message ${isOwn ? 'own' : ''}">
				<div class="message-header">
					<span class="fw-bold me-1">${message.username}</span>
					<span class="text-xs opacity-75">${time}</span>
				</div>
				<div class="d-flex align-items-start ${isOwn ? 'flex-row-reverse' : ''}">
					<div class="flex-shrink-0">
						<img src="${message.picture || '/assets/images/default-avatar.png'}" class="rounded-circle shadow-sm" style="width: 32px; height: 32px; object-fit: cover;">
					</div>
					<div class="message-content mx-2">
						${message.content}
					</div>
				</div>
			</div>
		`;

		container.append(html);
		container.scrollTop(container[0].scrollHeight);
	}

	function getCurrentTrack() {
		return currentTrack;
	}

	function getCurrentTrackIndex() {
		if (!currentTrack || !playlist || !playlist.length) {
			return -1;
		}
		return playlist.findIndex(t => t.id === currentTrack.id);
	}

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return mins + ':' + (secs < 10 ? '0' : '') + secs;
	}

	function initVolumeControl() {
		const volumeSlider = $('#volume-slider');
		const muteBtn = $('#mute-btn');
		const volumePercent = $('#volume-percent');
		
		// 从缓存加载音量
		let savedVolume = localStorage.getItem('music_room_volume');
		if (savedVolume === null) {
			savedVolume = 1;
		} else {
			savedVolume = parseFloat(savedVolume);
		}

		let isMuted = localStorage.getItem('music_room_muted') === 'true';
		let lastVolume = savedVolume || 1;

		// 应用初始音量
		updateVolume(isMuted ? 0 : savedVolume);
		volumeSlider.val(savedVolume);
		updateVolumeUI(isMuted ? 0 : savedVolume);

		// 监听滑块变化
		volumeSlider.on('input', function() {
			const val = parseFloat($(this).val());
			isMuted = val === 0;
			updateVolume(val);
			updateVolumeUI(val);
			
			// 只有非 0 时才更新上次音量
			if (val > 0) {
				lastVolume = val;
			}
			
			// 缓存
			localStorage.setItem('music_room_volume', val);
			localStorage.setItem('music_room_muted', isMuted);
		});

		// 监听静音按钮
		muteBtn.on('click', function() {
			isMuted = !isMuted;
			const targetVolume = isMuted ? 0 : lastVolume;
			
			updateVolume(targetVolume);
			volumeSlider.val(targetVolume);
			updateVolumeUI(targetVolume);
			
			localStorage.setItem('music_room_muted', isMuted);
		});

		function updateVolume(val) {
			if (audioPlayer) {
				audioPlayer.volume = val;
			}
		}

		function updateVolumeUI(val) {
			// 更新百分比文字
			volumePercent.text(Math.round(val * 100) + '%');
			
			// 更新图标
			const icon = muteBtn.find('i');
			icon.removeClass('fa-volume-up fa-volume-down fa-volume-off fa-volume-mute');
			
			if (val === 0) {
				icon.addClass('fa-volume-mute');
			} else if (val < 0.3) {
				icon.addClass('fa-volume-off');
			} else if (val < 0.7) {
				icon.addClass('fa-volume-down');
			} else {
				icon.addClass('fa-volume-up');
			}
		}
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
