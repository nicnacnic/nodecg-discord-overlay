const fs = require('fs');
const Discord = require('discord.js');
const command = require('./commands');

let silence, connection;

module.exports = function (nodecg) {

	const memberList = nodecg.Replicant('memberList', { persistent: false });
	const addMember = nodecg.Replicant('addMember', { persistent: false });
	const removeMember = nodecg.Replicant('removeMember', { persistent: false });
	const changeMute = nodecg.Replicant('changeMute', { persistent: false });
	const speaking = nodecg.Replicant('speaking', { persistent: false });
	addMember.value = null;
	removeMember.value = null;
	changeMute.value = null;
	speaking.value = null;
	memberList.value = [];
	connection = undefined;

	let roleID = nodecg.bundleConfig.roleID;

	const client = new Discord.Client();
	client.once('ready', () => {
		nodecg.log.info('DACBot is now online. For help, type @' + client.user.username + ' help')

		memberList.on('change', (newVal, oldVal) => {
			client.user.setPresence({ status: "online" });
			if (newVal.length <= 0)
				client.user.setActivity('voice channels...', { type: "WATCHING" });
			else
				client.user.setActivity(newVal.length + ' users...', { type: "LISTENING" });
		});

		command(client, 'connect', roleID, (message) => {
			if (connection === undefined && message.member.voice.channel !== undefined && message.member.voice.channel !== null)
				record(message.member.voice.channel.id);
			else
				message.reply(`you're not in a voice channel!`)
		})

		command(client, 'disconnect', roleID, (message) => {
			if (connection !== undefined)
				stopRecording(connection.channel.name);
			else
				message.reply(`I'm not in a voice channel!`)
		});

		client.on('guildMemberSpeaking', (member, memberSpeaking) => {
			if (memberSpeaking.bitfield == 1)
				speakState = true;
			else
				speakState = false;
			speaking.value = null;
			speaking.value = { id: member.id, speaking: speakState }
		});

		client.on('voiceStateUpdate', (oldMember, newMember) => {
			if (connection !== undefined && newMember.id !== client.user.id) {
				if (oldMember.channelID !== connection.channel.id && newMember.channelID === connection.channel.id) {
					let muteState;
					if (newMember.selfMute || newMember.selfDeaf || newMember.serverMute || newMember.serverDeaf)
						muteState = true;
					else
						muteState = false;
					addMember.value = null;
					addMember.value = { id: newMember.id, name: newMember.member.user.username, avatar: newMember.member.user.displayAvatarURL(), muted: muteState };
					memberList.value.push({ id: newMember.id, name: newMember.member.user.username, avatar: newMember.member.user.displayAvatarURL(), muted: muteState });
				}
				else if (oldMember.channelID === connection.channel.id && newMember.channelID !== connection.channel.id) {
					for (let i = 0; i < memberList.value.length; i++) {
						if (memberList.value[i].id === newMember.id) {
							memberList.value.splice(i, 1)
							break;
						}
					}
					removeMember.value = null;
					removeMember.value = newMember.id;
				}
				else if (newMember.serverMute !== oldMember.serverMute || newMember.serverDeaf !== oldMember.serverDeaf || newMember.selfMute !== oldMember.selfMute || newMember.selfDeaf !== oldMember.selfDeaf) {
					for (let i = 0; i < memberList.value.length; i++) {
						if (memberList.value[i].id === newMember.id) {
							let muteState;
							if (newMember.serverMute || newMember.serverDeaf || newMember.selfMute || newMember.selfDeaf)
								muteState = true;
							else
								muteState = false;
							changeMute.value = null;
							changeMute.value = { id: newMember.id, muted: muteState }
							memberList.value[i].muted = muteState;
						}
					}
				}
			}
			else if (connection !== undefined && oldMember.channelID !== null) {
				stopRecording(oldMember.channel.name);
				if (newMember.channelID !== null && newMember.channelID !== connection.channel.id)
					setTimeout(function () { record(newMember.channelID); }, 500);
			}
		})
	});
	async function record(channelID) {
		connection = await client.channels.cache.get(channelID).join();

		client.channels.cache.get(channelID).members.forEach((member) => {
			if (member.user.id !== client.user.id) {
				let muteState;
				if (member.voice.selfMute || member.voice.selfDeaf || member.voice.serverMute || member.voice.serverDeaf)
					muteState = true;
				else
					muteState = false;
				addMember.value = null;
				addMember.value = { id: member.user.id, name: member.user.username, avatar: member.user.displayAvatarURL(), muted: muteState };
				memberList.value.push({ id: member.user.id, name: member.user.username, avatar: member.user.displayAvatarURL(), muted: muteState });
			}
		})

		silence = setInterval(function () {
			connection.play(fs.createReadStream('./bundles/nodecg-dacbot/sounds/silence.wav'));
		}, 270000)
		nodecg.log.info('Capture started for channel ' + connection.channel.name + ' on ' + Date());
	}

	function stopRecording(channelName) {
		if (connection !== undefined) {
			nodecg.log.info('Capture stopped for channel ' + channelName + ' on ' + Date())
			connection.channel.leave();
		}
		for (let i = 0; i < memberList.value.length; i++) {
			removeMember.value = null;
			removeMember.value = memberList.value[i].id;
		}
		memberList.value = [];
		connection = undefined;
		clearInterval(silence);
	}
	client.login(nodecg.bundleConfig.botToken);
};