import { APIEmbed, EmbedBuilder, SlashCommandBuilder, User } from 'discord.js';
import { RendezvousClient as CondemnedSoulsClient, ALWAYS_OPTION_CONSTRAINT, Constraint, LimitedCommandInteraction, LimitedCommandInteractionOption, OptionValidationError, OptionValidationErrorOutcome, OptionValidationErrorStatus, Outcome, OutcomeStatus, SimpleRendezvousSlashCommand, SlashCommandDescribedOutcome, validateConstraints, SlashCommandEmbedDescribedOutcome } from 'discord-rendezvous';
import { ValueOf } from 'discord-rendezvous/dist/types/typelogic.js';
import { getGuildProfile } from '../../backend/queries/guildProfileQueries.js';
import { getOrCreateUserProfile } from '../../backend/queries/userProfileQueries.js';
import { getLevelUpProgressFraction, getSoulTier, getXPBar } from '../../util/experience.js';

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
enum ProfileSpecificStatus {
    SUCCESS_DETAILS,
}

/**
 * Union of specific and generic status codes.
 */
type ProfileStatus = ProfileSpecificStatus | OutcomeStatus;

enum ProfileViewRelationship {
    FETCHER_FETCHER = 'FETCHER_FETCHER',
    FETCHER_CONDEMNED = 'FETCHER_CONDEMNED',
    CONDEMNED_FETCHER = 'CONDEMNED_FETCHER',
    CONDEMNED_CONDEMNED = 'CONDEMNED_CONDEMNED',
}

type ProfileSuccessDetailsBody = {
    self: boolean,
    profileData: {
        souls: number;
        soulsCaught: number;
        careerSoulsCaught: number;
        fetchCount: number;
        condemnedCount: number;
        lifetimeXP: number;
        wasFooledCount: number;
        fooledAnotherCount: number;
    },
    discordData: {
        name: string;
        icon: string;
    },
    viewRelationship: ProfileViewRelationship,
};

/**
 * The outcome format for the specific status code(s).
 */
type ProfileSuccessDetailsOutcome = {
    status: ProfileSpecificStatus.SUCCESS_DETAILS,
    body: ProfileSuccessDetailsBody,
};

/**
 * Union of specific and generic outcomes.
 */
type ProfileOutcome = Outcome<T1, T2, ProfileSuccessDetailsOutcome>;

/**
 * Parameters for the solver function, as well as the "S" generic type.
 */
interface ProfileSolverParams {
    guildId: string;
    senderId: string;
    targetId: string;
}

const profileSolver = async (params: ProfileSolverParams): Promise<ProfileOutcome> => {
    try {
        const guild = (await CondemnedSoulsClient.getInstance()).guilds.fetch(params.guildId);
        const member = (await guild).members.fetch(params.targetId);
        const guildProfileDocument = await getGuildProfile(params.guildId);
        const targetProfileDocument = await getOrCreateUserProfile(params.guildId, params.targetId);

        let viewRelationship = ProfileViewRelationship.FETCHER_FETCHER;
        if (params.targetId === guildProfileDocument!.condemnedMemberId) {
            if (params.senderId === guildProfileDocument!.condemnedMemberId) {
                viewRelationship = ProfileViewRelationship.CONDEMNED_CONDEMNED;
            } else {
                viewRelationship = ProfileViewRelationship.FETCHER_CONDEMNED;
            }
        } else {
            if (params.senderId === guildProfileDocument!.condemnedMemberId) {
                viewRelationship = ProfileViewRelationship.CONDEMNED_FETCHER;
            } else {
                // fetcher-fetcher relationship
            }
        }

        return {
            status: ProfileSpecificStatus.SUCCESS_DETAILS,
            body: {
                self: params.senderId === params.targetId,
                profileData: {
                    souls: targetProfileDocument.souls,
                    soulsCaught: targetProfileDocument.soulsCaught,
                    careerSoulsCaught: targetProfileDocument.careerSoulsCaught,
                    fetchCount: targetProfileDocument.fetchCount,
                    condemnedCount: targetProfileDocument.condemnedCount,
                    lifetimeXP: targetProfileDocument.lifetimeXP,
                    wasFooledCount: targetProfileDocument.wasFooledCount,
                    fooledAnotherCount: targetProfileDocument.fooledAnotherCount,
                },
                discordData: {
                    name: (await member).displayName,
                    icon: (await member).user.avatarURL() ?? 'https://static.wikia.nocookie.net/minecraft_gamepedia/images/0/02/Pointer_%28texture%29_JE1_BE1.png',
                },
                viewRelationship,
            } as ProfileSuccessDetailsBody,
        } as ProfileSuccessDetailsOutcome;
    } catch (err) {
        // No expected thrown errors
    }

    return {
        status: OutcomeStatus.FAIL_UNKNOWN,
        body: {},
    };
};

