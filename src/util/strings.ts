
export function fromPascalCase(str: string): string[] {
	return str.split(/(?<=[a-z])(?=[A-Z])/)
}
export function titleCase(str: string): string {
	return str.substring(0, 1).toUpperCase() +
		str.substring(1).toLowerCase()
}
export function unwords(str: string[]): string {
	return str.join(' ')
}

export function pascalToWords(str: string): string {
	return unwords(fromPascalCase(str).map(titleCase))
}

