// 音乐搜索模块
define('music/search', [
	'alerts',
	'music/state',
	'music/ui'
], function (alerts, State, UI) {
	const Search = {};

	// 当前搜索类型和来源
	Search.searchType = 'song'; // song, user, playlist
	Search.searchSource = 'qq'; // qq, netease

	// 初始化搜索类型按钮
	Search.initSearchTypeButtons = function () {
		$('.search-type-btn').on('click', function () {
			const type = $(this).data('type');
			const source = $(this).data('source');

			// 更新按钮状态
			$('.search-type-btn').removeClass('active');
			$(this).addClass('active');

			// 更新搜索类型
			Search.searchType = type;
			if (source) {
				Search.searchSource = source;
			}

			// 更新占位符文本
			const placeholderMap = {
				'song': '搜索歌曲...',
				'user': '搜索用户...',
				'playlist': '搜索歌单...'
			};
			$('#music-search-input').attr('placeholder', placeholderMap[type] || '搜索...');

			console.log('[Search] Type:', Search.searchType, 'Source:', Search.searchSource);
		});

		// 点击外部关闭搜索结果
		$(document).on('click', function (e) {
			const $container = $('.music-search-card');
			const $target = $(e.target);

			// 如果点击的不是搜索容器内部，则关闭搜索结果
			if (!$container.is($target) && $container.has($target).length === 0) {
				$('#search-results-container').css({
					'visibility': 'hidden',
					'opacity': '0'
				});
			}
		});
	};

	// 搜索音乐
	Search.searchMusic = async function (isPageChange = false) {
		console.log('[Search] searchMusic called, isPageChange:', isPageChange);

		const keyword = $('#music-search-input').val().trim();
		console.log('[Search] Keyword:', keyword);

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
			// 根据搜索类型构建请求参数
			const searchParams = {
				key: State.searchKeyword,
				pageNo: State.searchPageNo,
				pageSize: 10,
				type: Search.searchType,
				source: Search.searchSource
			};

			// 歌曲搜索需要 t 参数
			if (Search.searchType === 'song') {
				searchParams.t = '0';
			}

			console.log('[Search] Sending request with params:', searchParams);

			const response = await fetch('/api/music/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(searchParams),
			});
			const data = await response.json();

			console.log('[Search] Response data:', data);
			console.log('[Search] data.result:', data.result);
			console.log('[Search] data.data:', data.data);
			console.log('[Search] data.data.list:', data.data?.list);
			console.log('[Search] data.data.list.length:', data.data?.list?.length);

			if (data.result !== 100 || !data.data.list || data.data.list.length === 0) {
				console.log('[Search] Condition failed - hiding results container');
				$('#search-results-container').css({
					'visibility': 'hidden',
					'opacity': '0'
				});
				const typeNames = {
					'song': '歌曲',
					'user': '用户',
					'playlist': '歌单'
				};
				alerts.alert({
					title: '未找到',
					message: `未找到相关${typeNames[Search.searchType]}`,
					type: 'info',
				});
				return;
			}

			console.log('[Search] Condition passed - calling UI.showSearchResults with', data.data.list.length, 'songs');
			State.searchTotalPages = Math.ceil((data.data.total || data.data.list.length) / 10);
			UI.updatePaginationUI();
			UI.showSearchResults(data.data.list);
			console.log('[Search] UI.showSearchResults completed');
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

				$('#search-results-container').css({
					'visibility': 'hidden',
					'opacity': '0'
				});
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
