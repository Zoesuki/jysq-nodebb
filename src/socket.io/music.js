'use strict';

const _ = require('lodash');

const Music = module.exports;

// 存储房间信息
const musicRooms = new Map();
// 存储每个 socket 所在的房间
const socketToRooms = new Map();
// 存储用户最后活跃时间（用于心跳检测）
const userLastActive = new Map();

// 心跳检测间隔（30秒）
const HEARTBEAT_INTERVAL = 30000;

// 初始化，注册断开连接的钩子
setTimeout(() => {
	const plugins = require('../plugins');
	plugins.hooks.register('music', {
		hook: 'action:sockets.disconnect',
		method: function (data) {
			const { socket } = data;
			const roomIds = socketToRooms.get(socket.id);
			if (roomIds) {
				for (const roomId of roomIds) {
					Music.leaveRoom(socket, { roomId });
				}
				socketToRooms.delete(socket.id);
			}
			// 清除用户活跃时间记录
			userLastActive.delete(socket.uid);
		},
	});
}, 0);

// 心跳检测 - 定期检查不活跃用户并从房间移除
setInterval(() => {
	const now = Date.now();
	const inactiveUsers = [];

	for (const [uid, lastActive] of userLastActive.entries()) {
		// 如果用户超过90秒没有活动，视为掉线
		if (now - lastActive > 90000) {
			inactiveUsers.push(uid);
		}
	}

	if (inactiveUsers.length > 0) {
		console.log('[Music] Detected inactive users:', inactiveUsers);
		// 遍历所有房间，移除不活跃用户
		for (const [roomId, room] of musicRooms.entries()) {
			let roomChanged = false;
			room.listeners = room.listeners.filter(listener => {
				const isInactive = inactiveUsers.includes(listener.uid);
				if (isInactive) {
					console.log(`[Music] Removing inactive user ${listener.uid} from room ${roomId}`);
					userLastActive.delete(listener.uid);
					roomChanged = true;
				}
				return !isInactive;
			});

			if (roomChanged) {
				// 如果房间为空，清理房间
				if (room.listeners.length === 0) {
					musicRooms.delete(roomId);
					console.log(`[Music] Room ${roomId} is now empty, cleaning up`);
				} else {
					// 如果房主离开，重新分配房主
					const hostStillConnected = room.listeners.some(l => l.uid === room.hostId);
					if (!hostStillConnected && room.listeners.length > 0) {
						room.hostId = room.listeners[0].uid;
						console.log(`[Music] Host left room ${roomId}, new host is ${room.hostId}`);
					}

					// 发送用户列表更新
					Music.sendUsersUpdate(roomId);
				}
			}
		}
	}
}, HEARTBEAT_INTERVAL);

// 发送用户列表更新的辅助函数
Music.sendUsersUpdate = async function (roomId) {
	const io = require('./index').server;
	try {
		const room = musicRooms.get(roomId);
		if (!room) {
			return;
		}

		// 计算当前播放进度
		let currentTime = room.currentTime;
		if (room.isPlaying && room.startTime > 0) {
			currentTime = (Date.now() - room.startTime) / 1000;
		}

		// 获取用户列表
		const usersList = await Music.getRoomUsersList(roomId);

		// 发送用户列表更新
		io.to(`music_room_${roomId}`).emit('event:music.users.update', {
			users: usersList
		});

		// 同时发送房间信息更新，确保人数同步
		io.to(`music_room_${roomId}`).emit('event:music.room.update', {
			room: {
				roomId: roomId,
				currentTrack: room.currentTrack,
				isPlaying: room.isPlaying,
				currentTime: currentTime,
				startTime: room.startTime,
				listeners: usersList.length,
				playlist: room.playlist,
				votes: Array.from(room.votes)
			}
		});
	} catch (err) {
		console.error('[Music] Failed to send users update:', err);
	}
};

