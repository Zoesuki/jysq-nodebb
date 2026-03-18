// UI 更新相关函数
define('music/ui', [
	'alerts',
	'music/state'
], function (alerts, State) {
	const UI = {};

	// 存储歌词模块的引用
	let lyricsModule = null;

	// 设置歌词模块引用
	UI.setLyricsModule = function (lyrics) {
		lyricsModule = lyrics;
	};

	// 获取歌词模块引用
	UI.getLyricsModule = function () {
		return lyricsModule;
	};

	// 更新房间UI
	UI.updateRoomUI = function (room) {
		if (!$('#listener-count').length) {
			console.warn('[UI] Elements not ready, skipping update');
			return;
		}

		$('#listener-count').text(room.listeners);

		// 更新投票显示
		if (room.votes) {
			if (room.votes.includes(parseInt(app.user.uid, 10))) {
				$('#vote-skip-btn').prop('disabled', true).addClass('btn-secondary').removeClass('btn-outline-primary').html('<i class="fa fa-check me-1"></i> 已投票');
			} else {
				$('#vote-skip-btn').prop('disabled', false).addClass('btn-outline-primary').removeClass('btn-secondary').html('<i class="fa fa-forward me-1"></i> 投票切歌');
			}
		}

		// 同步播放列表
		let playlistChanged = false;
		if (room.playlist && Array.isArray(room.playlist)) {
			const currentPlaylistJson = JSON.stringify(room.playlist);

			if (State.lastPlaylistJson !== currentPlaylistJson) {
				State.lastPlaylistJson = currentPlaylistJson;
				State.playlist = room.playlist;
				playlistChanged = true;
			}
		}

		// 更新当前播放
		if (room.currentTrack) {
			if (!State.currentTrack || room.currentTrack.id !== State.currentTrack.id) {
				State.currentTrack = room.currentTrack;
				playlistChanged = true;
			}
		} else if (State.currentTrack) {
			State.currentTrack = null;
			playlistChanged = true;
		}

		if (playlistChanged) {
			UI.updatePlaylistUI();
		}

		if (room.currentTrack) {
			$('#track-name').text(room.currentTrack.name);
			$('#track-artist').text(room.currentTrack.artist || '-');

			const albumCover = $('#album-cover');
			if (room.currentTrack.cover) {
				if (State.lastCoverUrl !== room.currentTrack.cover) {
					State.lastCoverUrl = room.currentTrack.cover;
					albumCover.html(`<img src="${room.currentTrack.cover}" alt="专辑封面" class="rounded-circle shadow-lg" onerror="this.onerror=null; $(this).replaceWith('<i class=\'fa fa-music fa-5x\'></i>'); $('.music-room-bg').css('background-image', 'none');">`);
					UI.updatePageBackground(room.currentTrack.cover);
				}
			} else {
				State.lastCoverUrl = null;
				albumCover.html(`<i class="fa fa-music fa-5x"></i>`);
				UI.clearPageBackground();
			}

			// 获取歌词
			if (State.lastTrackId !== room.currentTrack.id) {
				State.lastTrackId = room.currentTrack.id;
				if (lyricsModule) {
					lyricsModule.fetchLyrics(room.currentTrack.id);
				}
			}

			// 更新封面播放状态
			if (room.isPlaying) {
				albumCover.addClass('playing');
			} else {
				albumCover.removeClass('playing');
			}

			// 同步音频播放器的播放进度
			if (State.audioPlayer && room.currentTrack.url) {
				let targetTime = room.currentTime || 0;
				if (room.isPlaying && room.startTime > 0) {
					targetTime = (Date.now() - room.startTime) / 1000;
				}

				if (State.audioPlayer.src !== room.currentTrack.url) {
					State.audioPlayer.src = room.currentTrack.url;

					// 参考 Jusic-ui：设置自动预加载，提升加载速度
					State.audioPlayer.preload = 'auto';

					State.audioPlayer.onloadeddata = function() {
						if (targetTime > 0) {
							State.audioPlayer.currentTime = targetTime;
						}
						if (room.isPlaying) {
							State.audioPlayer.play().then(function() {
								UI.hidePlayOverlay();
							}).catch(function(e) {
								console.warn('[Music] Autoplay blocked or failed:', e);
								if (State.isFirstLoad) {
									console.log('[Music] Autoplay blocked on first load, showing overlay');
									UI.showPlayOverlay();
								}
							});
						}
					};
				} else {
					if (room.isPlaying) {
						if (State.audioPlayer.paused) {
							State.audioPlayer.play().then(function() {
								UI.hidePlayOverlay();
							}).catch(function(e) {
								console.warn('[Music] Play blocked or failed:', e);
								if (State.isFirstLoad) {
									console.log('[Music] Play blocked on first load, showing overlay');
									UI.showPlayOverlay();
								}
							});
						}

						// 参考 Jusic-ui 的同步策略：使用时间差计算
						const currentTime = State.audioPlayer.currentTime;
						const timeDiff = currentTime - targetTime;

						// 差异超过2秒：强制同步
						if (Math.abs(timeDiff) > 2) {
							console.log(`[Music] Large sync: ${timeDiff.toFixed(2)}s → ${targetTime.toFixed(2)}s`);
							State.audioPlayer.currentTime = targetTime;
						}
						// 差异在0.5-2秒之间：使用动态速率平滑调整
						else if (Math.abs(timeDiff) > 0.5) {
							let rateAdjustment = 1.0;
							if (timeDiff > 0) {
								// 本地超前，减速追赶（0.9-0.95x）
								rateAdjustment = Math.max(0.9, 1.0 - Math.min(Math.abs(timeDiff) * 0.05, 0.1));
							} else {
								// 本地滞后，加速追赶（1.05-1.1x）
								rateAdjustment = Math.min(1.1, 1.0 + Math.min(Math.abs(timeDiff) * 0.05, 0.1));
							}
							console.log(`[Music] Smooth adjust: ${rateAdjustment.toFixed(2)}x (diff: ${timeDiff.toFixed(2)}s)`);

							State.audioPlayer.playbackRate = rateAdjustment;

							// 根据差异大小动态计算调整时长
							const adjustmentDuration = Math.min(Math.abs(timeDiff) * 500, 2000);
							setTimeout(function() {
								State.audioPlayer.playbackRate = 1.0;
							}, adjustmentDuration);
						}
						// 差异小于0.5秒：不做调整，保持流畅性
					} else {
						// 如果服务器说暂停了，本地也暂停
						if (!State.audioPlayer.paused) {
							console.log('[Music] Server says pause, stopping audio player');
							State.audioPlayer.pause();
						}
						State.audioPlayer.currentTime = targetTime;
					}
				}

				const displayTime = room.isPlaying ? (State.audioPlayer.currentTime || targetTime) : targetTime;
				$('#current-time').text(State.formatTime(displayTime));
				const progress = (displayTime / State.audioPlayer.duration) * 100 || 0;
				$('#progress-bar').css('width', progress + '%');
			}
		} else {
			// 没有当前歌曲，重置UI显示
			$('#track-name').text('等待播放');
			$('#track-artist').text('-');
			$('#album-cover').removeClass('playing').html('<i class="fa fa-music fa-5x"></i>');
			$('#current-time').text('00:00');
			$('#progress-bar').css('width', '0%');
			UI.clearPageBackground();

			// 清空歌词
			if (lyricsModule) {
				lyricsModule.clearLyrics();
			}

			// 重置上次状态
			State.lastCoverUrl = null;
			State.lastTrackId = null;

			// 更新播放列表UI,显示"播放列表为空"的状态
			UI.updatePlaylistUI();
		}

		$('#prev-btn').prop('disabled', true);
		$('#next-btn').prop('disabled', true);

		// 如果服务器说暂停了，但本地还在播放，则暂停
		if (!room.isPlaying && State.audioPlayer && !State.audioPlayer.paused) {
			console.log('[Music] Server says pause, stopping audio player');
			State.audioPlayer.pause();
		}

		// 如果没有当前播放歌曲，重置播放器状态
		// 注意：不在这里显示覆盖层，覆盖层只在首次加载或自动播放被阻止时显示
		if (!room.currentTrack) {
			if (State.audioPlayer) {
				State.audioPlayer.pause();
				State.audioPlayer.currentTime = 0;
			}
		}
	};

	// 更新页面背景图
	UI.updatePageBackground = function (coverUrl) {
		$('.music-room-bg').css('background-image', `url(${coverUrl})`);
	};

	// 清除页面背景图
	UI.clearPageBackground = function () {
		$('.music-room-bg').css('background-image', 'none');
	};

	// 更新播放列表UI
	UI.updatePlaylistUI = function () {
		const container = $('#playlist');

		if (!State.currentTrack && State.playlist.length === 0) {
			container.html(`
				<div class="text-center text-muted py-5">
					<i class="fa fa-compact-disc fa-3x mb-3 opacity-25 fa-spin"></i>
					<p>播放列表为空</p>
					<p class="text-sm">快去搜索并添加你喜欢的歌曲吧</p>
				</div>
			`);
			return;
		}

		console.log('[Music] Updating playlist UI - currentTrack:', State.currentTrack ? State.currentTrack.name : 'none', ', playlist:', State.playlist.length, 'tracks');

		let html = '';

		// 如果有正在播放的歌曲，先添加到列表顶部
		if (State.currentTrack) {
			const isPlayingClass = 'track-playing';

			html += `
				<div class="list-group-item d-flex align-items-center border-0 mb-2 rounded-3 shadow-sm ${isPlayingClass}" data-trackid="${State.currentTrack.id}" data-is-current="true">
					<div class="flex-shrink-0 me-3">
						${State.currentTrack.cover ? `<img src="${State.currentTrack.cover}" class="rounded-3 shadow-sm" style="width: 48px; height: 48px; object-fit: cover;" onerror="this.onerror=null; $(this).replaceWith('<div class=\'bg-light rounded-3 d-flex align-items-center justify-content-center\' style=\'width: 48px; height: 48px;\'><i class=\'fa fa-music text-muted\'></i></div>');">` : '<div class="bg-light rounded-3 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;"><i class="fa fa-music text-muted"></i></div>'}
					</div>
					<div class="flex-grow-1 overflow-hidden">
						<div class="text-truncate fw-bold mb-0">${State.currentTrack.name}</div>
						<div class="text-xs text-muted text-truncate">${State.currentTrack.artist || '-'}</div>
					</div>
					<div class="flex-shrink-0">
						<div class="d-flex align-items-center text-primary opacity-75 small">
							<i class="fa fa-user me-1"></i>
							<span class="fw-medium">${State.currentTrack.addedBy || '系统'}</span>
						</div>
					</div>
				</div>
			`;
		}

		// 添加待播歌曲
		State.playlist.forEach(function (track, index) {
			const sourceBadge = track.source === 'netease' ?
				'<span class="source-badge ms-1">网易云</span>' :
				'<span class="source-badge ms-1">QQ</span>';

			html += `
				<div class="list-group-item d-flex align-items-center border-0 mb-2 rounded-3 shadow-sm" data-trackid="${track.id}" data-is-current="false">
					<div class="flex-shrink-0 me-3">
						${track.cover ? `<img src="${track.cover}" class="rounded-3 shadow-sm" style="width: 48px; height: 48px; object-fit: cover;" onerror="this.onerror=null; $(this).replaceWith('<div class=\'bg-light rounded-3 d-flex align-items-center justify-content-center\' style=\'width: 48px; height: 48px;\'><i class=\'fa fa-music text-muted\'></i></div>');">` : '<div class="bg-light rounded-3 d-flex align-items-center justify-content-center" style="width: 48px; height: 48px;"><i class="fa fa-music text-muted"></i></div>'}
					</div>
					<div class="flex-grow-1 overflow-hidden">
						<div class="text-truncate fw-bold mb-0">${track.name}${sourceBadge}</div>
						<div class="text-xs text-muted text-truncate">${track.artist || '-'}</div>
					</div>
					<div class="flex-shrink-0">
						<div class="d-flex align-items-center text-primary opacity-75 small">
							<i class="fa fa-user me-1"></i>
							<span class="fw-medium">${track.addedBy || '系统'}</span>
						</div>
					</div>
				</div>
			`;
		});

		container.html(html);
	};

	// 显示搜索结果
	UI.showSearchResults = function (items, type = 'song') {
		const container = $('#search-results');
		const defaultCover = '/assets/images/music-cover.png';

		let html = '';

		if (type === 'playlist') {
			// 显示收藏歌单列表
			for (const playlist of items) {
				// 检查是否是网易云音乐歌单
				const isNetease = playlist.source === 'netease';
				let playlistId, playlistName, creator, songCount, coverUrl;

				if (isNetease) {
					// 网易云格式
					playlistId = playlist.id;
					playlistName = playlist.name || '未知歌单';
					creator = playlist.creator || '未知创建者';
					songCount = playlist.trackCount || 0;
					coverUrl = playlist.cover || defaultCover;
				} else {
					// QQ音乐格式
					playlistId = playlist.dissid;
					playlistName = playlist.dissname || '未知歌单';
					creator = playlist.nickname || '未知创建者';
					songCount = playlist.songnum || 0;
					coverUrl = playlist.logo || defaultCover;
				}

				// 添加来源徽章
				const sourceBadge = isNetease ?
					'<span class="badge bg-secondary ms-1" style="font-size: 10px;">网易云</span>' : '';

				html += `
					<div class="list-group-item d-flex justify-content-between align-items-center" data-playlist-id="${playlistId}" data-playlist-name="${playlistName}" data-source="${isNetease ? 'netease' : 'qq'}">
						<div class="d-flex align-items-center" style="flex: 1; min-width: 0;">
							<img src="${coverUrl}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px; margin-right: 12px; flex-shrink: 0;" alt="${playlistName}" onerror="this.onerror=null; this.src='${defaultCover}';">
							<div style="flex: 1; min-width: 0; overflow: hidden;">
								<div class="fw-bold text-truncate">${playlistName}${sourceBadge}</div>
								<small class="text-muted text-truncate">${creator} · ${songCount} 首歌曲</small>
							</div>
						</div>
						<div class="d-flex align-items-center flex-shrink-0">
							<button class="btn btn-sm btn-success add-all-songs-from-playlist-btn" style="margin-right: 8px;" title="添加全部歌曲">
								<i class="fa fa-plus"></i>
							</button>
							<button class="btn btn-sm btn-outline-primary search-playlist-detail-btn">
								<i class="fa fa-list"></i>
							</button>
						</div>
					</div>
				`;
			}
	} else if (type === 'user-playlist') {
			// 显示自建歌单列表
			for (const playlist of items) {
				// 检查是否是网易云音乐歌单
				const isNetease = playlist.source === 'netease';
				let playlistId, playlistName, creator, songCount, coverUrl;

				if (isNetease) {
					// 网易云格式
					playlistId = playlist.id;
					playlistName = playlist.name || '未知歌单';
					creator = playlist.creator || '';
					songCount = playlist.trackCount || 0;
					coverUrl = playlist.cover || defaultCover;
				} else {
					// QQ音乐格式
					playlistId = playlist.tid;
					playlistName = playlist.diss_name || '未知歌单';
					creator = '';
					songCount = playlist.song_cnt || 0;
					coverUrl = playlist.diss_cover || defaultCover;
				}

				// 添加来源徽章
				const sourceBadge = isNetease ?
					'<span class="badge bg-secondary ms-1" style="font-size: 10px;">网易云</span>' : '';

				html += `
					<div class="list-group-item d-flex justify-content-between align-items-center" data-playlist-id="${playlistId}" data-playlist-name="${playlistName}" data-source="${isNetease ? 'netease' : 'qq'}">
						<div class="d-flex align-items-center" style="flex: 1; min-width: 0;">
							<img src="${coverUrl}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px; margin-right: 12px; flex-shrink: 0;" alt="${playlistName}" onerror="this.onerror=null; this.src='${defaultCover}';">
							<div style="flex: 1; min-width: 0; overflow: hidden;">
								<div class="fw-bold text-truncate">${playlistName}${sourceBadge}</div>
								<small class="text-muted text-truncate">${creator ? creator + ' · ' : ''}${songCount} 首歌曲</small>
							</div>
						</div>
						<div class="d-flex align-items-center flex-shrink-0">
							<button class="btn btn-sm btn-success add-all-songs-from-playlist-btn" style="margin-right: 8px;" title="添加全部歌曲">
								<i class="fa fa-plus"></i>
							</button>
							<button class="btn btn-sm btn-outline-primary search-playlist-detail-btn">
								<i class="fa fa-list"></i>
							</button>
						</div>
					</div>
				`;
			}
	} else {
	// 歌单详情页面,添加控制栏(只显示歌曲数量)
		const source = items[0]?.source || 'qq';
		html += `
			<div class="d-flex justify-content-between align-items-center mb-3 px-3 py-2 bg-light rounded">
				<span class="text-muted small"><i class="fa fa-music me-1"></i>共 ${items.length} 首歌曲</span>
			</div>
		`;

	// 显示歌曲搜索结果或歌单详情
		for (const song of items) {
			const isNetease = song.source === 'netease';
			const songName = song.songname || song.title || song.name || '未知歌曲';
			let singer = '';

			if (isNetease) {
				// 网易云音乐格式：后端已经将 singers 数组转换为 singer 字符串
				singer = song.singer || '未知歌手';
			} else {
				// QQ音乐格式：singer 是数组
				singer = (song.singer || []).map(s => s.name).join(', ') || '未知歌手';
			}

			const album = song.albumname || song.album?.name || song.albumName || '';
			const songId = song.songmid || song.id;
			const albummid = song.albummid || song.album?.id || '';
			const duration = song.interval ? State.formatTime(song.interval) : (song.duration ? State.formatTime(song.duration / 1000) : '');
			const coverUrl = song.cover || (albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : defaultCover);

			// 显示来源徽章
			const sourceBadge = isNetease ?
				'<span class="badge bg-secondary ms-2" style="font-size: 10px;">网易云</span>' :
				'<span class="badge bg-primary ms-2" style="font-size: 10px;">QQ</span>';

			html += `
				<div class="list-group-item d-flex justify-content-between align-items-center" data-songid="${songId}" data-source="${song.source || 'qq'}" data-songname="${songName}" data-singer="${singer}" data-cover="${coverUrl}" data-album="${album}">
					<div class="d-flex align-items-center" style="flex: 1; min-width: 0;">
						<img src="${coverUrl}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 4px; margin-right: 12px; flex-shrink: 0;" alt="${songName}" onerror="this.onerror=null; this.src='${defaultCover}';">
						<div style="flex: 1; min-width: 0; overflow: hidden;">
							<div class="fw-bold text-truncate">${songName}${sourceBadge}</div>
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
	}

		container.html(html);

		// 隐藏搜索历史记录
		$('#search-history-container').hide();

		const $resultsContainer = $('#search-results-container');

		// 直接修改内联样式
		$resultsContainer.css({
			'visibility': 'visible',
			'opacity': '1'
		});
	};

	// 更新分页UI
	UI.updatePaginationUI = function () {
		$('#current-page').text(`${State.searchPageNo} / ${State.searchTotalPages || 1}`);
		$('#prev-page-btn').prop('disabled', State.searchPageNo <= 1);
		$('#next-page-btn').prop('disabled', State.searchPageNo >= State.searchTotalPages);

		// 显示/隐藏分页区域
		if (State.searchTotalPages > 1) {
			$('#search-pagination').show();
		} else {
			$('#search-pagination').hide();
		}
	};

	// 显示全屏播放覆盖层
	UI.showPlayOverlay = function () {
		console.log('[Music] Showing play overlay');
		$('#play-overlay').removeClass('hidden');
	};

	// 隐藏全屏播放覆盖层
	UI.hidePlayOverlay = function () {
		console.log('[Music] Hiding play overlay');
		$('#play-overlay').addClass('hidden');
	};

	// 恢复播放器和歌词为默认状态
	UI.resetPlayerAndLyrics = function () {
		// 清除当前歌曲信息
		$('#track-name').text('等待播放');
		$('#track-artist').text('-');

		// 重置专辑封面
		const albumCover = $('#album-cover');
		albumCover.html(`<i class="fa fa-music fa-5x"></i>`);
		albumCover.removeClass('playing');
		UI.clearPageBackground();

		// 重置进度条和时间
		$('#progress-bar').css('width', '0%');
		$('#current-time').text('0:00');
		$('#total-time').text('0:00');

		// 清除歌词
		if (lyricsModule) {
			lyricsModule.clearLyrics();
		}

		// 更新播放列表UI
		UI.updatePlaylistUI();

		// 重置状态
		State.currentTrack = null;
		State.lastTrackId = null;
		State.lastCoverUrl = null;
		State.lastPlaylistJson = null; // 重置播放列表缓存
		State.playlist = []; // 清空播放列表

		// 清空音频播放器
		if (State.audioPlayer) {
			State.audioPlayer.pause();
			State.audioPlayer.currentTime = 0;
		}

		console.log('[Music] Player and lyrics reset to default state');
	};

	return UI;
});
