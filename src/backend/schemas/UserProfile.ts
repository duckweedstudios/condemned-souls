import { getModelForClass, index, prop } from '@typegoose/typegoose';
import { ObjectId } from 'mongodb';

@index({ userId: 1, guildId: 1 }, { unique: true })
export class UserProfile {
    _id!: ObjectId;

    @prop({ required: true })
    public userId!: string;

    @prop({ required: true })
    public guildId!: string;

    // The value of souls a user currently has, effectively currency
    @prop({ required: true, default: 0 })
    public souls!: number;

    // As condemned, the value of souls taken from you
    // As a fetcher, the value of souls taken from the condemned
    @prop({ required: true })
    public soulsCaught!: number;

    // Lifetime value of souls taken from the condemned
    @prop({ required: true })
    public careerSoulsCaught!: number;

    // Lifetime count of successful fetches
    @prop({ required: true, default: 0 })
    public fetchCount!: number;

    // Lifetime count of times as condemned
    @prop({ required: true, default: 0 })
    public condemnedCount!: number;

    // Lifetime XP = sum of (stolen soul values * relevant multipliers)
    @prop({ required: true, default: 0 })
    public lifetimeXP!: number;

    // Lifetime count of times fooled by others
    @prop({ required: true, default: 0 })
    public wasFooledCount!: number;

    // Lifetime count of times you fooled someone else
    @prop({ required: true, default: 0 })
    public fooledAnotherCount!: number;

    // Opt-out for the "lure" feature
    @prop({ required: true, default: true })
    public allowLure!: boolean;
}

export const UserProfileModel = getModelForClass(UserProfile);