const profileSlashCommandValidator = async (interaction: LimitedCommandInteraction): Promise<ProfileSolverParams | OptionValidationErrorOutcome<T1>> => {
    const guildId = interaction.guildId!;
    const senderId = interaction.member.id;

    const metadataConstraints = new Map<keyof LimitedCommandInteraction, Constraint<ValueOf<LimitedCommandInteraction>>[]>([
        ['guildId', [
            // Ensure that the guild has a database record
            {
                category: OptionValidationErrorStatus.OPTION_DNE,
                func: async function(metadata: ValueOf<LimitedCommandInteraction>): Promise<boolean> {
                    return (await getGuildProfile(metadata as string)) !== null;
                },
            },
        ]],
    ]);

    const targetUser = interaction.options.get('user', false);
    const optionConstraints = new Map<LimitedCommandInteractionOption | null | ALWAYS_OPTION_CONSTRAINT, Constraint<ValueOf<LimitedCommandInteractionOption>>[]>([
        [targetUser, [
            // Ensure the target user is not a bot
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

    const targetId = interaction.options.get('user', false)?.user?.id ?? senderId;

    return {
        guildId,
        senderId,
        targetId,
    };
};

const formatProfileEmbed = (oBody: ProfileSuccessDetailsBody): APIEmbed[] => {
    const targetSoulTier = getSoulTier(oBody.profileData.lifetimeXP);
    if (oBody.viewRelationship === ProfileViewRelationship.FETCHER_CONDEMNED || oBody.viewRelationship === ProfileViewRelationship.CONDEMNED_CONDEMNED) return [new EmbedBuilder()
        .setColor('DarkRed')
        .setTitle(`${oBody.discordData.name}'s Profile`)
        .setDescription('**👹 T̸̪́Ḥ̷̞̏̔Ē̵̦ ̶̰̍̀C̴̟͇͒̑O̸͈̊Ņ̸̱̀D̵̼͌Ĕ̴̝̕M̶̢̎̀Ń̵̦͆Ĕ̷̡͈͝D̵̬͗̓ 👹**')
        .addFields(
            { name: `Rank ${targetSoulTier.level}`, value: `${getXPBar(oBody.profileData.lifetimeXP)} *${getLevelUpProgressFraction(oBody.profileData.lifetimeXP)}*` },
            { name: '---------------------------------', value: ' ' },
            { name: '__Souls Left__', value: `👻  *${oBody.profileData.souls}*`, inline: true },
            { name: '__Souls Stolen__', value: `🪝  *${oBody.profileData.soulsCaught}*`, inline: true },
            { name: '---------------------------------', value: '__***Career Stats 📊***__' },
            { name: '__Times as Condemned:__', value: `*${oBody.profileData.condemnedCount}*`, inline: true },
            { name: '__Was Fooled Count:__', value: `*${oBody.profileData.wasFooledCount}*`, inline: true },
            { name: '__Fooled Others Count:__', value: `*${oBody.profileData.fooledAnotherCount}*`, inline: true },
        )
        .setThumbnail(oBody.discordData.icon)
        .toJSON(),
    ];
    else return [new EmbedBuilder()
        .setColor('Orange')
        .setTitle(`${oBody.discordData.name}'s Profile`)
        .setDescription(`${targetSoulTier.tierName}${targetSoulTier.tierQuote ? `\n*"${targetSoulTier.tierQuote}"*` : ''}`)
        .addFields(
            { name: `Rank ${targetSoulTier.level}`, value: `${getXPBar(oBody.profileData.lifetimeXP)} *${getLevelUpProgressFraction(oBody.profileData.lifetimeXP)}*` },
            { name: '---------------------------------', value: ' ' },
            { name: '__Current Souls:__', value: `👻 *${oBody.profileData.souls}*` },
            { name: '__Souls Caught:__', value: `🎣 *${oBody.profileData.soulsCaught}*`, inline: true },
            { name: '__Fetch Count:__', value: `🪝 *${oBody.profileData.fetchCount}*`, inline: true },
            { name: '---------------------------------', value: '__***Career Stats 📊***__' },
            { name: '__Times as Condemned:__', value: `*${oBody.profileData.condemnedCount}*`, inline: true },
            { name: '__Was Fooled Count:__', value: `*${oBody.profileData.wasFooledCount}*`, inline: true },
            { name: '__Fooled Others Count:__', value: `*${oBody.profileData.fooledAnotherCount}*`, inline: true },
        )
        .setThumbnail(oBody.discordData.icon)
        .toJSON(),
    ];
};

const profileSlashCommandDescriptions = new Map<ProfileStatus, (o: ProfileOutcome) => SlashCommandDescribedOutcome | SlashCommandEmbedDescribedOutcome>([
    [ProfileSpecificStatus.SUCCESS_DETAILS, (o: ProfileOutcome) => {
        const oBody = (o as ProfileSuccessDetailsOutcome).body;
        switch (oBody.viewRelationship) {
            // TODO: add different buttons depending on case
            case ProfileViewRelationship.FETCHER_FETCHER:
                return {
                    embeds: formatProfileEmbed(oBody),
                    ephemeral: true,
                } as SlashCommandEmbedDescribedOutcome;
            case ProfileViewRelationship.CONDEMNED_FETCHER:
                return {
                    embeds: formatProfileEmbed(oBody),
                    ephemeral: true,
                } as SlashCommandEmbedDescribedOutcome;
            case ProfileViewRelationship.FETCHER_CONDEMNED:
                return {
                    embeds: formatProfileEmbed(oBody),
                    ephemeral: true,
                } as SlashCommandEmbedDescribedOutcome;
            case ProfileViewRelationship.CONDEMNED_CONDEMNED:
                return {
                    embeds: formatProfileEmbed(oBody),
                    ephemeral: true,
                } as SlashCommandEmbedDescribedOutcome;
        }
    }],
    [OutcomeStatus.FAIL_VALIDATION, (o: ProfileOutcome) => {
        const oBody = (o as OptionValidationErrorOutcome<T1>).body;
        if (oBody.constraint.category === OptionValidationErrorStatus.TARGET_USER_BOT) return {
            userMessage: '❌ You cannot view a bot\'s profile', ephemeral: true,
        };
        else return {
            userMessage: `❌ This command failed unexpectedly due to a validation error.`, ephemeral: true,
        };
    }],
]);

const ProfileCommand = new SimpleRendezvousSlashCommand<ProfileOutcome, ProfileSolverParams, T1, ProfileStatus>(
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Show your Condemned Souls profile, or view another\'s profile.')
        .addUserOption(option => option.setName('user').setDescription('Whose profile you want to view.').setRequired(false)) as SlashCommandBuilder,
    profileSlashCommandDescriptions,
    profileSlashCommandValidator,
    profileSolver,
    false,
    true,
);

export default ProfileCommand;