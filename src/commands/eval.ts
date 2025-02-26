import { EmbedBuilder, escapeCodeBlock, type UserResolvable } from "discord.js";
import { createCommand, type CommandContext } from "../util/command.ts";
import { LinColors } from "../util/colors.ts";
import { inspect } from "node:util";

async function evalFunction(context: CommandContext, expression: string) {
	const response = await context.interaction.deferReply({});
	function baseEmbed() {
		return new EmbedBuilder()
			.setTitle("Evaluating expression")
			.addFields(
				{ name: '📄 Code', value: "```js\n" + escapeCodeBlock(expression) + "\n```" }
			)
	}
	const mappedCode = expression.replace(/<@([0-9]+)>/, (text, id) => `(await getUser("${id}"))`)

	const bindings: { name: string, value: any }[] = [
		{ name: 'add100', value: (x: number) => x + 100 },
		{ name: 'client', value: context.interaction.client },
		{ name: 'context', value: context },
		{ name: 'interaction', value: context.interaction },
		{ name: 'getUser', value: (snowflake: UserResolvable) => context.interaction.client.users.fetch(snowflake) },
	]


	let func;
	try {
		func = new Function(...bindings.map(it => it.name), `"use strict";\nreturn (async () => {\n${mappedCode}\n})();`,)
	} catch (ex) {
		await response.edit({
			embeds: [
				baseEmbed()
					.addFields({ name: '❌ Compilation failure', value: "```stacktrace\n" + escapeCodeBlock(ex + "") + "\n```" })
					.setColor(LinColors.Error)
			]
		})
		return
	}
	await response.edit({
		embeds: [
			baseEmbed()
				.setDescription("Running...")
				.setColor(LinColors.Working)
		]
	})
	let result
	try {
		result = await func(...bindings.map(it => it.value))
	} catch (ex) {
		await response.edit({
			embeds: [
				baseEmbed()
					.addFields({ name: '❌ Execution failure', value: "```stacktrace\n" + escapeCodeBlock(ex + "") + "\n```" })
					.setColor(LinColors.Error)
			]
		})
		return
	}
	if (typeof result === "undefined") {
		await response.edit({
			embeds: [
				baseEmbed()
					.addFields({ name: '📥 Result', value: "No return value given. Did you forget to `return`?" })
					.setColor(LinColors.Success)
			]
		})
	} else {
		await response.edit({
			embeds: [
				baseEmbed()
					.addFields({ name: '📥 Result', value: '```js\n' + escapeCodeBlock(inspect(result)) + "\n```" })
					.setColor(LinColors.Success)
			]
		})
	}
}

export const evalCommand = createCommand(
	evalFunction,
	{
		name: 'eval',
		description: 'Evaluates some JaVaScript',
		arguments: [
			{
				name: 'expression',
				description: 'A JaVaScript snippet you want to evaluate',
				type: 'string'
			}
		]
	});
