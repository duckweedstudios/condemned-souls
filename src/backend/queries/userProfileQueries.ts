import { Ref } from '@typegoose/typegoose';
import { UpdateWriteOpResult } from 'mongoose';
import { UserProfileDocument } from '../../types/customDocument.js';
import { UserProfile, UserProfileModel } from '../schemas/UserProfile.js';

// CREATE / POST
export const createUserProfile = async (guildId: string, userId: string): Promise<UserProfileDocument> => {
    return UserProfileModel.create({
        guildId,
        userId,
        souls: 0,
        soulsCaught: 0,
        careerSoulsCaught: 0,
        fetchCount: 0,
        condemnedCount: 0,
        lifetimeXP: 0,
        wasFooledCount: 0,
        fooledAnotherCount: 0,
        allowLure: true,
    });
};

// READ / GET
export const getOrCreateUserProfile = async (guildId: string, userId: string): Promise<UserProfileDocument> => {
    const userProfile = await UserProfileModel.findOne({ guildId, userId });
    if (userProfile) return userProfile;
    else return createUserProfile(guildId, userId);
};

export const getUserProfile = async (guildId: string, userId: string): Promise<UserProfileDocument | null> => {
    return UserProfileModel.findOne({ guildId, userId });
};

export const getUserProfileById = async (id: Ref<UserProfile> | string): Promise<UserProfileDocument | null> => {
    return UserProfileModel.findById(id);
};

// UPDATE / PUT
export const setSouls = async (guildId: string, userId: string, souls: number): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $set: { souls } }).exec();
};

export const addSouls = async (guildId: string, userId: string, souls: number): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { souls } }).exec();
};

export const setSoulsCaught = async (guildId: string, userId: string, soulsCaught: number): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $set: { soulsCaught } }).exec();
};

export const addSoulsCaught = async (guildId: string, userId: string, soulsCaught: number): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { soulsCaught } }).exec();
};

export const addCareerSoulsCaught = async (guildId: string, userId: string, careerSoulsCaught: number): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { careerSoulsCaught } }).exec();
};

export const addFetchCount = async (guildId: string, userId: string, fetchCount = 1): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { fetchCount } }).exec();
};

export const addCondemnedCount = async (guildId: string, userId: string, condemnedCount = 1): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { condemnedCount } }).exec();
};

export const addLifetimeXP = async (guildId: string, userId: string, lifetimeXP: number): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { lifetimeXP } }).exec();
};

export const addWasFooledCount = async (guildId: string, userId: string, wasFooledCount = 1): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { wasFooledCount } }).exec();
};

export const addFooledAnotherCount = async (guildId: string, userId: string, fooledAnotherCount = 1): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $inc: { fooledAnotherCount } }).exec();
};

export const setAllowLure = async (guildId: string, userId: string, allowLure: boolean): Promise<UpdateWriteOpResult> => {
    return UserProfileModel.updateOne({ guildId, userId }, { $set: { allowLure } }).exec();
};

// DELETE