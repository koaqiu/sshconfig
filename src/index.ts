#!/usr/bin/env node
import FS from 'fs';
import OS from 'os';
import PATH from 'path';
import { IConfigFile, IConfigItem } from './types/ssh';
import Oss from './libs/oss';
import md5 from 'md5';
import Commands from './libs/commands';

const CURRENT_VERSION = process.env['npm_package_version'] || '1.0.0';
const removeUndefined = (obj: any) => {
    if (!obj) return {};
    const r: any = {};
    for (const key in obj) {
        if (obj[key]) {
            r[key] = obj[key];
        }
    }
    return r;
}
const orderFunc = (a: IConfigItem, b: IConfigItem) => {
    if (a.name > b.name) {
        return 1;
    } else if (a.name < b.name) {
        return -1;
    }
    return 0;
}
const existsFolder = (path: string, autoCreate = false, mode = 0o777) => {
    if (FS.existsSync(path)) {
        return true;
    }
    if (autoCreate) {
        FS.mkdirSync(path, { recursive: true, mode });
        return true;
    }
    return false;
}
const pathJoin = (...str: string[]) => {
    if (str.length < 1) throw new Error('no path to join');
    if (str[0].startsWith('~/')) {
        str[0] = str[0].replace('~/', `${OS.homedir()}${PATH.sep}`);
    }
    if (str.length === 1) return str[0];
    //PATH.relative
    return PATH.join.apply(PATH, str).replace(/[\/\\]/ig, PATH.sep);
}
const writeSSHConfig = (config: IConfigFile) => {
    const content: string[] = [];
    content.push(`# Create By ConfigSsh(v:${config.version}) at: ${new Date()}`);
    content.push.apply(content, config.comments);
    config.hosts.map(host => {
        const lines: string[] = host.comments;
        lines.push(`Host\t${host.name}`);
        lines.push(`\tHostname\t${host.host}`);
        lines.push(`\tUser\t${host.user}`);
        if (host.port) {
            lines.push(`\Port\t${host.port}`);
        }
        lines.push(`\tIdentityFile\t${host.identityFile}`);
        return lines.concat(host.otherConfigs.map(s => `\t${s}`), '');
    }).forEach(lines => {
        content.push.apply(content, lines);
    });
    const str = content.join('\n');
    const configFilePath = pathJoin('~/.ssh/', 'config');
    if (!FS.existsSync(pathJoin('~/.ssh/'))) {
        FS.mkdirSync(pathJoin('~/.ssh/'), {
            recursive: true,
            mode: 0o700
        });
    }
    FS.writeFileSync(configFilePath, str, { mode: 0o600 });
}
const readSSHConfig = () => {
    const configFilePath = pathJoin('~/.ssh/', 'config');
    const config: IConfigFile = {
        version: CURRENT_VERSION,
        hosts: [],
        comments: []
    }
    if (!FS.existsSync(configFilePath)) {
        return config;
    }
    const content = FS.readFileSync(configFilePath).toString();
    const lines = content.split('\n').filter(s => s.length > 0).map(s => s.trim());
    // const isCreateByMe = lines.filter(s=> /#Create By ConfigSsh\(v:[0-9\.]+\)/ig.test(s)).length > 0;
    const length = lines.length;
    // if(isCreateByMe) {
    // config.version = getVersion();
    // }

    for (let i = 0; i < length; i++) {
        const line = lines[i];
        if (line.startsWith('#')) {
            const v = /# Create By ConfigSsh\(v:[0-9\.]+\)/ig.exec(line);
            if (v) {
                config.version = v[1];
            } else {
                config.comments.push(line);
            }
        } else if (/^Host\s(.+)\s{0,}/ig.test(line)) {
            // begin host
            const regName = /^Host\s(.+)\s{0,}/ig.exec(line);
            const hostItem: IConfigItem = {
                comments: [],
                name: regName ? regName[1] : '',
                host: '',
                identityFile: '',
                user: '',
                otherConfigs: []
            };
            i++;
            for (; i < length; i++) {
                const line = lines[i];
                if (line.startsWith('#')) {
                    hostItem.comments.push(line);
                    continue;
                }
                const regName = /^Host\s(.+)\s{0,}/ig.test(line);
                const regHost = /^Hostname\s(.+)\s{0,}/ig.exec(line);
                const regUser = /^User\s(.+)\s{0,}/ig.exec(line);
                const regPort = /^Port\s(\d+)\s{0,}/ig.exec(line);
                const regIdentityFile = /^IdentityFile\s(.+)\s{0,}/ig.exec(line);
                if (regHost) {
                    hostItem.host = regHost[1];
                } else if (regUser) {
                    hostItem.user = regUser[1];
                } else if (regPort) {
                    hostItem.port = parseInt(regPort[1]);
                } else if (regIdentityFile) {
                    hostItem.identityFile = regIdentityFile[1];
                } else if (!regName) {
                    hostItem.otherConfigs.push(line);
                }
                if (/^Host\s/ig.test(line)) {
                    i--;
                    break;
                }
            }
            config.hosts.push(hostItem);
        }
    }
    config.hosts = config.hosts.sort(orderFunc);
    return config;
}

