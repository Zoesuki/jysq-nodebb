// 音量控制模块
define('music/volume', [
	'music/state'
], function (State) {
	const Volume = {};

	// 初始化音量控制
	Volume.initVolumeControl = function () {
		const volumeSlider = $('#volume-slider');
		const muteBtn = $('#mute-btn');
		const volumePercent = $('#volume-percent');
		
		let savedVolume = localStorage.getItem('music_room_volume');
		if (savedVolume === null) {
			savedVolume = 1;
		} else {
			savedVolume = parseFloat(savedVolume);
		}

		let isMuted = localStorage.getItem('music_room_muted') === 'true';
		let lastVolume = savedVolume || 1;

		Volume.updateVolume(isMuted ? 0 : savedVolume);
		volumeSlider.val(savedVolume);
		Volume.updateVolumeUI(isMuted ? 0 : savedVolume);

		volumeSlider.on('input', function() {
			const val = parseFloat($(this).val());
			isMuted = val === 0;
			Volume.updateVolume(val);
			Volume.updateVolumeUI(val);
			
			if (val > 0) {
				lastVolume = val;
			}
			
			localStorage.setItem('music_room_volume', val);
			localStorage.setItem('music_room_muted', isMuted);
		});

		muteBtn.on('click', function() {
			isMuted = !isMuted;
			const targetVolume = isMuted ? 0 : lastVolume;
			
			Volume.updateVolume(targetVolume);
			volumeSlider.val(targetVolume);
			Volume.updateVolumeUI(targetVolume);
			
			localStorage.setItem('music_room_muted', isMuted);
		});
	};

	Volume.updateVolume = function (val) {
		if (State.audioPlayer) {
			State.audioPlayer.volume = val;
		}
	};

	Volume.updateVolumeUI = function (val) {
		const volumePercent = $('#volume-percent');
		const muteBtn = $('#mute-btn');
		const icon = muteBtn.find('i');
		
		volumePercent.text(Math.round(val * 100) + '%');
		
		icon.removeClass('fa-volume-up fa-volume-down fa-volume-off fa-volume-mute');
		
		if (val === 0) {
			icon.addClass('fa-volume-mute');
		} else if (val < 0.3) {
			icon.addClass('fa-volume-off');
		} else if (val < 0.7) {
			icon.addClass('fa-volume-down');
		} else {
			icon.addClass('fa-volume-up');
		}
	};

	return Volume;
});
