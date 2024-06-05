import { Dayjs } from 'dayjs';
import { Snowflake } from 'discord.js';

export interface GameCacheService {
    addMembersWhoFetched(guildId: Snowflake, userId: Snowflake): void;
    clearMembersWhoFetched(guildId: Snowflake): void;
    getMembersWhoFetched(guildId: Snowflake): Snowflake[] | undefined;

    setLastSummonTime(guildId: Snowflake, time: Dayjs): void;
    getLastSummonTime(guildId: Snowflake): Dayjs | undefined;

    setNextAppearanceBounds(guildId: Snowflake, timeDescription: string): void;
    getNextAppearanceBounds(guildId: Snowflake): string | undefined;

    setNextHauntTimeoutId(guildId: Snowflake, timeoutId: NodeJS.Timeout): void;
    getNextHauntTimeoutId(guildId: Snowflake): NodeJS.Timeout | undefined;
}