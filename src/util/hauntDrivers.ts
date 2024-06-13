import dayjs from 'dayjs';
import { Snowflake } from 'discord.js';
import { GameCacheServiceLocator } from '../caching/GameCacheServiceLocator.js';
import { getSoulByIdOrDefault, getWeightedRandomSoulType } from './souls.js';
import { getRandomizedNextTimeInFuture } from './time.js';
import { getAllGuildProfilesStream, getGuildProfile, scheduleNextHaunt } from '../backend/queries/guildProfileQueries.js';
import { TimeAndSoul } from '../backend/schemas/GuildProfile.js';
import { GuildProfileDocument } from '../types/customDocument.js';
import { hauntSomeChannelWithSoul } from './hauntings.js';

export const guildHauntDriver = async (guildId: Snowflake, fasterFirstHaunting = false, replaceExistingNextOnly = false) => {
    // Given a guild, decide a randomized next time to haunt it,
    // wait to haunt,
    // then haunt it and schedule the next haunting recursively
    const gameService = GameCacheServiceLocator.getService();
    const guildProfileDocument = await getGuildProfile(guildId);
    if (!guildProfileDocument) {
        console.error(`Error in guildHauntDriver: Server data could not be retrieved from the database for guild ID ${guildId}`);
        // TODO: set this server's status as paused, since no hauntings are occurring due to the error.
        return;
    }
    let nextTimeObj = getRandomizedNextTimeInFuture(dayjs(), guildProfileDocument.schedule.meanDelay, guildProfileDocument.schedule.variation);
    console.log(`The server with ID ${guildId} will be haunted at ${nextTimeObj.nextAppearanceFormatted}`);
    // Override the nextTimeObj for a quicker, reliable first appearance if desired
    if (fasterFirstHaunting) {
        const nextAppearance = dayjs().add(1, 'minute');
        nextTimeObj = { nextAppearance, nextAppearanceFormatted: nextAppearance.format('MM/DD/YYYY hh:mm:ss A'), msUntil: Math.abs(dayjs().diff(nextAppearance)) };
        console.log(`Override: The server with ID ${guildId} will be haunted at ${nextTimeObj.nextAppearanceFormatted}`);
    }
    const upcomingSoulType = getWeightedRandomSoulType(guildId);
    // Cancel a next haunting setTimeout if it exists
    const timeoutId = gameService.getNextHauntTimeoutId(guildId);
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    scheduleHaunting(guildId, { time: nextTimeObj.nextAppearance.toDate(), soul: upcomingSoulType } as TimeAndSoul, replaceExistingNextOnly);
};

export const scheduleHaunting = async (guildId: Snowflake, nextAppearance: TimeAndSoul, replaceExistingNextOnly = false) => {
    scheduleNextHaunt(guildId, nextAppearance, replaceExistingNextOnly);
    GameCacheServiceLocator.getService().setNextHauntTimeoutId(guildId, setTimeout(async () => {
        const guildProfileDocument = await getGuildProfile(guildId);
        if (!guildProfileDocument) {
            console.error(`Error in guildHauntDriver: Server data could not be retrieved from the database for guild ID ${guildId}`);
            return;
        }
        GameCacheServiceLocator.getService().clearMembersWhoFetched(guildId);
        hauntSomeChannelWithSoul(guildId, nextAppearance.soul);
        if (!guildProfileDocument.settings.paused) guildHauntDriver(guildId);
    }, Math.abs(dayjs().diff(nextAppearance.time, 'ms'))));
};

export const regenerateMissedHauntings = async () => {
    const currentTime = dayjs();
    // Stream over all guilds in the database
    // For each guild, check if it has a nextAppearance in the past
    // If so, schedule the next haunting
    (await getAllGuildProfilesStream()).eachAsync((doc: GuildProfileDocument) => {
        const nextAppearance = dayjs(doc.schedule.next.time);
        if (nextAppearance.isBefore(currentTime)) {
            console.log(`DEBUG: The server ${doc.guildId} was missed at ${nextAppearance.format('MM/DD/YYYY hh:mm:ss A')}`);
            guildHauntDriver(doc.guildId, false, true);
        } else {
            console.log(`DEBUG: The server ${doc.guildId} will have haunting regenerated for ${nextAppearance.format('MM/DD/YYYY hh:mm:ss A')}`);
            const upcomingSoulType = getSoulByIdOrDefault(doc.schedule.next.soul.id, doc.guildId);
            scheduleHaunting(doc.guildId, { time: nextAppearance.toDate(), soul: upcomingSoulType } as TimeAndSoul, true);
        }
    }, { continueOnError: true });
};