import { EmbedBuilder, escapeCodeBlock, RouteBases, transformResolved, type UserResolvable } from "discord.js";
import { createCommand, type CommandContext } from "../util/command.ts";
import { LinColors } from "../util/colors.ts";
import { inspect } from "node:util";
import { parse as acornParse } from 'acorn'
import { generate } from "astring";
import type { ModuleDeclaration, Program, Statement } from "acorn";
import { makeBaseEmbed } from "../util/embeds.ts";


function transformLastInBlock<T extends Statement | ModuleDeclaration>(
	array: Array<T | Statement>) {
	if (array) {
		array[array.length - 1] = transformStatement<T | Statement>(array[array.length - 1])
	}
}
function transformStatement<T extends Statement | ModuleDeclaration>(
	ast: T): T | Statement {
	switch (ast.type) {
		case 'ExpressionStatement':
			return {
				type: 'ExpressionStatement',
				start: 0,
				end: 0,
				expression: {
					type: 'AssignmentExpression',
					operator: '=',
					start: 0,
					end: 0,
					left: {
						start: 0,
						end: 0,
						type: 'Identifier',
						name: '__ret'
					},
					right: ast.expression
				}
			}
		case 'BlockStatement':
			transformLastInBlock(ast.body)
			break
		case 'ForStatement':
		case "WhileStatement":
		case 'ForOfStatement':
		case 'ForInStatement':
		case 'DoWhileStatement':
		case 'WithStatement':
			ast.body = transformStatement(ast.body)
			break
		case 'IfStatement':
			ast.consequent = transformStatement(ast.consequent)
			if (ast.alternate)
				ast.alternate = transformStatement(ast.alternate)
			break
	}

	return ast
}

async function evalFunction(context: CommandContext, expression: string) {
	const response = await context.interaction.deferReply({});
	let mappedCode: string | null = null
	function baseEmbed() {
		const builder = makeBaseEmbed()
			.setTitle("Evaluating expression")
			.addFields(
				{ name: '📄 Code', value: "```js\n" + escapeCodeBlock(expression) + "\n```" },
			)
		if (mappedCode) {
			builder.addFields(
				{ name: '📑 Formatted Code', value: "```js\n" + escapeCodeBlock(mappedCode) + "\n```" },
			)
		}
		return builder
	}
	const replacedCode = expression.replace(/<@([0-9]+)>/, (text, id) => `(await getUser("${id}"))`)
	let ast
	try {
		ast = acornParse(replacedCode, {
			ecmaVersion: 2020,
			allowReturnOutsideFunction: true,
			allowAwaitOutsideFunction: true,
		});
	} catch (ex) {
		await response.edit({
			embeds: [
				baseEmbed()
					.addFields({ name: '❌ Syntax error', value: "```stacktrace\n" + escapeCodeBlock(ex + "") + "\n```" })
					.setColor(LinColors.Error)
			]
		})
		return
	}
	if (ast.body) {
		ast.body.unshift({
			type: 'VariableDeclaration',
			kind: 'let',
			end: 0, start: 0,
			declarations: [{
				end: 0, start: 0,
				id: {
					start: 0,
					end: 0,
					type: 'Identifier',
					name: '__ret'
				},
				type: "VariableDeclarator"
			}]
		})
		transformLastInBlock(ast.body)
		ast.body.push({
			type: 'ReturnStatement',
			end: 0, start: 0,
			argument: {
				type: 'Identifier',
				end: 0,
				start: 0,
				name: '__ret'
			}
		})
	}
	mappedCode = generate(ast)


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
