import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type MessageActionRowComponent, type MessageComponentBuilder, type MessageActionRowComponentBuilder } from "discord.js";
import { createCommand, type CommandContext } from "../util/command.ts";
import { makeBaseEmbed } from "../util/embeds.ts";
import { lookupSongByLink, type SongLinkSchema } from "../util/songlink.ts";
import { chunkArray } from "../util/arrays.ts";
import { pascalToWords } from "../util/strings.ts";

async function songLinkFunc(
	context: CommandContext,
	link: string,
) {
	const reply = await context.interaction.deferReply()
	const song = await lookupSongByLink(link)
	function anyProp<K extends keyof SongLinkSchema['entitiesByUniqueId'][string]>(name: K):
		SongLinkSchema['entitiesByUniqueId'][string][K] | undefined {
		return Object.values(song.entitiesByUniqueId)
			.map(it => it[name])
			.find(it => it)
	}
	const thumbnail = anyProp("thumbnailUrl")
	const title = anyProp("title")
	const artist = anyProp("artistName")
	const embed = makeBaseEmbed()
		.setThumbnail(thumbnail ?? null)
		.setTitle(title ?? null).setAuthor(artist ? { name: artist } : null)

	const buttons = Object.entries(song.linksByPlatform)
		.map(([platform, link]) =>
			new ButtonBuilder({
				style: ButtonStyle.Link,
				url: link.url,
				emoji: '🎵',
				label: pascalToWords(platform)
			}))
	const chunkedButtons = chunkArray(buttons, 5);
	const rows = chunkedButtons.map(rowButtons =>
		new ActionRowBuilder<MessageActionRowComponentBuilder>()
			.addComponents(rowButtons)
	)
	await reply.edit({
		embeds: [embed],
		components: rows
	})
}
export const songLinkCommand = createCommand(
	songLinkFunc,
	{
		name: 'songlink',
		description: 'Look up a song on song.link, providing multiple song links',
		arguments: [{
			name: 'link',
			description: 'The link to look up',
			type: 'string'
		}]
	}
)
