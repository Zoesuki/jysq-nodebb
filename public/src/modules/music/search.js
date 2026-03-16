// 音乐搜索模块
define('music/search', [
	'alerts',
	'music/state',
	'music/ui'
], function (alerts, State, UI) {
	const Search = {};

	// 搜索音乐
	Search.searchMusic = async function (isPageChange = false) {
		const keyword = $('#music-search-input').val().trim();
		if (!keyword && !isPageChange) {
			alerts.alert({
				title: '提示',
				message: '请输入搜索关键词',
				type: 'info',
			});
			return;
		}

		if (isPageChange) {
			State.searchKeyword = State.searchKeyword || keyword;
		} else {
			State.searchKeyword = keyword;
			State.searchPageNo = 1;
		}

		try {
			const response = await fetch('/api/music/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					key: State.searchKeyword,
					t: '0',
					pageNo: State.searchPageNo,
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

			State.searchTotalPages = Math.ceil((data.data.total || data.data.list.length) / 10);
			UI.updatePaginationUI();
			UI.showSearchResults(data.data.list);
		} catch (err) {
			console.error('Search failed:', err);
			alerts.alert({
				title: '错误',
				message: '搜索失败，请稍后重试',
				type: 'error',
			});
		}
	};

	// 绑定搜索结果的事件
	Search.bindSearchResultsEvents = function () {
		$('#search-results').off('click', '.add-song-btn');
		$('#playlist').off('click', '.remove-track-btn');

		$('#search-results').on('click', '.add-song-btn', async function() {
			const item = $(this).closest('.list-group-item');
			const songmid = item.data('songmid');
			const songName = item.data('songname');
			const singer = item.data('singer');
			const coverUrl = item.data('cover');

			try {
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

				const addResponse = await socket.emit('modules.music.addToPlaylist', { roomId: State.currentRoomId, track: track });
				if (addResponse && addResponse.alreadyExists) {
					alerts.alert({
						title: '提示',
						message: '歌曲已在播放列表中',
						type: 'info',
					});
				}

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
	};

	return Search;
});
