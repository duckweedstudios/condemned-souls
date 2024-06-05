import { getModelForClass, prop } from '@typegoose/typegoose';
import { ObjectId } from 'mongodb';
import { Soul } from '../../util/souls.js';

export type Settings = {
    paused: boolean,
    condemnedRoleId: string | null,
    permissionRoleId: string | null,
};

export type TimeAndSoul = {
    time: Date,
    soul: Soul,
}

export type Schedule = {
    next: TimeAndSoul,
    past: TimeAndSoul | null,
    meanDelay: number,
    variation: number,
}

export type Stats = {
    lifetimeSoulsCaught: number,
    hauntingsCount: number,
    soulsCreatedCount: number,
    lastCondemnedMemberId: string | null,
}

export class GuildProfile {
    _id!: ObjectId;

    @prop({ required: true, index: true })
    public guildId!: string;

    @prop({ required: true })
    public condemnedMemberId!: string;

    @prop({ required: true, default: false })
    public newSoulMade!: boolean;

    @prop({ required: true })
    public settings!: Settings;

    @prop({ required: true })
    public schedule!: Schedule;

    @prop({ required: true })
    public stats!: Stats;
}

export const GuildProfileModel = getModelForClass(GuildProfile);