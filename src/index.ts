import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { GatewayIntentBits } from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { RendezvousClient as CondemnedSoulsClient } from 'discord-rendezvous';
import { prepareCommands } from './util/commandHandler.js';
import { prepareEvents } from './util/eventHandler.js';
import { prepareButtons } from './util/buttonHandler.js';
import config from './config.js';
import { regenerateMissedHauntings } from './util/hauntDrivers.js';
console.log(generateDependencyReport());


// MONGOOSE PORT
mongoose.connect(process.env.DB_URI as string, {
    dbName: 'condemnedSoulsDB',
    // Login to user/pass authenticated database
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
})
    .then(() => {
        console.log('Database connection established');
    })
    .catch((err) => {
        console.log(`Error connecting to database: ${err}}`);
    });

// Instantiate client singleton after selecting intents
CondemnedSoulsClient.addIntents([GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildEmojisAndStickers]);
if (!config.featureFlags.privacyMode) CondemnedSoulsClient.addIntents([GatewayIntentBits.MessageContent]);
const client = await CondemnedSoulsClient.getInstance();


// APPLICATION COMMANDS
prepareCommands(client);

// BUTTONS
prepareButtons(client);

// EVENTS
prepareEvents(client);

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
    // Regenerate missed or otherwise invalid hauntings
    regenerateMissedHauntings();
});