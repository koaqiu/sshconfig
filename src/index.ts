import FS from 'fs';
import OS from 'os';
import PATH from 'path';
import { IConfigFile, IConfigItem } from './types/ssh';
import oss from './libs/oss';
import md5 from 'md5';

const CURRENT_VERSION = process.env['npm_package_version'] || '1.0.0';
const orderFunc = (a: IConfigItem, b: IConfigItem) => {
    if(a.name > b.name){
        return 1;
    }else if(a.name < b.name){
        return -1;
    }
    return 0;
}
const pathJoin = (...str: string[]) => {
    if (str.length < 1) throw new Error('no path to join');
    if (str[0].startsWith('~/')) {
        str[0] = str[0].replace('~/', `${OS.homedir()}/`);
    }
    if (str.length === 1) return str[0];
    //PATH.relative
    return PATH.join.apply(PATH, str);
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
    FS.writeFileSync(configFilePath, str);
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
                } else if(!regName){
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
// const config = readSSHConfig();
// const content = writeSSHConfig(config);
// console.log(config);
// console.log(content);
const ossObjKeyPrefix = 'appdata/sshconfig/';
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
            const objKey = ossObjKeyPrefix + 'keys/' + md5(item.identityFile);
            console.log('从云端下载密钥文件...', md5(item.identityFile), item.identityFile, identityFile);
            // await oss.downloadFile(objKey, identityFile);
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

(async () => {
    // const r1 = await oss.uploadFile(pathJoin('~/.ssh/', 'config'), 'config');
    // console.log(r1)
    let configAtRemote: IConfigFile;
    if (await oss.exists(ossObjKeyPrefix + 'config')) {
        console.log('读取云端数据...')
        const buffer = await oss.downloadFile(ossObjKeyPrefix + 'config');
        configAtRemote = JSON.parse(buffer!.toString());
        configAtRemote.hosts = configAtRemote.hosts.sort(orderFunc);
        console.log('OK')
        console.log('')
    } else {
        configAtRemote = readSSHConfig();
        console.log('云端无数据，开始同步')
        console.log('上传配置文件到云端...')
        oss.uploadData(configAtRemote, ossObjKeyPrefix + 'config');
        for (let i = 0; i < configAtRemote.hosts.length; i++) {
            const item = configAtRemote.hosts[i];
            if (item.identityFile) {
                const objKey = ossObjKeyPrefix + 'keys/' + md5(item.identityFile);
                if (!await oss.exists(objKey)) {
                    console.log('上传密钥文件到云端...', md5(item.identityFile));
                    oss.uploadFile(pathJoin(item.identityFile), objKey);
                    console.log('OK')
                }
            }
        }
        console.log('数据上传完成')
        console.log('')
    }
    let configAtLocal = readSSHConfig();
    // console.log(configAtLocal);
    console.log(`本地配置有${configAtLocal.hosts.length}个主机`);
    configAtLocal.hosts.map(item => {
        console.log('\t', item.name, item.host, item.identityFile)
    })
    console.log(`云端配置有${configAtRemote.hosts.length}个主机`);
    configAtRemote.hosts.map(item => {
        console.log('\t', item.name, item.host, item.identityFile)
    })

    if (process.argv.length == 4) {
        // console.log(process.argv[2], process.argv[3]);
        const configName = process.argv[3];
        let r = 0;
        switch (process.argv[2].toLowerCase()) {
            case 'put':
                r = await putConfig(configAtLocal, configAtRemote, configName);
                break;
            case 'get':
                console.log('下载', configName)
                r = await getConfig(configAtRemote, configAtLocal, configName);
                break;
        }
        switch (r) {
            case 0:
                console.log('OK');
                break;
            case 1:
                console.error('目标已存在');
                break;
            case 2:
                console.error('找不到目标');
                break;

        }
    }
})()

