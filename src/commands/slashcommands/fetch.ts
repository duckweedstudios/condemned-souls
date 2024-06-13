import { SlashCommandBuilder } from 'discord.js';
import dayjs from 'dayjs';
import { ALWAYS_OPTION_CONSTRAINT, Constraint, LimitedCommandInteraction, LimitedCommandInteractionOption, OptionValidationError, OptionValidationErrorOutcome, OptionValidationErrorStatus, Outcome, OutcomeStatus, SimpleRendezvousSlashCommand, SlashCommandDescribedOutcome, validateConstraints } from 'discord-rendezvous';
import { Soul, getSoulValue } from '../../util/souls.js';
import { getLevelUps, getXPBar } from '../../util/experience.js';
import { ValueOf } from 'discord-rendezvous/dist/types/typelogic.js';
import { getGuildProfile } from '../../backend/queries/guildProfileQueries.js';
import { addCareerSoulsCaught, addFetchCount, addFooledAnotherCount, addLifetimeXP, addSouls, addSoulsCaught, addWasFooledCount, getOrCreateUserProfile, getUserProfile } from '../../backend/queries/userProfileQueries.js';
import { GameCacheServiceLocator } from '../../caching/GameCacheServiceLocator.js';
import config from '../../config.js';
import { TimeAndSoul } from '../../backend/schemas/GuildProfile.js';

/**
 * Alias for the first generic type of the command.
 */
type T1 = string;

/**
 * Alias for the second generic type of the command.
 */
type T2 = string;

/**
 * Status codes specific to this command.
 */
enum FetchSpecificStatus {
    SUCCESS_DETAILS,
    FAIL_ALREADY_FETCHED,
    FAIL_NO_HAUNT,
    SUCCESS_FOOLED,
}

/**
 * Union of specific and generic status codes.
 */
type FetchStatus = FetchSpecificStatus | OutcomeStatus;

type FetchSuccessDetailsOutcomeBody = {
    soul: Soul; // what they fetched: an object with details like the base XP value, rarity, name, etc.
    experience: {
        sum: number;
        multipliers: string[]; // The list of things like '🕐 **First fetch!** *x2 XP*', etc.
        oldXP: number;
    },
    specialMessages: string[]; // whatever else we want to show
}

/**
 * The outcome format for the specific status code(s).
 */
type FetchSuccessDetailsOutcome = {
    status: FetchSpecificStatus.SUCCESS_DETAILS,
    body: FetchSuccessDetailsOutcomeBody,
}

type FetchFailOutcome = {
    status: FetchSpecificStatus.FAIL_ALREADY_FETCHED | FetchSpecificStatus.FAIL_NO_HAUNT,
    body: {
        lastHaunt: TimeAndSoul | null;
    },
}

type FetchSuccessFooledOutcome = {
    status: FetchSpecificStatus.SUCCESS_FOOLED,
    body: {
        condemnedMemberId: string;
        wasFooledCount: number;
    },
}

/**
 * Union of specific and generic outcomes.
 */
type FetchOutcome = Outcome<T1, T2, FetchSuccessDetailsOutcome | FetchFailOutcome | FetchSuccessFooledOutcome>;

/**
 * Parameters for the solver function, as well as the "S" generic type.
 */
interface FetchSolverParams {
    guildId: string;
    userId: string;
    timestamp: Date;
}