const configPath = pathJoin('~/.ssh', 'ossconfig.json');
const getFilePath = (file?: string) => {
    if (!file) return file;
    if (/^[a-z]:/ig.test(file) || /^[\/\\]/ig.test(file)) {
        // 绝对路径
        return file;
    }
    return PATH.resolve(process.cwd(), file);
}
const readOssConfig = (file?: string) => {
    if (!FS.existsSync(file || configPath)) {
        return null;
    }
    return JSON.parse(FS.readFileSync(file || configPath).toString());
}
const saveOssConfig = (options: any, file?: string) => {
    existsFolder(PATH.dirname(file || configPath), true);
    FS.writeFileSync(file || configPath, JSON.stringify(options));
}
const ossObjKeyPrefix = 'appdata/sshconfig/';
let oss: Oss;
const getOss = (options: { [key: string]: any }) => {
    if (oss) { return oss; }
    const { accessKeyId, accessKeySecret, bucket, region } = options;
    const configFile = getFilePath(options['oss-config']);
    oss = new Oss(
        Object.assign(
            {}
            , readOssConfig(configFile)
            , removeUndefined({ accessKeyId, accessKeySecret, bucket, region })
        )
    );
    return oss;
}

const getConfig = async (configAtRemote: IConfigFile, configAtLocal: IConfigFile, configName: string) => {
    if (configAtLocal.hosts.some(item => item.name == configName)) {
        return 1;
    }
    const found = configAtRemote.hosts.filter(item => item.name == configName);
    if (found.length == 0) {
        return 2;
    }
    configAtLocal.hosts = configAtLocal.hosts.concat(found).sort(orderFunc);
    for (let i = 0; i < found.length; i++) {
        const item = found[i];
        const identityFile = pathJoin(item.identityFile);
        if (!FS.existsSync(identityFile)) {
            existsFolder(PATH.dirname(identityFile), true, 0o700);
            const objKey = ossObjKeyPrefix + 'keys/' + md5(item.identityFile);
            console.log('从云端下载密钥文件...', md5(item.identityFile));
            await oss.downloadFile(objKey, identityFile);
            FS.chmodSync(identityFile, 0o600);
            console.log('OK');
        }
    }
    writeSSHConfig(configAtLocal);
    return 0;
}
const putConfig = async (configAtLocal: IConfigFile, configAtRemote: IConfigFile, configName: string) => {
    if (configAtRemote.hosts.some(item => item.name == configName)) {
        return 1;
    }
    const found = configAtLocal.hosts.filter(item => item.name == configName);
    if (found.length == 0) {
        return 2;
    }
    configAtRemote.hosts = configAtRemote.hosts.concat(found).sort(orderFunc);
    for (let i = 0; i < found.length; i++) {
        const item = found[i];
        const identityFile = pathJoin(item.identityFile);
        const objKey = ossObjKeyPrefix + 'keys/' + md5(item.identityFile);
        if (! await oss.exists(objKey)) {
            console.log('上传密钥文件到云端...', md5(item.identityFile));
            await oss.uploadFile(identityFile, objKey);
            console.log('OK');
        }
    }
    console.log('上传配置文件到云端...')
    oss.uploadData(configAtRemote, ossObjKeyPrefix + 'config');
    console.log('OK')
    return 0;
}
const testOss = (options: { [key: string]: any }) => {
    const { accessKeyId, accessKeySecret, bucket, region } = options;
    const configFile = getFilePath(options['oss-config']);
    const oss = new Oss(
        Object.assign(
            {}
            , readOssConfig(configFile)
            , removeUndefined({ accessKeyId, accessKeySecret, bucket, region })
        )
    );
    console.log('测试OSS设置')
    oss.search(undefined, undefined, 1).then(result => {
        if (result.success) {
            console.log('OK');
            if (options.save) {
                saveOssConfig({ accessKeyId, accessKeySecret, bucket, region }, configFile);
            }
        } else {
            console.error('OSS错误，信息：', result.code);
        }
    });
    return oss;
}
const show = async (options: { [key: string]: any }, showLog = false) => {
    getOss(options);
    let configAtRemote: IConfigFile;
    if (await oss.exists(ossObjKeyPrefix + 'config')) {
        if (showLog) console.log('读取云端数据...')
        const buffer = await oss.downloadFile(ossObjKeyPrefix + 'config');
        configAtRemote = JSON.parse(buffer!.toString());
        configAtRemote.hosts = configAtRemote.hosts.sort(orderFunc);
        if (showLog) console.log('OK')
        if (showLog) console.log('')
    } else {
        configAtRemote = readSSHConfig();
        if (showLog) console.log('云端无数据，开始同步')
        if (showLog) console.log('上传配置文件到云端...')
        oss.uploadData(configAtRemote, ossObjKeyPrefix + 'config');
        for (let i = 0; i < configAtRemote.hosts.length; i++) {
            const item = configAtRemote.hosts[i];
            if (item.identityFile) {
                const objKey = ossObjKeyPrefix + 'keys/' + md5(item.identityFile);
                if (!await oss.exists(objKey)) {
                    if (showLog) console.log('上传密钥文件到云端...', md5(item.identityFile));
                    oss.uploadFile(pathJoin(item.identityFile), objKey);
                    if (showLog) console.log('OK')
                }
            }
        }
        if (showLog) console.log('数据上传完成')
        if (showLog) console.log('')
    }
    let configAtLocal = readSSHConfig();
    if (showLog) {
        // console.log(configAtLocal);
        console.log(`本地配置有${configAtLocal.hosts.length}个主机`);
        configAtLocal.hosts.map(item => {
            console.log('\t', item.name, item.host, item.identityFile)
        })
        console.log(`云端配置有${configAtRemote.hosts.length}个主机`);
        configAtRemote.hosts.map(item => {
            console.log('\t', item.name, item.host, item.identityFile)
        });
    }
    return [configAtLocal, configAtRemote];
}
const commands = new Commands()
    .addParam({
        name: 'oss-config',
        type: 'file',
        comment: 'OSS配置文件，JSON文件',
        default: configPath
    })
    .addParam({
        name: 'accessKeyId',
        type: 'string',
        comment: 'oss accessKeyId',
    })
    .addParam({
        name: 'accessKeySecret',
        type: 'string',
        comment: 'oss accessKeySecret',
    })
    .addParam({
        name: 'bucket',
        type: 'string',
        comment: 'oss bucket',
    })
    .addParam({
        name: 'region',
        type: 'string',
        comment: 'oss region',
    })
    .addParam({
        name: 'save',
        type: 'boolean',
        comment: '保存OSS设置',
        default: false
    })
    .parse();
