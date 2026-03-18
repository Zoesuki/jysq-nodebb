<div class="music-rooms-container h-100 mt-3 mt-md-0 py-md-3">
	<!-- 隐藏的侧边栏占位符，防止 NodeBB 自动包装内容 -->
	<div data-widget-area="sidebar" class="hidden"></div>

	<!-- Hero Section -->
	<div class="music-hero mb-4 p-5 text-white rounded-4 shadow-sm" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
		<div class="row align-items-center">
			<div class="col-md-8">
				<h1 class="display-5 fw-bold mb-2">一起听歌</h1>
				<p class="lead mb-4">在这里，你可以和社区的朋友们实时同步听歌，交流音乐心得。</p>
				<button id="create-music-room" class="btn btn-light btn-lg px-4 shadow-sm">
					<i class="fa fa-plus-circle me-2"></i> 创建听歌房间
				</button>
			</div>
			<div class="col-md-4 d-none d-md-block text-center">
				<i class="fa fa-music fa-5x opacity-50"></i>
			</div>
		</div>
	</div>

	<div class="card border-0 shadow-sm rounded-4">
		<div class="card-body p-4">
			<div id="create-room-modal" class="modal fade" tabindex="-1">
				<div class="modal-dialog">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">创建听歌房间</h5>
							<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
						</div>
						<div class="modal-body">
							<form id="create-room-form">
								<div class="mb-3">
									<label for="room-name" class="form-label">房间名称</label>
									<input type="text" class="form-control" id="room-name" placeholder="例如：今日歌单" required>
								</div>
								<div class="mb-3">
									<label for="room-description" class="form-label">房间描述（可选）</label>
									<textarea class="form-control" id="room-description" rows="2" placeholder="介绍一下这个房间..."></textarea>
								</div>
							</form>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
							<button type="button" class="btn btn-primary" id="create-room-btn">创建</button>
						</div>
					</div>
				</div>
			</div>

			<div class="d-flex justify-content-between align-items-center mb-4">
				<h5 class="fw-bold mb-0"><i class="fa fa-fire text-danger me-2"></i>活跃房间</h5>
				<button id="refresh-rooms" class="btn btn-outline-primary btn-sm">
					<i class="fa fa-refresh me-1"></i> 刷新
				</button>
			</div>
			<div id="rooms-list" class="row g-4">
				<div class="col-12 text-center text-muted py-5">
					<i class="fa fa-music fa-3x mb-3 opacity-25"></i>
					<p class="lead">暂无活跃房间，创建一个开始吧！</p>
				</div>
			</div>
		</div>
	</div>
</div>