const fetchSolver = async (params: FetchSolverParams): Promise<FetchOutcome> => {
    try {
        const currentTimestamp = dayjs();
        const guildProfileDocument = await getGuildProfile(params.guildId);
        const userProfileDocument = await getOrCreateUserProfile(params.guildId, params.userId);
        const gameService = GameCacheServiceLocator.getService();
        // Check if a summoned soul was recent enough (i.e. they were fooled)
        const lastSummonTime = gameService.getLastSummonTime(params.guildId);
        if (Math.abs(currentTimestamp.diff(lastSummonTime, 'second')) < config.claimWindowSeconds) {
            addWasFooledCount(params.guildId, params.userId);
            addFooledAnotherCount(params.guildId, guildProfileDocument!.condemnedMemberId);
            return {
                status: FetchSpecificStatus.SUCCESS_FOOLED,
                body: {
                    condemnedMemberId: guildProfileDocument!.condemnedMemberId,
                    wasFooledCount: userProfileDocument.wasFooledCount + 1,
                },
            };
        }

        // Check if a haunting wasn't recent enough
        if (!guildProfileDocument!.schedule.past || Math.abs(currentTimestamp.diff(guildProfileDocument!.schedule.past?.time, 'second')) > config.claimWindowSeconds) return {
            status: FetchSpecificStatus.FAIL_NO_HAUNT,
            body: {
                lastHaunt: guildProfileDocument!.schedule.past,
            },
        };

        // Check if they've already fetched the soul from this appearance
        const membersWhoFetched = gameService.getMembersWhoFetched(params.guildId);
        if (membersWhoFetched?.includes(params.userId)) return {
            status: FetchSpecificStatus.FAIL_ALREADY_FETCHED,
            body: {
                lastHaunt: guildProfileDocument!.schedule.past,
            },
        };

        // The fetch was successful
        const condemnedUserProfileDocument = getUserProfile(params.guildId, guildProfileDocument!.condemnedMemberId);
        const soulValue = getSoulValue(guildProfileDocument!.schedule.past.soul);
        gameService.addMembersWhoFetched(params.guildId, params.userId);
        // Apply multipliers
        const multiplierMessages = [];
        let earnedXPMultiplier = 1;
        if (membersWhoFetched?.length === 0) {
            multiplierMessages.push('🕐 **First fetch!** *x2 XP*');
            earnedXPMultiplier *= 2;
        }
        if (Math.abs(currentTimestamp.diff(guildProfileDocument!.schedule.past.time, 'second')) > (config.claimWindowSeconds - 2)) {
            multiplierMessages.push('🕚 **Buzzer-beater!** *x2 XP*');
            earnedXPMultiplier *= 2;
        }
        if ((await condemnedUserProfileDocument) && (await condemnedUserProfileDocument)!.souls > 0 && (await condemnedUserProfileDocument)!.souls - soulValue <= 0) {
            multiplierMessages.push('☠️ **Condemned soul defeated!** *x4 XP*');
            earnedXPMultiplier *= 4;
        }

        // Special messages, e.g. when the Condemned can be dethroned
        const specialMessages = [];
        if ((await condemnedUserProfileDocument) && (await condemnedUserProfileDocument)!.souls <= 0) {
            specialMessages.push(`👑 **The Condemned Soul can be dethroned!** Use \`/souls \`<@${guildProfileDocument!.condemnedMemberId}> to claim!`);
        }

        // Mutate fetcher's values
        addSouls(params.guildId, params.userId, soulValue);
        addSoulsCaught(params.guildId, params.userId, soulValue);
        addCareerSoulsCaught(params.guildId, params.userId, soulValue);
        addLifetimeXP(params.guildId, params.userId, soulValue * earnedXPMultiplier);
        addFetchCount(params.guildId, params.userId);
        // Mutate Condemned's values
        addSouls(params.guildId, guildProfileDocument!.condemnedMemberId, -soulValue);
        addSoulsCaught(params.guildId, guildProfileDocument!.condemnedMemberId, soulValue);

        return {
            status: FetchSpecificStatus.SUCCESS_DETAILS,
            body: {
                soul: guildProfileDocument!.schedule.past.soul,
                experience: {
                    sum: soulValue * earnedXPMultiplier,
                    multipliers: multiplierMessages,
                    oldXP: userProfileDocument!.lifetimeXP,
                },
                specialMessages: [],
            },
        };
    } catch (err) {
        // No expected thrown errors
    }

    return ({
        status: OutcomeStatus.FAIL_UNKNOWN,
        body: {},
    });
};

