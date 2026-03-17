'use strict';

const user = require('../user');
const helpers = require('./helpers');

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
		console.log('[Music Controller] Search request:', { key, type, source, pageNo });

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
			console.log('[Music Controller] NetEase search requested, but not yet implemented');

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
		console.log('[Music Controller] Search response:', data);

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
