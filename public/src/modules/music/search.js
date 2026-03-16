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

			// 更新按钮显示文本
			const sourceNames = {
				'qq': 'QQ音乐',
				'netease': '网易云音乐'
			};
			const typeNames = {
				'song': '歌曲',
				'user': '用户',
				'playlist': '歌单'
			};
			$('#current-search-type').text(`${sourceNames[source] || ''} ${typeNames[type] || ''}`);

			// 更新占位符文本
			const placeholder = `搜索${sourceNames[source] || ''}${typeNames[type] || ''}...`;
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

			console.log('[Search] Type:', Search.searchType, 'Source:', Search.searchSource);
		});

		// 搜索类型按钮点击切换
		$('#search-type-btn').on('click', function () {
			$(this).toggleClass('show');
			$('.search-dropdown-menu').toggleClass('show');
		});

		// 点击外部关闭搜索结果和下拉菜单
		$(document).on('click', function (e) {
			const $container = $('.search-container');
			const $target = $(e.target);

			// 如果点击的不是搜索容器内部，则关闭搜索结果和下拉菜单
			if (!$container.is($target) && $container.has($target).length === 0) {
				$('#search-results-container').css({
					'visibility': 'hidden',
					'opacity': '0'
				});
				$('#search-type-btn').removeClass('show');
				$('.search-dropdown-menu').removeClass('show');
			}
		});
	};

	// 搜索音乐
	Search.searchMusic = async function (isPageChange = false) {
		console.log('[Search] searchMusic called, isPageChange:', isPageChange);

		const keyword = $('#music-search-input').val().trim();
		console.log('[Search] Input value:', $('#music-search-input').val());
		console.log('[Search] Keyword:', keyword);
		console.log('[Search] Current State.searchKeyword:', State.searchKeyword);
		
		// 如果是分页切换，使用缓存的搜索词
		if (isPageChange) {
			// 如果没有缓存的搜索词，且当前输入框也没有内容，则不执行搜索
			if (!State.searchKeyword && !keyword) {
				console.log('[Search] No keyword available for pagination');
				return;
			}
			// 优先使用缓存的搜索词
			State.searchKeyword = State.searchKeyword || keyword;
			console.log('[Search] Using cached keyword for pagination:', State.searchKeyword);
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
			console.log('[Search] Updating cached keyword from', State.searchKeyword, 'to', keyword);
			State.searchKeyword = keyword;
			State.searchPageNo = 1;
		}

		// 添加loading状态
		const $searchBtn = $('#search-track-btn');
		$searchBtn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> 搜索中...');

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

			if (data.result !== 100 || !data.data.list || data.data.list.length === 0) {
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
						'user': '用户',
						'playlist': '歌单'
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

			console.log('[Search] Condition passed - calling UI.showSearchResults with', data.data.list.length, 'songs');

			// 计算总页数
			const total = data.data.total || data.data.list.length;
			State.searchTotalPages = Math.ceil(total / 10);

			// 保存搜索历史（只在首次搜索时保存）
			if (!isPageChange) {
				Search.saveSearchHistory(State.searchKeyword);
			}

			UI.updatePaginationUI();
			UI.showSearchResults(data.data.list);
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

			// 检查是否点击在搜索容器外部
			if (!$searchContainer.is(e.target) && $searchContainer.has(e.target).length === 0) {
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
						timeout: 3000,
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
