'use strict';

const fs = require('fs').promises;
const path = require('path');
const user = require('../user');
const helpers = require('./helpers');

const COOKIE_FILE_PATH = path.join(__dirname, '../../netease-cookies.json');

const MusicController = module.exports;

MusicController.getRooms = async function (req, res, next) {
	res.locals.metaTags = {
		...res.locals.metaTags,
		name: 'robots',
		content: 'noindex',
	};

	const { userData } = await user.getUserFields(req.uid, ['username', 'userslug', 'picture']);

	const data = {
		title: '一起听歌',
		breadcrumbs: helpers.buildBreadcrumbs([
			{
				text: '一起听歌',
			},
		]),
		userData: userData,
		uid: req.uid,
	};

	res.render('music/rooms', data);
};

MusicController.getRoom = async function (req, res, next) {
	const { roomId } = req.params;

	res.locals.metaTags = {
		...res.locals.metaTags,
		name: 'robots',
		content: 'noindex',
	};

	const { userData } = await user.getUserFields(req.uid, ['username', 'userslug', 'picture']);

	const data = {
		title: `一起听歌 - ${roomId}`,
		breadcrumbs: helpers.buildBreadcrumbs([
			{
				text: '一起听歌',
				url: '/music',
			},
			{
				text: roomId,
			},
		]),
		roomId: roomId,
		userData: userData,
		uid: req.uid,
	};

	res.render('music/room', data);
};

// 代理QQ音乐Cookie设置
MusicController.setCookie = async function (req, res, next) {
	const { id } = req.params;

	try {
		const response = await fetch(`http://localhost:3300/user/getCookie?id=${id}`, {
			headers: {
				'Origin': 'http://localhost:4567',
			},
		});
		const data = await response.json();

		// 将QQ音乐API的所有cookie转发给客户端
		const setCookies = [];
		for (const [key, value] of response.headers) {
			if (key.toLowerCase() === 'set-cookie') {
				setCookies.push(value);
			}
		}
		if (setCookies.length > 0) {
			res.setHeader('Set-Cookie', setCookies);
		}

		res.json(data);
	} catch (err) {
		console.error('Failed to set QQMusic cookie:', err);
		res.status(500).json({ result: 500, errMsg: '设置Cookie失败' });
	}
};

// 代理音乐搜索
MusicController.search = async function (req, res, next) {
	const { key, t = '0', pageNo = 1, pageSize = 20, type = 'song', source = 'qq' } = req.body;

	try {
		// console.log('[Music Controller] Search request:', { key, type, source, pageNo });

		// 根据来源和类型选择不同的API端点
		let apiUrl = '';
		let requestBody = {};

		if (source === 'qq') {
			// QQ音乐搜索
			apiUrl = 'http://localhost:3300/search';
			requestBody = { key, t, pageNo, pageSize };

			// QQ音乐目前只支持歌曲搜索
			if (type !== 'song') {
				return res.json({
					result: 100,
					data: {
						list: [],
						total: 0
					}
				});
			}
		} else if (source === 'netease') {
			// 网易云音乐搜索
			// 这里需要对接网易云API，暂时返回空结果
			// console.log('[Music Controller] NetEase search requested, but not yet implemented');

			return res.json({
				result: 100,
				data: {
					list: [],
					total: 0,
					message: '网易云音乐搜索功能开发中'
				}
			});
		} else {
			// 不支持的来源
			return res.json({
				result: 100,
				data: {
					list: [],
					total: 0
				}
			});
		}

		// 转发客户端的cookie到音乐API
		const cookies = req.headers.cookie;
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': cookies || '',
				'Origin': 'http://localhost:4567',
			},
			body: JSON.stringify(requestBody),
		});

		const data = await response.json();
		// console.log('[Music Controller] Search response:', data);

		res.json(data);
	} catch (err) {
		console.error('Failed to search:', err);
		res.status(500).json({ result: 500, errMsg: '搜索失败' });
	}
};

// 代理QQ音乐歌单列表搜索
MusicController.searchPlaylist = async function (req, res, next) {
	const { key, pageNo = 1, pageSize = 10 } = req.body;

	try {
		console.log('[Music Controller] Search playlist request:', { key, pageNo, pageSize });

		// 使用QQ音乐的用户歌单搜索接口
		const apiUrl = `http://localhost:3300/user/collect/songlist?id=${key}&pageNo=${pageNo}&pageSize=${pageSize}`;

		const cookies = req.headers.cookie;
		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies || '',
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();
		console.log('[Music Controller] Search playlist response:', data);

		res.json(data);
	} catch (err) {
		console.error('Failed to search playlist:', err);
		res.status(500).json({ result: 500, errMsg: '搜索歌单失败' });
	}
};