// 加入听歌房间
Music.joinRoom = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	socket.join(`music_room_${roomId}`);

	// 记录 socket 所在的房间
	if (!socketToRooms.has(socket.id)) {
		socketToRooms.set(socket.id, new Set());
	}
	socketToRooms.get(socket.id).add(roomId);

	// 初始化房间信息
	if (!musicRooms.has(roomId)) {
		musicRooms.set(roomId, {
			roomId: roomId,
			currentTrack: null,
			isPlaying: false,
			currentTime: 0,
			startTime: 0,
			listeners: [], // 存储 { socketId, uid }
			hostId: socket.uid,
			createdAt: Date.now(),
			playlist: [],
			votes: new Set() // 存储投票切歌的 uid
		});
	}

	const room = musicRooms.get(roomId);

	// 计算当前播放进度
	let currentTime = room.currentTime;
	if (room.isPlaying && room.startTime > 0) {
		currentTime = (Date.now() - room.startTime) / 1000;
	}

	// 添加监听者
	if (!room.listeners.some(l => l.socketId === socket.id)) {
		room.listeners.push({ socketId: socket.id, uid: socket.uid });
		// 更新用户活跃时间
		userLastActive.set(socket.uid, Date.now());
	} else {
		// 如果用户已经在房间里，更新活跃时间
		userLastActive.set(socket.uid, Date.now());
	}

	// 向房间内所有用户发送更新
	const io = require('./index').server;
	const roomInfo = {
		roomId: roomId,
		currentTrack: room.currentTrack,
		isPlaying: room.isPlaying,
		currentTime: currentTime,
		startTime: room.startTime,
		listeners: _.uniqBy(room.listeners, 'uid').length,
		isHost: room.hostId === socket.uid,
		playlist: room.playlist,
		votes: Array.from(room.votes)
	};

	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: roomInfo
	});

	// 通知用户列表已更新
	const usersList = await Music.getRoomUsersList(roomId);
	io.to(`music_room_${roomId}`).emit('event:music.users.update', {
		users: usersList
	});

	return {
		room: roomInfo
	};
};

// 离开听歌房间
Music.leaveRoom = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		return;
	}

	socket.leave(`music_room_${roomId}`);

	// 移除 socket 所在的房间记录
	if (socketToRooms.has(socket.id)) {
		socketToRooms.get(socket.id).delete(roomId);
		if (socketToRooms.get(socket.id).size === 0) {
			socketToRooms.delete(socket.id);
		}
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		return;
	}

	// 移除监听者
	const leavingUser = room.listeners.find(l => l.socketId === socket.id);
	room.listeners = room.listeners.filter(l => l.socketId !== socket.id);

	// 如果房间没有监听者了，清理房间
	if (room.listeners.length === 0) {
		musicRooms.delete(roomId);
		return;
	}

	// 如果是房主离开（且房主没有其他 socket 在房间里了）
	const hostStillConnected = room.listeners.some(l => l.uid === room.hostId);
	if (!hostStillConnected && leavingUser && leavingUser.uid === room.hostId) {
		// 重新分配房主给第一个在房间里的其他用户
		room.hostId = room.listeners[0].uid;
	}

	// 向房间内其他用户发送更新
	const io = require('./index').server;
	
	// 计算当前播放进度
	let currentTime = room.currentTime;
	if (room.isPlaying && room.startTime > 0) {
		currentTime = (Date.now() - room.startTime) / 1000;
	}

	const roomInfo = {
		roomId: room.roomId,
		currentTrack: room.currentTrack,
		isPlaying: room.isPlaying,
		currentTime: currentTime,
		startTime: room.startTime,
		listeners: _.uniqBy(room.listeners, 'uid').length,
		playlist: room.playlist,
		votes: Array.from(room.votes)
	};

	// 广播更新
	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: roomInfo
	});

	// 通知用户列表已更新
	const usersList = await Music.getRoomUsersList(roomId);
	io.to(`music_room_${roomId}`).emit('event:music.users.update', {
		users: usersList
	});

};

// 播放音乐
Music.play = async function (socket, data) {
	const { roomId, track } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	// 只有房主可以手动切换播放（通过点击列表）
	if (room.hostId !== socket.uid) {
		throw new Error('Only host can control playback');
	}

	await Music.doPlay(roomId, track);
};

