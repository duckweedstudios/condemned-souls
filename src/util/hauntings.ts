import { createAudioPlayer, NoSubscriberBehavior, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { RendezvousClient as CondemnedSoulsClient } from 'discord-rendezvous';
import { Soul, getAudioResourceFromSoul, getWeightedRandomSoulType } from './souls.js';
import { NonThreadGuildBasedChannel } from 'discord.js';
import config from '../config.js';

// TODO: Stability testing across different connection problem scenarios.

export const hauntSomeChannelWithSoul = async (guildId: string, soul: Soul): Promise<void> => {
    // Given a guild and a soul object:
    // -- If the soul object is a global (i.e. default) soul,
    // -- replace it with a soul from that guild's souls
    // -- Then, play the sound in the guild's most active voice channel
    const guild = await (await CondemnedSoulsClient.getInstance()).guilds.fetch(guildId);
    if (!guild) {
        console.log(`Error in hauntings.ts: Could not fetch guild with ID ${guildId}`);
        return;
    }
    const guildChannels = await guild.channels.fetch();
    const guildVoiceChannels = guildChannels.filter((v: NonThreadGuildBasedChannel | null) => v && v.isVoiceBased() && v.joinable && v.id !== guild.afkChannelId);
    if (!guildVoiceChannels) {
        console.log(`No voice channels to join in ${guild.name}, aborting...`);
        // TODO: notify the server that no voice channels could be joined
        return;
    }

    // Find the VC with the most active users. Arbitrarily break ties -- just join the one first in the list
    type idAndCount = { id: string, count: number };
    let winningIdAndCount: idAndCount = { id: guildVoiceChannels.at(0)!.id, count: guildVoiceChannels.at(0)!.members.size };
    for (const [voiceChannelId, voiceChannel] of guildVoiceChannels.entries()) {
        // entries() returns a map:
        // key (a string of the channel ID) -> the VoiceChannel object from discordjs
        if (voiceChannel!.members.size > winningIdAndCount.count) {
            winningIdAndCount = { id: voiceChannelId, count: voiceChannel!.members.size };
        }
    }

    // We know which soul type is meant to play because it's predetermined
    // HOWEVER, when the bot is first setup, it's queued to play the default global sound no matter what bc no other sounds exist.
    // Therefore, we need to check if it is the default global sound about to be played. If so, try to "reroll"
    // Either the condemned still hasn't set a sound, in which case nothing changes,
    // or they did set a sound, and that will, as a guarantee, be played instead. 
    if (soul.global) {
        soul = getWeightedRandomSoulType(guildId);
    }

    // Actually getting the audio resource, given the soul info, is deferred until the last minute
    // Throws error if the audio resource cannot be located.
    const audioResourceToPlay = getAudioResourceFromSoul(soul, guildId);

    // Connect to a voice channel
    const connection = joinVoiceChannel({
        channelId: winningIdAndCount.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
    });

    // Now, the bot is in a random VC and ready to transmit audio

    // Tramsitting audio
    // Create a player instance
    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause, // can be configured to either pause, stop, or continue when there are no active subscribers
        },
    });

    // Subscribe the connection to the audio player (will play audio on the voice connection)
    const subscription = connection.subscribe(player);

    console.log(`Haunting ${guild.name}`);

    // Wait to avoid the start of the audio cutting off
    connection.on(VoiceConnectionStatus.Ready, () => {
        player.play(audioResourceToPlay);
    });
	
    player.on('error', error => {
        throw new Error(`Error: ${error.message} with resource ${error.resource.metadata}`); // never seen this occur, I assume it's a connection problem thing?
    });

    // Unsubscribe.
    // subscription could be undefined if the connection is destroyed!
    if (subscription) {
        setTimeout(() => subscription.unsubscribe(), config.claimWindowSeconds * 1000);
        setTimeout(() => {
            try {
                connection.destroy();
            } catch (err) {
                console.error(err);
            }
        }, (config.claimWindowSeconds + 1) * 1000);
    }
};