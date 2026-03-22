<!-- 全屏背景 -->
<div class="music-room-bg"></div>

<!-- 全屏播放覆盖层 -->
<div id="play-overlay" class="play-overlay hidden">
	<div class="play-overlay-content">
		<div class="play-overlay-icon">
			<i class="fa fa-play-circle"></i>
		</div>
		<div class="play-overlay-title">点击任意位置开始播放</div>
		<div class="play-overlay-desc">浏览器需要用户交互后才能播放音频</div>
	</div>
</div>

<!-- 内容容器 -->
<div class="music-room-wrapper">
	<div class="row g-0">
	<div class="h-100 col-lg-12 col-sm-12">
		<!-- 隐藏的侧边栏占位符，防止 NodeBB 自动包装内容 -->
		<div data-widget-area="sidebar" class="hidden"></div>

		<!-- 隐藏的音频元素 -->
		<audio id="audio-player" style="display: none;"></audio>

		<!-- 歌词样式 -->
		<style>
			/* 全屏背景层 */
			.music-room-bg {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background-size: cover;
				background-position: center;
				background-repeat: no-repeat;
				background-attachment: fixed;
				transition: background-image 0.5s ease;
				z-index: -2;
			}

			/* 毛玻璃效果背景层 */
			.music-room-bg::after {
				content: '';
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(255, 255, 255, 0.85);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				z-index: -1;
				pointer-events: none;
			}

			/* 内容容器 - 保持原有宽度和居中 */
			.music-room-wrapper {
				position: relative;
				z-index: 1;
				max-width: 95%;
				margin-left: auto !important;
				margin-right: auto !important;
				padding: 0 1rem 1rem 1rem;
				width: 100%;
			}

			/* 确保 .row 元素也正确居中 */
			.music-room-wrapper > .row {
				margin-left: auto !important;
				margin-right: auto !important;
				max-width: 100%;
			}

			/* 侧边栏毛玻璃效果 */
			[data-widget-area="sidebar"] {
				position: relative;
				z-index: 1;
				background: rgba(255, 255, 255, 0.6);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				padding: 1rem;
				border-radius: 12px;
				margin-left: 0;
				margin-right: 0;
				margin-top: 2rem;
			}

			/* 确保内容在背景之上 */
			.music-room-container {
				position: relative;
				z-index: 1;
			}

			/* 隐藏播放列表的滚动条 */
			#playlist::-webkit-scrollbar {
				width: 6px;
			}
			#playlist::-webkit-scrollbar-track {
				background: transparent;
			}
			#playlist::-webkit-scrollbar-thumb {
				background: rgba(0, 0, 0, 0.1);
				border-radius: 3px;
			}
			#playlist::-webkit-scrollbar-thumb:hover {
				background: rgba(0, 0, 0, 0.2);
			}

			/* 隐藏搜索结果区域的滚动条 */
			#search-results::-webkit-scrollbar {
				width: 6px;
			}
			#search-results::-webkit-scrollbar-track {
				background: transparent;
			}
			#search-results::-webkit-scrollbar-thumb {
				background: rgba(0, 0, 0, 0.1);
				border-radius: 3px;
			}
			#search-results::-webkit-scrollbar-thumb:hover {
				background: rgba(0, 0, 0, 0.2);
			}

			/* 确保列表项底部没有多余的样式 */
			.list-group-item {
				cursor: default;
				border-bottom: none !important;
				background-color: transparent !important;
				border: none !important;
			}
			.list-group-item:last-child {
				border-bottom: none !important;
			}
			.list-group-item.active {
				background-color: rgba(0, 123, 255, 0.1) !important;
				border: none !important;
			}
			.list-group-item:hover {
				background-color: rgba(0, 123, 255, 0.05) !important;
				box-shadow: none;
				transform: none;
			}

			/* 隐藏list-group的默认边框 */
			.list-group {
				border: none !important;
			}

			/* 彻底隐藏所有滚动条 */
			#playlist,
			#search-results,
			#lyrics-container,
			#chat-messages {
				-ms-overflow-style: none !important;
				scrollbar-width: none !important;
			}
			#playlist::-webkit-scrollbar,
			#search-results::-webkit-scrollbar,
			#lyrics-container::-webkit-scrollbar,
			#chat-messages::-webkit-scrollbar {
				display: none !important;
				width: 0 !important;
				height: 0 !important;
			}

			.lyric-line {
				padding: 8px;
				opacity: 0.5;
				transition: all 0.3s ease;
				margin: 5px 0;
				cursor: default;
				line-height: 1.6;
			}
			.lyric-line .lyric-trans {
				display: block;
				font-size: 0.9em;
				color: #6c757d;
				margin-top: 4px;
			}
			.lyric-line.active {
				opacity: 1;
				color: #007bff;
				font-weight: bold;
				transform: scale(1.05);
			}
			.lyric-line.active .lyric-trans {
				color: #495057;
			}

			/* 正在播放的歌曲样式 */
			.track-playing {
				background: linear-gradient(135deg, rgba(0, 123, 255, 0.1) 0%, rgba(0, 123, 255, 0.05) 100%) !important;
				border-left: 4px solid #007bff !important;
				transition: all 0.3s ease;
			}

			.track-playing:hover {
				background: linear-gradient(135deg, rgba(0, 123, 255, 0.15) 0%, rgba(0, 123, 255, 0.08) 100%) !important;
				transform: translateX(4px);
			}

			/* 全屏播放覆盖层 */
			.play-overlay {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.85);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				z-index: 9999;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				color: white;
				transition: opacity 0.5s ease;
			}

			.play-overlay.hidden {
				opacity: 0;
				pointer-events: none;
			}

			.play-overlay-content {
				text-align: center;
				padding: 2rem;
			}

			.play-overlay-icon {
				font-size: 80px;
				margin-bottom: 2rem;
				opacity: 0.9;
				animation: pulse 2s infinite;
			}

			.play-overlay-title {
				font-size: 24px;
				font-weight: bold;
				margin-bottom: 1rem;
			}

			.play-overlay-desc {
				font-size: 16px;
				opacity: 0.8;
				margin-bottom: 2rem;
			}

			.play-overlay-btn {
				font-size: 18px;
				padding: 15px 40px;
				border-radius: 50px;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				border: none;
				color: white;
				cursor: pointer;
				transition: all 0.3s ease;
				box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
			}

			.play-overlay-btn:hover {
				transform: translateY(-2px);
				box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
			}

			.play-overlay-btn:active {
				transform: translateY(0);
			}

			@keyframes pulse {
				0%, 100% {
					transform: scale(1);
					opacity: 0.9;
				}
				50% {
					transform: scale(1.05);
					opacity: 1;
				}
			}
			.album-cover img {
				width: 200px;
				height: 200px;
				object-fit: cover;
				border-radius: 50%;
				background-color: transparent;
				background-image: none;
				display: block;
			}
			#album-cover {
				background-color: transparent;
				background-image: none;
				border-radius: 50%;
				width: 200px;
				height: 200px;
				display: flex;
				align-items: center;
				justify-content: center;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				overflow: hidden;
			}
			/* 确保音乐页面容器不会影响整体布局 */
			.music-room-container {
				max-width: 100%;
				overflow: hidden;
			}

			/* 卡片半透明效果 */
			.music-player, .chat-container {
				background: rgba(255, 255, 255, 0.7) !important;
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
			}

			/* 房间用户列表弹出框 */
			.room-users-popover {
				position: fixed;
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(15px);
				-webkit-backdrop-filter: blur(15px);
				border-radius: 16px;
				min-width: 280px;
				max-width: 320px;
				max-height: 500px;
				overflow: hidden;
				z-index: 9999;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
				border: 1px solid rgba(255, 255, 255, 0.3);
				animation: slideInLeft 0.3s ease;
			}

			@keyframes slideInLeft {
				from {
					opacity: 0;
					transform: translateX(-10px);
				}
				to {
					opacity: 1;
					transform: translateX(0);
				}
			}

			.room-users-popover-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 14px 18px;
				border-bottom: 1px solid rgba(0, 0, 0, 0.06);
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
			}

			.room-users-popover-header span {
				font-weight: 700;
				color: #495057;
				font-size: 14px;
				letter-spacing: 0.5px;
			}

			.room-users-popover-header i {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}

			.room-users-popover-body {
				max-height: 400px;
				overflow-y: auto;
				padding: 8px;
			}

			.room-users-list {
				display: flex;
				flex-direction: column;
				gap: 6px;
			}

			.room-user-item {
				display: flex;
				align-items: center;
				padding: 12px 14px;
				border-radius: 10px;
				transition: all 0.2s ease;
				cursor: default;
				background: rgba(255, 255, 255, 0.5);
			}

			.room-user-item:hover {
				background: rgba(102, 126, 234, 0.08);
				transform: translateX(2px);
			}

			.room-user-avatar {
				width: 40px;
				height: 40px;
				border-radius: 50%;
				object-fit: cover;
				margin-right: 12px;
				flex-shrink: 0;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				font-weight: 600;
				font-size: 15px;
				box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
			}

			.room-user-info {
				flex: 1;
				min-width: 0;
				overflow: hidden;
			}

			.room-user-name {
				font-weight: 600;
				color: #212529;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				margin-bottom: 4px;
				font-size: 14px;
			}

			.room-user-badges {
				display: flex;
				gap: 4px;
				flex-wrap: wrap;
			}

			.room-user-badge {
				font-size: 10px;
				padding: 2px 8px;
				border-radius: 8px;
				display: inline-block;
				font-weight: 600;
				letter-spacing: 0.3px;
			}

			.room-user-badge.host {
				background: linear-gradient(135deg, #ffc107 0%, #ffb300 100%);
				color: #5c4d00;
				box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
			}

			.room-user-badge.you {
				background: linear-gradient(135deg, #28a745 0%, #218838 100%);
				color: white;
				box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
			}

			.room-users-empty {
				text-align: center;
				padding: 48px 20px;
				color: #6c757d;
			}

			.room-users-empty i {
				font-size: 48px;
				margin-bottom: 12px;
				opacity: 0.3;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}

			.room-users-empty p {
				font-size: 14px;
				margin: 0;
			}

			.cursor-pointer {
				cursor: pointer;
			}

			/* 隐藏滚动条但保留滚动功能 */
			.room-users-popover-body::-webkit-scrollbar {
				width: 4px;
			}

			.room-users-popover-body::-webkit-scrollbar-track {
				background: transparent;
			}

			.room-users-popover-body::-webkit-scrollbar-thumb {
				background: rgba(102, 126, 234, 0.2);
				border-radius: 2px;
			}

			.room-users-popover-body::-webkit-scrollbar-thumb:hover {
				background: rgba(102, 126, 234, 0.4);
			}

			.source-badge {
				font-size: 11px;
				padding: 2px 6px;
				border-radius: 4px;
				background: rgba(0, 123, 255, 0.1);
				color: #007bff;
				font-weight: 600;
				transition: all 0.3s ease;
			}

			/* 搜索输入框样式 */
			#music-search-input {
				border: none;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
			}

			#music-search-input:focus {
				box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
			}

			#search-track-btn {
				border-radius: 0 25px 25px 0;
				font-weight: 500;
				transition: all 0.3s ease;
			}

			#search-track-btn:hover {
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
			}

			.input-group-text {
				border-radius: 25px 0 0 25px;
				border: none;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
			}

			/* 搜索结果区域样式 */
			#search-results-container.visible {
				visibility: visible !important;
				opacity: 1 !important;
			}

			#search-results-container .card {
				border-radius: 12px;
				overflow: hidden;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
				backdrop-filter: blur(10px);
				background: rgba(255, 255, 255, 0.95);
			}

			#search-results {
				max-height: 400px;
				overflow-y: auto;
			}

			#search-results .list-group-item {
				transition: all 0.2s ease;
				border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
				padding: 12px 16px;
			}

			#search-results .list-group-item:hover {
				background: rgba(0, 123, 255, 0.05) !important;
				transform: translateX(4px);
			}

			#search-results .list-group-item:last-child {
				border-bottom: none !important;
			}

			/* 搜索卡片容器 */
			.card.music-search-card {
				position: relative;
			}

			/* 搜索区域样式 */
			.search-container {
				display: flex;
				gap: 0;
				align-items: stretch;
			}

			.search-type-btn {
				border: 1px solid #0d6efd;
				background: white;
				color: #0d6efd;
				font-weight: 500;
				height: 42px;
				min-width: 180px;
				padding: 0 16px;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
				transition: all 0.2s ease;
				border-radius: 21px 0 0 21px;
				cursor: pointer;
				position: relative;
			}

			.search-type-btn:hover {
				background: #0d6efd;
				color: white;
			}

			.search-type-btn.show {
				background: #0d6efd;
				color: white;
			}

			.search-input-field {
				flex: 1;
				border: 1px solid #0d6efd;
				border-left: none;
				border-right: none;
				height: 42px;
				padding: 0 16px;
				font-size: 15px;
				outline: none;
				transition: all 0.2s ease;
			}

			.search-input-field:focus {
				box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
			}

			.search-submit-btn {
				border: 1px solid #0d6efd;
				background: #0d6efd;
				color: white;
				font-weight: 500;
				height: 42px;
				padding: 0 24px;
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 6px;
				transition: all 0.2s ease;
				border-radius: 0 21px 21px 0;
				cursor: pointer;
			}

			.search-submit-btn:hover {
				background: #0b5ed7;
				border-color: #0b5ed7;
			}

			.search-dropdown-menu {
				position: absolute;
				top: 100%;
				left: 0;
				margin-top: 8px;
				border-radius: 8px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				border: 1px solid rgba(0, 0, 0, 0.1);
				min-width: 200px;
				z-index: 10002;
				background: white;
				padding: 4px;
				opacity: 0;
				visibility: hidden;
				transform: translateY(-4px);
				transition: all 0.2s ease;
			}

			.search-dropdown-menu.show {
				opacity: 1;
				visibility: visible;
				transform: translateY(0);
			}

			.search-dropdown-header {
				padding: 8px 12px;
				font-size: 11px;
				font-weight: 600;
				color: #6c757d;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}

			.search-dropdown-item {
				padding: 10px 12px;
				cursor: pointer;
				border-radius: 4px;
				display: flex;
				align-items: center;
				gap: 8px;
				transition: background-color 0.15s ease, color 0.15s ease;
				color: #212529 !important;
				font-size: 14px;
				background: transparent !important;
			}

			.search-dropdown-item:hover {
				background-color: #0d6efd !important;
				color: white !important;
			}

			.search-dropdown-item:hover .search-dropdown-icon {
				color: white !important;
			}

			.search-dropdown-item.active {
				background-color: #0d6efd !important;
				color: white !important;
				font-weight: 500;
			}

			.search-dropdown-item.active .search-dropdown-icon {
				color: white !important;
			}

			.search-dropdown-icon {
				font-size: 14px;
				transition: color 0.15s ease;
				color: #dc3545;
			}

			/* 删除旧的dropdown-item样式，不再使用 */

			/* 搜索历史样式 */
			#search-history-chips {
				max-height: 200px;
				overflow-y: auto;
			}

			.history-chip {
				padding: 6px 12px;
				border-radius: 16px;
				background: linear-gradient(135deg, rgba(13, 110, 253, 0.08) 0%, rgba(13, 110, 253, 0.04) 100%);
				border: 1px solid rgba(13, 110, 253, 0.15);
				color: #0d6efd;
				font-size: 12px;
				font-weight: 500;
				cursor: pointer;
				transition: all 0.2s ease;
				display: inline-flex;
				align-items: center;
				gap: 5px;
				white-space: nowrap;
				max-width: 120px;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.history-chip:hover {
				background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
				color: white;
				transform: translateY(-2px);
				box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
			}

			.history-chip .history-remove {
				font-size: 10px;
				opacity: 0.6;
				transition: opacity 0.2s ease;
			}

			.history-chip:hover .history-remove {
				opacity: 1;
			}

		</style>

		<div class="music-room-container h-100">
			<div class="d-flex flex-column gap-4">
				<!-- 搜索区域 -->
				<div class="card music-search-card border-0 shadow-sm rounded-4 overflow-visible">
					<div class="card-body p-4">
						<div class="row justify-content-center">
							<div class="col-12 col-md-10 col-lg-8">
								<div class="search-container position-relative">
									<!-- 搜索类型按钮 -->
									<div class="dropdown">
										<button class="search-type-btn" id="search-type-btn">
											<i class="fa fa-music"></i>
											<span id="current-search-type">QQ音乐 歌曲</span>
										</button>
										<div class="search-dropdown-menu" aria-labelledby="search-type-btn">
											<div class="search-dropdown-header">QQ音乐</div>
											<div class="search-dropdown-item active" data-type="song" data-source="qq">
												<i class="fa fa-music search-dropdown-icon"></i>歌曲
											</div>
											<div class="search-dropdown-item" data-type="playlist" data-source="qq">
												<i class="fa fa-heart search-dropdown-icon"></i>收藏歌单
											</div>
											<div class="search-dropdown-item" data-type="user-playlist" data-source="qq">
												<i class="fa fa-list search-dropdown-icon"></i>自建歌单
											</div>
											<div class="search-dropdown-header">网易云音乐</div>
											<div class="search-dropdown-item" data-type="song" data-source="netease">
												<i class="fa fa-compact-disc search-dropdown-icon"></i>歌曲
											</div>
											<div class="search-dropdown-item" data-type="playlist" data-source="netease">
												<i class="fa fa-compact-disc search-dropdown-icon"></i>所有歌单
											</div>
											<div class="search-dropdown-item" data-type="user" data-source="netease">
												<i class="fa fa-users search-dropdown-icon"></i>用户
											</div>
											<div class="search-dropdown-item" data-type="user-playlist" data-source="netease">
												<i class="fa fa-user search-dropdown-icon"></i>用户歌单
											</div>
										</div>
									</div>
									<!-- 搜索输入框 -->
									<input type="text" id="music-search-input" class="search-input-field" placeholder="搜索QQ音乐歌曲...">
									<!-- 搜索按钮 -->
									<button id="search-track-btn" class="search-submit-btn">
										<i class="fa fa-search"></i>
										搜索
									</button>
								</div>
								<!-- 搜索结果 - 使用绝对定位，包含搜索历史和搜索结果 -->
								<div id="search-results-container" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 10000; margin-top: 8px; visibility: hidden; opacity: 0; transition: all 0.3s ease;">
									<div class="card border-0 shadow-sm">
										<!-- 搜索历史 -->
										<div id="search-history-section" style="display: none; padding: 16px;">
											<div class="d-flex justify-content-between align-items-center mb-3">
												<span class="text-muted small fw-bold"><i class="fa fa-history me-2"></i>搜索历史</span>
												<button id="clear-history-btn" class="btn btn-sm btn-link text-decoration-none text-muted" style="padding: 0; font-size: 13px;">
													<i class="fa fa-trash-o me-1"></i>清除
												</button>
											</div>
											<div id="search-history-chips" class="d-flex flex-wrap gap-2"></div>
										</div>
										<!-- 搜索结果 -->
										<div id="search-results-section" class="card-body p-0" style="display: none;">
											<div id="search-results" class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;"></div>
										</div>
										<!-- 分页 -->
										<div id="search-pagination" class="card-footer border-0 bg-light py-2 px-3 d-flex justify-content-between align-items-center" style="display: none;">
											<button id="prev-page-btn" class="btn btn-sm btn-outline-primary" disabled>
												<i class="fa fa-chevron-left"></i>
											</button>
											<div class="d-flex align-items-center">
												<input type="number" id="page-input" class="form-control form-control-sm text-center" style="width: 60px;" min="1" value="1" placeholder="按回车跳转">
												<span class="text-muted small ms-2">/ <span id="total-pages">1</span> 页</span>
											</div>
											<button id="next-page-btn" class="btn btn-sm btn-outline-primary" disabled>
												<i class="fa fa-chevron-right"></i>
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- 音乐播放器和歌词 -->
				<div class="card music-player border-0 shadow-sm rounded-4 overflow-hidden">
					<div class="card-body p-4 p-md-5">
						<div class="row g-4 align-items-center">
							<!-- 左侧：播放器 -->
							<div class="col-md-5 text-center">
								<div id="album-cover" class="album-cover mb-4 mx-auto shadow-lg">
									<i class="fa fa-music fa-5x"></i>
				 				</div>
								<div class="track-info mb-4">
									<h2 id="track-name" class="fw-bold mb-1">未播放</h2>
									<p id="track-artist" class="text-muted lead mb-2">-</p>
									<div id="room-info" class="badge rounded-pill bg-light text-dark px-3 py-2 shadow-sm cursor-pointer" data-bs-toggle="tooltip" data-bs-placement="top" title="查看房间用户">
										<i class="fa fa-users text-primary me-2"></i><span id="listener-count" class="fw-bold">0</span> 人正在收听
									</div>
								</div>

								<!-- 进度条 -->
								<div id="progress-container" class="mb-4 px-3">
									<div class="progress mb-2" style="height: 8px; cursor: pointer;">
										<div id="progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
									</div>
									<div class="d-flex justify-content-between text-xs text-muted">
										<span id="current-time">0:00</span>
										<span id="total-time">0:00</span>
								</div>
								</div>



								<!-- 音量控制 -->
								<div class="volume-control d-flex align-items-center justify-content-center gap-3 px-4">
									<button id="mute-btn" class="btn btn-link text-dark p-0" title="静音/取消静音">
										<i class="fa fa-volume-up"></i>
									</button>
									<input type="range" id="volume-slider" class="form-range flex-grow-1" min="0" max="1" step="0.01" value="1" style="max-width: 150px;">
									<span id="volume-percent" class="text-xs text-muted" style="min-width: 35px;">100%</span>
								</div>
							</div>

							<!-- 右侧：歌词 -->
							<div class="col-md-7 border-start d-none d-md-block">
								<div class="lyric-header mb-3 px-4">
									<h5 class="fw-bold mb-0 text-muted"><i class="fa fa-quote-left me-2"></i>歌词</h5>
								</div>
								<div id="lyrics-container" class="lyrics-container" style="height: 400px; overflow-y: auto; text-align: center; padding: 20px; position: relative;">
									<div class="text-muted d-flex flex-column align-items-center justify-content-center h-100">
										<i class="fa fa-music fa-3x mb-3 opacity-25"></i>
										<p class="lead">同步歌词，让听歌更有氛围</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="row g-4">
					<!-- 播放列表 -->
					<div class="col-lg-6">
						<div class="card h-100 border-0 shadow-sm rounded-4">
							<div class="card-header bg-transparent border-0 pt-4 px-4">
								<h5 class="card-title fw-bold mb-0"><i class="fa fa-list-ul text-primary me-2"></i>播放列表</h5>
							</div>
							<div class="card-body p-4">
								<!-- 播放列表 -->
								<div id="playlist" class="list-group list-group-flush" style="max-height: 500px; overflow-y: auto;">
									<div class="text-center text-muted py-5">
										<i class="fa fa-compact-disc fa-3x mb-3 opacity-25 fa-spin"></i>
										<p>播放列表为空</p>
										<p class="text-sm">快去搜索并添加你喜欢的歌曲吧</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- 聊天区域 -->
					<div class="col-lg-6">
						<div class="card h-100 border-0 shadow-sm rounded-4 chat-container">
							<div class="card-header bg-transparent border-0 pt-4 px-4 d-flex justify-content-between align-items-center">
								<h5 class="card-title fw-bold mb-0"><i class="fa fa-comments text-primary me-2"></i>实时讨论</h5>
								<div id="vote-skip-container" class="d-flex align-items-center gap-2">
									<button id="vote-skip-btn" class="btn btn-sm btn-outline-primary rounded-pill px-3" title="投票切换下一首">
										<i class="fa fa-forward me-1"></i> 投票切歌
									</button>
								</div>
							</div>
							<div class="card-body p-4 d-flex flex-column">
								<div id="chat-messages" class="chat-messages overflow-auto mb-4 flex-grow-1" style="height: 400px; background: #f8f9fa; border-radius: 12px; padding: 15px;">
									<div class="text-center text-muted py-3">
										<p class="mb-0">还没有人说话</p>
									</div>
								</div>
								<div class="input-group shadow-sm rounded-pill overflow-hidden border">
									<input type="text" id="chat-input" class="form-control border-0 ps-4" placeholder="说点什么吧...">
									<button id="send-chat-btn" class="btn btn-primary px-4">
										<i class="fa fa-paper-plane"></i>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
