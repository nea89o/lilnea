import { z } from "zod";
const songLinkSchema = z.object({
	entityUniqueId: z.string(),
	userCountry: z.string(),
	pageUrl: z.string(),
	entitiesByUniqueId: z.record(
		z.object({
			id: z.string(),
			type: z.string(),
			title: z.string(),
			artistName: z.string(),
			thumbnailUrl: z.string(),
			apiProvider: z.string(),
			platforms: z.array(z.string())
		})
	),
	linksByPlatform: z.record(z.object({
		country: z.string(),
		url: z.string(),
		entityUniqueId: z.string()
	}))
});

export type SongLinkSchema = z.infer<typeof songLinkSchema>
export async function lookupSongByLink(link: string): Promise<SongLinkSchema> {
	const response = await fetch(
		"https://api.song.link/v1-alpha.1/links?" + new URLSearchParams(
			{
				url: link
			}
		))
	return await songLinkSchema.parseAsync(await response.json())
}
