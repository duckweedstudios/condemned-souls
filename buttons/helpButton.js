const { MessageEmbed, MessageButton } = require('discord.js');
const { editInteraction } = require('../events/editInteraction');
const { getActionRow } = require('../events/getActionRow');

module.exports = {
	name: 'helpButton',
	data: new MessageButton()
		.setCustomId('helpButton')
		.setLabel('Need Help? 🤔')
		.setStyle('PRIMARY'),
    
	async execute(interaction) {
		const helpEmbed = new MessageEmbed()
			.setColor('BLUE')
			.setTitle(`__***NEED HELP?***__`)
			.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
			.setDescription('*There will be help stuff here*')
			.setThumbnail('https://i.imgur.com/T9HDICa.jpeg');

		const _testButton = new MessageButton()
			.setCustomId('testButton')
			.setLabel('testing')
			.setStyle('PRIMARY');

		const finalComponents = await getActionRow(interaction);
		const data = { embeds : [helpEmbed], components: [finalComponents] };

		try {
			await editInteraction(interaction, data);
			await interaction.deferUpdate();
		} catch (error) {
			await interaction.reply({ content: 'There was an error', ephemeral: true });
			console.log(error);
		}
	},
};