// 内部执行播放逻辑
Music.doPlay = async function (roomId, track) {
	const room = musicRooms.get(roomId);
	if (!room) return;

	room.currentTrack = track;
	room.isPlaying = true;
	room.currentTime = 0;
	room.startTime = Date.now();
	room.votes = new Set(); // 播放新歌曲时重置投票

	// 从播放列表中移除该歌曲（如果存在），确保它作为"正在播放"的歌曲从"待播列表"中移除
	const currentIndex = room.playlist.findIndex(t => t.id === track.id);
	if (currentIndex !== -1) {
		room.playlist.splice(currentIndex, 1);
	}

	const io = require('./index').server;
	io.to(`music_room_${roomId}`).emit('event:music.play', {
		track: track,
		currentTime: 0,
		startTime: room.startTime
	});

	io.to(`music_room_${roomId}`).emit('event:music.chat', {
		message: {
			username: '系统',
			content: `正在播放歌曲：${track.name}`,
			timestamp: Date.now(),
			system: true
		}
	});

	// 通知所有用户播放列表已更新
	io.to(`music_room_${roomId}`).emit('event:music.playlist.update', {
		playlist: room.playlist
	});
};

// 自动播放下一首
Music.playNext = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	if (room.playlist.length === 0) {
		// 没有下一首，停止播放
		room.currentTrack = null;
		room.isPlaying = false;
		room.currentTime = 0;
		room.startTime = 0;
		room.votes = new Set();

		const io = require('./index').server;
		io.to(`music_room_${roomId}`).emit('event:music.room.update', {
			room: {
				roomId: roomId,
				currentTrack: null,
				isPlaying: false,
				currentTime: 0,
				startTime: 0,
				listeners: _.uniqBy(room.listeners, 'uid').length,
				playlist: room.playlist,
				votes: []
			}
		});

		io.to(`music_room_${roomId}`).emit('event:music.playlist.update', {
			playlist: room.playlist
		});
	} else {
		// 播放下一首
		const nextTrack = room.playlist[0];
		await Music.doPlay(roomId, nextTrack);
	}

	return { success: true };
};

// 暂停音乐已移除，改为投票切歌模式
Music.pause = async function () {
	throw new Error('Pause functionality is disabled. Use voting to skip tracks.');
};

// 心跳处理
Music.heartbeat = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		return;
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		return;
	}

	// 更新用户活跃时间
	userLastActive.set(socket.uid, Date.now());
};

// 同步播放进度
Music.sync = async function (socket, data) {
	const { roomId, currentTime } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		return;
	}

	// 只有房主可以同步进度
	if (room.hostId !== socket.uid) {
		return;
	}

	room.currentTime = currentTime;
	
	// 如果正在播放，同步更新 startTime 以维持进度一致
	if (room.isPlaying) {
		room.startTime = Date.now() - (currentTime * 1000);
	}

	// 同步播放进度给所有用户
	const io = require('./index').server;
	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: {
			roomId: roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			startTime: room.startTime,
			listeners: _.uniqBy(room.listeners, 'uid').length,
			playlist: room.playlist
		}
	});
};

// 获取房间信息
Music.getRoomInfo = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	// 计算当前播放进度
	let currentTime = room.currentTime;
	if (room.isPlaying && room.startTime > 0) {
		currentTime = (Date.now() - room.startTime) / 1000;
	}

	return {
		room: {
			roomId: roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: currentTime,
			startTime: room.startTime,
			listeners: _.uniqBy(room.listeners, 'uid').length,
			isHost: room.hostId === socket.uid,
			playlist: room.playlist
		}
	};
};

// 获取所有房间列表
Music.getRooms = async function () {
	const rooms = [];
	for (const [roomId, room] of musicRooms) {
		rooms.push({
			roomId: roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			listeners: _.uniqBy(room.listeners, 'uid').length,
			createdAt: room.createdAt
		});
	}
	return { rooms: rooms };
};

