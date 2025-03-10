import { z } from "zod"
import { CacheOnce } from "../util/cache.ts"
import { createCommand, type CommandContext } from "../util/command.ts"
import { words } from "../util/strings.ts"
import { makeBaseEmbed } from "../util/embeds.ts"
import { LinColors } from "../util/colors.ts"
import { CONFIG } from "../config.ts"

interface GitRepo {
	name: string
	owner: string
	title: string
	description: string
	stars: number
	url: string
}

interface GitSource {
	getReposForUser(user: string): Promise<GitRepo[]>
}
const githubReposSchema = z.array(z.object({
	name: z.string(),
	full_name: z.string(),
	html_url: z.string(),
	description: z.string().nullable(),
	owner: z.object({
		login: z.string()
	}),
	stargazers_count: z.number().nonnegative()
}))

const githubSource: GitSource = {
	async getReposForUser(user) {
		let pageNumber = 0
		let repos: GitRepo[] = []
		while (true) {
			// TODO: 429
			const response = await fetch(`https://api.github.com/users/${user}/repos?page=${pageNumber}`,
				{
					headers: {
						authorization: `Bearer ${CONFIG.GITHUB_TOKEN}`
					}
				}
			)
			pageNumber++;
			const nextRepos = githubReposSchema.parse(await response.json())
			console.log(`Fetched ${nextRepos.length} repos from page ${pageNumber}`)
			if (nextRepos.length === 0) break
			nextRepos.forEach(repo =>
				repos.push({
					description: repo.description ?? 'Missing description',
					name: repo.name,
					title: repo.name,
					owner: repo.full_name.split("/")[0],
					stars: repo.stargazers_count,
					url: repo.html_url
				})
			)
		}
		return repos
	},
}

const allSources: GitSource[] = [
	githubSource
]


async function fetchAll(user: string) {
	const promises = await Promise.all(
		allSources.map(it => it.getReposForUser(user))
	)
	return promises.flatMap(it => it)
}

const cache = new CacheOnce(() => fetchAll("nea89o"))

async function sourceFunc(context: CommandContext, search: string) {
	const reply = await context.interaction.deferReply()
	const repos = await cache.getValue()
	const requiredWords = words(search).map(it => it.trim().toLowerCase())
		.filter(it => it)
	function repoFilter(repo: GitRepo) {
		const searchText = (repo.name + " " + repo.title + " " + repo.description).toLowerCase()
		return requiredWords.every(it => searchText.includes(it))
	}
	const matches = repos.filter(repoFilter)
	const embeds = matches.map(repo => makeBaseEmbed()
		.setTitle(repo.title)
		.setDescription(repo.description)
		.addFields({ name: '⭐ Stars', value: repo.stars.toString() })
		.setURL(repo.url)
		.setColor(LinColors.Success))
	await reply.edit({ embeds: embeds.slice(0, 10) })
}
export const sourceCommand = createCommand(
	sourceFunc,
	{
		name: 'src',
		description: 'Look up a git repo on your GitHub',
		arguments: [{
			name: 'search',
			description: 'A search phrase to look for',
			type: 'string',
		}]
	}
)

