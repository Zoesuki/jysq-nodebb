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
