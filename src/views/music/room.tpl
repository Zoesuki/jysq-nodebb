<!-- 全屏背景 -->
<div class="music-room-bg"></div>

<!-- 内容容器 -->
<div class="music-room-wrapper">
	<div class="row g-0">
	<div class="h-100 {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<!-- 隐藏的音频元素 -->
		<audio id="audio-player" style="display: none;"></audio>

		<!-- 歌词样式 -->
		<style>

			#content > .container,
			#content > .container-fluid {
				margin: 0 !important;
				padding: 0 !important;
				max-width: 100% !important;
			}

			#panel {
				margin: 0 !important;
				padding: 0 !important;
			}

			#panel > .container,
			#panel > .container-fluid {
				margin: 0 !important;
				padding: 0 !important;
			}

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
				padding: 2rem 1rem 1rem 1rem;
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
			}
			.lyric-line.active {
				opacity: 1;
				color: #007bff;
				font-weight: bold;
				transform: scale(1.05);
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
		</style>

		<div class="music-room-container h-100">
			<div class="d-flex flex-column gap-4">
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
									<div id="room-info" class="badge rounded-pill bg-light text-dark px-3 py-2 shadow-sm">
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

								<!-- 控制按钮 -->
								<div class="d-flex justify-content-center align-items-center gap-4 mb-4">
									<div class="d-none">
										<button id="prev-btn"></button>
										<button id="play-btn"></button>
										<button id="next-btn"></button>
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
								<div id="playlist-container">
									<!-- 搜索框 -->
									<div class="input-group mb-3 shadow-sm">
										<span class="input-group-text bg-light border-0">
											<i class="fa fa-search text-muted"></i>
										</span>
										<input type="text" id="music-search-input" class="form-control" placeholder="搜索音乐...">
										<button id="search-track-btn" class="btn btn-primary">
											<i class="fa fa-search"></i>
										</button>
									</div>
									<!-- 搜索结果 -->
									<div id="search-results-container" style="display: none;">
										<div class="card border-0 shadow-sm mb-3">
											<div class="card-body p-0">
												<div id="search-results" class="list-group list-group-flush" style="max-height: 350px; overflow-y: auto;"></div>
											</div>
											<!-- 分页 -->
											<div id="search-pagination" class="card-footer border-0 bg-light py-2 px-3 d-flex justify-content-between align-items-center" style="display: none;">
												<button id="prev-page-btn" class="btn btn-sm btn-outline-primary" disabled>
													<i class="fa fa-chevron-left"></i>
												</button>
												<span class="text-muted small">第 <span id="current-page">1</span> 页</span>
												<button id="next-page-btn" class="btn btn-sm btn-outline-primary" disabled>
													<i class="fa fa-chevron-right"></i>
												</button>
											</div>
										</div>
									</div>
									<!-- 播放列表 -->
									<div id="playlist" class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
										<div class="text-center text-muted py-5">
											<i class="fa fa-compact-disc fa-3x mb-3 opacity-25 fa-spin"></i>
											<p>播放列表为空</p>
											<p class="text-sm">快去搜索并添加你喜欢的歌曲吧</p>
										</div>
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