// 代理QQ音乐播放链接获取
MusicController.getSongUrl = async function (req, res, next) {
	const { id, type = '128' } = req.params;

	try {
		// 转发客户端的cookie到QQ音乐API
		const cookies = req.headers.cookie;
		console.log('[Music Controller] getSongUrl received cookies:', cookies);
		console.log('[Music Controller] getSongUrl request headers:', Object.keys(req.headers));

		const response = await fetch(`http://localhost:3300/song/urls?id=${id}&type=${type}`, {
			headers: {
				'Cookie': cookies || '',
				'Origin': 'http://localhost:4567',
			},
		});
		const data = await response.json();
		res.json(data);
	} catch (err) {
		console.error('Failed to get song URL:', err);
		res.status(500).json({ result: 500, errMsg: '获取播放链接失败' });
	}
};

// 代理QQ音乐歌词获取
MusicController.getLyrics = async function (req, res, next) {
	const { id } = req.params;

	try {
		const cookies = req.headers.cookie;
		const response = await fetch(`http://localhost:3300/lyric?songmid=${id}`, {
			headers: {
				'Cookie': cookies || '',
				'Origin': 'http://localhost:4567',
			},
		});
		const data = await response.json();
		res.json(data);
	} catch (err) {
		console.error('Failed to get lyrics:', err);
		res.status(500).json({ result: 500, errMsg: '获取歌词失败' });
	}
};

// 代理QQ音乐歌单详情获取
MusicController.getPlaylist = async function (req, res, next) {
	const { id } = req.params;

	try {
		console.log('[Music Controller] Get playlist detail, id:', id);

		const cookies = req.headers.cookie;
		const response = await fetch(`http://localhost:3300/songlist?id=${id}`, {
			headers: {
				'Cookie': cookies || '',
				'Origin': 'http://localhost:4567',
			},
		});
		const data = await response.json();
		console.log('[Music Controller] Playlist detail response:', data);
		res.json(data);
	} catch (err) {
		console.error('Failed to get playlist:', err);
		res.status(500).json({ result: 500, errMsg: '获取歌单详情失败' });
	}
};

// 代理QQ音乐用户自建歌单搜索
MusicController.searchUserPlaylist = async function (req, res, next) {
	const { key, pageNo = 1, pageSize = 10 } = req.body;

	try {
		console.log('[Music Controller] Search user playlist request:', { key, pageNo, pageSize });

		// 使用QQ音乐的用户自建歌单搜索接口
		const apiUrl = `http://localhost:3300/user/songlist?id=${key}&pageNo=${pageNo}&pageSize=${pageSize}`;

		const cookies = req.headers.cookie;
		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies || '',
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();
		console.log('[Music Controller] Search user playlist response:', data);
		res.json(data);
	} catch (err) {
		console.error('Failed to search user playlist:', err);
		res.status(500).json({ result: 500, errMsg: '搜索用户歌单失败' });
	}
};

// 获取网易云音乐Cookie
MusicController.getNeteaseCookie = async function (req, res, next) {
	try {

		// 从body raw json的data字段中获取cookie字符串
		const { data } = req.body;

		if (!data) {
			return res.status(400).json({ result: 400, errMsg: '无效的Cookie数据，缺少data字段' });
		}

		// 将cookie字符串解析为对象
		const cookieObj = {};
		data.split(';').forEach(cookie => {
			const [name, value] = cookie.trim().split('=');
			if (name && value) {
				cookieObj[name] = value;
			}
		});


		// 保存cookie到本地文件
		await fs.writeFile(COOKIE_FILE_PATH, JSON.stringify(cookieObj, null, 2), 'utf8');

		res.json({
			result: 200,
			data: {
				message: 'Cookie保存到本地成功',
				count: Object.keys(cookieObj).length
			}
		});
	} catch (err) {
		console.error('[getNeteaseCookie] Failed to save cookie:', err);
		res.status(500).json({ result: 500, errMsg: '保存网易云音乐Cookie失败', error: err.message });
	}
};

