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
						`<img src="${user.picture}" class="room-user-avatar" alt="${user.username}">` :
						`<div class="room-user-avatar">${user.username.charAt(0).toUpperCase()}</div>`
					}
					<div class="room-user-info">
						<div class="room-user-name">${user.username}</div>
						${badges ? `<div class="room-user-badges">${badges}</div>` : ''}
					</div>
				</div>
			`;
		}

		container.html(html);
	};

	// 初始化用户列表功能
	Users.init = function () {
		// hover 显示用户列表
		$('#room-info').hover(
			function () {
				Users.fetchRoomUsers();
				Users.updatePopoverPosition();
				$('#room-users-popover').show();
			},
			function () {
				// 延迟隐藏，给用户时间移动到弹出框
				$(this).data('hoverTimer', setTimeout(() => {
					$('#room-users-popover').hide();
				}, 300));
			}
		);

		// 鼠标移入弹出框时取消隐藏
		$('#room-users-popover').hover(
			function () {
				clearTimeout($('#room-info').data('hoverTimer'));
				$(this).show();
			},
			function () {
				$(this).hide();
			}
		);

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
	};

	// 更新弹出框位置
	Users.updatePopoverPosition = function () {
		const $roomInfo = $('#room-info');
		const $popover = $('#room-users-popover');

		if ($roomInfo.length === 0 || $popover.length === 0) {
			return;
		}

		const roomInfoOffset = $roomInfo.offset();
		const roomInfoWidth = $roomInfo.outerWidth();
		const roomInfoHeight = $roomInfo.outerHeight();
		const popoverWidth = $popover.outerWidth();

		// 计算弹出框位置：在左侧，垂直居中对齐
		const left = roomInfoOffset.left - popoverWidth - 12;
		const top = roomInfoOffset.top + (roomInfoHeight / 2);

		// 设置弹出框位置
		$popover.css({
			left: left + 'px',
			top: top + 'px',
			marginTop: '-' + ($popover.outerHeight() / 2) + 'px'
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
