
export class CacheOnce<T> {
	private compute: () => Promise<T>;
	private promise: Promise<T> | null;
	constructor(compute: () => Promise<T>) {
		this.compute = compute
		this.promise = null;
	}

	async getValue(): Promise<T> {
		if (!this.promise)
			this.promise = new Promise((resolve) => resolve(this.compute()))
		return await this.promise;
	}
}
