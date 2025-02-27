import { EmbedBuilder } from "discord.js";
export function makeBaseEmbed(): EmbedBuilder {
	return new EmbedBuilder()
		.setFooter({ text: 'LilNea - Premium Edition' })
}
