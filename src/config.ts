import "dotenv/config";


function prop<T>(envVar: string, mapper: (str: string) => T, defaultValue?: T): T {
	const value = process.env[envVar]
	if (!value) {
		if (typeof defaultValue === "undefined")
			throw new Error(`Environment variable ${envVar} is not missing.`)
		return defaultValue
	}
	return mapper(value)
}

function string(envVar: string, defaultValue?: string) {
	return prop(envVar, it => it, defaultValue)
}

export const CONFIG = {
	TOKEN: string("DISCORD_TOKEN"),
} as const;