// 设置网易云音乐Cookie到浏览器
MusicController.setNeteaseCookie = async function (req, res, next) {
	try {
		// 从文件中读取cookie
		const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
		const cookies = JSON.parse(cookieData);

		if (!cookies || typeof cookies !== 'object') {
			return res.status(400).json({ result: 400, errMsg: 'Cookie文件无效' });
		}

		// 构建Set-Cookie头部，保留所有原始属性
		const setCookies = Object.entries(cookies).map(([name, value]) => {
			let cookieString = `${name}=${value}`;

			// 如果value包含分号，说明它包含了属性
			if (value.includes(';')) {
				// value已经是完整的cookie字符串（包含属性），直接使用
				cookieString = `${name}=${value}`;
			} else {
				// 添加默认属性
				cookieString += '; Path=/; SameSite=Lax';
			}

			return cookieString;
		});

		if (setCookies.length > 0) {
			res.setHeader('Set-Cookie', setCookies);
		}

		res.json({
			result: 200,
			data: {
				message: 'Cookie设置成功',
				count: setCookies.length
			}
		});
	} catch (err) {
		// 文件不存在时返回友好提示
		if (err.code === 'ENOENT') {
			return res.status(404).json({ result: 404, errMsg: 'Cookie文件不存在，请先保存Cookie' });
		}
		console.error('Failed to set NetEase cookie:', err);
		res.status(500).json({ result: 500, errMsg: '设置Cookie失败' });
	}
};

// 网易云音乐搜索
MusicController.neteaseSearch = async function (req, res, next) {
	const { keywords, type = '1', limit = 30, offset = 0 } = req.query;

	if (!keywords) {
		return res.status(400).json({ result: 400, errMsg: '缺少关键词参数' });
	}

	try {
		// 获取cookie
		let cookies = '';
		try {
			const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
			const cookieObj = JSON.parse(cookieData);
			cookies = Object.entries(cookieObj).map(([name, value]) => `${name}=${value}`).join('; ');
		} catch (err) {
			console.warn('[neteaseSearch] No cookie file found');
		}

		const apiUrl = `http://localhost:3000/search?keywords=${encodeURIComponent(keywords)}&type=${type}&limit=${limit}&offset=${offset}`;

		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies,
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();

		// 如果是歌曲搜索(type=1),需要适配格式
		if (type === '1' && data.result && data.result.songs) {
			// 适配为前端需要的格式
			const adaptedList = data.result.songs.map(song => {
				return {
					id: song.id,
					name: song.name,
					singer: song.artists?.[0]?.name || '',
					duration: song.duration,
					cover: song.album?.picUrl || '',
					source: 'netease',
					albumId: song.album?.id,
					albumName: song.album?.name,
					artists: song.artists || []
				};
			});

			res.json({
				result: 100,
				data: {
					list: adaptedList,
					total: data.result.songCount || 0
				}
			});
		} else if (data.result && data.result.playlists) {
			// 歌单搜索,适配格式
			const adaptedList = data.result.playlists.map(playlist => ({
				id: playlist.id,
				name: playlist.name,
				cover: playlist.cover || playlist.coverImgUrl || '', // 兼容两种字段名
				creator: playlist.creator || playlist.creator?.nickname || '',
				trackCount: playlist.trackCount || 0,
				source: 'netease' // 添加 source 标识
			}));

			res.json({
				result: 100,
				data: {
					list: adaptedList,
					total: data.result.playlistCount || 0
				}
			});
		} else if (data.result && (data.result.albums || data.result.artists)) {
			// 专辑、歌手搜索，直接返回
			res.json(data);
		} else {
			// 其他情况直接返回原始数据
			res.json(data);
		}
	} catch (err) {
		console.error('Failed to search NetEase music:', err);
		res.status(500).json({ result: 500, errMsg: '搜索网易云音乐失败' });
	}
};

// 网易云音乐获取歌单详情
MusicController.neteasePlaylistDetail = async function (req, res, next) {
	const { id, limit, offset = 0 } = req.query;

	if (!id) {
		return res.status(400).json({ result: 400, errMsg: '缺少歌单ID参数' });
	}

	try {
		// 获取cookie
		let cookies = '';
		try {
			const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
			const cookieObj = JSON.parse(cookieData);
			cookies = Object.entries(cookieObj).map(([name, value]) => `${name}=${value}`).join('; ');
		} catch (err) {
			console.warn('[neteasePlaylistDetail] No cookie file found');
		}

		let apiUrl = `http://localhost:3000/playlist/track/all?id=${id}&offset=${offset}`;
		if (limit) {
			apiUrl += `&limit=${limit}`;
		}

		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies,
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();

		// 适配返回格式
		if (data.songs && Array.isArray(data.songs)) {
			// 将网易云格式转换为前端需要的格式
			const adaptedSongs = data.songs.map(song => ({
				id: song.id,
				name: song.name,
				singer: song.ar?.map(artist => artist.name).join(', ') || '',
				cover: song.al?.picUrl || '',
				albumName: song.al?.name || '',
				albumId: song.al?.id,
				duration: song.dt, // 毫秒
				artists: song.ar || [],
				source: 'netease'
			}));

			res.json({
				result: 100,
				data: {
					songlist: adaptedSongs,
					total: data.songs.length
				}
			});
		} else {
			res.json(data);
		}
	} catch (err) {
		console.error('Failed to get NetEase playlist detail:', err);
		res.status(500).json({ result: 500, errMsg: '获取网易云音乐歌单详情失败' });
	}
};

