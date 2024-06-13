import { createAudioResource } from '@discordjs/voice';
import { Snowflake } from 'discord.js';
import path from 'path';
import fs from 'fs';

export type Soul = {
    id: string,
    name: string,
    author: Snowflake,
    rarity: number,
    emoji: string,
    extension: 'mp3',
    global: boolean,
};

export const getDefaultSoul = (): Soul => {
    return {
        'id': '-1',
        'name': 'Bruh',
        'author': 'OliGuzzler',
        'rarity': 5, // fairly punishing for the condemned if they don't set a soul. TODO this needs revision for the rarity system overhaul
        'emoji': '<:oliguzzler:981560015204798504>',
        'extension': 'mp3',
        'global': true,
    };
};

export const getWeightedRandomSoulType = (guildId: Snowflake): Soul => {
    const soulsFileContents = getSoulTypesJSON(guildId);
    if (soulsFileContents.length === 0) {
        // No souls exist on the server. Play a default sound.
        return getDefaultSoul();
    } else {
        const soulRaritySum = soulsFileContents.reduce((prev, curr) => prev + (1 / curr.rarity), 0);
        const randomNumber = Math.random() * soulRaritySum; // floats on [0, soulRaritySum)
        let runningSum = 0;
        for (const soulType of soulsFileContents) {
            if (randomNumber < (1 / soulType.rarity) + runningSum) {
                return soulType;
            } else {
                runningSum += 1 / soulType.rarity;
            }
        }
        throw new Error(`Error in getWeightedRandomSoulType: No soul type was chosen. Tried ${randomNumber} of ${soulRaritySum}`);
    }
};

export const getAudioResourceFromSoul = (soul: Soul, guildId: Snowflake) => {
    try {
        if (soul.global) {
            const pathOfFileToPlay = path.join(process.cwd(), `./resources/global/${soul.name}.${soul.extension}`);
            return createAudioResource(pathOfFileToPlay, {
                metadata: {
                    title: `${soul.name} <default sound>`,
                },
            });
        } else {
            const pathOfFileToPlay = path.join(process.cwd(), `./resources/guilds/${guildId}/${soul.name}.${soul.extension}`);
            return createAudioResource(pathOfFileToPlay, {
                metadata: {
                    title: soul.name,
                },
            });
        }
    } catch (err) {
        throw new Error(`Error in getAudioResourceFromSoul: Soul ${soul.name} gave error ${err}`);
    }
};

export const getSoulTypesJSON = (guildId: Snowflake): Soul[] => {
    try {
        const soulsFilePath = path.join(process.cwd(), `../resources/guilds/${guildId}/souls.json`);
        const soulsFileContents = JSON.parse(fs.readFileSync(soulsFilePath).toString());
        return soulsFileContents.souls;
    } catch (err) {
        console.log(`Warning in getSoulTypesJSON: No entry for ${guildId}`);
        return [];
    }
};

export const getSoulById = (soulId: string, guildId: Snowflake) => {
    try {
        const soulsFileContents = getSoulTypesJSON(guildId);

        for (const soulType of soulsFileContents) {
            if (soulType.id === soulId) {
                return soulType;
            }
        }

        console.log(`Warning in getSoulById: Found a non-empty souls file, but did not find a soul with id ${soulId} in server ${guildId}`);
    } catch (err) {
        return;
    }
};

export const getSoulByIdOrDefault = (soulId: string, guildId: Snowflake) => {
    if (soulId === '-1') return getDefaultSoul(); // temporary fix for issue #77
    const result = getSoulById(soulId, guildId);
    return result ? result : getDefaultSoul();
};

// TODO: revise soul value calculation method
export const getSoulValue = (soul: Soul) => {
    return soul.rarity;
};