// 添加歌曲到播放列表
Music.addToPlaylist = async function (socket, data) {
	const { roomId, track } = data;
	if (!roomId || !track) {
		throw new Error('Invalid room ID or track');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	// 检查歌曲是否正在播放或已在播放列表中
	const isCurrent = room.currentTrack && room.currentTrack.id === track.id;
	const inPlaylist = room.playlist.find(t => t.id === track.id);

	if (isCurrent || inPlaylist) {
		return { success: true, alreadyExists: true };
	}

	// 获取点歌人信息
	const user = require('../user');
	const userData = await user.getUserFields(socket.uid, ['username']);
	track.addedBy = userData.username;

	// 添加歌曲到播放列表
	room.playlist.push(track);

	const io = require('./index').server;

	// 发送点歌系统消息
	io.to(`music_room_${roomId}`).emit('event:music.chat', {
		message: {
			username: '系统',
			content: `${userData.username} 点了歌曲：${track.name}`,
			timestamp: Date.now(),
			system: true
		}
	});

	// 如果房间当前没有播放歌曲，则自动播放这第一首歌
	if (!room.currentTrack) {
		await Music.doPlay(roomId, track);
	} else {
		// 否则，只需要通知播放列表已更新
		io.to(`music_room_${roomId}`).emit('event:music.playlist.update', {
			playlist: room.playlist
		});
	}

	return { success: true };
};

// 投票切歌
Music.voteSkip = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	if (!room.currentTrack) {
		throw new Error('No track playing');
	}

	// 检查是否已经投过票
	if (room.votes.has(socket.uid)) {
		throw new Error('You have already voted');
	}

	// 记录投票
	room.votes.add(socket.uid);

	const uniqueListenersCount = _.uniqBy(room.listeners, 'uid').length;
	const currentVotesCount = room.votes.size;
	const requiredVotes = Math.ceil(uniqueListenersCount / 2);

	const io = require('./index').server;

	// 获取投票者信息并发送聊天消息
	const user = require('../user');
	const userData = await user.getUserFields(socket.uid, ['username']);
	
	io.to(`music_room_${roomId}`).emit('event:music.chat', {
		message: {
			username: '系统',
			content: `${userData.username} 参与了投票切歌 (${currentVotesCount}/${requiredVotes})`,
			timestamp: Date.now(),
			system: true
		}
	});

	// 广播投票更新
	io.to(`music_room_${roomId}`).emit('event:music.vote.update', {
		votes: Array.from(room.votes),
		requiredVotes: requiredVotes,
		currentVotes: currentVotesCount,
		totalListeners: uniqueListenersCount
	});

	// 检查是否达到切歌条件
	if (currentVotesCount >= requiredVotes) {
		// 自动切换到下一首
		if (room.playlist.length > 0) {
			const nextTrack = room.playlist[0];

			// 发送切歌聊天通知
			io.to(`music_room_${roomId}`).emit('event:music.chat', {
				message: {
					username: '系统',
					content: `投票通过！自动切换下一首：${nextTrack.name}`,
					timestamp: Date.now(),
					system: true
				}
			});

			// 执行播放逻辑（doPlay 会自动从播放列表中移除正在播放的歌曲）
			await Music.doPlay(roomId, nextTrack);

			// 发送完整的房间更新
			io.to(`music_room_${roomId}`).emit('event:music.room.update', {
				room: {
					roomId: roomId,
					currentTrack: room.currentTrack,
					isPlaying: room.isPlaying,
					currentTime: room.currentTime,
					startTime: room.startTime,
					listeners: uniqueListenersCount,
					playlist: room.playlist,
					votes: []
				}
			});
		} else {
			// 如果没有下一首，则停止播放
			room.currentTrack = null;
			room.isPlaying = false;
			room.currentTime = 0;
			room.startTime = 0;
			room.votes = new Set();

			io.to(`music_room_${roomId}`).emit('event:music.chat', {
				message: {
					username: '系统',
					content: `投票通过！已切歌（播放列表已空）`,
					timestamp: Date.now(),
					system: true
				}
			});

			// 通知所有用户播放列表已更新
			io.to(`music_room_${roomId}`).emit('event:music.playlist.update', {
				playlist: room.playlist
			});

			io.to(`music_room_${roomId}`).emit('event:music.room.update', {
				room: {
					roomId: roomId,
					currentTrack: null,
					isPlaying: false,
					currentTime: 0,
					startTime: 0,
					listeners: uniqueListenersCount,
					playlist: room.playlist,
					votes: []
				}
			});
		}
	}

	return { success: true };
};

