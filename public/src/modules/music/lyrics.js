// 歌词处理模块
define('music/lyrics', [
	'music/state'
], function (State) {
	const Lyrics = {};

	// 获取歌词
	Lyrics.fetchLyrics = async function (songId) {
		try {
			// 检查是否是网易云音乐的歌曲ID（网易云音乐通常是数字，QQ音乐有字符）
			let apiUrl = `/api/music/lyric/${songId}`;

			// 如果当前播放的是网易云音乐歌曲，使用网易云歌词接口
			if (State.currentTrack && State.currentTrack.source === 'netease') {
				apiUrl = `/api/music/netease/lyric?id=${songId}`;
			}

			const response = await fetch(apiUrl, {
				credentials: 'include',
			});
			const data = await response.json();

			// QQ音乐返回格式
			if (data.result === 100 && data.data && data.data.lyric) {
				// 如果有翻译（trans），使用双语歌词
				if (data.data.trans) {
					Lyrics.parseLyrics(data.data.lyric, data.data.trans);
				} else {
					Lyrics.parseLyrics(data.data.lyric);
				}
			}
			// 网易云音乐返回格式
			else if (data.lrc && data.lrc.lyric) {
				// 网易的翻译在 tlyric 字段
				const transText = data.tlyric ? data.tlyric.lyric : null;
				Lyrics.parseLyrics(data.lrc.lyric, transText);
			} else {
				$('#lyrics-container').html(`
					<div class="text-muted">
						<p>暂无歌词</p>
					</div>
				`);
			}
		} catch (err) {
			console.error('Failed to fetch lyrics:', err);
		}
	};

	// 解析歌词
	Lyrics.parseLyrics = function (lrcText, transText = null) {

		if (!lrcText) {
			$('#lyrics-container').html(`
				<div class="text-muted">
					<p>暂无歌词</p>
				</div>
			`);
			return;
		}

		console.log('[Lyrics] 开始解析歌词, transText:', transText ? '有翻译' : '无翻译');

		const lines = lrcText.split('\n');
		const transLines = transText ? transText.split('\n') : null;
		State.lyricsLines = [];

		// 先解析原文歌词,建立一个时间戳到文本的映射
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// 支持两种时间格式：[mm:ss.xxx] 和 [mm:ss:xxx]
			const match = line.match(/\[(\d{2}):(\d{2})[:.](\d{2,3})\](.*)/);
			if (match) {
				const minutes = parseInt(match[1]);
				const seconds = parseInt(match[2]);
				const milliseconds = parseInt(match[3]);
				const time = minutes * 60 + seconds + milliseconds / 1000;
				const text = match[4].trim();

				if (text) {
					State.lyricsLines.push({ time, text, trans: null });
				}
			}
		}

		console.log('[Lyrics] 解析原文歌词完成, 共', State.lyricsLines.length, '行');

		// 如果有翻译,通过时间戳匹配翻译行
		if (transLines && State.lyricsLines.length > 0) {
			console.log('[Lyrics] 开始解析翻译歌词...');
			// 构建翻译的时间戳映射
			const transMap = new Map();
			for (let i = 0; i < transLines.length; i++) {
				const line = transLines[i];
				const match = line.match(/\[(\d{2}):(\d{2})[:.](\d{2,3})\](.*)/);
				if (match) {
					const minutes = parseInt(match[1]);
					const seconds = parseInt(match[2]);
					const milliseconds = parseInt(match[3]);
					const time = minutes * 60 + seconds + milliseconds / 1000;
					const text = match[4].trim();
					if (text) {
						transMap.set(time, text);
					}
				}
			}

			console.log('[Lyrics] 解析翻译完成, 共', transMap.size, '条');

			// 将翻译文本匹配到原文歌词
			let matchedCount = 0;
			State.lyricsLines.forEach(lyric => {
				if (transMap.has(lyric.time)) {
					lyric.trans = transMap.get(lyric.time);
					matchedCount++;
				}
			});
			console.log('[Lyrics] 成功匹配', matchedCount, '条翻译');
		}

		Lyrics.displayLyrics();
	};

	// 显示歌词
	Lyrics.displayLyrics = function () {
		const container = $('#lyrics-container');

		if (State.lyricsLines.length === 0) {
			container.html(`
				<div class="text-muted">
					<p>暂无歌词</p>
				</div>
			`);
			return;
		}

		let html = '';
		for (let i = 0; i < State.lyricsLines.length; i++) {
			const lyricLine = State.lyricsLines[i];
			// 如果有翻译，显示双语歌词
			if (lyricLine.trans) {
				html += `<p class="lyric-line" data-time="${lyricLine.time}" data-index="${i}">
					${lyricLine.text}<br>
					<span class="lyric-trans">${lyricLine.trans}</span>
				</p>`;
			} else {
				html += `<p class="lyric-line" data-time="${lyricLine.time}" data-index="${i}">${lyricLine.text}</p>`;
			}
		}
		container.html(html);
	};

	// 音频时间更新时同步歌词和进度条
	Lyrics.onTimeUpdate = function () {
		if (!State.audioPlayer) return;

		const currentTime = State.audioPlayer.currentTime;
		const duration = State.audioPlayer.duration;

		// 更新进度条（确保 duration 有效）
		if (duration && duration > 0 && !isNaN(duration)) {
			const progress = (currentTime / duration) * 100;
			$('#progress-bar').css('width', progress + '%');
		}
		$('#current-time').text(State.formatTime(currentTime));

		// 如果没有歌词，直接返回
		if (State.lyricsLines.length === 0) return;

		let activeIndex = -1;

		// 找到当前时间对应的歌词行
		for (let i = 0; i < State.lyricsLines.length; i++) {
			if (State.lyricsLines[i].time <= currentTime) {
				activeIndex = i;
			} else {
				break;
			}
		}

		// 高亮当前歌词行
		if (activeIndex >= 0) {
			const activeLine = $(`.lyric-line[data-index="${activeIndex}"]`);

			// 只在行索引变化时才滚动和高亮
			if (!activeLine.hasClass('active')) {
				$('.lyric-line').removeClass('active').css({
					'opacity': '0.5',
					'font-size': 'inherit',
					'font-weight': 'normal'
				});

				activeLine.addClass('active').css({
					'opacity': '1',
					'font-size': '1.2em',
					'font-weight': 'bold'
				});

				// 滚动到当前歌词
				const container = $('#lyrics-container');
				const containerHeight = container.height();
				const containerScrollTop = container.scrollTop();
				const lineHeight = activeLine.outerHeight();
				const lineTop = activeLine.position().top + containerScrollTop;

				const scrollTo = lineTop - (containerHeight / 2) + (lineHeight / 2);
				container.stop().animate({ scrollTop: scrollTo }, 300);
			}
		}
	};

	// 清除歌词显示
	Lyrics.clearLyrics = function () {
		State.lyricsLines = [];
		$('#lyrics-container').html(`
			<div class="text-muted">
				<p>暂无歌词</p>
			</div>
		`);
	};

	return Lyrics;
});
