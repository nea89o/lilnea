import { client } from "./client.ts";
import { evalCommand } from "./commands/eval.ts";
import { songLinkCommand } from "./commands/songlink.ts";
import { CONFIG } from "./config.ts";
import { type CommandContext, CommandHost } from "./util/command.ts";

const commandHost = new CommandHost(client);

async function ping(context: CommandContext, message: string) {
	await context.interaction.reply("pinging with " + message)
}
commandHost.register(ping, {
	name: "ping",
	arguments: [
		{
			name: 'message',
			type: 'string',
			description: 'The message to ping back with'
		},
	],
	description: 'Ping the bot to check if it is online'
})
commandHost.addCommand(evalCommand)
commandHost.addCommand(songLinkCommand)

client.on('interactionCreate', (it) => commandHost.onCommand(it));
client.once('ready', async () => {
	await commandHost.publishCommands()
})
client.login(CONFIG.TOKEN);

