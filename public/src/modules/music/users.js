// 房间用户列表模块
define('music/users', [
	'alerts',
	'music/state'
], function (alerts, State) {
	const Users = {};

	// 获取房间用户列表
	Users.fetchRoomUsers = async function () {
		if (!State.currentRoomId) return;

		try {
			const response = await socket.emit('modules.music.getRoomUsers', { roomId: State.currentRoomId });
			State.roomUsers = response.users;
			Users.renderRoomUsers();
		} catch (err) {
			console.error('Failed to fetch room users:', err);
		}
	};

	// 渲染房间用户列表
	Users.renderRoomUsers = function () {
		const container = $('#room-users-list');

		if (!State.roomUsers || State.roomUsers.length === 0) {
			container.html(`
				<div class="room-users-empty">
					<i class="fa fa-user-slash"></i>
					<p>房间里没有用户</p>
				</div>
			`);
			return;
		}

		let html = '';
		for (const user of State.roomUsers) {
			// 处理用户名,替换NodeBB语言键为中文(仅听歌房)
			const displayName = user.username === '[[global:guest]]' ? '纯路人' : user.username;

			let badges = '';
			if (user.isHost) {
				badges += '<span class="room-user-badge host">房主</span>';
			}
			if (user.isYou) {
				badges += '<span class="room-user-badge you">你</span>';
			}

			html += `
				<div class="room-user-item">
					${user.picture ?
						`<img src="${user.picture}" class="room-user-avatar" alt="${displayName}">` :
						`<div class="room-user-avatar">${displayName.charAt(0).toUpperCase()}</div>`
					}
					<div class="room-user-info">
						<div class="room-user-name">${displayName}</div>
						${badges ? `<div class="room-user-badges">${badges}</div>` : ''}
					</div>
				</div>
			`;
		}

		container.html(html);
	};

	// 初始化用户列表功能
	Users.init = function () {
		// 如果弹出框不存在，则创建并添加到body
		if ($('#room-users-popover').length === 0) {
			const popoverHtml = `
				<div id="room-users-popover" class="room-users-popover shadow-lg rounded-3" style="display: none;">
					<div class="room-users-popover-header">
						<span><i class="fa fa-users me-2"></i>房间用户</span>
					</div>
					<div class="room-users-popover-body">
						<div id="room-users-list" class="room-users-list">
							<div class="text-center text-muted py-3">
								<i class="fa fa-spinner fa-spin me-2"></i>加载中...
							</div>
						</div>
					</div>
				</div>
			`;
			$('body').append(popoverHtml);
		}

		// hover 显示用户列表
		$('#room-info').hover(
			function () {
				Users.fetchRoomUsers();
				// 使用setTimeout确保DOM已渲染
				setTimeout(() => {
					Users.updatePopoverPosition();
					$('#room-users-popover').show();
				}, 50);
			},
			function () {
				// 延迟隐藏，给用户时间移动到弹出框
				$(this).data('hoverTimer', setTimeout(() => {
					$('#room-users-popover').hide();
				}, 300));
			}
		);

		// 鼠标移入弹出框时取消隐藏
		$(document).on('mouseenter', '#room-users-popover', function () {
			clearTimeout($('#room-info').data('hoverTimer'));
			$(this).show();
		});

		$(document).on('mouseleave', '#room-users-popover', function () {
			$(this).hide();
		});

		// 点击其他地方隐藏弹出框
		$(document).on('click', function (e) {
			if (!$(e.target).closest('#room-info').length && !$(e.target).closest('#room-users-popover').length) {
				$('#room-users-popover').hide();
			}
		});

		// 窗口大小改变时更新弹出框位置
		$(window).on('resize', function () {
			if ($('#room-users-popover').is(':visible')) {
				Users.updatePopoverPosition();
			}
		});

		// 滚动时更新弹出框位置
		$(window).on('scroll', function () {
			if ($('#room-users-popover').is(':visible')) {
				Users.updatePopoverPosition();
			}
		});
	};

	// 更新弹出框位置
	Users.updatePopoverPosition = function () {
		const $roomInfo = $('#room-info');
		const $popover = $('#room-users-popover');

		if ($roomInfo.length === 0 || $popover.length === 0) {
			return;
		}

		// 使用固定定位，相对于视口定位
		const roomInfoRect = $roomInfo[0].getBoundingClientRect();

		// 计算弹出框位置：在目标元素左边，垂直居中
		const popoverWidth = $popover.outerWidth() || 320;
		const popoverHeight = $popover.outerHeight() || 0;
		const left = roomInfoRect.left - popoverWidth - 12;
		const top = roomInfoRect.top + (roomInfoRect.height / 2) - (popoverHeight / 2);

		$popover.css({
			position: 'fixed',
			left: left + 'px',
			top: top + 'px',
			right: 'auto'
		});
	};

	// 处理用户列表更新事件
	Users.onUsersUpdate = function (data) {
		if (data && data.users) {
			State.roomUsers = data.users;
			Users.renderRoomUsers();
		} else {
			console.warn('[Music] onUsersUpdate received invalid data:', data);
		}
	};

	return Users;
});
