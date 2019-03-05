import FS from 'fs';
import OS from 'os';
import PATH from 'path';
import { isRegExp } from 'util';
import { IConfigFile, IConfigItem } from './types/ssh';
const CURRENT_VERSION = process.env['npm_package_version'] || '1.0.0';
const pathJoin = (...str: string[]) =>{
    if(str.length < 1) throw new Error('no path to join');
    if(str[0].startsWith('~/')) {
        str[0] = str[0].replace('~/', `${OS.homedir()}/`);
    }
    if(str.length === 1) return str[0];
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
        if(host.port){
            lines.push(`\Port\t${host.port}`);
        }
        lines.push(`\tIdentityFile\t${host.identityFile}`);
        return lines.concat(host.otherConfigs.map(s => `\t${s}`), '');
    }).forEach(lines => {
        content.push.apply(content, lines);
    });
    return content.join('\n');
}
const readSSHConfig = () =>{
    const configFilePath = pathJoin('~/.ssh/', 'config');
    const config: IConfigFile = {
        version: CURRENT_VERSION,
        hosts: [],
        comments: []
    }
    if(!FS.existsSync(configFilePath)){
        return config;
    }
    const content = FS.readFileSync(configFilePath).toString();
    const lines = content.split('\n').filter(s=> s.length > 0).map(s=> s.trim());
    // const isCreateByMe = lines.filter(s=> /#Create By ConfigSsh\(v:[0-9\.]+\)/ig.test(s)).length > 0;
    const length = lines.length;
    // if(isCreateByMe) {
        // config.version = getVersion();
    // }

    for(let i = 0; i < length; i++){
        const line = lines[i];
        if(line.startsWith('#')){
            const v = /# Create By ConfigSsh\(v:[0-9\.]+\)/ig.exec(line);
            if(v){
                config.version = v[1];
            }else{
                config.comments.push(line);
            }
        }else if(/^Host\s(.+)\s{0,}/ig.test(line)){
            // begin host
            const regName = /^Host\s(.+)\s{0,}/ig.exec(line);
            const hostItem:IConfigItem = {
                comments: [],
                name: regName ? regName[1] : '',
                host: '',
                identityFile: '',
                user: '',
                otherConfigs: []
            };
            i++;
            for(; i < length; i++){
                const line = lines[i];
                if(line.startsWith('#')){
                    hostItem.comments.push(line);
                    continue;
                }
                const regHost = /^Hostname\s(.+)\s{0,}/ig.exec(line);
                const regUser = /^User\s(.+)\s{0,}/ig.exec(line);
                const regPort = /^Port\s(\d+)\s{0,}/ig.exec(line);
                const regIdentityFile = /^IdentityFile\s(.+)\s{0,}/ig.exec(line);
                if(regHost){
                    hostItem.host  = regHost[1];
                }else if(regUser){
                    hostItem.user  = regUser[1];
                }else if(regPort){
                    hostItem.port  = parseInt(regPort[1]);
                }else if(regIdentityFile){
                    hostItem.identityFile  = regIdentityFile[1];
                }else{
                    hostItem.otherConfigs.push(line);
                }
                if(/^Host\s/ig.test(line)){
                    i--;
                    break;
                }
            }
            config.hosts.push(hostItem);
        }
    }
    return config;
}
const config = readSSHConfig();
const content = writeSSHConfig(config);
console.log(config);
console.log(content);
