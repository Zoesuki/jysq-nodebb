'use strict';

define('forum/music', [
	'music',
], function (Music) {
	const MusicPage = {};

	$(window).on('action:ajaxify.start', function () {
		// 离开音乐房间
		if (ajaxify.data.roomId) {
			socket.emit('modules.music.leaveRoom', { roomId: ajaxify.data.roomId });
		}
		// 清理事件监听器
		Music.removeListeners();
	});

	MusicPage.init = function () {
		console.log('[Music Page] 页面初始化');
		console.log('[Music Page] 当前页面:', window.location.pathname);

		// 初始化音乐模块
		Music.init();

		// 设置页面标题
		document.title = ajaxify.data.title || '一起听歌';
	};

	return MusicPage;
});
