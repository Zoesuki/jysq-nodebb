'use strict';

const _ = require('lodash');

const Music = module.exports;

// 存储房间信息
const musicRooms = new Map();

// 加入听歌房间
Music.joinRoom = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	socket.join(`music_room_${roomId}`);

	// 初始化房间信息
	if (!musicRooms.has(roomId)) {
		musicRooms.set(roomId, {
			currentTrack: null,
			isPlaying: false,
			currentTime: 0,
			listeners: [],
			hostId: socket.uid,
			createdAt: Date.now()
		});
	}

	const room = musicRooms.get(roomId);

	// 添加监听者
	if (!room.listeners.includes(socket.uid)) {
		room.listeners.push(socket.uid);
	}

	// 向房间内所有用户发送更新
	const io = require('./index').server;
	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: {
			roomId: roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			listeners: room.listeners.length,
			isHost: room.hostId === socket.uid
		}
	});

	return {
		room: {
			roomId: roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			listeners: room.listeners.length,
			isHost: room.hostId === socket.uid
		}
	};
};

// 离开听歌房间
Music.leaveRoom = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	socket.leave(`music_room_${roomId}`);

	const room = musicRooms.get(roomId);
	if (!room) {
		return;
	}

	// 移除监听者
	room.listeners = room.listeners.filter(uid => uid !== socket.uid);

	// 如果房间没有监听者了，清理房间
	if (room.listeners.length === 0) {
		musicRooms.delete(roomId);
		return;
	}

	// 如果是房主离开，重新分配房主
	if (room.hostId === socket.uid && room.listeners.length > 0) {
		room.hostId = room.listeners[0];
	}

	// 向房间内其他用户发送更新
	const io = require('./index').server;
	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: {
			roomId: room.roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			listeners: room.listeners.length,
			isHost: room.hostId === socket.uid
		}
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

	// 只有房主可以控制播放
	if (room.hostId !== socket.uid) {
		throw new Error('Only host can control playback');
	}

	room.currentTrack = track;
	room.isPlaying = true;
	room.currentTime = 0;

	const io = require('./index').server;
	io.to(`music_room_${roomId}`).emit('event:music.play', {
		track: track,
		currentTime: 0
	});

	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: {
			roomId: room.roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			listeners: room.listeners.length,
			isHost: room.hostId === socket.uid
		}
	});
};

// 暂停音乐
Music.pause = async function (socket, data) {
	const { roomId } = data;
	if (!roomId) {
		throw new Error('Invalid room ID');
	}

	const room = musicRooms.get(roomId);
	if (!room) {
		throw new Error('Room not found');
	}

	// 只有房主可以控制播放
	if (room.hostId !== socket.uid) {
		throw new Error('Only host can control playback');
	}

	room.isPlaying = false;

	const io = require('./index').server;
	io.to(`music_room_${roomId}`).emit('event:music.pause', {
		currentTime: room.currentTime
	});

	io.to(`music_room_${roomId}`).emit('event:music.room.update', {
		room: {
			roomId: room.roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			listeners: room.listeners.length,
			isHost: room.hostId === socket.uid
		}
	});
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

	room.currentTime = currentTime;
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

	return {
		room: {
			roomId: room.roomId,
			currentTrack: room.currentTrack,
			isPlaying: room.isPlaying,
			currentTime: room.currentTime,
			listeners: room.listeners.length,
			isHost: room.hostId === socket.uid
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
			listeners: room.listeners.length,
			createdAt: room.createdAt
		});
	}
	return { rooms: rooms };
};
