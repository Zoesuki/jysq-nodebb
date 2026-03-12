<div class="row h-100">
	<div class="h-100 {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<!-- 隐藏的音频元素 -->
		<audio id="audio-player" style="display: none;"></audio>

		<!-- 歌词样式 -->
		<style>
			.lyric-line {
				padding: 8px;
				opacity: 0.5;
				transition: all 0.3s ease;
				margin: 5px 0;
			}
			.lyric-line.active {
				opacity: 1;
				color: #007bff;
				font-weight: bold;
			}
			.album-cover img {
				width: 200px;
				height: 200px;
				object-fit: cover;
				border-radius: 8px;
			}
			/* 确保音乐页面容器不会影响整体布局 */
			.music-room-container {
				max-width: 100%;
				overflow: hidden;
			}
		</style>

		<div class="music-room-container h-100 mt-3 mt-md-0 py-md-3">
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
								<div class="d-flex justify-content-center align-items-center gap-4">
									<button id="prev-btn" class="btn btn-link text-dark p-0" title="上一首">
										<i class="fa fa-step-backward fa-2x"></i>
									</button>
									<button id="play-btn" class="btn btn-primary btn-lg rounded-circle shadow" style="width: 64px; height: 64px;" title="播放/暂停">
										<i class="fa fa-play"></i>
									</button>
									<button id="next-btn" class="btn btn-link text-dark p-0" title="下一首">
										<i class="fa fa-step-forward fa-2x"></i>
									</button>
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
									<div class="input-group mb-4 shadow-sm rounded-pill overflow-hidden border">
										<span class="input-group-text bg-white border-0 ps-3">
											<i class="fa fa-search text-muted"></i>
										</span>
										<input type="text" id="music-search-input" class="form-control border-0 px-2" placeholder="搜索并添加音乐...">
										<button id="search-track-btn" class="btn btn-primary px-4">
											搜索
										</button>
									</div>
									<!-- 搜索结果 -->
									<div id="search-results" class="list-group mb-4 shadow-sm rounded-3 overflow-hidden border" style="display: none; max-height: 300px; overflow-y: auto;"></div>
									<!-- 播放列表 -->
									<div id="playlist" class="list-group list-group-flush custom-scrollbar" style="max-height: 400px; overflow-y: auto;">
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
							<div class="card-header bg-transparent border-0 pt-4 px-4">
								<h5 class="card-title fw-bold mb-0"><i class="fa fa-comments text-primary me-2"></i>实时讨论</h5>
							</div>
							<div class="card-body p-4 d-flex flex-column">
								<div id="chat-messages" class="chat-messages overflow-auto mb-4 flex-grow-1 custom-scrollbar" style="height: 400px; background: #f8f9fa; border-radius: 12px; padding: 15px;">
									<div class="text-center text-muted py-3">
										<p class="mb-0">正在连接聊天室...</p>
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
	<div data-widget-area="sidebar" class="h-100 col-lg-3 col-sm-12 {{{ if !widgets.sidebar.length }}}hidden{{{ end }}}">
		{{{ each widgets.sidebar }}}
		{{widgets.sidebar.html}}
		{{{ end }}}
	</div>
</div>
