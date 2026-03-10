'use strict';

define('forum/music/rooms', [
	'music',
], function (Music) {
	console.log('[forum/music/rooms] 模块加载');
	// 初始化音乐模块
	Music.init();
	return Music;
});
