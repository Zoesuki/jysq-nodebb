'use strict';

define('music/rooms', [
	'alerts',
], function (alerts) {
	const MusicRooms = {};

	let roomListInterval = null;

	MusicRooms.init = function () {
		// 检查是否在房间列表页面
		if (!$('#create-music-room').length) {
			return;
		}

		console.log('[Music Rooms] 初始化房间列表页面');

		// 清理旧的监听器和定时器
		MusicRooms.removeListeners();

		// 移除房间列表页面的旧事件监听器
		$('#create-music-room').off('click');
		$('#create-room-btn').off('click');
		$(document).off('click', '.join-room-btn');
		$(document).off('click', '.delete-room-btn');

		// 加载房间列表
		loadRooms();

		// 创建房间按钮
		$('#create-music-room').on('click', function () {
			$('#create-room-modal').modal('show');
		});

		// 创建房间
		$('#create-room-btn').on('click', function () {
			const roomName = $('#room-name').val().trim();
			if (!roomName) {
				alerts.alert({
					title: '错误',
					message: '请输入房间名称',
					type: 'error',
					timeout: 3000,
				});
				return;
			}

			// 生成房间ID
			const roomId = 'room-' + Date.now();
			ajaxify.go('/music/' + roomId);
			$('#create-room-modal').modal('hide');
		});

		// 加入房间
		$(document).on('click', '.join-room-btn', function () {
			const roomId = $(this).data('room-id');
			ajaxify.go('/music/' + roomId);
		});

		// 定时刷新房间列表（先清理旧的定时器）
		if (roomListInterval) {
			clearInterval(roomListInterval);
		}
		roomListInterval = setInterval(loadRooms, 15000);

		// 刷新按钮
		$('#refresh-rooms').on('click', function () {
			loadRooms();
		});
	};

	MusicRooms.removeListeners = function () {
		// 清理定时器
		if (roomListInterval) {
			clearInterval(roomListInterval);
			roomListInterval = null;
		}

		// 移除 DOM 事件监听器
		$('#create-music-room').off('click');
		$('#create-room-btn').off('click');
		$('#refresh-rooms').off('click');
		$(document).off('click', '.join-room-btn');
		$(document).off('click', '.delete-room-btn');
	};

	async function loadRooms() {
		try {
			const response = await socket.emit('modules.music.getRooms');
			updateRoomsList(response.rooms);
		} catch (err) {
			console.error('Failed to load rooms:', err);
		}
	}

	function updateRoomsList(rooms) {
		const container = $('#rooms-list');

		if (!rooms || rooms.length === 0) {
			container.html(`
				<div class="col-12 text-center text-muted py-5">
					<i class="fa fa-music fa-3x mb-3 opacity-25"></i>
					<p class="lead">暂无活跃房间，创建一个开始吧！</p>
				</div>
			`);
			return;
		}

		// 使用本地的默认封面占位图
		const defaultCover = '/assets/images/music-cover.png';

		let html = '';
		rooms.forEach(function (room) {
			const hasTrack = room.currentTrack && room.currentTrack.cover;
			const cover = hasTrack ? room.currentTrack.cover : defaultCover;
			const trackName = room.currentTrack ? room.currentTrack.name : '暂无播放';
			const artistName = room.currentTrack ? (room.currentTrack.artist || '-') : '-';
			const defaultBg = !hasTrack ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' : '';

			html += `
				<div class="col-md-6 col-lg-4">
					<div class="card h-100 room-item border-0 shadow-sm rounded-4 overflow-hidden position-relative" style="${defaultBg}">
						<div class="room-cover-wrapper position-relative" style="height: 160px;">
							<img src="${cover}" class="card-img-top w-100 h-100 object-fit-cover blur-bg" alt="room cover" onerror="this.onerror=null; this.src='${defaultCover}';">
							<div class="position-absolute top-0 start-0 w-100 h-100 bg-dark opacity-50"></div>
							<div class="position-absolute top-50 start-50 translate-middle text-white text-center w-100 px-3">
								<h5 class="card-title mb-1 text-truncate fw-bold">${room.roomId.replace('room-', '房间 #')}</h5>
								<div class="badge rounded-pill bg-primary shadow-sm">
									<i class="fa fa-users me-1"></i> ${room.listeners} 人在线
								</div>
							</div>
							${room.isPlaying ? '<div class="playing-indicator-v2 position-absolute top-3 end-3"><span class="badge bg-success shadow-sm">播放中</span></div>' : ''}
						</div>
						<div class="card-body p-3">
							<div class="d-flex align-items-center mb-3">
								<div class="flex-shrink-0 me-3">
									<img src="${cover}" class="rounded-3 shadow-sm" style="width: 48px; height: 48px; object-fit: cover;" alt="track cover" onerror="this.onerror=null; this.src='${defaultCover}';">
								</div>
								<div class="flex-grow-1 overflow-hidden">
									<p class="mb-0 text-truncate fw-bold text-sm">${trackName}</p>
									<p class="mb-0 text-truncate text-muted text-xs">${artistName}</p>
								</div>
							</div>
							<button class="btn btn-primary w-100 rounded-pill join-room-btn shadow-sm" data-room-id="${room.roomId}">
								<i class="fa fa-sign-in me-1"></i> 加入房间
							</button>
						</div>
					</div>
				</div>
			`;
		});

		container.html(html);
	}

	// 监听页面跳转事件，清理事件监听器和定时器
	$(window).on('action:ajaxify.start', function () {
		MusicRooms.removeListeners();
	});

	return MusicRooms;
});
