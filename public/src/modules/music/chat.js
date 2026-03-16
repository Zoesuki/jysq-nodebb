// 聊天模块
define('music/chat', ['music/state'], function (State) {
	const Chat = {};

	// 发送聊天消息
	Chat.sendChatMessage = function () {
		const input = $('#chat-input');
		const message = input.val().trim();
		if (!message) return;

		// 获取当前房间ID
		if (!State.currentRoomId) {
			console.error('[Music] No room ID available');
			return;
		}

		// 通过socket发送消息到服务器
		socket.emit('modules.music.sendChat', {
			roomId: State.currentRoomId,
			content: message
		}).catch(err => {
			console.error('[Music] Failed to send chat message:', err);
		});

		input.val('');
	};

	// 添加聊天消息
	Chat.addChatMessage = function (message, isOwn) {
		const container = $('#chat-messages');

		container.find('.text-center.text-muted').remove();

		// 处理系统消息
		if (message.system) {
			const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			const systemHtml = `
				<div class="chat-message system text-center my-2">
					<span class="badge rounded-pill bg-light text-muted border shadow-sm px-3 py-2">
						<i class="fa fa-info-circle me-1"></i> ${message.content} <small class="ms-2 opacity-75">${time}</small>
					</span>
				</div>
			`;
			container.append(systemHtml);
			container.scrollTop(container[0].scrollHeight);
			return;
		}

		// 使用消息中的头像，如果没有则使用默认头像
		const avatarUrl = message.picture || '/assets/uploads/system/avatar-default.jpeg';

		const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		const html = `
			<div class="chat-message ${isOwn ? 'own' : ''}">
				<div class="message-header">
					<span class="fw-bold me-1">${message.username}</span>
					<span class="text-xs opacity-75">${time}</span>
				</div>
				<div class="d-flex align-items-start ${isOwn ? 'flex-row-reverse' : ''}">
					<div class="flex-shrink-0">
						<img src="${avatarUrl}" class="rounded-circle shadow-sm" style="width: 32px; height: 32px; object-fit: cover;" onerror="this.src='/assets/uploads/system/avatar-default.jpeg'">
					</div>
					<div class="message-content mx-2">
						${message.content}
					</div>
				</div>
			</div>
		`;

		container.append(html);
		container.scrollTop(container[0].scrollHeight);
	};

	return Chat;
});
