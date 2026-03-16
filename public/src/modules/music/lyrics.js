// 歌词处理模块
define('music/lyrics', [
	'music/state'
], function (State) {
	const Lyrics = {};

	// 获取歌词
	Lyrics.fetchLyrics = async function (songId) {
		try {
			const response = await fetch(`/api/music/lyric/${songId}`, {
				credentials: 'include',
			});
			const data = await response.json();

			if (data.result === 100 && data.data && data.data.lyric) {
				Lyrics.parseLyrics(data.data.lyric);
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
	Lyrics.parseLyrics = function (lrcText) {
		if (!lrcText) {
			$('#lyrics-container').html(`
				<div class="text-muted">
					<p>暂无歌词</p>
				</div>
			`);
			return;
		}

		const lines = lrcText.split('\n');
		State.lyricsLines = [];

		for (const line of lines) {
			const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
			if (match) {
				const minutes = parseInt(match[1]);
				const seconds = parseInt(match[2]);
				const milliseconds = parseInt(match[3]);
				const time = minutes * 60 + seconds + milliseconds / 1000;
				const text = match[4].trim();
				if (text) {
					State.lyricsLines.push({ time, text });
				}
			}
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
			html += `<p class="lyric-line" data-time="${State.lyricsLines[i].time}" data-index="${i}">${State.lyricsLines[i].text}</p>`;
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
