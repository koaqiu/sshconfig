export interface IParam {
    name: string;
    alias?: string;
    type: 'boolean' | 'string' | 'int' | 'float' | 'file';
    comment?: string;
    default?: boolean | string | number;
}

function arrayMax<T>(array: T[], callBack: (item: T) => number): number
function arrayMax<T>(array: any[], callBack?: (item: T) => number): number {
    return callBack
        ? Math.max.apply(Math, array.map(callBack))
        : Math.max.apply(Math, array);
}
function arrayMin<T>(array: T[], callBack: (item: T) => number): number
function arrayMin<T>(array: any[], callBack?: (item: T) => number): number {
    return callBack
        ? Math.min.apply(Math, array.map(callBack))
        : Math.min.apply(Math, array);
}

const tyrParseInt = (s: string, errFunc: (s: string)=> number | any) => {
    if (!/^[+-]{0,1}\d+$/ig.test(s)) {
        if (errFunc) return errFunc(s);
        return NaN;
    }
    return parseInt(s);
}
const tyrParseFloat = (s: string, errFunc: (s: string)=> number | any) => {
    if (!/^[+-]{0,1}\d+(\.\d+)?$/ig.test(s)) {
        if (errFunc) return errFunc(s);
        return NaN;
    }
    return parseFloat(s);
}
const tyrParseBoolean = (s: string, errFunc: (s: string)=> boolean | any) => {
    if (!/(true|false|1|0|yes|no)/ig.test(s)) {
        if (errFunc) return errFunc(s);
        throw new Error(`${s} 无效`);
    }
    return /(true|1|yes)/ig.test(s);
}
const checkParam = (opt: IParam, arg: string) => {
    const arr = arg.split(' ').filter(s => s);
    if (arr.length == 1) {
        if (opt.type == 'boolean') {
            return {
                name: opt.name,
                alias: opt.alias,
                value: true
            };
        } else {
            if (opt.default === undefined) {
                throw new Error(`缺少参数：${opt.name}`);
            }
            return null;
        }
    }
    const value = arr.slice(1).join(' ');
    switch (opt.type) {
        case 'string':
        case 'file':
            return {
                name: opt.name,
                alias: opt.alias,
                value
            };
        case 'int':
            return {
                name: opt.name,
                alias: opt.alias,
                value: tyrParseInt(value, opt.default === undefined ? () => { throw new Error(`${opt.name} 输入不正确，必须是：${opt.type}`) } : () => opt.default)
            }
        case 'float':
            return {
                name: opt.name,
                alias: opt.alias,
                value: tyrParseFloat(value, opt.default === undefined ? () => { throw new Error(`${opt.name} 输入不正确，必须是：${opt.type}`) } : () => opt.default)
            }
        case 'boolean':
            return {
                name: opt.name,
                alias: opt.alias,
                value: tyrParseBoolean(value, 
                    opt.default === undefined 
                        ? (s) => { throw new Error(`${opt.name} 输入不正确，必须是：true, false, yes, no`) } 
                        : (s) => opt.default
                    )
            }
        default: return null;
    }
}
const getType = (opt: IParam) => {
    return opt.type
}
const getDefault = (opt: IParam) => {
    if (opt.default || opt.default === false || opt.default === '') {
        if (typeof opt.default === 'string') {
            return ` 默认值："${opt.default}"`;
        }
        return ` 默认值：${opt.default}`;
    }
    return '';
}
const getCmdOptionName = (opt: IParam) => {
    if(opt.alias){
        return (opt.name.length > 1 ? `--${opt.name}` : `-${opt.name}`) + ', ' +
                (opt.alias.length > 1 ? `--${opt.alias}` : `-${opt.alias}`);
    }
    return opt.name.length > 1 ? `--${opt.name}` : `-${opt.name}`;
};
export default class Commands {
    private params: IParam[] = [];
    private args: string[] = [];
    private options: {[key: string]: any} = {};
    private autoShowHelp = true;
    constructor(autoShowHelp = true) {
        // this.showHelp();
        this.autoShowHelp = autoShowHelp;
        this.addParam({
            name: 'H',
            alias: 'help',
            type: 'boolean',
            default: false,
            comment: '显示帮助'
        });
    }
    public get Options() { return this.options; }
    public get Args() { return this.args; }

    public addParam(opt: IParam): Commands {
        this.params.push(opt);
        if(opt.default !== undefined){
            this.options[opt.name] = opt.default;
            if(opt.alias)
                this.options[opt.alias] = opt.default;
        }
        return this;
    }
    
    public showHelp() {
        const lines = this.params.map(item => {
            return {
                name: `${getCmdOptionName(item)} <${getType(item)}>`,
                comment: `${item.comment}${getDefault(item)}`
            }
        });
        const maxLength = Math.min(arrayMax(lines, (item)=> item.name.length) + 1, 35);
        lines.forEach((item)=>{
            console.log(`  ${item.name}${' '.repeat(maxLength - item.name.length)}`, item.comment)
        })
    }
    public parse() {
        let args = process.argv;
        let argsCount = args.length;
        if (argsCount < 3) { return this; }
        args = args.slice(2);
        let startOption = false;
        const fixArgs: string[] = [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (startOption && i > 0 && !arg.startsWith('-')) {
                fixArgs[fixArgs.length - 1] += ` ${arg}`;
            } else {
                fixArgs.push(arg);
            }
            startOption = arg.startsWith('-');
        }

        try {
            const aaa: any[] = fixArgs.map(arg => {
                const found = this.params.find((opt) => (new RegExp(`^-{1,2}(${(opt.alias? `${opt.name}|${opt.alias}` : opt.name )})`, 'g')).test(arg));
                if (found) {
                    return checkParam(found, arg);
                }

                if (arg.includes(' ')) {
                    const a = arg.split(' ').filter(s => s);
                    return {
                        name: a[0].replace(/-{0,}/ig, ''),
                        value: a.slice(1).join(' ')
                    }
                }
                return arg;
            }).filter(s=>s);
            this.args = aaa.filter(s => typeof s === 'string');
            aaa.filter(s => typeof s === 'object')
                .map(item => {
                    if(item.alias) {
                        this.options[item.alias] = item.value;
                    }
                    this.options[item.name] = item.value;
                });
            // console.log(cmdArgs, cmdParams);
            // return this;
        } catch (err) {
            console.error(err.message);
            if(this.autoShowHelp){
                this.showHelp()
            }
            process.exit(1);
        }
        if(this.options.help === true){
            this.showHelp();
            process.exit();
        }
        return this;
    }
}
