// 聊天模块
define('music/chat', [], function () {
	const Chat = {};

	// 发送聊天消息
	Chat.sendChatMessage = function () {
		const input = $('#chat-input');
		const message = input.val().trim();
		if (!message) return;

		Chat.addChatMessage({
			username: app.user.username,
			uid: app.user.uid,
			content: message,
			timestamp: Date.now(),
		}, true);

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

		const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		const html = `
			<div class="chat-message ${isOwn ? 'own' : ''}">
				<div class="message-header">
					<span class="fw-bold me-1">${message.username}</span>
					<span class="text-xs opacity-75">${time}</span>
				</div>
				<div class="d-flex align-items-start ${isOwn ? 'flex-row-reverse' : ''}">
					<div class="flex-shrink-0">
						<img src="${message.picture || '/assets/images/default-avatar.png'}" class="rounded-circle shadow-sm" style="width: 32px; height: 32px; object-fit: cover;">
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
