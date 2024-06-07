import { BeAnObject, IObjectWithTypegooseFunction } from '@typegoose/typegoose/lib/types';
import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';
import { UserProfile } from '../backend/schemas/UserProfile';
import { GuildProfile } from '../backend/schemas/GuildProfile';

type GenericDocument<T> = Document<ObjectId, BeAnObject, T> & Omit<T & Required<{ _id: ObjectId; }>, 'typegooseName'> & IObjectWithTypegooseFunction;
export type UserProfileDocument = GenericDocument<UserProfile>;
export type GuildProfileDocument = GenericDocument<GuildProfile>;