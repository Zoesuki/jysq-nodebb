<div class="row h-100">
	<div class="h-100 {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<div class="music-room-container h-100 mt-3 py-md-3">
			<div class="d-flex flex-column gap-3">
				<!-- 音乐播放器 -->
				<div class="card music-player">
					<div class="card-body">
						<div class="d-flex flex-column gap-3">
							<!-- 专辑封面和信息 -->
							<div class="d-flex gap-3">
								<div id="album-cover" class="album-cover">
									<i class="fa fa-music fa-5x"></i>
								</div>
								<div class="flex-grow-1">
									<h4 id="track-name">未播放</h4>
									<p id="track-artist" class="text-muted">-</p>
									<div id="room-info" class="text-sm text-muted mt-2">
										<i class="fa fa-users"></i> <span id="listener-count">0</span> 人在听
									</div>
								</div>
							</div>

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
							<div class="input-group mb-3">
								<input type="text" id="music-url-input" class="form-control" placeholder="输入音乐链接（网易云音乐、QQ音乐等）">
								<button id="add-track-btn" class="btn btn-primary">
									<i class="fa fa-plus"></i> 添加
								</button>
							</div>
							<div id="playlist" class="list-group">
								<div class="text-center text-muted py-4">
									<i class="fa fa-list fa-2x mb-2"></i>
									<p>播放列表为空</p>
									<p class="text-sm">添加音乐链接开始听歌</p>
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
