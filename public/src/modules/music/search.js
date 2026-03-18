// 音乐搜索模块
define('music/search', [
	'alerts',
	'music/state',
	'music/ui'
], function (alerts, State, UI) {
const Search = {};

// 当前搜索类型和来源
Search.searchType = 'song'; // song, playlist, user-playlist
Search.searchSource = 'qq'; // qq, netease
// 是否正在搜索歌单详情
Search.isSearchingPlaylistDetail = false;
// 当前搜索的歌单ID（仅用于歌单详情搜索）
Search.currentPlaylistId = null;
// 缓存的歌单所有歌曲（用于前端分页）
Search.cachedPlaylistSongs = null;

	// 初始化搜索类型下拉菜单
	Search.initSearchTypeButtons = function () {
		// 下拉菜单项点击事件
		$('.search-dropdown-item').on('click', function (e) {
			e.preventDefault();
			e.stopPropagation();
			const type = $(this).data('type');
			const source = $(this).data('source');

			// 更新选中状态
			$('.search-dropdown-item').removeClass('active');
			$(this).addClass('active');

			// 关闭下拉菜单
			$('#search-type-btn').removeClass('show');
			$('.search-dropdown-menu').removeClass('show');

			// 更新搜索类型
			Search.searchType = type;
			Search.searchSource = source;
			// 重置歌单详情搜索标志和歌单ID
			Search.isSearchingPlaylistDetail = false;
			Search.currentPlaylistId = null;
			Search.cachedPlaylistSongs = null;

			// 更新按钮显示文本
			const sourceNames = {
				'qq': 'QQ音乐',
				'netease': '网易云音乐'
			};
			const typeNames = {
				'song': '歌曲',
				'playlist': '收藏歌单',
				'user-playlist': '自建歌单'
			};
			$('#current-search-type').text(`${sourceNames[source] || ''} ${typeNames[type] || ''}`);

			// 更新占位符文本
			let placeholder = '';
			if (type === 'playlist' || type === 'user-playlist') {
				placeholder = `搜索${sourceNames[source] || ''}${typeNames[type] || ''}(QQ号)...`;
			} else {
				placeholder = `搜索${sourceNames[source] || ''}${typeNames[type] || ''}...`;
			}
			$('#music-search-input').attr('placeholder', placeholder);

			// 清空之前的搜索结果和状态
			State.searchKeyword = '';
			State.searchPageNo = 1;
			State.searchTotalPages = 0;
			$('#search-results-container').css({
				'visibility': 'hidden',
				'opacity': '0'
			});
			$('#search-results').empty();

		});

		// 搜索类型按钮点击切换
		$('#search-type-btn').on('click', function () {
			$(this).toggleClass('show');
			$('.search-dropdown-menu').toggleClass('show');
		});

		// 点击外部关闭搜索结果和下拉菜单
		$(document).on('click', function (e) {
			const $container = $('.search-container');
			const $resultsContainer = $('#search-results-container');
			const $target = $(e.target);

			// 检查点击是否在搜索容器内部
			const isInSearchContainer = $container.is($target) || $container.has($target).length > 0;

			// 如果点击的是搜索容器内部，不做处理
			if (isInSearchContainer) {
				return;
			}

			// 点击外部，关闭所有
			$('#search-results-container').css({
				'visibility': 'hidden',
				'opacity': '0'
			});
			$('#search-type-btn').removeClass('show');
			$('.search-dropdown-menu').removeClass('show');
		});
	};

	// 搜索音乐
	Search.searchMusic = async function (isPageChange = false) {

		const keyword = $('#music-search-input').val().trim();

		// 如果是歌单详情的分页切换，直接显示缓存的歌单数据
		if (isPageChange && Search.isSearchingPlaylistDetail && Search.cachedPlaylistSongs) {
			const startIndex = (State.searchPageNo - 1) * 10;
			const endIndex = startIndex + 10;
			const paginatedSongs = Search.cachedPlaylistSongs.slice(startIndex, endIndex);

			UI.updatePaginationUI();
			UI.showSearchResults(paginatedSongs, 'playlist_detail');
			return;
		}

		// 如果是分页切换，使用缓存的搜索词
		if (isPageChange) {
			// 如果没有缓存的搜索词，且当前输入框也没有内容，则不执行搜索
			if (!State.searchKeyword && !keyword) {
				return;
			}
			// 优先使用缓存的搜索词
			State.searchKeyword = State.searchKeyword || keyword;
		} else {
			// 新搜索，必须有关键词
			if (!keyword) {
				alerts.alert({
					title: '提示',
					message: '请输入搜索关键词',
					type: 'info',
					timeout: 3000,
				});
				return;
			}
			// 更新缓存的关键词
			State.searchKeyword = keyword;
			State.searchPageNo = 1;
		}

		// 添加loading状态
		const $searchBtn = $('#search-track-btn');
		$searchBtn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> 搜索中...');

		try {
			let apiUrl, searchParams;

			// 根据搜索类型构建请求参数
			if (Search.isSearchingPlaylistDetail) {
				// 搜索歌单详情，使用当前歌单ID
				apiUrl = `/api/music/playlist/${Search.currentPlaylistId}`;
				searchParams = {};
			} else if (Search.searchType === 'playlist') {
				// 搜索收藏歌单列表
				searchParams = {
					key: State.searchKeyword,
					pageNo: State.searchPageNo,
					pageSize: 10
				};
				apiUrl = '/api/music/search/playlist';
			} else if (Search.searchType === 'user-playlist') {
				// 搜索自建歌单列表
				searchParams = {
					key: State.searchKeyword,
					pageNo: State.searchPageNo,
					pageSize: 10
				};
				apiUrl = '/api/music/search/user-playlist';
			} else {
				// 搜索歌曲
				searchParams = {
					key: State.searchKeyword,
					pageNo: State.searchPageNo,
					pageSize: 10,
					type: Search.searchType,
					source: Search.searchSource
				};
				apiUrl = '/api/music/search';

				// 歌曲搜索需要 t 参数
				if (Search.searchType === 'song') {
					searchParams.t = '0';
				}
			}

			// 构建fetch请求
			const fetchOptions = {
				method: Search.isSearchingPlaylistDetail ? 'GET' : 'POST',
				headers: Search.isSearchingPlaylistDetail ? {} : {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
			};

			// 只有搜索和搜索歌单列表时才添加body
			if (!Search.isSearchingPlaylistDetail) {
				fetchOptions.body = JSON.stringify(searchParams);
			}

			console.log('[Search] Fetching from:', apiUrl);

			const response = await fetch(apiUrl, fetchOptions);
			const data = await response.json();

			console.log('[Search] Response data:', data);

			// 歌单详情使用 songlist 字段，其他搜索使用 list 字段
			const listField = Search.isSearchingPlaylistDetail ? 'songlist' : 'list';
			const items = data.data[listField];

			if (data.result !== 100 || !items || items.length === 0) {
				console.log('[Search] Condition failed - hiding results container');
				$('#search-results-container').css({
					'visibility': 'hidden',
					'opacity': '0'
				});

				// 只有在不是分页切换时才提示
				if (!isPageChange) {
					const sourceNames = {
						'qq': 'QQ音乐',
						'netease': '网易云音乐'
					};
					const typeNames = {
						'song': '歌曲',
						'playlist': '收藏歌单',
						'user-playlist': '自建歌单'
					};

					let message = '';
					if (Search.searchSource === 'netease') {
						message = `网易云音乐${typeNames[Search.searchType]}搜索功能开发中，敬请期待`;
					} else {
						message = `在${sourceNames[Search.searchSource]}中未找到相关${typeNames[Search.searchType]}`;
					}

					alerts.alert({
						title: '提示',
						message: message,
						type: 'info',
						timeout: 3000,
					});
				}
				return;
			}

			console.log('[Search] Condition passed - calling UI.showSearchResults with', items.length, 'songs');

			// 计算总页数
			const total = data.data.total || items.length;
			State.searchTotalPages = Math.ceil(total / 10);

			let displayItems = items;

			// 如果是歌单详情，进行前端分页
			if (Search.isSearchingPlaylistDetail) {
				// 缓存所有歌曲
				Search.cachedPlaylistSongs = items;

				// 根据当前页码截取需要显示的歌曲
				const startIndex = (State.searchPageNo - 1) * 10;
				const endIndex = startIndex + 10;
				displayItems = items.slice(startIndex, endIndex);
				console.log('[Search] Paginated playlist songs:', displayItems.length, 'of', items.length, 'total songs, page', State.searchPageNo);
			}

			// 保存搜索历史（只在首次搜索时保存）
			if (!isPageChange && !Search.isSearchingPlaylistDetail) {
				Search.saveSearchHistory(State.searchKeyword);
			}

			UI.updatePaginationUI();
			UI.showSearchResults(displayItems, Search.isSearchingPlaylistDetail ? 'playlist_detail' : Search.searchType);
			console.log('[Search] UI.showSearchResults completed');
		} catch (err) {
			console.error('Search failed:', err);
			alerts.alert({
				title: '错误',
				message: '搜索失败,请稍后重试',
				type: 'error',
				timeout: 3000,
			});
		} finally {
			// 移除loading状态
			$searchBtn.prop('disabled', false).html('<i class="fa fa-search"></i> 搜索');
		}
	};

	// 初始化快捷键和滚动加载
	Search.initShortcuts = function () {
		// 搜索框回车搜索
		$('#music-search-input').off('keypress').on('keypress', function(e) {
			if (e.which === 13) { // Enter键
				e.preventDefault();
				Search.searchMusic(false);
			}
		});

		// 搜索框获取焦点时显示历史记录
		$('#music-search-input').off('focus').on('focus', function() {
			// 如果搜索结果可见，不显示历史记录
			const $resultsContainer = $('#search-results-container');
			if ($resultsContainer.length && $resultsContainer.css('visibility') === 'visible') {
				console.log('[Search] Results visible, not showing history');
				return;
			}
			console.log('[Search] Showing history');
			Search.showSearchHistory();
		});

		// 点击外部隐藏历史记录和搜索结果
		$(document).off('click.music-search').on('click.music-search', function(e) {
			const $searchInput = $('#music-search-input');
			const $historyContainer = $('#search-history-container');
			const $searchContainer = $('.search-container');
			const $resultsContainer = $('#search-results-container');
			const $target = $(e.target);

			// 检查是否点击在搜索容器外部，或者点击的是搜索结果容器
			const isInResultsContainer = $resultsContainer.is($target) || $resultsContainer.has($target).length > 0;
			const isInSearchContainer = $searchContainer.is($target) || $searchContainer.has($target).length > 0;

			if (!isInSearchContainer || isInResultsContainer) {
				$historyContainer.hide();
			}
		});

		// 上一页
		$('#prev-page-btn').off('click').on('click', function() {
			if (State.searchPageNo > 1) {
				State.searchPageNo--;
				Search.searchMusic(true);
				// 滚动到搜索结果顶部
				$('#search-results').scrollTop(0);
			}
		});

		// 下一页
		$('#next-page-btn').off('click').on('click', function() {
			if (State.searchPageNo < State.searchTotalPages) {
				State.searchPageNo++;
				Search.searchMusic(true);
				// 滚动到搜索结果顶部
				$('#search-results').scrollTop(0);
			}
		});
	};

	// 显示搜索历史
	Search.showSearchHistory = function () {
		const history = Search.getSearchHistory();
		const $container = $('#search-history-container');

		if (!history || history.length === 0) {
			$container.hide();
			return;
		}

		let html = '<div class="search-history-card card border-0 shadow-sm" style="background: white; border-radius: 12px; overflow: hidden;">';
		html += '<div class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto; overflow-x: hidden;">';
		history.forEach(function(keyword) {
			html += `
				<button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center search-history-item" data-keyword="${keyword}" style="padding: 12px 16px; border: none; border-bottom: 1px solid #f0f0f0; background: white; transition: all 0.2s ease; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
					<span style="color: #212529; font-size: 14px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${keyword}</span>
					<i class="fa fa-times history-clear-btn" style="cursor: pointer; color: #6c757d; font-size: 14px; padding: 4px; border-radius: 4px; transition: all 0.2s ease; flex-shrink: 0; margin-left: 8px;"></i>
				</button>
			`;
		});
		html += '</div>';
		html += '</div>';

		// 清除历史按钮
		html += `
			<button id="clear-history-btn" class="btn btn-sm btn-light w-100 mt-2" style="border-radius: 8px; border: 1px solid #dee2e6; background: #f8f9fa;">
				<i class="fa fa-trash-o me-1"></i>清除历史
			</button>
		`;

		$container.html(html).show();

		// 绑定事件
		$container.find('[data-keyword]').on('click', function() {
			const keyword = $(this).data('keyword');
			$('#music-search-input').val(keyword);
			// 隐藏历史记录
			$container.hide();
			// 执行搜索
			Search.searchMusic(false);
		});

		$container.find('.history-clear-btn').on('click', function(e) {
			e.stopPropagation();
			const keyword = $(this).closest('[data-keyword]').data('keyword');
			Search.removeSearchHistory(keyword);
			Search.showSearchHistory();
		});

		$('#clear-history-btn').on('click', function() {
			Search.clearSearchHistory();
			$container.hide();
		});
	};

	// 获取搜索历史
	Search.getSearchHistory = function () {
		try {
			const history = localStorage.getItem('music_search_history');
			return history ? JSON.parse(history) : [];
		} catch (e) {
			console.error('Failed to get search history:', e);
			return [];
		}
	};

	// 保存搜索历史
	Search.saveSearchHistory = function (keyword) {
		if (!keyword || keyword.trim() === '') {
			return;
		}

		try {
			let history = Search.getSearchHistory();

			// 移除重复项
			history = history.filter(function(k) {
				return k !== keyword;
			});

			// 添加到开头
			history.unshift(keyword);

			// 限制最多保存10条
			if (history.length > 10) {
				history = history.slice(0, 10);
			}

			localStorage.setItem('music_search_history', JSON.stringify(history));
		} catch (e) {
			console.error('Failed to save search history:', e);
		}
	};

	// 删除单个搜索历史
	Search.removeSearchHistory = function (keyword) {
		try {
			let history = Search.getSearchHistory();
			history = history.filter(function(k) {
				return k !== keyword;
			});
			localStorage.setItem('music_search_history', JSON.stringify(history));
		} catch (e) {
			console.error('Failed to remove search history:', e);
		}
	};

	// 清空搜索历史
	Search.clearSearchHistory = function () {
		try {
			localStorage.removeItem('music_search_history');
		} catch (e) {
			console.error('Failed to clear search history:', e);
		}
	};

	// 绑定搜索结果的事件
	Search.bindSearchResultsEvents = function () {
		$('#search-results').off('click', '.add-song-btn');
		$('#playlist').off('click', '.remove-track-btn');
		$('#search-results').off('click', '.search-playlist-detail-btn');

		// 歌单详情按钮点击事件
		$('#search-results').on('click', '.search-playlist-detail-btn', async function() {
			const item = $(this).closest('.list-group-item');
			const playlistId = item.data('playlist-id');
			const playlistName = item.data('playlist-name');

			console.log('[Search] Playlist detail button clicked, playlistId:', playlistId);

			// 保存歌单ID到单独的变量
			Search.currentPlaylistId = playlistId;
			// 标记正在搜索歌单详情
			Search.isSearchingPlaylistDetail = true;

			// 更新搜索框显示为歌单名称
			$('#music-search-input').val(playlistName);

			// 执行搜索
			await Search.searchMusic(false);
		});

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

				if (data.result !== 100 || !data.data || !data.data[songmid]) {
					alerts.alert({
						title: '错误',
						message: '获取播放链接失败',
						type: 'error',
						timeout: 3000,
					});
					return;
				}

				const track = {
					id: songmid,
					name: songName,
					artist: singer,
					cover: coverUrl,
					url: data.data[songmid],
				};

				const addResponse = await socket.emit('modules.music.addToPlaylist', { roomId: State.currentRoomId, track: track });
				if (addResponse && addResponse.alreadyExists) {
					alerts.alert({
						title: '提示',
						message: '歌曲已在播放列表中',
						type: 'info',
						timeout: 3000,
					});
				}

			} catch (err) {
				console.error('Add song failed:', err);
				alerts.alert({
					title: '错误',
					message: '添加歌曲失败',
					type: 'error',
					timeout: 3000,
				});
			}
		});
	};

	return Search;
});