// 网易云音乐获取歌曲URL
MusicController.neteaseSongUrl = async function (req, res, next) {
	const { id } = req.query;

	if (!id) {
		return res.status(400).json({ result: 400, errMsg: '缺少歌曲ID参数' });
	}

	try {
		// 获取cookie
		let cookies = '';
		try {
			const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
			const cookieObj = JSON.parse(cookieData);
			cookies = Object.entries(cookieObj).map(([name, value]) => `${name}=${value}`).join('; ');
		} catch (err) {
			console.warn('[neteaseSongUrl] No cookie file found');
		}

		const apiUrl = `http://localhost:3000/song/url?id=${id}`;

		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies,
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();
		res.json(data);
	} catch (err) {
		console.error('Failed to get NetEase song URL:', err);
		res.status(500).json({ result: 500, errMsg: '获取网易云音乐歌曲URL失败' });
	}
};

// 网易云音乐获取歌词
MusicController.neteaseLyric = async function (req, res, next) {
	const { id } = req.query;

	if (!id) {
		return res.status(400).json({ result: 400, errMsg: '缺少歌曲ID参数' });
	}

	try {
		// 获取cookie
		let cookies = '';
		try {
			const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
			const cookieObj = JSON.parse(cookieData);
			cookies = Object.entries(cookieObj).map(([name, value]) => `${name}=${value}`).join('; ');
		} catch (err) {
			console.warn('[neteaseLyric] No cookie file found');
		}

		const apiUrl = `http://localhost:3000/lyric?id=${id}`;

		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies,
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();
		res.json(data);
	} catch (err) {
		console.error('Failed to get NetEase lyric:', err);
		res.status(500).json({ result: 500, errMsg: '获取网易云音乐歌词失败' });
	}
};

// 网易云音乐获取用户歌单
MusicController.neteaseUserPlaylist = async function (req, res, next) {
	const { uid, limit = 30, offset = 0 } = req.query;

	if (!uid) {
		return res.status(400).json({ result: 400, errMsg: '缺少用户ID参数' });
	}

	try {
		// 获取cookie
		let cookies = '';
		try {
			const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
			const cookieObj = JSON.parse(cookieData);
			cookies = Object.entries(cookieObj).map(([name, value]) => `${name}=${value}`).join('; ');
		} catch (err) {
			console.warn('[neteaseUserPlaylist] No cookie file found');
		}

		const apiUrl = `http://localhost:3000/user/playlist?uid=${uid}&limit=${limit}&offset=${offset}`;

		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies,
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();

		// 适配返回格式为前端需要的格式
		if (data.result === 100 && data.data && data.data.list) {
			// 数据已经是正确格式,直接返回
			res.json(data);
		} else {
			// 其他情况直接返回原始数据
			res.json(data);
		}
	} catch (err) {
		console.error('Failed to get NetEase user playlist:', err);
		res.status(500).json({ result: 500, errMsg: '获取网易云音乐用户歌单失败' });
	}
};

// 网易云音乐检查音乐是否可用
MusicController.neteaseCheckMusic = async function (req, res, next) {
	const { id, br = 999000 } = req.query;

	if (!id) {
		return res.status(400).json({ result: 400, errMsg: '缺少歌曲ID参数' });
	}

	try {
		// 获取cookie
		let cookies = '';
		try {
			const cookieData = await fs.readFile(COOKIE_FILE_PATH, 'utf8');
			const cookieObj = JSON.parse(cookieData);
			cookies = Object.entries(cookieObj).map(([name, value]) => `${name}=${value}`).join('; ');
		} catch (err) {
			console.warn('[neteaseCheckMusic] No cookie file found');
		}

		const apiUrl = `http://localhost:3000/check/music?id=${id}&br=${br}`;

		const response = await fetch(apiUrl, {
			headers: {
				'Cookie': cookies,
				'Origin': 'http://localhost:4567',
			},
		});

		const data = await response.json();
		res.json(data);
	} catch (err) {
		console.error('Failed to check NetEase music availability:', err);
		res.status(500).json({ result: 500, errMsg: '检查网易云音乐可用性失败' });
	}
};

