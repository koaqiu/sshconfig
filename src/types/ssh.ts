export interface IConfigItem {
    /**
     * 注释
     */
    comments: string[];
    /**
     * 别名
     */
    name: string;
    /**
     * ssh主机，域名或者IP地址
     */
    host: string;
    /**
     * 端口 默认22
     */
    port?: number;
    /**
     * 用户名
     */
    user: string;
    /**
     * 证书地址（私钥）
     */
    identityFile: string;
    otherConfigs: string[];
}

export interface IConfigFile {
    /**
     * 注释
     */
    comments: string[];
    /**
     * 版本
     */
    version: string;
    hosts: IConfigItem[];
}