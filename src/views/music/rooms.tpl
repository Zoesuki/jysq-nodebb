<div class="row h-100">
	<div class="h-100 {{{if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<div class="music-rooms-container h-100 mt-3 py-md-3">
			<div class="card">
				<div class="card-header">
					<h3 class="card-title">一起听歌</h3>
				</div>
				<div class="card-body">
					<div class="d-flex flex-column gap-3">
						<div class="text-center mb-3">
							<button id="create-music-room" class="btn btn-primary btn-lg">
								<i class="fa fa-music"></i> 创建听歌房间
							</button>
						</div>

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

						<hr>

						<h5 class="mb-3">活跃房间</h5>
						<div id="rooms-list" class="d-flex flex-column gap-2">
							<div class="text-center text-muted py-5">
								<i class="fa fa-music fa-3x mb-3"></i>
								<p>暂无活跃房间，创建一个开始吧！</p>
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
