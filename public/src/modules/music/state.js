// 音乐播放器核心状态和工具函数
define('music/state', [], function () {
	const State = {
		currentRoomId: null,
		isHost: false,
		playlist: [],
		currentTrack: null,
		audioPlayer: null,
		lyricsLines: [],
		isFirstLoad: true,
		isCookieSet: false,
		
		// 搜索分页相关变量
		searchPageNo: 1,
		searchTotalPages: 1,
		searchKeyword: '',
		
		// 缓存相关
		lastTrackId: null,
		lastCoverUrl: null,
		lastPlaylistJson: null,
		lastSyncTime: 0,
		
		// 房间用户列表
		roomUsers: [],
	};

	// 格式化时间为 mm:ss
	State.formatTime = function (seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return mins + ':' + (secs < 10 ? '0' : '') + secs;
	};

	// 获取当前播放的歌曲
	State.getCurrentTrack = function () {
		return State.currentTrack;
	};

	// 获取当前播放歌曲在播放列表中的索引
	State.getCurrentTrackIndex = function () {
		if (!State.currentTrack || !State.playlist || !State.playlist.length) {
			return -1;
		}
		return State.playlist.findIndex(t => t.id === State.currentTrack.id);
	};

	return State;
});
