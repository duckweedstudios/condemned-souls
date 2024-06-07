import { Ref } from '@typegoose/typegoose';
import { Cursor, QueryOptions, UpdateWriteOpResult } from 'mongoose';
import { GuildProfileDocument } from '../../types/customDocument.js';
import { GuildProfile, GuildProfileModel, Schedule, Settings, Stats, TimeAndSoul } from '../schemas/GuildProfile.js';
import { Soul } from '../../util/souls.js';

// CREATE / POST
export const createGuildProfile = async (guildId: string, condemnedMemberId: string, schedule: Schedule): Promise<GuildProfileDocument> => {
    return GuildProfileModel.create({
        guildId,
        condemnedMemberId,
        newSoulMade: false,
        schedule,
        settings: {
            paused: false,
            condemnedRoleId: null,
            permissionRoleId: null,
        } as Settings,
        stats: {
            lifetimeSoulsCaught: 0,
            hauntingsCount: 0,
            soulsCreatedCount: 0,
            lastCondemnedMemberId: null,
        } as Stats,
    });
};

// READ / GET
export const getGuildProfile = async (guildId: string): Promise<GuildProfileDocument | null> => {
    return GuildProfileModel.findOne({ guildId });
};

export const getGuildProfileById = async (id: Ref<GuildProfile> | string): Promise<GuildProfileDocument | null> => {
    return GuildProfileModel.findById(id);
};

export const getAllGuildProfilesStream = async (): Promise<Cursor<GuildProfileDocument, QueryOptions<GuildProfileDocument>>> => {
    return GuildProfileModel.find().cursor();
};

// UPDATE / PUT
export const scheduleNextHaunt = async (guildId: string, nextHaunt: TimeAndSoul, replaceExistingNextOnly = false): Promise<UpdateWriteOpResult> => {
    if (replaceExistingNextOnly) {
        return GuildProfileModel.updateOne({ guildId }, { $set: { 'schedule.next': nextHaunt } }).exec();
    } else {
        return GuildProfileModel.updateOne({ guildId }, { $set: { 'schedule.past': '$schedule.next', 'schedule.next': nextHaunt } }).exec();
    }
};

export const setNextHauntTime = async (guildId: string, nextHauntTime: Date): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'schedule.next.time': nextHauntTime } }).exec();
};

export const setNextHauntSoul = async (guildId: string, nextHauntSoul: Soul): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'schedule.next.soul': nextHauntSoul } }).exec();
};

export const setMeanDelay = async (guildId: string, meanDelay: number): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'schedule.meanDelay': meanDelay } }).exec();
};

export const setVariation = async (guildId: string, variation: number): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'schedule.variation': variation } }).exec();
};

export const addLifetimeSoulsCaught = async (guildId: string, soulsCaught = 1): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $inc: { 'stats.lifetimeSoulsCaught': soulsCaught } }).exec();
};

export const addHauntingsCount = async (guildId: string, hauntingsCount = 1): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $inc: { 'stats.hauntingsCount': hauntingsCount } }).exec();
};

export const addSoulsCreatedCount = async (guildId: string, soulsCreatedCount = 1): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $inc: { 'stats.soulsCreatedCount': soulsCreatedCount } }).exec();
};

export const setLastCondemnedMemberId = async (guildId: string, lastCondemnedMemberId: string): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'stats.lastCondemnedMemberId': lastCondemnedMemberId } }).exec();
};

export const setPaused = async (guildId: string, paused: boolean): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'settings.paused': paused } }).exec();
};

export const setCondemnedRoleId = async (guildId: string, condemnedRoleId: string): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'settings.condemnedRoleId': condemnedRoleId } }).exec();
};

export const setPermissionRoleId = async (guildId: string, permissionRoleId: string): Promise<UpdateWriteOpResult> => {
    return GuildProfileModel.updateOne({ guildId }, { $set: { 'settings.permissionRoleId': permissionRoleId } }).exec();
};

// DELETE