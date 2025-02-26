import { ApplicationCommandOptionBase, ApplicationIntegrationType, ChatInputCommandInteraction, Client, CommandInteraction, InteractionContextType, InteractionType, REST, Routes, SlashCommandBuilder, type Interaction } from "discord.js";
import type { LilClient } from "../client.ts";

export interface CommandContext {
	interaction: ChatInputCommandInteraction,
}

type CommandArgumentExtra<T extends any> =
	T extends string
	? { type: 'string' }
	: T extends number
	? { type: 'number' }
	: { type: never }

type CommandArgument<T extends any> =
	{ name: string, description: string } & CommandArgumentExtra<T>

type CommandArguments<T extends any[]> =
	T extends []
	? []
	: T extends [infer P, ...infer Rest]
	? [CommandArgument<P>, ...CommandArguments<Rest>]
	: never;
export type CommandMeta<F> = F extends (context: CommandContext, ...args: infer P) => Promise<void> ? {
	name: string,
	description: string,
	arguments: CommandArguments<P>
} : never;

export function createCommand<F>(
	func: F,
	declaration: CommandMeta<F>
): Command {
	function prepareArgument<T>(options: ChatInputCommandInteraction['options'], arg: CommandArgument<T>): any {
		switch (arg.type) {
			case "string":
				return options.getString(arg.name)
			case "number":
				return options.getNumber(arg.name)
		}
	}

	class DeclaredCommand extends Command {
		declaration: CommandMeta<F>;
		func: F;
		async run(interaction: ChatInputCommandInteraction): Promise<void> {
			const options = interaction.options;
			const commandContext: CommandContext = {
				interaction
			}
			const preparedArguments: any[] = [commandContext];
			const expectedArguments = this.declaration.arguments as CommandArgument<unknown>[];
			try {
				expectedArguments.forEach(arg => {
					preparedArguments.push(prepareArgument(options, arg))
				});
			} catch (ex) {
				console.error("Error during command preparation", interaction, ex)
				return
			}
			// @ts-expect-error this is valid, because we build the arguments according to CommandMeta<F>
			await this.func(...preparedArguments)
		}
		getAsSlashCommand(): SlashCommandBuilder {
			const builder = new SlashCommandBuilder();
			builder.setName(declaration.name);
			builder.setDescription(declaration.description)
			builder.setIntegrationTypes(ApplicationIntegrationType.UserInstall)
			builder.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
			if (declaration.description)
				builder.setDescription(declaration.description);
			function declareArg<T>(arg: CommandArgument<T>) {
				function base<T extends ApplicationCommandOptionBase>(opt: T): T {
					return opt.setName(arg.name).setDescription(arg.description);
				}
				switch (arg.type) {
					case "string":
						builder.addStringOption(option => base(option).setRequired(true))
						return
					case "number":
						builder.addNumberOption(option => base(option).setRequired(true))
						return
				}
			}
			(this.declaration.arguments as CommandArgument<unknown>[]).forEach(declareArg)
			return builder;
		}
		getAliases(): string[] {
			return [] // TODO
		};
		getName(): string {
			return declaration.name
		}
		constructor(func: F, declaration: CommandMeta<F>) {
			super()
			this.declaration = declaration;
			this.func = func;
		}
	}
	return new DeclaredCommand(func, declaration);
}

export abstract class Command {
	abstract run(interaction: CommandInteraction): Promise<void>;
	getAliases(): string[] { return [] }
	abstract getName(): string;
	abstract getAsSlashCommand(): SlashCommandBuilder;
	getAllAliases() {
		return [...this.getAliases(), this.getName()]
	}
}

export class CommandHost {
	client: LilClient;
	constructor(client: LilClient) {
		this.client = client;
	}
	commands: Command[] = []
	commandLUT: Record<string, Command> = {}

	addCommand(command: Command) {
		this.commands.push(command)
		command.getAllAliases().forEach(alias => {
			if (alias in this.commandLUT) {
				throw new Error(`Duplicate command registration for command name ${alias}.`)
			}
			this.commandLUT[alias] = command;
		})
	}

	register<F>(func: F, meta: CommandMeta<F>) {
		this.addCommand(createCommand(func, meta));
	}

	getCommand(name: string): Command | undefined {
		return this.commandLUT[name]
	}

	async publishCommands() {
		if (!this.client.isReady())
			throw new Error("Client not ready!")
		const route = Routes.applicationCommands(this.client.user.id)
		const response =
			await this.client.rest.put(route, { body: this.commands.map(it => it.getAsSlashCommand().toJSON()) }) as unknown[]
		console.log(`Registered ${response.length} commands.`)
	}

	async onCommand(event: Interaction) {
		if (!event.isChatInputCommand()) {
			return // TODO: check out completions / modals
		}
		const command = this.getCommand(event.commandName)
		if (!command) {
			await event.reply(`Unknown command ${event.commandName}.`);
			return
		}
		await this.executeCommand(command, event)
	}

	async executeCommand(command: Command, event: ChatInputCommandInteraction) {
		try {
			await command.run(event);
		} catch (ex) {
			console.error("Error during command execution", event, ex);
		}
	}
}
