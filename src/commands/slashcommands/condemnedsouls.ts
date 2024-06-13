import { GuildMember, PermissionsBitField, SlashCommandBuilder, User } from 'discord.js';
import dayjs from 'dayjs';
import { ALWAYS_OPTION_CONSTRAINT, Constraint, LimitedCommandInteraction, LimitedCommandInteractionOption, OptionValidationError, OptionValidationErrorOutcome, OptionValidationErrorStatus, Outcome, OutcomeStatus, OutcomeWithMonoBody, SimpleRendezvousSlashCommand, SlashCommandDescribedOutcome, validateConstraints } from 'discord-rendezvous';
import { ValueOf } from 'discord-rendezvous/dist/types/typelogic.js';
import { createGuildProfile, getGuildProfile } from '../../backend/queries/guildProfileQueries.js';
import { guildHauntDriver } from '../../util/hauntDrivers.js';
import { getWeightedRandomSoulType } from '../../util/souls.js';
import { getRandomizedNextTimeInFuture } from '../../util/time.js';
import { Schedule } from '../../backend/schemas/GuildProfile.js';


/**
 * Alias for the first generic type of the command.
 */
type T1 = string;

/**
 * Alias for the second generic type of the command.
 */
type T2 = never;

/**
 * Status codes specific to this command.
 */
enum _CondemnedSoulsSpecificStatus {
    
}

/**
 * Union of specific and generic status codes.
 */
type CondemnedSoulsStatus = OutcomeStatus;

/**
 * The outcome format for the specific status code(s).
 */


/**
 * Union of specific and generic outcomes.
 */
type CondemnedSoulsOutcome = Outcome<T1, T2>;

/**
 * Parameters for the solver function, as well as the "S" generic type.
 */
interface CondemnedSoulsSolverParams {
    guildId: string;
    initialCondemnedUserId: string;
}

const condemnedSoulsSolver = async (params: CondemnedSoulsSolverParams): Promise<CondemnedSoulsOutcome> => {
    try {
        const meanDelay = 1440;
        const variation = 5;
        const schedule = {
            next: { // This will be overwritten with a sooner haunt by guildHauntDriver()
                soul: getWeightedRandomSoulType(params.guildId),
                time: getRandomizedNextTimeInFuture(dayjs(), meanDelay, variation).nextAppearance.toDate(),
            },
            past: null,
            meanDelay,
            variation,
        } as Schedule;
        await createGuildProfile(params.guildId, params.initialCondemnedUserId, schedule);
        guildHauntDriver(params.guildId, true, true);

        return {
            status: OutcomeStatus.SUCCESS_MONO,
            body: {
                data: params.initialCondemnedUserId,
                context: 'initial condemned user ID',
            },
        };
    } catch (err) {
        // No expected thrown errors
        console.error(err);
    }
    return {
        status: OutcomeStatus.FAIL_UNKNOWN,
        body: {},
    };
};

const condemnedSoulsSlashCommandValidator = async (interaction: LimitedCommandInteraction): Promise<CondemnedSoulsSolverParams | OptionValidationErrorOutcome<T1>> => {
    const guildId = interaction.guildId!;

    const metadataConstraints = new Map<keyof LimitedCommandInteraction, Constraint<ValueOf<LimitedCommandInteraction>>[]>([
        ['member', [
            // Ensure that the sender is an Administrator
            {
                category: OptionValidationErrorStatus.INSUFFICIENT_PERMISSIONS,
                func: async function(metadata: ValueOf<LimitedCommandInteraction>): Promise<boolean> {
                    return (metadata as GuildMember).permissions.has(PermissionsBitField.Flags.Administrator);
                },
            },
        ]],
        ['guildId', [
            // Ensure that the guild does NOT have a database record
            {
                category: OptionValidationErrorStatus.OPTION_DUPLICATE,
                func: async function(_: ValueOf<LimitedCommandInteraction>): Promise<boolean> {
                    return (await getGuildProfile(guildId)) === null;
                },
            },
        ]],
    ]);
    const targetUser = interaction.options.get('initial-condemned', true);
    const optionConstraints = new Map<LimitedCommandInteractionOption | null | ALWAYS_OPTION_CONSTRAINT, Constraint<ValueOf<LimitedCommandInteractionOption>>[]>([
        [targetUser, [
            // Ensure that the target is not a bot
            {
                category: OptionValidationErrorStatus.TARGET_USER_BOT,
                func: async function(option: ValueOf<LimitedCommandInteractionOption>): Promise<boolean> {
                    return !(option as User).bot;
                },
            },
        ]],
    ]);

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
        initialCondemnedUserId: targetUser.user!.id,
    };
};

const condemnedSoulsSlashCommandDescriptions = new Map<CondemnedSoulsStatus, (o: CondemnedSoulsOutcome) => SlashCommandDescribedOutcome>([
    [OutcomeStatus.SUCCESS_MONO, (o: CondemnedSoulsOutcome) => ({
        userMessage: `✅ <@${(o as OutcomeWithMonoBody<T1>).body.data}> has become The Condemned. **FETCH ME THEIR SOULS!**`, ephemeral: true,
    })],
    [OutcomeStatus.FAIL_VALIDATION, (o: CondemnedSoulsOutcome) => {
        const oBody = (o as OptionValidationErrorOutcome<T1>).body;
        if (oBody.constraint.category === OptionValidationErrorStatus.INSUFFICIENT_PERMISSIONS) return {
            userMessage: '❌ You must be a server Administrator to use this command.', ephemeral: true,
        };
        if (oBody.constraint.category === OptionValidationErrorStatus.OPTION_DUPLICATE) return {
            userMessage: '❌ Your server is already setup.', ephemeral: true,
        };
        if (oBody.constraint.category === OptionValidationErrorStatus.TARGET_USER_BOT) return {
            userMessage: '❌ A puny bot cannot bear the mantle of Condemned Soul. Choose a user instead.', ephemeral: true,
        };
        else return {
            userMessage: `❌ This command failed unexpectedly due to a validation error.`, ephemeral: true,
        };
    }],
]);

const CondemnedSoulsCommand = new SimpleRendezvousSlashCommand<CondemnedSoulsOutcome, CondemnedSoulsSolverParams, T1>(
    new SlashCommandBuilder()
        .setName('condemnedsouls')
        .setDescription('Sets up the bot and starts the game.')
        .addUserOption(option => option.setName('initial-condemned').setDescription('Choose the first person to become the Condemned Soul.').setRequired(true)) as SlashCommandBuilder,
    condemnedSoulsSlashCommandDescriptions,
    condemnedSoulsSlashCommandValidator,
    condemnedSoulsSolver,
);

export default CondemnedSoulsCommand;