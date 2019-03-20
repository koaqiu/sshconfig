import readline from 'readline';
import FS from 'fs';
import OS from 'os';
import PATH from 'path';

const getFilePath = (file: string) => {
	if (!file) return file;
	if (file.startsWith('~/')) {
        return file.replace(/^~\//, `${OS.homedir()}${PATH.sep}`);
    }
    if (/^[a-z]:/ig.test(file) || /^[\/\\]/ig.test(file)) {
        // 绝对路径
        return file;
    }
    return PATH.resolve(process.cwd(), file);
}

export type ReadLineTestFunc = (answer: string) => boolean;
export default class ConsoleInput {
	private rl: readline.Interface;
	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		})
	}
	public close() {
		this.rl.close();
	}
	public question(query: string, defaultValue?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			this.rl.question(defaultValue ? `${query}[${defaultValue}]:` : `${query}:`, (answer: string) => {
				if (/^\s{0,}$/ig.test(answer)) {
					resolve(defaultValue);
				} else {
					resolve(answer);
				}
			})
		});
	}
	public async readFileName(query: string, defaultValue: string): Promise<string> {
		return await this.readLine(query, defaultValue, (answer: string) => {
			const file = getFilePath(answer.trim());
			const isFile = FS.existsSync(file);
			if (!isFile) {
				console.log(answer, '不是一个有效的路径');
			}
			return isFile;
		});
	}
	public async readLine(query: string, defaultValue: string, testFunc: RegExp | ReadLineTestFunc): Promise<string> {
		do {
			const line = await this.question(query, `${defaultValue}`);
			if (testFunc instanceof RegExp && testFunc.test(line)) {
				return line;
			}
			if (typeof testFunc == 'function' && testFunc(line)) {
				return line;
			}
		} while (true);
		return defaultValue;
	}
	public async readNumber(query: string, defaultValue: number = 0) {
		do {
			const line = await this.question(query, `${defaultValue}`);
			if (/^[+-]{0,1}\d+(\.\d+)?$/ig.test(line)) {
				return parseFloat(line);
			}
			if (/^[+-]{0,1}\d+$/ig.test(line)) {
				return parseInt(line);
			}
		} while (true);
		return defaultValue;
	}
    public async readBoolean(query: string, defaultValue: boolean | 'true' | 'false' | 'yes' | 'no' | 'y' | 'n') {
        do {
            const line = await this.question(query, `${defaultValue}`);
            if (/^(true|false|1|0|yes|no|y|n)$/ig.test(line)) {
                return /(true|1|yes)/ig.test(line);
            }
        } while (true);
        return defaultValue;
    }
}