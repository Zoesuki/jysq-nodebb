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

		<div class="music-room-container mt-3 py-md-3">
			<div class="d-flex flex-column gap-3">
				<!-- 音乐播放器和歌词 -->
				<div class="card music-player">
					<div class="card-body">
						<div class="row align-items-center">
							<!-- 左侧：播放器 -->
							<div class="col-md-4 text-center">
								<div id="album-cover" class="album-cover mb-3">
									<i class="fa fa-music fa-5x"></i>
								</div>
								<h4 id="track-name">未播放</h4>
								<p id="track-artist" class="text-muted">-</p>
								<div id="room-info" class="text-sm text-muted mt-2">
									<i class="fa fa-users"></i> <span id="listener-count">0</span> 人在听
								</div>
							</div>

							<!-- 右侧：歌词 -->
							<div class="col-md-8">
								<div id="lyrics-container" class="lyrics-container d-flex flex-column justify-content-center" style="height: 250px; overflow-y: auto; text-align: center; padding: 10px; position: relative;">
									<div class="text-muted">
										<i class="fa fa-music fa-2x mb-2"></i>
										<p>播放音乐后显示歌词</p>
									</div>
								</div>
							</div>
						</div>

						<style>
							#lyrics-container {
								max-height: 250px;
							}
						</style>

							<!-- 进度条 -->
							<div id="progress-container" class="mb-2">
								<div class="d-flex justify-content-between text-sm text-muted mb-1">
									<span id="current-time">0:00</span>
									<span id="total-time">0:00</span>
								</div>
								<div class="progress" style="height: 6px;">
									<div id="progress-bar" class="progress-bar" role="progressbar" style="width: 0%"></div>
								</div>
							</div>

							<!-- 控制按钮 -->
							<div class="d-flex justify-content-center gap-3">
								<button id="prev-btn" class="btn btn-outline-secondary btn-sm">
									<i class="fa fa-step-backward"></i>
								</button>
								<button id="play-btn" class="btn btn-primary btn-lg">
									<i class="fa fa-play"></i>
								</button>
								<button id="next-btn" class="btn btn-outline-secondary btn-sm">
									<i class="fa fa-step-forward"></i>
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- 播放列表 -->
				<div class="card">
					<div class="card-header">
						<h5 class="card-title">播放列表</h5>
					</div>
					<div class="card-body">
						<div id="playlist-container">
							<!-- 搜索框 -->
							<div class="input-group mb-3">
								<input type="text" id="music-search-input" class="form-control" placeholder="搜索QQ音乐歌曲">
								<button id="search-track-btn" class="btn btn-primary">
									<i class="fa fa-search"></i> 搜索
								</button>
							</div>
							<!-- 搜索结果 -->
							<div id="search-results" class="list-group mb-3" style="display: none;"></div>
							<!-- 播放列表 -->
							<div id="playlist" class="list-group">
								<div class="text-center text-muted py-4">
									<i class="fa fa-list fa-2x mb-2"></i>
									<p>播放列表为空</p>
									<p class="text-sm">搜索歌曲添加到播放列表</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- 聊天区域 -->
				<div class="card chat-container">
					<div class="card-header">
						<h5 class="card-title">聊天室</h5>
					</div>
					<div class="card-body">
						<div id="chat-messages" class="chat-messages overflow-auto mb-3" style="max-height: 300px;">
							<div class="text-center text-muted py-3">
								<p>开始聊天吧...</p>
							</div>
						</div>
						<div class="input-group">
							<input type="text" id="chat-input" class="form-control" placeholder="输入消息...">
							<button id="send-chat-btn" class="btn btn-primary">
								<i class="fa fa-paper-plane"></i>
							</button>
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
