'use strict';

define('forum/music/room', [
	'music',
], function (Music) {
	console.log('[forum/music/room] 模块加载');
	// 初始化音乐模块
	Music.init();
	return Music;
});