// 获取房间用户列表
Music.getRoomUsers = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	// 获取唯一的用户 ID 列表
	const uniqueUids = _.uniqBy(room.listeners, 'uid').map(l => l.uid);

	// 获取用户详细信息
	const user = require('../user');
	const usersData = await Promise.all(uniqueUids.map(async (uid) => {
		try {
			const userData = await user.getUserFields(uid, ['username', 'picture', 'uid']);
			return {
				uid: userData.uid,
				username: userData.username,
				picture: userData.picture || '/assets/images/default-avatar.png',
				isHost: userData.uid === room.hostId,
				isYou: userData.uid === socket.uid
			};
		} catch (err) {
			console.error(`Failed to get user data for uid ${uid}:`, err);
			return {
				uid: uid,
				username: 'Unknown',
				picture: '/assets/images/default-avatar.png',
				isHost: uid === room.hostId,
				isYou: uid === socket.uid
			};
		}
	}));

	return {
		users: usersData,
		total: usersData.length
	};
};

// 获取房间用户列表（辅助函数）
Music.getRoomUsersList = async function (roomId) {
	const room = musicRooms.get(roomId);
	if (!room) {
		return [];
	}

	// 获取唯一的用户 ID 列表
	const uniqueUids = _.uniqBy(room.listeners, 'uid').map(l => l.uid);

	// 获取用户详细信息
	const user = require('../user');
	const usersData = await Promise.all(uniqueUids.map(async (uid) => {
		try {
			const userData = await user.getUserFields(uid, ['username', 'picture', 'uid']);
			return {
				uid: userData.uid,
				username: userData.username,
				picture: userData.picture || '/assets/images/default-avatar.png',
				isHost: userData.uid === room.hostId
			};
		} catch (err) {
			console.error(`Failed to get user data for uid ${uid}:`, err);
			return {
				uid: uid,
				username: 'Unknown',
				picture: '/assets/images/default-avatar.png',
				isHost: uid === room.hostId
			};
		}
	}));

	return usersData;
};


// 从播放列表移除歌曲
Music.removeFromPlaylist = async function (socket, data) {
	const { roomId, index, trackId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	// 只有房主可以移除歌曲
	if (room.hostId !== socket.uid) {
		throw new Error('Only host can remove tracks from playlist');
	}

	// 移除歌曲（但不能移除正在播放的歌曲）
	let removed = false;
	if (trackId) {
		// 检查是否正在播放这首歌
		if (room.currentTrack && room.currentTrack.id === trackId) {
			throw new Error('Cannot remove currently playing track');
		}
		const newPlaylist = room.playlist.filter(t => t.id !== trackId);
		if (newPlaylist.length !== room.playlist.length) {
			room.playlist = newPlaylist;
			removed = true;
		}
	} else if (typeof index === 'number' && index >= 0 && index < room.playlist.length) {
		const trackToRemove = room.playlist[index];
		// 检查是否正在播放这首歌
		if (room.currentTrack && trackToRemove.id === room.currentTrack.id) {
			throw new Error('Cannot remove currently playing track');
		}
		room.playlist.splice(index, 1);
		removed = true;
	}

	if (removed) {
		// 通知所有用户播放列表已更新
		const io = require('./index').server;
		io.to(`music_room_${roomId}`).emit('event:music.playlist.update', {
			playlist: room.playlist
		});

		// 通知房间更新
		io.to(`music_room_${roomId}`).emit('event:music.room.update', {
			room: {
				roomId: roomId,
				currentTrack: room.currentTrack,
				isPlaying: room.isPlaying,
				currentTime: room.currentTime,
				startTime: room.startTime,
				listeners: _.uniqBy(room.listeners, 'uid').length,
				playlist: room.playlist,
				votes: Array.from(room.votes)
			}
		});
	}

	return { success: true };
};
