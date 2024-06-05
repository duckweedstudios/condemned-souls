import { Dayjs } from 'dayjs';
import { GameCacheService } from './GameCacheService.js';
import { Collection, Snowflake } from 'discord.js';

export class InMemoryGameCacheService implements GameCacheService {
    private membersWhoFetchedCache: Collection<Snowflake, Snowflake[]> = new Collection();

    addMembersWhoFetched(guildId: Snowflake, userId: Snowflake): void {
        const members = this.membersWhoFetchedCache.get(guildId);
        if (members) {
            members.push(userId);
        } else {
            this.membersWhoFetchedCache.set(guildId, [userId]);
        }
    }

    clearMembersWhoFetched(guildId: Snowflake): void {
        this.membersWhoFetchedCache.set(guildId, []);
    }

    getMembersWhoFetched(guildId: Snowflake): Snowflake[] | undefined {
        return this.membersWhoFetchedCache.get(guildId);
    }

    private lastSummonTimeCache: Collection<Snowflake, Dayjs> = new Collection();

    setLastSummonTime(guildId: Snowflake, time: Dayjs): void {
        this.lastSummonTimeCache.set(guildId, time);
    }

    getLastSummonTime(guildId: Snowflake): Dayjs | undefined {
        return this.lastSummonTimeCache.get(guildId);
    }

    private nextAppearanceBoundsCache: Collection<Snowflake, string> = new Collection();

    setNextAppearanceBounds(guildId: Snowflake, timeDescription: string): void {
        this.nextAppearanceBoundsCache.set(guildId, timeDescription);
    }

    getNextAppearanceBounds(guildId: Snowflake): string | undefined {
        return this.nextAppearanceBoundsCache.get(guildId);
    }

    private nextHauntTimeoutIdCache: Collection<Snowflake, NodeJS.Timeout> = new Collection();

    setNextHauntTimeoutId(guildId: Snowflake, timeoutId: NodeJS.Timeout): void {
        this.nextHauntTimeoutIdCache.set(guildId, timeoutId);
    }

    getNextHauntTimeoutId(guildId: Snowflake): NodeJS.Timeout | undefined {
        return this.nextHauntTimeoutIdCache.get(guildId);
    }
}