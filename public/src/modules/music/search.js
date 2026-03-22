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
// 当前搜索的歌单来源（仅用于歌单详情搜索）
Search.currentPlaylistSource = null;
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
			// 根据来源和类型选择不同的显示名称
			const typeNames = {
				'qq': {
					'song': '歌曲',
					'playlist': '收藏歌单',
					'user-playlist': '自建歌单'
				},
				'netease': {
					'song': '歌曲',
					'playlist': '所有歌单',
					'user': '用户',
					'user-playlist': '用户歌单'
				}
			};
			const typeName = typeNames[source]?.[type] || type;
			$('#current-search-type').text(`${sourceNames[source] || ''} ${typeName}`);

			// 更新占位符文本
			let placeholder = '';
			if (source === 'qq' && (type === 'playlist' || type === 'user-playlist')) {
				// QQ音乐歌单搜索 - 提示输入QQ号
				placeholder = `输入QQ号搜索${typeName}...`;
			} else if (source === 'netease' && type === 'user-playlist') {
				// 网易云用户歌单 - 提示输入用户ID
				placeholder = `输入网易云音乐用户ID...`;
			} else if (source === 'netease' && type === 'user') {
				// 网易云用户 - 提示输入用户名
				placeholder = `输入网易云用户名...`;
			} else {
				// 其他情况 - 通用提示
				placeholder = `搜索${sourceNames[source] || ''}${typeName}...`;
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
			const $dropdownMenu = $('.search-dropdown-menu');
			const $target = $(e.target);

			// 检查点击是否在搜索容器内部(不包括搜索结果容器和下拉菜单)
			const isInSearchContainer = $container.is($target) || $container.has($target).length > 0;
			const isInResults = $resultsContainer.is($target) || $resultsContainer.has($target).length > 0;
			const isInDropdown = $dropdownMenu.is($target) || $dropdownMenu.has($target).length > 0;

			// 如果点击的是搜索容器内部(输入框、按钮等)或者搜索结果内部,不做处理
			if (isInSearchContainer && !isInResults && !isInDropdown) {
				return;
			}

			// 点击搜索结果内部,只关闭下拉菜单,保留搜索结果
			if (isInResults) {
				$('#search-type-btn').removeClass('show');
				$('.search-dropdown-menu').removeClass('show');
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

		// 隐藏搜索历史，显示搜索结果容器
		const $resultsContainer = $('#search-results-container');
		$resultsContainer.css({
			'visibility': 'visible',
			'opacity': '1'
		});

		// 添加loading状态
		const $searchBtn = $('#search-track-btn');
		$searchBtn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> 搜索中...');

		try {
			let apiUrl, searchParams;

			// 根据搜索类型和来源构建请求参数
			if (Search.isSearchingPlaylistDetail) {
				// 搜索歌单详情，使用当前歌单ID和来源
				const playlistSource = Search.currentPlaylistSource || 'qq';
				if (playlistSource === 'netease') {
					apiUrl = `/api/music/netease/playlist/detail?id=${Search.currentPlaylistId}`;
				} else {
					apiUrl = `/api/music/playlist/${Search.currentPlaylistId}`;
				}
				searchParams = {};
			} else if (Search.searchSource === 'netease') {
				// 网易云音乐搜索
				if (Search.searchType === 'user') {
					// 网易云搜索用户
					const type = '1002';
					apiUrl = `/api/music/netease/search?keywords=${encodeURIComponent(State.searchKeyword)}&type=${type}&limit=10&offset=${(State.searchPageNo - 1) * 10}`;
				} else if (Search.searchType === 'user-playlist') {
					// 网易云用户歌单 - 需要用户ID
					const uid = State.searchKeyword.trim();
					if (!uid || isNaN(uid)) {
						alerts.alert({
							title: '提示',
							message: '请输入正确的网易云音乐用户ID',
							type: 'info',
							timeout: 3000,
						});
						return;
					}
					apiUrl = `/api/music/netease/user/playlist?uid=${uid}&limit=10&offset=${(State.searchPageNo - 1) * 10}`;
				} else if (Search.searchType === 'playlist') {
					// 网易云搜索歌单
					const type = '1000';
					apiUrl = `/api/music/netease/search?keywords=${encodeURIComponent(State.searchKeyword)}&type=${type}&limit=10&offset=${(State.searchPageNo - 1) * 10}`;
				} else {
					// 网易云搜索歌曲
					apiUrl = `/api/music/netease/search?keywords=${encodeURIComponent(State.searchKeyword)}&type=1&limit=10&offset=${(State.searchPageNo - 1) * 10}`;
				}
			} else if (Search.searchType === 'playlist') {
				// QQ音乐搜索收藏歌单列表
				searchParams = {
					key: State.searchKeyword,
					pageNo: State.searchPageNo,
					pageSize: 10
				};
				apiUrl = '/api/music/search/playlist';
			} else if (Search.searchType === 'user-playlist') {
				// QQ音乐搜索自建歌单列表
				searchParams = {
					key: State.searchKeyword,
					pageNo: State.searchPageNo,
					pageSize: 10
				};
				apiUrl = '/api/music/search/user-playlist';
			} else {
				// QQ音乐搜索歌曲
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
				method: (Search.searchSource === 'netease' || Search.isSearchingPlaylistDetail) ? 'GET' : 'POST',
				headers: (Search.searchSource === 'netease' || Search.isSearchingPlaylistDetail) ? {} : {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
			};

			// 只有搜索和搜索歌单列表时才添加body
			if (Search.searchSource !== 'netease' && !Search.isSearchingPlaylistDetail) {
				fetchOptions.body = JSON.stringify(searchParams);
			}

			console.log('[Search] Fetching from:', apiUrl);

			const response = await fetch(apiUrl, fetchOptions);
			const data = await response.json();

			console.log('[Search] Response data:', data);

			// 检查是否为错误响应
			if (data.result && data.result !== 100) {
				console.error('[Search] API returned error:', data);
				$('#search-results-container').css({
					'visibility': 'hidden',
					'opacity': '0'
				});

				if (!isPageChange) {
					alerts.alert({
						title: '错误',
						message: data.errMsg || data.message || '搜索失败',
						type: 'error',
						timeout: 3000,
					});
				}
				return;
			}

			// 网易云音乐搜索结果已经通过后端适配,直接使用
			if (Search.searchSource === 'netease' || Search.isSearchingPlaylistDetail) {
				let items = [];

				// 根据搜索类型获取对应的数据字段
				if (Search.searchType === 'user') {
					// 用户搜索
					items = data.data?.list || [];
				} else if (Search.isSearchingPlaylistDetail) {
					// 歌单详情
					items = data.data?.songlist || [];
				} else {
					// 其他搜索(歌曲、歌单)
					items = data.data?.list || [];
				}

				if (!data.data || items.length === 0) {
					console.log('[Search] NetEase search returned empty results');
					$('#search-results-container').css({
						'visibility': 'hidden',
						'opacity': '0'
					});

					if (!isPageChange) {
						alerts.alert({
							title: '提示',
							message: Search.searchType === 'user' ? '未找到相关用户' : '未找到相关歌曲',
							type: 'info',
							timeout: 3000,
						});
					}
					return;
				}

				console.log('[Search] NetEase search found', items.length, Search.searchType === 'user' ? 'users' : 'songs');

				// 计算总页数
				const total = data.data.total || items.length;
				State.searchTotalPages = Math.ceil(total / 10);

				let displayItems = items;

				// 如果是歌单详情,进行前端分页
				if (Search.isSearchingPlaylistDetail) {
					// 缓存所有歌曲
					Search.cachedPlaylistSongs = items;

					// 根据当前页码截取需要显示的歌曲
					const startIndex = (State.searchPageNo - 1) * 10;
					const endIndex = startIndex + 10;
					displayItems = items.slice(startIndex, endIndex);
					console.log('[Search] Paginated playlist songs:', displayItems.length, 'of', items.length, 'total songs, page', State.searchPageNo);
				}

				// 保存搜索历史(只在首次搜索时保存)
				if (!isPageChange && !Search.isSearchingPlaylistDetail) {
					Search.saveSearchHistory(State.searchKeyword);
				}

				UI.updatePaginationUI();
				UI.showSearchResults(displayItems, Search.isSearchingPlaylistDetail ? 'playlist_detail' : Search.searchType);
				console.log('[Search] UI.showSearchResults completed for NetEase');
				return;
			}

			// QQ音乐和其他搜索处理
			// 歌单详情使用 songlist 字段,其他搜索使用 list 字段
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
							'qq': {
								'song': '歌曲',
								'playlist': '收藏歌单',
								'user-playlist': '自建歌单'
							},
							'netease': {
								'song': '歌曲',
								'playlist': '所有歌单',
								'user-playlist': '用户歌单'
							}
						};
						const typeName = typeNames[Search.searchSource]?.[Search.searchType] || Search.searchType;

						let message = '';
						if (Search.searchSource === 'netease') {
							if (Search.searchType === 'user-playlist') {
								message = `未找到该用户的歌单，请确认用户ID是否正确`;
							} else if (Search.searchType === 'playlist') {
								message = `未找到相关所有歌单`;
							} else {
								message = `网易云音乐${typeName}搜索功能开发中,敬请期待`;
							}
						} else {
							message = `在${sourceNames[Search.searchSource]}中未找到相关${typeName}`;
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

			// 为网易云音乐的歌曲添加 source 字段
			if (Search.searchSource === 'netease') {
				displayItems = items.map(item => ({
					...item,
					source: 'netease'
				}));
			}

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

			// 检查错误对象中是否包含API响应的错误信息
			let errorMessage = '搜索失败,请稍后重试';
			if (err.errMsg) {
				errorMessage = err.errMsg;
			} else if (err.message && err.message.includes('500')) {
				// 如果是网络请求失败，尝试从响应中获取错误信息
				errorMessage = '网络错误,请稍后重试';
			}

			alerts.alert({
				title: '错误',
				message: errorMessage,
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
		// 点击搜索输入框显示历史记录和搜索结果
		$('#music-search-input').off('click').on('click', function() {
			// 显示搜索历史和搜索结果
			Search.showSearchHistory();
		});

		// 聚焦搜索输入框也显示历史记录和搜索结果
		$('#music-search-input').off('focus').on('focus', function() {
			// 显示搜索历史和搜索结果
			Search.showSearchHistory();
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

		// 跳转到指定页
		$('#jump-page-btn').off('click').on('click', function() {
			const $pageInput = $('#page-input');
			const targetPage = parseInt($pageInput.val(), 10);

			// 验证页码
			if (isNaN(targetPage) || targetPage < 1) {
				alerts.alert({
					title: '提示',
					message: '请输入有效的页码',
					type: 'info',
					timeout: 3000,
				});
				$pageInput.val(State.searchPageNo);
				return;
			}

			if (targetPage > State.searchTotalPages) {
				alerts.alert({
					title: '提示',
					message: `最大页数为 ${State.searchTotalPages}`,
					type: 'info',
					timeout: 3000,
				});
				$pageInput.val(State.searchPageNo);
				return;
			}

			// 如果输入的是当前页，不需要跳转
			if (targetPage === State.searchPageNo) {
				return;
			}

			State.searchPageNo = targetPage;
			Search.searchMusic(true);
			// 滚动到搜索结果顶部
			$('#search-results').scrollTop(0);
		});

		// 页数输入框回车跳转
		$('#page-input').off('keypress').on('keypress', function(e) {
			if (e.which === 13) { // Enter键
				const $pageInput = $(this);
				const targetPage = parseInt($pageInput.val(), 10);

				// 验证页码
				if (isNaN(targetPage) || targetPage < 1) {
					alerts.alert({
						title: '提示',
						message: '请输入有效的页码',
						type: 'info',
						timeout: 3000,
					});
					$pageInput.val(State.searchPageNo);
					return;
				}

				if (targetPage > State.searchTotalPages) {
					alerts.alert({
						title: '提示',
						message: `最大页数为 ${State.searchTotalPages}`,
						type: 'info',
						timeout: 3000,
					});
					$pageInput.val(State.searchPageNo);
					return;
				}

				// 如果输入的是当前页，不需要跳转
				if (targetPage === State.searchPageNo) {
					return;
				}

				State.searchPageNo = targetPage;
				Search.searchMusic(true);
				// 滚动到搜索结果顶部
				$('#search-results').scrollTop(0);
			}
		});
	};

	// 显示搜索历史
	Search.showSearchHistory = function () {
		const history = Search.getSearchHistory();
		const $container = $('#search-results-container');
		const $historySection = $('#search-history-section');
		const $resultsSection = $('#search-results-section');
		const $chipsContainer = $('#search-history-chips');
		const $resultsContainer = $('#search-results');

		// 显示容器
		$container.css({
			'visibility': 'visible',
			'opacity': '1'
		});

		// 总是显示历史区域
		$historySection.show();

		// 显示之前的搜索结果（如果有内容）
		$resultsSection.show();

		// 如果没有搜索结果，显示空提示
		if ($resultsContainer.children().length === 0) {
			$resultsContainer.html(`
				<div class="text-center text-muted py-4">
					<i class="fa fa-search fa-2x mb-3 opacity-25"></i>
					<p>暂无搜索结果</p>
				</div>
			`);
		}

		// 生成历史记录chips
		let html = '';
		if (history && history.length > 0) {
			history.forEach(function(keyword) {
				html += `
					<span class="history-chip" data-keyword="${keyword}" title="${keyword}">
						<span class="history-text">${keyword}</span>
						<i class="fa fa-times history-remove" style="cursor: pointer;"></i>
					</span>
				`;
			});
		} else {
			html = '<span class="text-muted small">暂无搜索历史</span>';
		}

		$chipsContainer.html(html);

		// 绑定点击事件
		$chipsContainer.find('.history-chip').on('click', function(e) {
			// 如果点击的是删除按钮，不触发搜索
			if ($(e.target).hasClass('history-remove')) {
				e.stopPropagation();
				const keyword = $(this).data('keyword');
				Search.removeSearchHistory(keyword);
				Search.showSearchHistory();
				return;
			}

			const keyword = $(this).data('keyword');
			$('#music-search-input').val(keyword);
			// 执行搜索
			Search.searchMusic(false);
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
		$('#search-results').off('click', '.add-all-songs-btn');
		$('#search-results').off('click', '.add-all-songs-from-playlist-btn');

		// 从歌单列表直接添加全部歌曲
		$('#search-results').on('click', '.add-all-songs-from-playlist-btn', async function() {
			const item = $(this).closest('.list-group-item');
			const playlistId = item.data('playlist-id');
			const playlistName = item.data('playlist-name');
			const playlistSource = item.data('source') || 'qq';

			console.log('[Search] Add all songs from playlist clicked, playlistId:', playlistId, 'source:', playlistSource);

			try {
				let apiUrl;
				if (playlistSource === 'netease') {
					apiUrl = `/api/music/netease/playlist/detail?id=${playlistId}`;
				} else {
					apiUrl = `/api/music/playlist/${playlistId}`;
				}

				const response = await fetch(apiUrl, {
					credentials: 'include',
				});
				const data = await response.json();

				// 获取歌曲列表
				const songs = data.data?.songlist || [];

				if (songs.length === 0) {
					alerts.alert({
						title: '提示',
						message: '该歌单暂无歌曲',
						type: 'info',
						timeout: 3000,
					});
					return;
				}

				// 批量添加歌曲
				await Search.addAllSongsToPlaylist(songs);
			} catch (err) {
				console.error('[Search] Failed to add all songs from playlist:', err);
				alerts.alert({
					title: '错误',
					message: '获取歌单歌曲失败,请重试',
					type: 'error',
					timeout: 3000,
				});
			}
		});

		// 歌单详情按钮点击事件
		$('#search-results').on('click', '.search-playlist-detail-btn', async function() {
			const item = $(this).closest('.list-group-item');
			const playlistId = item.data('playlist-id');
			const playlistName = item.data('playlist-name');
			const playlistSource = item.data('source') || 'qq';

			console.log('[Search] Playlist detail button clicked, playlistId:', playlistId, 'source:', playlistSource);

			// 保存歌单ID和来源到单独的变量
			Search.currentPlaylistId = playlistId;
			Search.currentPlaylistSource = playlistSource; // 保存歌单来源
			// 标记正在搜索歌单详情
			Search.isSearchingPlaylistDetail = true;

			// 执行搜索
			await Search.searchMusic(false);
		});

		// 查看用户歌单按钮点击事件
		$('#search-results').on('click', '.search-user-playlist-btn', async function() {
			const item = $(this).closest('.list-group-item');
			const userId = item.data('user-id');
			const userName = item.data('user-name');

			console.log('[Search] User playlist button clicked, userId:', userId);

			// 切换到用户歌单搜索类型
			Search.searchType = 'user-playlist';
			Search.searchSource = 'netease';

			// 更新搜索框显示为用户ID
			$('#music-search-input').val(userId);

			// 更新搜索类型显示
			$('#current-search-type').text('网易云音乐 用户歌单');

			// 执行搜索
			await Search.searchMusic(false);
		});

		// 添加全部按钮点击事件
		$('#search-results').on('click', '.add-all-songs-btn', async function() {
			const songs = Search.cachedPlaylistSongs || [];
			if (songs.length === 0) {
				alerts.alert({
					title: '提示',
					message: '没有可添加的歌曲',
					type: 'info',
					timeout: 3000,
				});
				return;
			}

			// 添加所有歌曲(不获取url,播放时再加载)
			Search.addAllSongsToPlaylist(songs);
		});

		$('#search-results').on('click', '.add-song-btn', async function() {
			const item = $(this).closest('.list-group-item');
			const songId = item.data('songid');
			const source = item.data('source') || 'qq';
			const songName = item.data('songname');
			const singer = item.data('singer');
			const coverUrl = item.data('cover');

			try {
				// 构建track对象（不包含url，播放时再动态获取）
				const track = {
					id: songId,
					name: songName,
					artist: singer,
					cover: coverUrl,
					source: source,
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

	// 批量添加歌曲到播放列表(播放时才加载url)
	Search.addAllSongsToPlaylist = async function(songs) {
		const total = songs.length;
		let successCount = 0;
		let alreadyExistsCount = 0;

		try {
			for (const song of songs) {
				try {
					const songId = song.songmid || song.id;
					const source = song.source || 'qq';
					const songName = song.songname || song.title || song.name || '未知歌曲';
					let singer = '';

					// 解析歌手信息
					if (source === 'netease') {
						singer = song.singer || '未知歌手';
					} else {
						singer = (song.singer || []).map(s => s.name).join(', ') || '未知歌手';
					}

					const coverUrl = song.cover || '/assets/images/music-cover.png';

					// 构建track对象（不包含url，播放时动态获取）
					const track = {
						id: songId,
						name: songName,
						artist: singer,
						cover: coverUrl,
						source: source,
					};

					// 添加到播放列表
					const addResponse = await socket.emit('modules.music.addToPlaylist', {
						roomId: State.currentRoomId,
						track: track
					});

					if (addResponse && addResponse.alreadyExists) {
						alreadyExistsCount++;
					} else {
						successCount++;
					}
				} catch (err) {
					console.error('[Search] Add song failed:', err);
				}
			}

			// 显示结果
			let message = `成功添加 ${successCount} 首歌曲`;
			if (alreadyExistsCount > 0) {
				message += `\n${alreadyExistsCount} 首歌曲已在播放列表中`;
			}

			alerts.alert({
				title: '添加完成',
				message: message,
				type: 'success',
				timeout: 3000,
			});
		} catch (err) {
			console.error('[Search] Add all songs failed:', err);
			alerts.alert({
				title: '错误',
				message: '批量添加失败,请重试',
				type: 'error',
				timeout: 3000,
			});
		}
	};

	return Search;
});