const showHelp = () => {
    console.log('sshcfg <command> [options]');
    console.log('版本：', CURRENT_VERSION);
    console.log('命令：');
    console.log('  show\t\t显示ssh config配置信息');
    console.log('  get <name>\t\t从云端下载 config配置信息');
    console.log('  put <name>\t\t上传ssh config配置信息到云端');
    console.log('  test\t\t测试OSS设置是否成功');
    console.log('参数：');
    commands.showHelp();
}
const exit = (code?: number) => {
    process.exit(code);
}
(async () => {
    if (commands.Args.length == 0) {
        showHelp();
    } else {
        let r = 0;
        switch (commands.Args[0]) {
            case 'test':
                testOss(commands.Options);
                return;
            case 'show':
                show(commands.Options, true);
                return;
            case 'put': {
                if (commands.Args.length < 2) {
                    console.error('缺少参数');
                    console.error('  put <name>\t\t上传ssh config配置信息到云端');
                    return exit(99);
                }
                const configName = commands.Args[1];
                const [configAtLocal, configAtRemote] = await show(commands.Options);
                r = await putConfig(configAtLocal, configAtRemote, configName);
                break;
            }
            case 'get': {
                if (commands.Args.length < 2) {
                    console.error('缺少参数');
                    console.error('  get <name>\t\t从云端下载 config配置信息');
                    return exit(99);
                }
                const configName = commands.Args[1];
                console.log('下载', configName)
                const [configAtLocal, configAtRemote] = await show(commands.Options);
                r = await getConfig(configAtRemote, configAtLocal, configName);
                break;
            }
        }
        switch (r) {
            case 0:
                console.log('OK');
                break;
            case 1:
                console.error('目标已存在');
                exit(r);
            case 2:
                console.error('找不到目标');
                exit(r);

        }
    }
})();