const fetchSlashCommandValidator = async (interaction: LimitedCommandInteraction): Promise<FetchSolverParams | OptionValidationErrorOutcome<T1>> => {
    const guildId = interaction.guildId!;
    const timestamp = new Date();
    const guildProfileDocument = getGuildProfile(guildId);

    const metadataConstraints = new Map<keyof LimitedCommandInteraction, Constraint<ValueOf<LimitedCommandInteraction>>[]>([
        ['guildId', [
            // Ensure that the guild has a database record
            {
                category: OptionValidationErrorStatus.OPTION_DNE,
                func: async function(_: ValueOf<LimitedCommandInteraction>): Promise<boolean> {
                    return (await guildProfileDocument) !== null;
                },
            },
        ]],
        ['member', [
            // Ensure the user isn't the Condemned Soul for the guild
            {
                category: OptionValidationErrorStatus.INSUFFICIENT_PERMISSIONS,
                func: async function(metadata: ValueOf<LimitedCommandInteraction>): Promise<boolean> {
                    return metadata === (await guildProfileDocument)?.condemnedMemberId;
                },
            },
        ]],
    ]);
    const optionConstraints = new Map<LimitedCommandInteractionOption | null | ALWAYS_OPTION_CONSTRAINT, Constraint<ValueOf<LimitedCommandInteractionOption>>[]>([]);

    try {
        await validateConstraints(interaction, metadataConstraints, optionConstraints);
    } catch (err) {
        if (err instanceof OptionValidationError) return {
            status: OutcomeStatus.FAIL_VALIDATION,
            body: {
                constraint: err.constraint,
                field: err.field,
                value: err.value,
                context: err.message,
            },
        };

        throw err;
    }

    return {
        guildId,
        userId: interaction.member.id,
        timestamp,
    };
};

const formatFetchSuccessDetailsOutcome = (oBody: FetchSuccessDetailsOutcomeBody): string => {
    const soulValue = getSoulValue(oBody.soul);
    let userMessage = `You fetched a ${oBody.soul.emoji} ${oBody.soul.name} ${oBody.soul.emoji} soul worth ${soulValue} ${soulValue == 1 ? 'soul' : 'souls'}!`;
    for (const mult of oBody.experience.multipliers) {
        userMessage += `\n${mult}`;
    }
    userMessage += `\n= **__+${oBody.experience.sum} XP__**\n\n`;
    const levelUps = getLevelUps(oBody.experience.oldXP, oBody.experience.oldXP + oBody.experience.sum);
    userMessage += `${levelUps}\n${getXPBar(oBody.experience.oldXP + oBody.experience.sum)}${oBody.specialMessages ? '\n' : ''}`;
    for (const msg of oBody.specialMessages) {
        userMessage += `\n${msg}`;
    }
    return userMessage;
};

const fetchSlashCommandDescriptions = new Map<FetchStatus, (o: FetchOutcome) => SlashCommandDescribedOutcome>([
    [FetchSpecificStatus.SUCCESS_DETAILS, (o: FetchOutcome) => ({
        userMessage: formatFetchSuccessDetailsOutcome((o as FetchSuccessDetailsOutcome).body), ephemeral: true,
    })],
    [FetchSpecificStatus.FAIL_ALREADY_FETCHED, (_o: FetchOutcome) => ({
        userMessage: '❌ You\'ve already fetched the soul from this haunting.', ephemeral: true,
    })],
    [FetchSpecificStatus.FAIL_NO_HAUNT, (_o: FetchOutcome) => ({
        userMessage: '❌ There were no souls to be fetched.', ephemeral: true,
    })],
    [FetchSpecificStatus.SUCCESS_FOOLED, (o: FetchOutcome) => ({
        userMessage: `🃏 You were fooled into fetching a soul summoned by <@${(o as FetchSuccessFooledOutcome).body.condemnedMemberId}>!\nYou've been fooled **${(o as FetchSuccessFooledOutcome).body.wasFooledCount}** times.`, ephemeral: true,
    })],
    [OutcomeStatus.FAIL_VALIDATION, (o: FetchOutcome) => {
        const oBody = (o as OptionValidationErrorOutcome<T1>).body;
        if (oBody.constraint.category === OptionValidationErrorStatus.OPTION_DNE) return {
            userMessage: '❌ The bot has not been setup yet.\n\nTell an admin to use /condemnedsouls first!', ephemeral: true,
        };
        if (oBody.constraint.category === OptionValidationErrorStatus.INSUFFICIENT_PERMISSIONS) return {
            userMessage: '❌ Try as you might, you cannot fetch a soul while you yourself are condemned.', ephemeral: true,
        };
        else return {
            userMessage: `❌ This command failed unexpectedly due to a validation error.`, ephemeral: true,
        };
    }],
]);

const FetchCommand = new SimpleRendezvousSlashCommand<FetchOutcome, FetchSolverParams, T1, FetchStatus>(
    new SlashCommandBuilder()
        .setName('fetch')
        .setDescription('Fetches a soul. Use it during a haunting, but don\'t be fooled!'),
    fetchSlashCommandDescriptions,
    fetchSlashCommandValidator,
    fetchSolver,
);

export default FetchCommand;